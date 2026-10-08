import type { Run } from "./types";
export function activeDuration(t: number, quality: Run["quality"]) {
  let from: number | null = null,
    paused = 0;
  for (const q of quality.slice().sort((a, b) => a.t - b.t)) {
    if (q.kind === "measurementPause" && from === null) from = q.t;
    if (q.kind === "measurementResume" && from !== null) {
      paused += Math.max(0, Math.min(t, q.t) - from);
      from = null;
    }
  }
  if (from !== null) paused += Math.max(0, t - from);
  return Math.max(0, t - paused);
}
