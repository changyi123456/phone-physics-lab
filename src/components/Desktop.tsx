import { MeasurementInfo } from "./MeasurementInfo";
import type { Trial } from "../core/session";
import { MemoAdvancedData as AdvancedData } from "./AdvancedData";
import { MemoSessionCompare as SessionCompare } from "./SessionCompare";
import { TeacherConfig } from "./TeacherConfig";
import { sourceFor, limitFor } from "../core/advanced-registry";
import { categories, categoryFor } from "../core/catalog";
import { ExperimentIcon } from "./ExperimentIcon";
import { useEffect, useState, useSyncExternalStore, useRef } from "react";
import {
  Crosshair,
  Home,
  Search,
  Monitor,
  Play,
  Download,
  QrCode,
  Clock,
  Check,
  Copy,
  RefreshCw,
  ExternalLink,
  Pause,
  Square,
} from "lucide-react";
import { Lab, isActive } from "../core/lab";
import { getExperiment, experiments, canMeasure } from "../core/registry";
import { tr, tx, qualityText, type Key } from "../core/i18n";
import { angles, vector, relativeAngle } from "../core/analysis";
import {
  COLORS,
  type ExperimentId,
  type Lang,
  type Run,
  type Vec,
} from "../core/types";
import { Preferences, type PreferencesProps } from "./Preferences";
import { Instructions } from "./Instructions";
import { Plot } from "./Plot";
import { angleSeries, centripetalSeries, vectorSeries } from "./charts";
const fmt = (n: number | null | undefined, digits = 3) =>
  n === null || n === undefined || !Number.isFinite(n)
    ? "—"
    : n.toFixed(digits);
const time = (n: number) =>
  `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(n % 60)
    .toString()
    .padStart(2, "0")}`;
