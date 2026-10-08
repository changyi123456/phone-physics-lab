import type {
  Analysis,
  Calibration,
  ExperimentId,
  Point,
  Sample,
  Vec,
} from "./types";
import { magnitude, subtract } from "./types";
export const median = (a: number[]) => {
  if (!a.length) return 0;
  const b = a.slice().sort((x, y) => x - y);
  return b[Math.floor(b.length / 2)];
};
const mean = (a: number[]) =>
  a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const variance = (a: number[]) => {
  const m = mean(a);
  return mean(a.map((v) => (v - m) ** 2));
};
export function sampleRate(samples: Sample[]) {
  const m = samples.filter((s) => s.source === "motion");
  const dt = m
    .slice(1)
    .map((s, i) => s.t - m[i].t)
    .filter((v) => v > 0);
  return dt.length ? 1 / median(dt) : 0;
}
export function angles(g: Vec, mount = "flat"): Vec {
  const [x, y, z] = g;
  const deg = 180 / Math.PI;
  if (mount === "upright")
    return [
      Math.atan2(z, Math.hypot(x, y)) * deg,
      Math.atan2(x, Math.abs(y)) * deg,
      0,
    ];
  if (mount === "side")
    return [
      Math.atan2(y, Math.abs(x)) * deg,
      Math.atan2(z, Math.hypot(x, y)) * deg,
      0,
    ];
  if (mount === "plane")
    return [
      Math.atan2(Math.hypot(x, y), Math.abs(z)) * deg,
      Math.atan2(y, x) * deg,
      0,
    ];
  return [
    Math.atan2(y, Math.abs(z)) * deg,
    Math.atan2(x, Math.abs(z)) * deg,
    0,
  ];
}
export const relativeAngle = (value: number, reference: number) =>
  ((value - reference + 540) % 360) - 180;
