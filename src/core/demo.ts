import { sourceFor } from "./advanced-registry";
import type { ExperimentId, Sample, Vec } from "./types";
export function demoSample(
  id: ExperimentId,
  t: number,
  runId: string,
  seq: number,
  params: Record<string, number> = {},
): Sample {
  let a: Vec = [0, 0, 0],
    w: Vec = [0, 0, 0],
    g: Vec = [0, 0, 9.81];
  if (id === "centripetal" || id === "radius") {
    const omega = 0.6 + 2 * (0.5 + 0.5 * Math.sin(t * 0.5));
    a = [0.25 * omega ** 2, 0, 0];
    w = [0, 0, omega];
    g = [a[0], 0, 9.81];
  } else if (id === "inclination") {
    const angle = (Math.sin(t * 0.6) * Math.PI) / 9;
    g = [9.81 * Math.sin(angle), 0, 9.81 * Math.cos(angle)];
  } else {
    const f =
      id === "pendulum" && params.length > 0
        ? Math.sqrt(9.80665 / params.length) / (2 * Math.PI)
        : ["spring", "springK"].includes(id) && params.mass > 0
          ? Math.sqrt(18 / params.mass) / (2 * Math.PI)
          : id === "spring"
            ? 1.5
            : 1;
    const wave = Math.sin(2 * Math.PI * f * t);
    a = [1.8 * wave, 0.4 * Math.cos(2 * Math.PI * f * t), 0.15 * wave];
    w = [1.2 * wave, 0.15 * wave, 0.05 * wave];
    g = [a[0], a[1], 9.81 + a[2]];
  }
  const source = sourceFor(id);
  let data: Sample["data"];
  if (source === "audio") {
    const rate = 16000;
    data = {
      rate,
      units: "FS",
      settings: {
        sampleRate: rate,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      values: Array.from({ length: 2048 }, (_, i) => {
        const time = t + i / rate;
        if (id === "soundTimer" || id === "bounce") {
          const times =
            id === "bounce"
              ? [0.5, 1.5, 2.3, 2.94, 3.452, 3.862]
              : [0.5, 1.5, 2.5, 3.5, 4.5];
          return times.some((x) => time >= x && time < x + 0.025)
            ? 0.7 * Math.sin(2 * Math.PI * 800 * time)
            : 0.002 * Math.sin(2 * Math.PI * 200 * time);
        }
        return (
          0.4 *
          Math.sin(
            2 *
              Math.PI *
              (id === "soundHistory" ? 300 + 100 * Math.floor(time / 2) : 440) *
              time,
          )
        );
      }),
    };
  } else if (source === "camera") {
    const y = 120 + 100 * Math.sin(t * 4);
    data = {
      values: [y, 100, 80, 0.2126 * y + 0.7152 * 100 + 0.0722 * 80],
      profile: Array.from(
        { length: 160 },
        (_, i) =>
          30 +
          180 * Math.exp(-(((i - 50) / 4) ** 2)) +
          120 * Math.exp(-(((i - 110) / 6) ** 2)),
      ),
      units: "pixel 0..255",
    };
  } else if (source === "gps")
    data = {
      values: [25.04 + t * 0.000005, 121.56 + t * 0.000008],
      accuracy: 4,
      settings: { speed: 1, altitude: 20 },
      units: "degrees",
    };
  else if (source !== "motion" && source !== "orientation")
    data = {
      values:
        source === "magnetometer"
          ? [20 * Math.sin(t), 10, 35]
          : [source === "light" ? 400 + 100 * Math.sin(t) : 10 + Math.sin(t)],
      units: { magnetometer: "µT", light: "lx" }[source],
    };
  return {
    runId,
    seq,
    source,
    data,
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