interface DesktopProps extends PreferencesProps {
  initialExperiment: ExperimentId;
  initialDemo: boolean;
  onHome: () => void;
  onSelection: (id: ExperimentId, demo: boolean) => void;
  registerExitGuard: (guard: (() => boolean) | null) => void;
}
export function Desktop(props: DesktopProps) {
  const [lab, setLab] = useState<Lab | null>(null);
  useEffect(() => {
    const instance = new Lab();
    instance.select(props.initialExperiment);
    if (props.initialDemo) instance.demo();
    else void instance.pair();
    setLab(instance);
    return () => instance.dispose();
  }, []);
  return lab ? (
    <Workspace lab={lab} {...props} />
  ) : (
    <div className="boot">{tr("brand", props.lang)}</div>
  );
}
function Workspace({
  lab,
  onHome,
  onSelection,
  registerExitGuard,
  initialExperiment: _initialExperiment,
  initialDemo: _initialDemo,
  ...prefs
}: DesktopProps & { lab: Lab }) {
  const { lang, theme } = prefs,
    s = useSyncExternalStore(lab.subscribe, lab.getSnapshot);
  const experiment = getExperiment(s.experiment);
  const [tab, setTab] = useState<"live" | "analysis">("live"),
    [search, setSearch] = useState(""),
    [trials, setTrials] = useState<Trial[]>([]),
    [linear, setLinear] = useState(false),
    [mount, setMount] = useState("flat"),
    [qr, setQr] = useState(""),
    [copied, setCopied] = useState(false),
    [busy, setBusy] = useState(false),
    [file, setFile] = useState<{ url: string; name: string } | null>(null),
    [exportMessage, setExportMessage] = useState("");
  const [navigationNotice, setNavigationNotice] = useState("");
  const fileRef = useRef(file);
  fileRef.current = file;
  const active = isActive(s.phase),
    url = s.code ? lab.link.url(lang, theme) : "";
  useEffect(() => {
    if (!url) {
      setQr("");
      return;
    }
    let cancelled = false;
    void import("qrcode")
      .then((m) =>
        m.toDataURL(url, { width: 220, margin: 1, errorCorrectionLevel: "M" }),
      )
      .then((data) => {
        if (!cancelled) setQr(data);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (lab.recorder?.count && !lab.exported) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [lab]);
  useEffect(
    () => () => {
      if (fileRef.current) URL.revokeObjectURL(fileRef.current.url);
    },
    [],
  );
  const clearFile = () => {
    if (file) URL.revokeObjectURL(file.url);
    setFile(null);
    setExportMessage("");
  };
  const allowClear = () =>
    !lab.recorder?.count || lab.exported || confirm(tr("leave", lang));
  useEffect(() => {
    registerExitGuard(() => {
      if (active || busy) {
        setNavigationNotice(
          lang === "zh"
            ? "請先結束量測，再返回入口。"
            : "Finish the measurement before returning home.",
        );
        return false;
      }
      return !lab.recorder?.count || lab.exported || confirm(tr("leave", lang));
    });
    return () => registerExitGuard(null);
  }, [lab, active, busy, lang, registerExitGuard]);
  useEffect(() => {
    onSelection(s.experiment, s.mode === "demo");
  }, [s.experiment, s.mode]);
  const select = (id: ExperimentId) => {
    if (active || busy || !allowClear()) return;
    clearFile();
    lab.select(id);
    setTab("live");
    setLinear(false);
  };
  const download = async () => {
    const run = lab.recorder?.materialize();
    if (!run || !run.samples.length || busy) return;
    setBusy(true);
    setExportMessage("");
    try {
      const bytes = await generateExcel(run, lang, trials);
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const next = {
        url: URL.createObjectURL(blob),
        name: `physics-${run.experiment}${run.mode === "demo" ? "-DEMO" : ""}-${run.startedAt.replace(/[:.]/g, "-")}.xlsx`,
      };
      if (file) URL.revokeObjectURL(file.url);
      setFile(next);
      lab.exported = true;
      const a = document.createElement("a");
      a.href = next.url;
      a.download = next.name;
      a.click();
      setExportMessage("downloaded");
    } catch {
      setExportMessage("exportError");
    } finally {
      setBusy(false);
    }
  };
  const finish = () => lab.finish();
  const rate = s.rate > 0 ? fmt(s.rate, 1) : "—";
  const v = s.latest
    ? vector(s.latest, s.experiment, linear, s.calibration)
    : null;
  const basic = vectorSeries(s.recent, s.experiment, linear, s.calibration);
  const chartUnit =
    s.experiment === "gyroscope" || s.experiment === "pendulum"
      ? "ω (rad/s)"
      : "a (m/s²)";
  const angle = s.latest?.g ? angles(s.latest.g, mount) : null;
  const angleRef = s.calibration ? angles(s.calibration.g, mount) : [0, 0, 0];
  const isOsc = s.experiment === "pendulum" || s.experiment === "spring";
  const statusKey = s.mode === "demo" ? "demoMode" : s.link;
  const titleKey =
    s.phase === "paused"
      ? "paused"
      : s.phase === "pausing"
        ? "pausePending"
        : s.phase === "resuming"
          ? "resumePending"
          : s.phase === "starting"
            ? "startPending"
            : s.phase === "stopping"
              ? "stopPending"
              : s.phase === "recording"
                ? "recording"
                : s.phase === "finished"
                  ? "finished"
                  : "readyToMeasure";
  return (
    <div className="desktop-shell">
      <aside className="sidebar">
        <span className="brand brand-wordmark">Phylab</span>
        <p>{tr("subtitle", lang)}</p>
        <button
          className="sidebar-home"
          onClick={onHome}
          disabled={active || busy}
        >
          <Home size={19} />
          {lang === "zh" ? "返回入口" : "Back to home"}
        </button>
        <label className="sidebar-search">
          <Search size={17} />
          <input
            className="experiment-search"
            aria-label={lang === "zh" ? "搜尋實驗" : "Search experiments"}
            placeholder={lang === "zh" ? "搜尋實驗…" : "Search experiments…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <nav aria-label={lang === "zh" ? "實驗選單" : "Experiments"}>
          {categories
            .filter((c) => c.id !== "all")
            .map((category) => {
              const matches = experiments.filter(
                (e) =>
                  categoryFor(e.id) === category.id &&
                  e.name.some((name) =>
                    name.toLowerCase().includes(search.toLowerCase()),
                  ),
              );
              return matches.length ? (
                <div className="sidebar-group" key={category.id}>
                  <h2>{tx(category.name, lang)}</h2>
                  {matches.map((e) => (
                    <button
                      key={e.id}
                      className={s.experiment === e.id ? "selected" : ""}
                      onClick={() => select(e.id)}
                      disabled={active || busy}
                      aria-current={s.experiment === e.id ? "page" : undefined}
                    >
                      <ExperimentIcon id={e.id} />
                      <span>{tx(e.name, lang)}</span>
                    </button>
                  ))}
                </div>
              ) : null;
            })}
        </nav>
        <div className="local-note">
          <Monitor size={20} />
          <span>{tr("local", lang)}</span>
        </div>
      </aside>
      <main className="workspace">
        <header className="desktop-header">
          <div>
            <h1>{tx(experiment.name, lang)}</h1>
            <p>{tx(experiment.description, lang)}</p>
          </div>
          <div className="header-actions">
            <Preferences {...prefs} />
            <button
              className="button"
              disabled={active || busy}
              onClick={() => {
                if (!allowClear()) return;
                clearFile();
                lab.reset();
                s.mode === "demo" ? lab.usePhone() : lab.demo();
              }}
            >
              {tr(s.mode === "demo" ? "exitDemo" : "demo", lang)}
            </button>
            <button
              className="button primary"
              disabled={active || busy}
              onClick={() => {
                if (s.mode === "demo") {
                  if (!allowClear()) return;
                  clearFile();
                }
                void lab.pair();
              }}
            >
              <QrCode size={17} />
              {tr("pair", lang)}
            </button>
          </div>
        </header>
        {navigationNotice ? (
          <p className="notice" role="status">
            {navigationNotice}
          </p>
        ) : null}
        <div className="workspace-columns">
          <div className="data-column">
            <Instructions
              experiment={experiment}
              lang={lang}
              demo={s.mode === "demo"}
            />
            <section className="data-panel panel">
              <div className="tabs" role="tablist">
                <button
                  role="tab"
                  aria-selected={tab === "live"}
                  className={tab === "live" ? "selected" : ""}
                  onClick={() => setTab("live")}
                >
                  {tr("live", lang)}
                </button>
                <button
                  role="tab"
                  aria-selected={tab === "analysis"}
                  className={tab === "analysis" ? "selected" : ""}
                  onClick={() => setTab("analysis")}
                >
                  {tr("analysis", lang)}
                </button>
                {s.mode === "demo" ? (
                  <span className="demo-label">{tr("demoMode", lang)}</span>
                ) : null}
              </div>
              {experiments.indexOf(experiment) >= 6 ? (
                <AdvancedData
                  view={tab}
                  result={s.advanced}
                  lang={lang}
                  theme={theme}
                />
              ) : (
                <>
                  <div className="readouts">
                    {s.experiment === "acceleration" ? (
                      <div className="segments">
                        <button
                          className={!linear ? "selected" : ""}
                          disabled={active}
                          onClick={() => setLinear(false)}
                        >
                          {tr("withG", lang)}
                        </button>
                        <button
                          className={linear ? "selected" : ""}
                          disabled={active}
                          onClick={() => setLinear(true)}
                        >
                          {tr("linear", lang)}
                        </button>
                      </div>
                    ) : s.experiment === "inclination" ? (
                      <div className="segments mounts">
                        {["flat", "upright", "side", "plane"].map((m) => (
                          <button
                            key={m}
                            className={mount === m ? "selected" : ""}
                            onClick={() => setMount(m)}
                          >
                            {tr(m as Key, lang)}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {isOsc ? (
                      <>
                        <Metric
                          label={tr("period", lang)}
                          value={fmt(s.analysis.period)}
                          unit="s"
                        />
                        <Metric
                          label={tr("frequency", lang)}
                          value={fmt(s.analysis.frequency)}
                          unit="Hz"
                        />
                        {s.experiment === "spring" ? (
                          <label className="parameter">
                            {lang === "zh"
                              ? "有效質量 (kg)"
                              : "Effective mass (kg)"}
                            <input
                              type="number"
                              min=".001"
                              max="20"
                              step=".01"
                              value={s.params.mass ?? 0.2}
                              disabled={active}
                              onChange={(e) =>
                                lab.parameter("mass", Number(e.target.value))
                              }
                            />
                          </label>
                        ) : null}
                        {s.experiment === "pendulum" ? (
                          <Metric
                            label={tr("gravity", lang)}
                            value={fmt(s.analysis.gravity)}
                            unit="m/s²"
                          />
                        ) : null}
                      </>
                    ) : s.experiment === "inclination" ? (
                      <>
                        <Metric
                          label={tr("physical", lang)}
                          value={fmt(angle?.[0], 1)}
                          unit="°"
                        />
                        <Metric
                          label={tr("relative", lang)}
                          value={fmt(
                            angle ? relativeAngle(angle[0], angleRef[0]) : null,
                            1,
                          )}
                          unit="°"
                        />
                      </>
                    ) : (
                      <>
                        {[0, 1, 2].map((i) => (
                          <Metric
                            key={i}
                            label={`${["x", "y", "z"][i]} ${tr("axis", lang)}`}
                            value={fmt(v?.[i])}
                            unit={chartUnit.includes("rad") ? "rad/s" : "m/s²"}
                          />
                        ))}
                      </>
                    )}
                    <Metric label={tr("rate", lang)} value={rate} unit="Hz" />
                  </div>
                  {tab === "analysis" && isOsc ? (
                    <>
                      <Plot
                        title={tr("autocorrelation", lang)}
                        series={[
                          {
                            name: "C",
                            color: COLORS[0],
                            points: s.analysis.correlation,
                          },
                        ]}
                        x="Δt (s)"
                        y="C"
                        theme={theme}
                        empty={tr("insufficient", lang)}
                      />
                      <Plot
                        title={tr("spectrum", lang)}
                        series={[
                          {
                            name: "A",
                            color: COLORS[1],
                            points: s.analysis.spectrum,
                          },
                        ]}
                        x="f (Hz)"
                        y={tr("relativeAmplitude", lang)}
                        theme={theme}
                        empty={tr("insufficient", lang)}
                        small
                      />
                    </>
                  ) : s.experiment === "centripetal" ? (
                    tab === "analysis" ? (
                      <>
                        <Plot
                          title={tr("relation", lang)}
                          series={centripetalSeries(
                            s.recent,
                            s.calibration,
                            false,
                          )}
                          x="ω (rad/s)"
                          y="a (m/s²)"
                          theme={theme}
                          empty={tr(
                            s.mode === "demo" ? "demoEmpty" : "empty",
                            lang,
                          )}
                          scatter
                        />
                        <Plot
                          title={tr("squareRelation", lang)}
                          series={centripetalSeries(
                            s.recent,
                            s.calibration,
                            true,
                          )}
                          x="ω² (rad²/s²)"
                          y="a (m/s²)"
                          theme={theme}
                          empty={tr(
                            s.mode === "demo" ? "demoEmpty" : "empty",
                            lang,
                          )}
                          scatter
                          small
                        />
                      </>
                    ) : (
                      <>
                        <Plot
                          title={tr("accelMagnitude", lang)}
                          series={vectorSeries(
                            s.recent,
                            "spring",
                            true,
                            s.calibration,
                          ).slice(3)}
                          x={tr("time", lang)}
                          y="a (m/s²)"
                          theme={theme}
                          empty={tr(
                            s.mode === "demo" ? "demoEmpty" : "empty",
                            lang,
                          )}
                        />
                        <Plot
                          title={tr("gyroMagnitude", lang)}
                          series={vectorSeries(
                            s.recent,
                            "gyroscope",
                            false,
                            s.calibration,
                          ).slice(3)}
                          x={tr("time", lang)}
                          y="ω (rad/s)"
                          theme={theme}
                          empty={tr(
                            s.mode === "demo" ? "demoEmpty" : "empty",
                            lang,
                          )}
                          small
                        />
                      </>
                    )
                  ) : s.experiment === "inclination" ? (
                    <>
                      <Plot
                        title={tr("anglePlot", lang)}
                        series={angleSeries(s.recent, mount, s.calibration)}
                        x={tr("time", lang)}
                        y="θ (°)"
                        theme={theme}
                        empty={tr(
                          s.mode === "demo" ? "demoEmpty" : "empty",
                          lang,
                        )}
                      />
                      <div className="analysis-note">
                        <h3>
                          {tr("physical", lang)} / {tr("relative", lang)}
                        </h3>
                        <p>{tx(experiment.physics, lang)}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Plot
                        title={tr(
                          chartUnit.includes("rad") ? "gyroPlot" : "accelPlot",
                          lang,
                        )}
                        series={basic.slice(0, 3)}
                        x={tr("time", lang)}
                        y={chartUnit}
                        theme={theme}
                        empty={tr(
                          s.mode === "demo" ? "demoEmpty" : "empty",
                          lang,
                        )}
                      />
                      <Plot
                        title={tr(
                          chartUnit.includes("rad")
                            ? "gyroMagnitude"
                            : "accelMagnitude",
                          lang,
                        )}
                        series={basic.slice(3)}
                        x={tr("time", lang)}
                        y={chartUnit}
                        theme={theme}
                        empty={tr(
                          s.mode === "demo" ? "demoEmpty" : "empty",
                          lang,
                        )}
                        small
                      />
                      {tab === "analysis" ? (
                        <div className="analysis-note">
                          <p>{tx(experiment.physics, lang)}</p>
                          <p>
                            {tr("count", lang)}: {s.count} ·{" "}
                            {experiment.formula}
                          </p>
                        </div>
                      ) : null}
                    </>
                  )}
                </>
              )}
              <div className="data-footer">
                <span>
                  {tr("count", lang)}: <b>{s.count.toLocaleString()}</b>
                </span>
                <span>
                  {tr("quality", lang)}:{" "}
                  {s.quality.length
                    ? `${s.quality.length}`
                    : tr("noIssues", lang)}
                </span>
              </div>
            </section>
            {s.experiment === "custom" ? (
              <TeacherConfig
                lang={lang}
                disabled={active || s.phase === "finished"}
                manifest={s.manifest}
                onLoad={(m) => lab.setManifest(m)}
              />
            ) : null}
            <details
              className="physics panel"
              open={!!experiment.parameters?.length}
            >
              <summary>{tr("params", lang)}</summary>
              <div>
                <p className="formula">{experiment.formula}</p>
                <p>{tx(experiment.physics, lang)}</p>
                {experiment.parameters?.map((p) => (
                  <label className="parameter" key={p.key}>
                    {tx(p.name, lang)} ({p.unit})
                    <input
                      type="number"
                      min={p.min}
                      max={p.max}
                      step={p.step}
                      value={s.params[p.key] ?? p.value}
                      disabled={active || s.phase === "finished"}
                      onChange={(e) =>
                        lab.parameter(p.key, Number(e.target.value))
                      }
                    />
                  </label>
                ))}
                {s.experiment === "pendulum" ? (
                  <label className="parameter">
                    {tr("length", lang)}
                    <input
                      type="number"
                      min=".01"
                      max="10"
                      step=".01"
                      value={s.params.length}
                      disabled={active || s.phase === "finished"}
                      onChange={(e) =>
                        lab.parameter("length", Number(e.target.value))
                      }
                    />
                  </label>
                ) : null}
              </div>
            </details>
            <MeasurementInfo
              lang={lang}
              id={s.experiment}
              mode={s.mode}
              phase={s.phase}
              timing={s.timing}
              transport={s.transport}
              customField={s.params.customField ?? 0}
            />
            <SessionCompare
              current={s.phase === "finished" ? lab.recorder?.run : undefined}
              lang={lang}
              theme={theme}
              onTrials={setTrials}
            />
            {s.quality.length ? (
              <details className="quality-list panel">
                <summary>
                  {tr("quality", lang)} ({s.quality.length})
                </summary>
                <ul>
                  {s.quality.slice(-12).map((q, i) => (
                    <li key={i}>
                      {fmt(q.t, 2)} s · {qualityText(q.kind, lang)}{" "}
                      {q.detail ?? ""}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
          <aside className="connection-panel panel">
            <h2>{tr("connection", lang)}</h2>
            <div className="connection-state">
              <i className={s.link === "connected" ? "online" : ""} />
              <div>
                <strong>{tr(statusKey as Key, lang)}</strong>
                {s.mode === "phone" ? <p>{tr("scanHelp", lang)}</p> : null}
              </div>
            </div>
            {s.mode === "phone" ? (
              <>
                <div className="qr-stage">
                  {qr ? (
                    <img
                      src={qr}
                      width="210"
                      height="210"
                      alt={
                        lang === "zh"
                          ? "手機配對 QR Code"
                          : "Phone pairing QR code"
                      }
                    />
                  ) : (
                    <QrCode size={85} strokeWidth={1} />
                  )}
                </div>
                <p className="qr-help">{tr("scanHelp", lang)}</p>
                {url ? (
                  <div className="link-actions">
                    <button
                      className="button compact"
                      onClick={() => {
                        void navigator.clipboard?.writeText(url).then(() => {
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2500);
                        });
                      }}
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}{" "}
                      {tr(copied ? "copied" : "copy", lang)}
                    </button>
                    <a
                      className="button compact"
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={tr("openPhone", lang)}
                    >
                      <ExternalLink size={15} />
                    </a>
                  </div>
                ) : null}
                {!isSecureContext || location.hostname === "localhost" ? (
                  <p className="local-warning">{tr("secure", lang)}</p>
                ) : null}
              </>
            ) : (
              <p className="demo-connection">
                {lang === "zh"
                  ? "目前使用示範訊號，可先熟悉讀值與分析。要量測真實數據，請切回手機量測。"
                  : "Explore readings and analysis with a simulated signal. Switch to phone mode to capture real data."}
              </p>
            )}
            {sourceFor(s.experiment) === "motion" ? (
              <div className="calibration-zone">
                <button
                  className="button outline wide"
                  disabled={active || (!s.caps.gravity && s.mode !== "demo")}
                  onClick={() => lab.zero()}
                >
                  <Crosshair size={18} />
                  {tr("calibrate", lang)}
                </button>
                <p>{tr(s.calibration ? "calibrated" : "zeroHelp", lang)}</p>
              </div>
            ) : null}
            {s.message ? (
              <p
                className={`notice ${s.message === "calibrated" ? "success" : ""}`}
                role="status"
              >
                {qualityText(s.message, lang)}
              </p>
            ) : null}
            <div className="measurement-control">
              <h2>{tr("control", lang)}</h2>
              <p className="muted">
                {lang === "zh"
                  ? `單輪上限 ${limitFor(s.experiment)} 秒；結束後手動下載。`
                  : `Run limit ${limitFor(s.experiment)} s; download manually after finishing.`}
              </p>
              <p className="phase-text">{tr(titleKey, lang)}</p>
              <div className="elapsed">
                <Clock size={18} />
                <span>{tr("elapsed", lang)}</span>
                <b>{time(s.elapsed)}</b>
              </div>
              <button
                className="button primary wide"
                disabled={
                  (active &&
                    s.phase !== "paused" &&
                    s.message !== "pauseTimeout") ||
                  busy ||
                  !canMeasure(
                    s.experiment,
                    s.caps,
                    linear,
                    s.params.customField,
                  ) ||
                  (s.mode === "phone" && s.link !== "connected")
                }
                onClick={() => {
                  if (s.phase === "paused" || s.message === "pauseTimeout") {
                    lab.resume();
                    return;
                  }
                  if (!allowClear()) return;
                  clearFile();
                  lab.start(linear);
                }}
              >
                <Play size={18} />
                {tr(
                  s.phase === "paused" || s.message === "pauseTimeout"
                    ? "resume"
                    : "begin",
                  lang,
                )}
              </button>
              <div className="transport-actions">
                <button
                  className="button outline wide"
                  disabled={s.phase !== "recording" || busy}
                  onClick={() => lab.pause()}
                >
                  <Pause size={18} />
                  {tr("pause", lang)}
                </button>
                <button
                  className="button finish-button wide"
                  disabled={!active || s.phase === "stopping" || busy}
                  onClick={() => void finish()}
                >
                  <Square size={18} />
                  {tr("finish", lang)}
                </button>
              </div>
              {s.phase === "finished" ? (
                <div className="finished-actions">
                  <p className={s.complete ? "success" : "warning"}>
                    {tr(s.complete ? "complete" : "partial", lang)}
                  </p>
                  <button
                    className="button outline wide"
                    disabled={busy || !s.count}
                    onClick={() => void download()}
                  >
                    <Download size={16} />
                    {tr(busy ? "exporting" : "export", lang)}
                  </button>
                  <button
                    className="button wide"
                    disabled={busy}
                    onClick={() => {
                      if (allowClear()) {
                        clearFile();
                        lab.reset();
                      }
                    }}
                  >
                    <RefreshCw size={15} />
                    {tr("newRun", lang)}
                  </button>
                </div>
              ) : null}
              {busy ? (
                <p className="muted" role="status">
                  {tr("exporting", lang)}
                </p>
              ) : null}
              {exportMessage ? (
                <p className="notice" role="status">
                  {qualityText(exportMessage, lang)}
                </p>
              ) : null}
              {file ? (
                <a
                  className="download-file"
                  href={file.url}
                  download={file.name}
                >
                  {tr("export", lang)} · .xlsx
                </a>
              ) : null}
              {s.rtt > 0 ? (
                <p className="rtt">
                  {tr("rtt", lang)} {fmt(s.rtt, 0)} ms
                </p>
              ) : null}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
function Metric({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>
        {value} <small>{unit}</small>
      </strong>
    </div>
  );
}
function generateExcel(run: Run, lang: Lang, trials: Trial[]) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const worker = new Worker(
      new URL("../core/export.worker.ts", import.meta.url),
      { type: "module" },
    );
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error("Export timeout"));
    }, 60000);
    worker.onmessage = (e) => {
      clearTimeout(timeout);
      worker.terminate();
      e.data.error ? reject(new Error(e.data.error)) : resolve(e.data.bytes);
    };
    worker.onerror = (e) => {
      clearTimeout(timeout);
      worker.terminate();
      reject(e);
    };
    worker.postMessage({ run, lang, trials });
  });
}