export function calibrate(samples: Sample[]): Calibration | null {
  const m = samples.filter((s) => s.source === "motion" && s.g).slice(-150);
  if (m.length < 8 || m.at(-1)!.t - m[0].t < 0.7) return null;
  const average = (field: "g" | "w"): Vec =>
    [0, 1, 2].map((i) =>
      mean(m.flatMap((s) => (s[field] ? [s[field]![i]] : []))),
    ) as Vec;
  const g = average("g");
  const bias = average("w");
  if (
    magnitude(g) < 7 ||
    magnitude(g) > 12 ||
    magnitude(bias) > 0.15 ||
    [0, 1, 2].some((i) => variance(m.map((s) => s.g![i])) > 0.08)
  )
    return null;
  if (m.some((s, i) => i > 0 && s.t - m[i - 1].t > 0.3)) return null;
  return { at: new Date().toISOString(), g, bias, count: m.length };
}
export function vector(
  s: Sample,
  id: ExperimentId,
  linear: boolean,
  calibration: Calibration | null,
): Vec | null {
  if (id === "gyroscope" || id === "pendulum")
    return s.w ? (calibration ? subtract(s.w, calibration.bias) : s.w) : null;
  if (id === "spring" || linear) return s.a;
  return s.g;
}
function latestUniform(
  samples: Sample[],
  field: "a" | "w",
  calibration: Calibration | null,
) {
  let data = samples.filter((s) => s.source === "motion" && s[field]);
  if (data.length < 30) return null;
  const dt = median(
    data
      .slice(1)
      .map((s, i) => s.t - data[i].t)
      .filter((x) => x > 0),
  );
  if (!dt || dt > 0.1) return null;
  let cut = 0;
  for (let i = 1; i < data.length; i++)
    if (data[i].t - data[i - 1].t > 3 * dt) cut = i;
  data = data.slice(cut);
  if (data.length < 30 || data.at(-1)!.t - data[0].t < 2) return null;
  const end = data.at(-1)!.t,
    start = Math.max(data[0].t, end - 511 * dt);
  const n = Math.min(512, Math.floor((end - start) / dt) + 1);
  const v = data.map((s) =>
    field === "w" && calibration ? subtract(s.w!, calibration.bias) : s[field]!,
  );
  const axis = [0, 1, 2]
    .map((i) => variance(v.map((x) => x[i])))
    .reduce((best, value, i, all) => (value > all[best] ? i : best), 0);
  const vals: number[] = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = start + i * dt;
    while (j < data.length - 2 && data[j + 1].t < t) j++;
    const d = data[j + 1].t - data[j].t;
    const u = d > 0 ? (t - data[j].t) / d : 0;
    vals.push(
      v[j][axis] + Math.max(0, Math.min(1, u)) * (v[j + 1][axis] - v[j][axis]),
    );
  }
  return { vals, dt, axis };
}
export function fftSpectrum(values: number[], dt: number): Point[] {
  let n = 1;
  while (n < values.length) n *= 2;
  const real = new Float64Array(n),
    imag = new Float64Array(n),
    avg = mean(values);
  values.forEach((v, i) => {
    real[i] =
      (v - avg) *
      (0.5 -
        0.5 * Math.cos((2 * Math.PI * i) / Math.max(1, values.length - 1)));
  });
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [real[i], real[j]] = [real[j], real[i]];
  }
  for (let len = 2; len <= n; len *= 2) {
    const theta = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let j = 0; j < len / 2; j++) {
        const c = Math.cos(theta * j),
          s = Math.sin(theta * j),
          p = i + j,
          q = p + len / 2,
          tr = real[q] * c - imag[q] * s,
          ti = real[q] * s + imag[q] * c;
        real[q] = real[p] - tr;
        imag[q] = imag[p] - ti;
        real[p] += tr;
        imag[p] += ti;
      }
    }
  }
  const power = Array.from({ length: n / 2 }, (_, i) =>
    Math.hypot(real[i], imag[i]),
  );
  const max = Math.max(...power, 1e-12);
  return power.map((p, i) => ({ x: i / (n * dt), y: p / max }));
}
export function analyse(
  samples: Sample[],
  id: ExperimentId,
  params: Record<string, number>,
  calibration: Calibration | null,
): Analysis {
  const result: Analysis = {
    period: null,
    frequency: null,
    gravity: null,
    correlation: [],
    spectrum: [],
    axis: 0,
    reason: "insufficient",
    sampleRate: sampleRate(samples),
    count: samples.length,
  };
  if (id !== "pendulum" && id !== "spring") return result;
  const u = latestUniform(samples, id === "pendulum" ? "w" : "a", calibration);
  if (!u) return result;
  const { vals, dt, axis } = u;
  result.axis = axis;
  result.spectrum = fftSpectrum(vals, dt);
  const m = mean(vals),
    centered = vals.map((v) => v - m);
  if (variance(vals) < 1e-5) return result;
  for (let lag = 0; lag <= Math.floor(vals.length / 2); lag++) {
    let sum = 0,
      a = 0,
      b = 0;
    for (let i = 0; i < vals.length - lag; i++) {
      sum += centered[i] * centered[i + lag];
      a += centered[i] ** 2;
      b += centered[i + lag] ** 2;
    }
    result.correlation.push({ x: lag * dt, y: sum / Math.sqrt(a * b || 1) });
  }
  const candidates: number[] = [];
  for (
    let k = Math.max(2, Math.round(0.2 / dt));
    k < result.correlation.length - 1;
    k++
  ) {
    const v = result.correlation[k].y!;
    if (
      v > 0.45 &&
      v > result.correlation[k - 1].y! &&
      v >= result.correlation[k + 1].y!
    )
      candidates.push(k);
  }
  if (!candidates.length) return result;
  const max = Math.max(...candidates.map((k) => result.correlation[k].y!));
  const k = candidates.find((k) => result.correlation[k].y! >= 0.85 * max)!;
  const y0 = result.correlation[k - 1].y!,
    y1 = result.correlation[k].y!,
    y2 = result.correlation[k + 1].y!;
  const denom = y0 - 2 * y1 + y2,
    shift = denom
      ? Math.max(-0.5, Math.min(0.5, (0.5 * (y0 - y2)) / denom))
      : 0;
  result.period = (k + shift) * dt;
  result.frequency = 1 / result.period;
  result.reason = "";
  if (id === "pendulum" && params.length > 0)
    result.gravity = (4 * Math.PI ** 2 * params.length) / result.period ** 2;
  return result;
}
