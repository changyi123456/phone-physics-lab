import { useEffect, useRef, memo } from "react";
import type { Lang, Theme } from "../core/types";
import type {
  AdvancedAnalysis,
  FrameSpectrum,
} from "../core/advanced-analysis";
import { tx } from "../core/i18n";
import { Plot } from "./Plot";
export function Heatmap({
  frames,
  lang,
  theme,
}: {
  frames: FrameSpectrum[];
  lang: Lang;
  theme: Theme;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const w = 800,
      h = 220;
    c.width = w;
    c.height = h;
    ctx.fillStyle = theme === "dark" ? "#111d30" : "#f9fbfe";
    ctx.fillRect(0, 0, w, h);
    const data = frames.slice(-500);
    if (!data.length) return;
    const start = data[0].t,
      end = data.at(-1)!.t,
      maxF = Math.max(...data.map((f) => f.maxFrequency));
    for (let i = 0; i < data.length; i++) {
      const f = data[i],
        next = data[i + 1],
        x = 60 + ((f.t - start) / Math.max(0.1, end - start)) * 710;
      const width =
        next && next.segment === f.segment
          ? Math.min(
              25,
              ((next.t - f.t) / Math.max(0.1, end - start)) * 710 + 1,
            )
          : 2;
      for (let j = 0; j < f.values.length; j++) {
        const level = Math.max(
          0,
          Math.min(1, (20 * Math.log10(Math.max(1e-6, f.values[j])) + 60) / 60),
        );
        ctx.fillStyle = `hsl(${220 - level * 190} 85% ${20 + level * 40}%)`;
        const y = 185 - ((j / f.values.length) * 160 * f.maxFrequency) / maxF;
        ctx.fillRect(
          x,
          y,
          Math.max(1, width),
          Math.ceil(160 / f.values.length) + 1,
        );
      }
    }
    ctx.fillStyle = theme === "dark" ? "#96a8c3" : "#62748f";
    ctx.font = "13px system-ui";
    ctx.fillText(`${Math.round(maxF)} Hz`, 5, 20);
    ctx.fillText("0 Hz", 16, 187);
    ctx.fillText(`${start.toFixed(2)} s`, 60, 215);
    ctx.fillText(`${end.toFixed(2)} s`, 730, 215);
  }, [frames, theme]);
  return (
    <section className="plot">
      <div className="plot-heading">
        <h3>{lang === "zh" ? "頻率–時間熱圖" : "Frequency–time heatmap"}</h3>
        <span className="muted">−60 … 0 dB relative</span>
      </div>
      <canvas
        className="heatmap"
        ref={canvas}
        role="img"
        aria-label={lang === "zh" ? "頻率時間熱圖" : "Frequency-time heatmap"}
      />
    </section>
  );
}
export function AdvancedData({
  result,
  lang,
  theme,
  view,
}: {
  view: "live" | "analysis";
  result: AdvancedAnalysis;
  lang: Lang;
  theme: Theme;
}) {
  const zh = lang === "zh";
  const timePlots = result.plots.filter((p) => p.x === "t (s)");
  const analysisPlots = result.plots.filter((p) => p.x !== "t (s)");
  const visible = (
    view === "live"
      ? timePlots.length
        ? timePlots
        : result.plots.slice(0, 1)
      : analysisPlots.length
        ? analysisPlots
        : result.plots
  )
    .slice()
    .sort((a, b) =>
      view === "live"
        ? Number(b.title[1].includes("history")) -
          Number(a.title[1].includes("history"))
        : 0,
    );
  return (
    <>
      <div className="readouts">
        {result.metrics.length ? (
          result.metrics.map((m) => (
            <div className="metric" key={m.name[1]}>
              <span>{tx(m.name, lang)}</span>
              <strong>
                {m.value === null
                  ? "—"
                  : Number.isInteger(m.value)
                    ? m.value
                    : m.value.toFixed(3)}{" "}
                <small>{m.unit}</small>
              </strong>
            </div>
          ))
        ) : (
          <p className="muted">
            {zh
              ? "啟用手機感測器後開始量測，圖表會隨資料更新。"
              : "Enable the phone sensor and start measuring to populate the charts."}
          </p>
        )}
      </div>
      {visible.map((p, i) => (
        <Plot
          key={`${p.title[1]}-${i}`}
          title={tx(p.title, lang)}
          x={p.x}
          y={p.y}
          series={p.series}
          theme={theme}
          empty={zh ? "等待本輪感測數據" : "Waiting for run data"}
          scatter={p.scatter}
          small={i > 0}
        />
      ))}
      {view === "live" && result.heatmap.length > 1 ? (
        <Heatmap frames={result.heatmap} lang={lang} theme={theme} />
      ) : null}
      {view === "analysis" && result.events.length ? (
        <div className="event-table">
          <h3>
            {zh
              ? "事件時間與模型結果（請確認漏觸發／誤觸發）"
              : "Event times and model results (inspect missed / false triggers)"}
          </h3>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>t (s)</th>
                <th>Δt (s)</th>
                <th>h (m)*</th>
                <th>E/E₀*</th>
              </tr>
            </thead>
            <tbody>
              {result.events.map((e, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{e.t.toFixed(4)}</td>
                  <td>{e.interval?.toFixed(4) ?? "—"}</td>
                  <td>{e.height?.toFixed(4) ?? "—"}</td>
                  <td>{e.energy?.toFixed(3) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">
            {zh
              ? "* 只有垂直反彈實驗能解讀高度及相對能量。"
              : "* Height and relative energy apply only to a vertical bounce experiment."}
          </p>
        </div>
      ) : null}
      <p className="analysis-note">{tx(result.note, lang)}</p>
    </>
  );
}

export const MemoAdvancedData = memo(AdvancedData);
