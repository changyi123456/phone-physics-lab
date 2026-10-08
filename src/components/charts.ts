import { angles, median, vector, relativeAngle } from "../core/analysis";
import {
  COLORS,
  magnitude,
  subtract,
  type Sample,
  type Series,
  type ExperimentId,
  type Calibration,
} from "../core/types";
export function vectorSeries(
  samples: Sample[],
  id: ExperimentId,
  linear: boolean,
  c: Calibration | null,
): Series[] {
  const motion = samples.filter((s) => s.source === "motion");
  const dt = median(
    motion
      .slice(1)
      .map((s, i) => s.t - motion[i].t)
      .filter((v) => v > 0),
  );
  return [0, 1, 2, 3].map((axis) => ({
    name: axis < 3 ? ["x", "y", "z"][axis] : "| |",
    color: COLORS[axis],
    points: motion.flatMap((s, i) => {
      const v = vector(s, id, linear, c),
        point = { x: s.t, y: v ? (axis === 3 ? magnitude(v) : v[axis]) : null };
      return i &&
        (s.t - motion[i - 1].t > Math.max(0.15, 3 * dt) ||
          (s.segment ?? 0) !== (motion[i - 1].segment ?? 0))
        ? [{ x: s.t - 0.00001, y: null }, point]
        : [point];
    }),
  }));
}
export function angleSeries(
  samples: Sample[],
  mount: string,
  c: Calibration | null,
): Series[] {
  const ref = c ? angles(c.g, mount) : [0, 0, 0];
  return [0, 1].map((axis) => ({
    name: ["θ₁", "θ₂"][axis],
    color: COLORS[axis],
    points: samples
      .filter((s) => s.source === "motion")
      .flatMap((s, i, list) => {
        const value = s.g
          ? relativeAngle(angles(s.g, mount)[axis], ref[axis])
          : null;
        const point = { x: s.t, y: value };
        return i &&
          (s.t - list[i - 1].t > 0.2 ||
            (s.segment ?? 0) !== (list[i - 1].segment ?? 0))
          ? [{ x: s.t - 0.00001, y: null }, point]
          : [point];
      }),
  }));
}
export function centripetalSeries(
  samples: Sample[],
  c: Calibration | null,
  squared: boolean,
): Series[] {
  const bins = new Map<string, { w: number[]; a: number[] }>();
  for (const s of samples) {
    if (!s.w || !s.a || s.source !== "motion") continue;
    const k = `${s.segment ?? 0}:${Math.floor(s.t * 2)}`;
    const bin = bins.get(k) ?? { w: [], a: [] };
    bin.w.push(magnitude(c ? subtract(s.w, c.bias) : s.w));
    bin.a.push(magnitude(s.a));
    bins.set(k, bin);
  }
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  return [
    {
      name: "a",
      color: COLORS[0],
      points: Array.from(bins.values())
        .map((b) => ({ x: mean(b.w) ** (squared ? 2 : 1), y: mean(b.a) }))
        .sort((a, b) => a.x - b.x),
    },
  ];
}
