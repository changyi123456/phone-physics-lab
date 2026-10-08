import type { ExperimentId, Sample, Vec } from "./types";
export function demoSample(
  id: ExperimentId,
  t: number,
  runId: string,
  seq: number,
): Sample {
  let a: Vec = [0, 0, 0],
    w: Vec = [0, 0, 0],
    g: Vec = [0, 0, 9.81];
  if (id === "centripetal") {
    const omega = 0.6 + 2 * (0.5 + 0.5 * Math.sin(t * 0.5));
    a = [0.25 * omega ** 2, 0, 0];
    w = [0, 0, omega];
    g = [a[0], 0, 9.81];
  } else if (id === "inclination") {
    const angle = (Math.sin(t * 0.6) * Math.PI) / 9;
    g = [9.81 * Math.sin(angle), 0, 9.81 * Math.cos(angle)];
  } else {
    const f = id === "spring" ? 1.5 : 1;
    const wave = Math.sin(2 * Math.PI * f * t);
    a = [1.8 * wave, 0.4 * Math.cos(2 * Math.PI * f * t), 0.15 * wave];
    w = [1.2 * wave, 0.15 * wave, 0.05 * wave];
    g = [a[0], a[1], 9.81 + a[2]];
  }
  return {
    runId,
    seq,
    source: "motion",
    t,
    eventTime: t * 1000,
    g,
    a,
    w,
    rawRotation: w.map((x) => (x * 180) / Math.PI) as Vec,
    angles: null,
    screen: 0,
  };
}
