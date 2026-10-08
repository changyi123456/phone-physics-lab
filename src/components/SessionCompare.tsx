import { useState, memo } from "react";
import type { Run, Lang, Theme } from "../core/types";
import { COLORS } from "../core/types";
import { trialFrom, compareTrials, type Trial } from "../core/session";
import { getExperiment } from "../core/registry";
import { tx } from "../core/i18n";
import { Plot } from "./Plot";
export function SessionCompare({
  current,
  lang,
  theme,
  onTrials,
}: {
  current: Run | undefined;
  lang: Lang;
  theme: Theme;
  onTrials: (t: Trial[]) => void;
}) {
  const [trials, set] = useState<Trial[]>([]),
    [quantity, q] = useState<"frequency" | "period" | "k" | "radius">("period");
  const zh = lang === "zh";
  const update = (v: Trial[]) => {
    set(v);
    onTrials(v);
  };
  const { stats, scan, points, fit, derived } = compareTrials(
    trials,
    current?.experiment,
    current?.mode,
    quantity,
  );
  return (
    <details className="session panel">
      <summary>
        {zh ? "多輪比較與量測誤差" : "Trial comparison and uncertainty"} (
        {trials.length}/20)
      </summary>
      <div className="session-body">
        <p>
          {zh
            ? "只保留本頁工作階段的摘要。原始資料請逐輪下載；重新整理會清除比較。示範與實測分開比較。"
            : "Summaries stay in this page session. Download raw data per run; refresh clears comparisons. Demo and measured trials are compared separately."}
        </p>
        <div className="session-actions">
          <button
            className="button outline"
            disabled={
              !current?.complete ||
              trials.some((t) => t.id === current.id) ||
              trials.length >= 20
            }
            onClick={() => {
              if (current) update([...trials, trialFrom(current)]);
            }}
          >
            {zh ? "加入本輪比較" : "Add this trial"}
          </button>
          <button
            className="button"
            disabled={!trials.length}
            onClick={() => update([])}
          >
            {zh ? "清除比較" : "Clear trials"}
          </button>
          <label>
            {zh ? "重複量" : "Repeat quantity"}
            <select
              value={quantity}
              onChange={(e) => q(e.target.value as typeof quantity)}
            >
              <option value="period">T (s)</option>
              <option value="frequency">f (Hz)</option>
              <option value="k">k (N/m)</option>
              <option value="radius">r (m)</option>
            </select>
          </label>
        </div>
        <p className="statistics">
          n = {stats.n} · {zh ? "平均" : "Mean"} ={" "}
          {stats.mean?.toFixed(4) ?? "—"} · s = {stats.std?.toFixed(4) ?? "—"} ·
          SEM = {stats.sem?.toFixed(4) ?? "—"}
        </p>
        <Plot
          title={
            scan
              ? zh
                ? "參數掃描：T² 線性關係"
                : "Parameter scan: T² relation"
              : zh
                ? "重複量測"
                : "Repeated trials"
          }
          x={scan === "length" ? "L (m)" : scan === "mass" ? "m (kg)" : "trial"}
          y={scan ? "T² (s²)" : quantity}
          series={[{ name: "trials", color: COLORS[0], points }]}
          scatter
          theme={theme}
          empty={zh ? "加入同模組的數輪量測" : "Add trials of the same module"}
        />
        {fit ? (
          <>
            <p>
              {zh ? "最小平方法" : "Least squares"}: slope=
              {fit.slope.toFixed(4)} {scan === "length" ? "s²/m" : "s²/kg"} ·
              intercept={fit.intercept.toFixed(4)} s² · R²={fit.r2.toFixed(4)}
              {scan === "length" && fit.slope > 0
                ? ` · g=${((4 * Math.PI ** 2) / fit.slope).toFixed(3)} m/s²`
                : scan === "mass" && fit.slope > 0
                  ? ` · k=${((4 * Math.PI ** 2) / fit.slope).toFixed(3)} N/m`
                  : ""}
            </p>
            <Plot
              title={zh ? "殘差" : "Residuals"}
              x={scan === "length" ? "L (m)" : "m (kg)"}
              y="residual (s²)"
              series={[
                { name: "residual", color: COLORS[2], points: fit.residuals },
              ]}
              scatter
              small
              theme={theme}
              empty="—"
            />
          </>
        ) : null}
        <div className="event-table">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{zh ? "模組" : "Module"}</th>
                <th>T (s)</th>
                <th>f (Hz)</th>
                <th>DEMO</th>
              </tr>
            </thead>
            <tbody>
              {trials.map((t, i) => (
                <tr key={t.id}>
                  <td>{i + 1}</td>
                  <td>{tx(getExperiment(t.experiment).name, lang)}</td>
                  <td>{t.period?.toFixed(4) ?? "—"}</td>
                  <td>{t.frequency?.toFixed(3) ?? "—"}</td>
                  <td>{t.mode === "demo" ? "DEMO" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

export const MemoSessionCompare = memo(SessionCompare);
