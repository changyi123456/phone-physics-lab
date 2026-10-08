import { PHONE_FLUSH_MS, PHONE_PREVIEW_MS } from "../core/timing";
import { sourceFor } from "../core/advanced-registry";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Check,
  Smartphone,
  Crosshair,
  RefreshCw,
  Monitor,
  RectangleHorizontal,
  Radio,
  ShieldCheck,
  Play,
} from "lucide-react";
import { Link, type LinkStatus, type Wire } from "../platform/link";
import { SourceHub as Sensors } from "../platform/source-hub";
import { ReplayBuffer } from "../core/recording";
import { sampleRate } from "../core/analysis";
import { getExperiment, experiments } from "../core/registry";
import { qualityText, tr, tx } from "../core/i18n";
import type { ExperimentId, Sample } from "../core/types";
import { Preferences, type PreferencesProps } from "./Preferences";
interface PhoneState {
  link: LinkStatus;
  enabled: boolean;
  requesting: boolean;
  rate: number;
  phase: string;
  experiment: ExperimentId;
  message: string;
  calibrated: boolean;
}
export function Phone({ code, ...prefs }: PreferencesProps & { code: string }) {
  const { lang } = prefs;
  const [s, set] = useState<PhoneState>({
    link: "connecting",
    enabled: false,
    requesting: false,
    rate: 0,
    phase: "idle",
    experiment: "acceleration",
    message: "",
    calibrated: false,
  });
  const engine = useRef<{ link: Link; sensors: Sensors; buffer: ReplayBuffer }>(
    null,
  );
  useEffect(() => {
    const link = new Link(),
      sensors = new Sensors(),
      buffer = new ReplayBuffer();
    engine.current = { link, sensors, buffer };
    let preview: Sample[] = [],
      recent: Sample[] = [],
      id = "",
      stopping = "",
      finalSeq = 0,
      lastPreview = 0,
      lastSample = 0,
      force = false;
    let selected: ExperimentId = "acceleration";
    let pausing = false;
    const flush = () => {
      if (!link.conn?.open) return;
      if (id || stopping) {
        const batch = buffer.packet(performance.now(), force);
        force = false;
        if (batch.length || buffer.droppedThrough > buffer.ack)
          link.send({
            type: "batch",
            runId: id || stopping,
            samples: batch,
            drop: buffer.droppedThrough,
          });
        if (
          pausing &&
          id &&
          !buffer.samples.length &&
          link.send({ type: "paused", runId: id, ...sensors.checkpoint })
        ) {
          pausing = false;
          set((v) => ({ ...v, phase: "paused" }));
        }
        if (
          stopping &&
          !buffer.samples.length &&
          link.send({ type: "stopped", runId: stopping, seq: finalSeq })
        ) {
          stopping = "";
          set((v) => ({ ...v, phase: "finished" }));
        }
      }
      if (
        preview.length &&
        performance.now() - lastPreview > PHONE_PREVIEW_MS
      ) {
        link.send({
          type: "preview",
          samples:
            sensors.source === "audio"
              ? preview.slice(-1)
              : preview.slice(-256),
        });
        preview = [];
        lastPreview = performance.now();
      }
    };
    sensors.onSample = (sample) => {
      lastSample = Date.now();
      recent.push(sample);
      recent = recent.slice(-150);
      if (sample.runId === "preview") preview.push(sample);
      else {
        buffer.add(sample);
        if (sample.source === "audio") flush();
      }
    };
    sensors.onEvent = (kind) => {
      link.send({ type: "status", hidden: document.hidden });
      if (!["background", "foreground"].includes(kind))
        link.send({ type: "sensor-error", kind });
      if (id || stopping)
        link.send({
          type: "quality",
          runId: id || stopping,
          t: Math.max(0, (performance.now() - sensors.origin) / 1000),
          kind,
        });
      set((v) => ({
        ...v,
        message: !["background", "foreground"].includes(kind)
          ? kind
          : document.hidden
            ? "pauseSensor"
            : "",
        ...(["denied", "sourceUnsupported", "audioSuspended"].includes(kind)
          ? { enabled: false }
          : {}),
      }));
    };
    link.onStatus = (status) => set((v) => ({ ...v, link: status }));
    link.onMessage = (p: Wire) => {
      if (p.type === "welcome") {
        if (experiments.some((e) => e.id === p.experiment)) {
          selected = p.experiment as ExperimentId;
          if (sensors.configure(selected))
            set((v) => ({
              ...v,
              enabled: false,
              calibrated: false,
              phase: "idle",
            }));
          set((v) => ({
            ...v,
            experiment: p.experiment as ExperimentId,
            calibrated: !!p.calibrated,
          }));
        }
        if (p.runId && !["idle", "finished"].includes(String(p.phase))) {
          if (p.runId === id || p.runId === stopping) {
            if (typeof p.ack === "number") buffer.acknowledge(p.ack);
            force = true;
            flush();
            if (id) {
              if (["pausing", "paused"].includes(String(p.phase))) {
                sensors.pause();
                pausing = true;
                flush();
              } else if (
                p.phase === "resuming" ||
                (p.phase === "recording" && sensors.paused)
              ) {
                link.send({ type: "resumed", runId: id, ...sensors.resume() });
                set((v) => ({ ...v, phase: "recording" }));
              } else if (p.phase === "stopping") {
                finalSeq = sensors.stop();
                stopping = id;
                id = "";
                pausing = false;
                flush();
              } else link.send({ type: "started", runId: id });
            }
          } else link.send({ type: "resume-unavailable", runId: p.runId });
        }
      }
      if (
        p.type === "select" &&
        experiments.some((e) => e.id === p.experiment)
      ) {
        selected = p.experiment as ExperimentId;
        const changed = sensors.configure(selected);
        set((v) => ({
          ...v,
          experiment: selected,
          ...(changed
            ? {
                enabled: false,
                calibrated: false,
                phase: "idle",
                message: "sourceChanged",
              }
            : {}),
        }));
      }
      if (
        p.type === "start" &&
        experiments.some((e) => e.id === p.experiment) &&
        typeof p.runId === "string" &&
        p.runId.length < 100 &&
        sensors.enabled
      ) {
        if (id !== p.runId) {
          buffer.reset();
          stopping = "";
          id = p.runId;
          recent = [];
          preview = [];
          sensors.start(id);
        }
        set((v) => ({
          ...v,
          phase: "recording",
          message: "",
          experiment: p.experiment as ExperimentId,
        }));
        link.send({ type: "started", runId: id });
      }
      if (p.type === "pause" && p.runId === id) {
        sensors.pause();
        pausing = true;
        force = true;
        set((v) => ({ ...v, phase: "pausePending" }));
        flush();
      }
      if (p.type === "resume" && p.runId === id) {
        pausing = false;
        link.send({ type: "resumed", runId: id, ...sensors.resume() });
        set((v) => ({ ...v, phase: "recording", message: "" }));
      }
      if (p.type === "stop" && p.runId === id) {
        pausing = false;
        finalSeq = sensors.stop();
        stopping = id;
        id = "";
        force = true;
        set((v) => ({ ...v, phase: "stopPending" }));
        flush();
      }
      if (
        p.type === "ack" &&
        p.runId === (id || stopping) &&
        typeof p.seq === "number" &&
        p.seq <= (stopping ? finalSeq : sensors.seq)
      ) {
        buffer.acknowledge(p.seq);
        flush();
      }
      if (p.type === "calibration")
        set((v) => ({
          ...v,
          calibrated: !!p.ok,
          message: p.ok ? "calibrated" : "calibrationFailed",
        }));
    };
    const timer = setInterval(() => {
      flush();
      set((v) => ({
        ...v,
        rate: Date.now() - lastSample < 1500 ? sampleRate(recent) : 0,
        message:
          sensors.paused || Date.now() - lastSample < 1500
            ? v.message === "noSensor"
              ? ""
              : v.message
            : sensors.enabled
              ? "noSensor"
              : v.message,
      }));
    }, PHONE_FLUSH_MS);
    void link.phone(code);
    return () => {
      clearInterval(timer);
      sensors.dispose();
      link.close();
      engine.current = null;
    };
  }, [code]);
  const enable = async () => {
    set((v) => ({ ...v, requesting: true, message: "" }));
    try {
      await engine.current?.sensors.enable();
      set((v) => ({ ...v, enabled: true, message: "" }));
    } catch (error) {
      set((v) => ({
        ...v,
        message:
          error instanceof Error &&
          ["secure", "sourceUnsupported", "sourceChanged"].includes(
            error.message,
          )
            ? error.message
            : "denied",
      }));
      engine.current?.link.send({
        type: "sensor-error",
        kind:
          error instanceof Error &&
          ["secure", "sourceUnsupported", "sourceChanged"].includes(
            error.message,
          )
            ? error.message
            : "denied",
      });
    } finally {
      set((v) => ({ ...v, requesting: false }));
    }
  };
  const experiment = getExperiment(s.experiment);
  const active = !["idle", "finished"].includes(s.phase);
  const source = sourceFor(s.experiment);
  const help =
    source === "audio"
      ? "audioHelp"
      : source === "camera"
        ? "cameraHelp"
        : source === "gps"
          ? "gpsHelp"
          : source === "motion"
            ? "safariHelp"
            : "genericHelp";
  return (
    <main className="phone-shell">
      <header className="phone-header">
        <div>
          <h1 className="brand-wordmark">Phylab</h1>
          <p>{tr("phoneSubtitle", lang)}</p>
        </div>
        <Preferences {...prefs} />
      </header>
      <section className="phone-ready">
        <div className="ready-icon">
          {s.link === "connected" ? (
            <Check size={29} />
          ) : (
            <Smartphone size={29} />
          )}
        </div>
        <div>
          <h2>{tr(s.link === "connected" ? "connected" : "unpaired", lang)}</h2>
          {s.link !== "connected" ? <p>{tr(s.link, lang)}</p> : null}
          <p className="current-experiment">
            {tr("current", lang)}: <strong>{tx(experiment.name, lang)}</strong>
          </p>
        </div>
      </section>
      <section className="phone-guide">
        <h2>{tr("phoneInstructions", lang)}</h2>
        {[
          ["phoneEnable", "safariHelp"],
          ["phonePosition", "position"],
          ["phoneStart", "phoneStartHelp"],
        ].map(([title, body], i) => (
          <div className="phone-step" key={title}>
            <span>0{i + 1}</span>
            <div>
              <h3>
                {i === 0 ? (
                  <Smartphone size={18} />
                ) : i === 1 ? (
                  <RectangleHorizontal size={18} />
                ) : (
                  <Monitor size={18} />
                )}
                {tr(title as "phoneEnable", lang)}
              </h3>
              <p>
                {body === "position"
                  ? source === "motion"
                    ? lang === "zh"
                      ? "固定手機，保持靜止。姿態確定後，按下方按鈕設為相對 0°。"
                      : "Secure the phone and hold it still. Confirm your reference pose, then set relative zero below."
                    : source === "camera"
                      ? lang === "zh"
                        ? "固定手機與照明，將目標放進中央取樣框。"
                        : "Fix the phone and lighting. Position the target inside the centre sampling region."
                      : tx(experiment.position, lang)
                  : body === "safariHelp"
                    ? source === "motion"
                      ? lang === "zh"
                        ? "點擊下方按鈕，允許動作與方向感測。"
                        : "Tap the button below and allow motion and orientation access."
                      : lang === "zh"
                        ? "點擊下方按鈕，允許本實驗所需的感測權限。"
                        : "Tap the button below and allow the sensors required for this experiment."
                    : tr(body as "safariHelp", lang)}
              </p>
            </div>
          </div>
        ))}
      </section>
      <button
        className="button primary wide phone-enable"
        disabled={s.requesting || s.enabled || active}
        onClick={() => void enable()}
      >
        <Radio size={19} />
        {tr(
          s.requesting ? "requesting" : s.enabled ? "enabled" : "enable",
          lang,
        )}
      </button>
      {s.enabled && engine.current?.sensors.video ? (
        <div
          className="camera-preview"
          ref={(element) => {
            const video = engine.current?.sensors.video;
            if (element && video && !element.contains(video))
              element.append(video);
          }}
        />
      ) : null}
      {source === "motion" ? (
        <>
          <button
            className="button outline wide phone-zero"
            disabled={
              !s.enabled ||
              s.link !== "connected" ||
              active ||
              !["motion", "orientation"].includes(
                engine.current?.sensors.source ?? "motion",
              )
            }
            onClick={() =>
              engine.current?.link.send({ type: "calibrate-request" })
            }
          >
            <Crosshair size={19} />
            {tr("zero", lang)}
          </button>
          <p className="phone-note">
            {tr(s.calibrated ? "calibrated" : "zeroHelp", lang)}
          </p>
        </>
      ) : null}
      {s.message ? (
        <p className="notice" role="status">
          {qualityText(s.message, lang)}
        </p>
      ) : null}
      <dl className="phone-status">
        <div>
          <dt>
            <ShieldCheck size={17} />
            {tr("permission", lang)}
          </dt>
          <dd>{tr(s.enabled ? "enabled" : "notEnabled", lang)}</dd>
        </div>
        <div>
          <dt>
            <Activity size={17} />
            {tr("rate", lang)}
          </dt>
          <dd>{s.rate > 0 ? s.rate.toFixed(1) : "—"} Hz</dd>
        </div>
        <div>
          <dt>
            <Play size={17} />
            {tr("phoneState", lang)}
          </dt>
          <dd>{qualityText(s.phase, lang)}</dd>
        </div>
      </dl>
      <details className="sensor-details">
        <summary>
          {lang === "zh"
            ? "實驗擺放與感測說明"
            : "Positioning & sensor details"}
        </summary>
        <p>{tx(experiment.position, lang)}</p>
        <p>{tr(help, lang)}</p>
      </details>
      <section className="phone-footer">
        <p>{tr("keepOpen", lang)}</p>
        <button
          className="button outline"
          disabled={active}
          onClick={() => {
            const engineNow = engine.current;
            if (engineNow) void engineNow.link.phone(code);
          }}
        >
          <RefreshCw size={16} />
          {tr("retry", lang)}
        </button>
      </section>
    </main>
  );
}
