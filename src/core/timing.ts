import type { Sample } from "./types";

// Acquisition, transport, display and analysis cadences are independent.
export const PHONE_FLUSH_MS = 120;
export const PHONE_PREVIEW_MS = 100;
export const UI_REFRESH_MS = 100;
export const ANALYSIS_REFRESH_MS = 600;
export const CAMERA_MIN_INTERVAL_MS = 95;
export const GENERIC_SENSOR_HZ = 20;
export const AUDIO_BLOCK_SAMPLES = 1024;
export const AUDIO_ENVELOPE_S = 0.005;
export const SAMPLING_WINDOW_S = 20;

const median = (values: number[]) => {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
export interface SamplingInfo {
  source: Sample["source"] | null;
  rateHz: number | null;
  stepS: number | null;
  eventRateHz: number | null;
  eventIntervalS: number | null;
  minIntervalS: number | null;
  maxIntervalS: number | null;
  intervalCount: number;
  windowS: number;
  blockSamples: number | null;
  blockDurationS: number | null;
  reportedIntervalS: number | null;
}
export function samplingInfo(
  samples: Sample[],
  requested?: Sample["source"],
): SamplingInfo {
  const source =
    requested ??
    (samples.some((s) => s.source === "audio")
      ? "audio"
      : samples.some((s) => s.source === "motion")
        ? "motion"
        : samples.at(-1)?.source);
  const list = samples.filter((s) => s.source === source).slice(-300);
  const last = list.at(-1);
  const current = last
    ? list.filter(
        (s) =>
          s.t >= last.t - SAMPLING_WINDOW_S &&
          s.runId === last.runId &&
          (s.segment ?? 0) === (last.segment ?? 0),
      )
    : [];
  const intervals = current.slice(1).flatMap((s, i) => {
    const dt = s.t - current[i].t;
    return Number.isFinite(dt) && dt > 0 ? [dt] : [];
  });
  const eventIntervalS = intervals.length ? median(intervals) : null;
  const audioRate =
    last?.source === "audio" &&
    Number.isFinite(last.data?.rate) &&
    last.data!.rate! > 0
      ? last.data!.rate!
      : null;
  const rateHz = audioRate ?? (eventIntervalS ? 1 / eventIntervalS : null);
  const blockSamples = audioRate ? last!.data!.values.length : null;
  const reportedMs = last?.sensorIntervalMs;
  return {
    source: source ?? null,
    rateHz,
    stepS: rateHz ? 1 / rateHz : null,
    eventRateHz: eventIntervalS ? 1 / eventIntervalS : null,
    eventIntervalS,
    minIntervalS: intervals.length ? Math.min(...intervals) : null,
    maxIntervalS: intervals.length ? Math.max(...intervals) : null,
    intervalCount: intervals.length,
    windowS: current.length > 1 ? current.at(-1)!.t - current[0].t : 0,
    blockSamples,
    blockDurationS: audioRate && blockSamples ? blockSamples / audioRate : null,
    reportedIntervalS:
      typeof reportedMs === "number" && reportedMs > 0
        ? reportedMs / 1000
        : null,
  };
}
export interface ArrivalInfo {
  packetCount: number;
  intervalCount: number;
  medianMs: number | null;
  minMs: number | null;
  maxMs: number | null;
  rttMs: number | null;
}
export function arrivalInfo(
  times: number[],
  packetCount = times.length,
  rttMs: number | null = null,
): ArrivalInfo {
  const intervals = times
    .slice(1)
    .flatMap((t, i) => (t > times[i] ? [t - times[i]] : []));
  return {
    packetCount,
    intervalCount: intervals.length,
    medianMs: intervals.length ? median(intervals) : null,
    minMs: intervals.length ? Math.min(...intervals) : null,
    maxMs: intervals.length ? Math.max(...intervals) : null,
    rttMs: rttMs && rttMs > 0 ? rttMs : null,
  };
}
