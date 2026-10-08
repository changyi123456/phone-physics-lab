import { useEffect, useRef, useState } from "react";
import { Check, Smartphone, RotateCw, RefreshCw } from "lucide-react";
import { Link, type LinkStatus, type Wire } from "../platform/link";
import { Sensors } from "../platform/sensors";
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
          stopping &&
          !buffer.samples.length &&
          link.send({ type: "stopped", runId: stopping, seq: finalSeq })
        ) {
          stopping = "";
          set((v) => ({ ...v, phase: "finished" }));
        }
      }
      if (preview.length && performance.now() - lastPreview > 100) {
        link.send({ type: "preview", samples: preview.slice(-256) });
        preview = [];
        lastPreview = performance.now();
      }
    };
    sensors.onSample = (sample) => {
      lastSample = Date.now();
      recent.push(sample);
      recent = recent.slice(-150);
      if (sample.runId === "preview") preview.push(sample);
      else buffer.add(sample);
    };
    sensors.onEvent = (kind) => {
      link.send({ type: "status", hidden: document.hidden });
      if (id || stopping)
        link.send({
          type: "quality",
          runId: id || stopping,
          t: Math.max(0, (performance.now() - sensors.origin) / 1000),
          kind,
        });
      set((v) => ({ ...v, message: document.hidden ? "pauseSensor" : "" }));
    };
    link.onStatus = (status) => set((v) => ({ ...v, link: status }));
    link.onMessage = (p: Wire) => {
      if (p.type === "welcome") {
        if (experiments.some((e) => e.id === p.experiment))
          set((v) => ({
            ...v,
            experiment: p.experiment as ExperimentId,
            calibrated: !!p.calibrated,
          }));
        if (
          p.runId &&
          (p.phase === "recording" ||
            p.phase === "stopping" ||
            p.phase === "starting")
        ) {
          if (p.runId === id || p.runId === stopping) {
            if (typeof p.ack === "number") buffer.acknowledge(p.ack);
            force = true;
            flush();
            if (id) link.send({ type: "started", runId: id });
          } else link.send({ type: "resume-unavailable", runId: p.runId });
        }
      }
      if (p.type === "select" && experiments.some((e) => e.id === p.experiment))
        set((v) => ({ ...v, experiment: p.experiment as ExperimentId }));
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
      if (p.type === "stop" && p.runId === id) {
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
          Date.now() - lastSample < 1500
            ? v.message === "noSensor"
              ? ""
              : v.message
            : sensors.enabled
              ? "noSensor"
              : v.message,
      }));
    }, 120);
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
        message: error instanceof Error ? error.message : "denied",
      }));
    } finally {
      set((v) => ({ ...v, requesting: false }));
    }
  };
  const experiment = getExperiment(s.experiment);
  const active = s.phase === "recording" || s.phase === "stopPending";
  return (
    <main className="phone-shell">
      <header className="phone-header">
        <div>
          <h1>{tr("brand", lang)}</h1>
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
          <h2>{tr(s.link === "connected" ? "ready" : "unpaired", lang)}</h2>
          <p>{tr(s.link === "connected" ? "connected" : s.link, lang)}</p>
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
            <span>{i + 1}</span>
            <div>
              <h3>{tr(title as "phoneEnable", lang)}</h3>
              <p>
                {body === "position"
                  ? tx(experiment.position, lang)
                  : tr(body as "safariHelp", lang)}
              </p>
            </div>
          </div>
        ))}
      </section>
      <button
        className="button primary wide phone-enable"
        disabled={s.requesting || s.enabled}
        onClick={() => void enable()}
      >
        {tr(
          s.requesting ? "requesting" : s.enabled ? "enabled" : "enable",
          lang,
        )}
      </button>
      <p className="phone-note">{tr("safariHelp", lang)}</p>
      <button
        className="button outline wide phone-zero"
        disabled={!s.enabled || s.link !== "connected" || active}
        onClick={() => engine.current?.link.send({ type: "calibrate-request" })}
      >
        <RotateCw size={19} />
        {tr("zero", lang)}
      </button>
      <p className="phone-note">
        {tr(s.calibrated ? "calibrated" : "zeroHelp", lang)}
      </p>
      {s.message ? (
        <p className="notice" role="status">
          {qualityText(s.message, lang)}
        </p>
      ) : null}
      <dl className="phone-status">
        <div>
          <dt>{tr("permission", lang)}</dt>
          <dd>{tr(s.enabled ? "enabled" : "notEnabled", lang)}</dd>
        </div>
        <div>
          <dt>{tr("rate", lang)}</dt>
          <dd>{s.rate > 0 ? s.rate.toFixed(1) : "—"} Hz</dd>
        </div>
        <div>
          <dt>{tr("phoneState", lang)}</dt>
          <dd>{qualityText(s.phase, lang)}</dd>
        </div>
      </dl>
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
