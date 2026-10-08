import { memo, useEffect, useRef } from "react";
import {
  Chart,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import type { Series, Theme } from "../core/types";
Chart.register(LinearScale, LineController, LineElement, PointElement, Tooltip);
interface Props {
  title: string;
  series: Series[];
  x: string;
  y: string;
  theme: Theme;
  empty: string;
  small?: boolean;
  scatter?: boolean;
}
export const Plot = memo(function Plot({
  title,
  series,
  x,
  y,
  theme,
  empty,
  small,
  scatter,
}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null),
    chart = useRef<Chart<"line">>(null);
  useEffect(() => {
    if (!canvas.current) return;
    chart.current = new Chart(canvas.current, {
      type: "line",
      data: { datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        parsing: false,
        normalized: true,
        plugins: {
          legend: { display: false },
          tooltip: { mode: "nearest", intersect: false },
        },
        elements: { point: { radius: 0 }, line: { borderWidth: 1.8 } },
        scales: {
          x: {
            type: "linear",
            title: { display: true, text: x },
            ticks: { maxTicksLimit: 6 },
          },
          y: {
            type: "linear",
            title: { display: true, text: y },
            ticks: { maxTicksLimit: 5 },
          },
        },
      },
    });
    return () => chart.current?.destroy();
  }, []);
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    const text = theme === "dark" ? "#a0b5b2" : "#5e7070",
      grid = theme === "dark" ? "#304541" : "#e7eeed";
    c.data.datasets = series.map((s) => ({
      label: s.name,
      data: s.points,
      borderColor: s.color,
      backgroundColor: s.color,
      pointRadius: scatter ? 2 : 0,
      showLine: !scatter,
      spanGaps: false,
    }));
    for (const key of ["x", "y"] as const) {
      const scale = c.options.scales![key]!;
      scale.grid = { color: grid };
      scale.ticks = {
        ...scale.ticks,
        color: text,
        font: {
          family: "ui-monospace, SFMono-Regular, Menlo, monospace",
          size: 11,
        },
      };
      scale.title = {
        display: true,
        text: key === "x" ? x : y,
        color: text,
        font: { family: "system-ui", size: 12 },
      };
    }
    c.update("none");
  }, [series, theme, x, y, scatter]);
  const hasData = series.some((s) => s.points.some((p) => p.y !== null));
  return (
    <section className={`plot ${small ? "small" : ""}`}>
      <div className="plot-heading">
        <h3>{title}</h3>
        <div className="legend">
          {series.map((s) => (
            <span key={s.name}>
              <i style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      </div>
      <div className="plot-canvas">
        <canvas ref={canvas} aria-label={`${title}: ${x}, ${y}`} role="img" />
        {!hasData ? <p className="plot-empty">{empty}</p> : null}
      </div>
    </section>
  );
});
