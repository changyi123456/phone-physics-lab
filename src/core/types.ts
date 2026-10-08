export type Lang = "zh" | "en";
export type Theme = "light" | "dark";
export type ExperimentId =
  | "acceleration"
  | "gyroscope"
  | "inclination"
  | "pendulum"
  | "spring"
  | "centripetal"
  | "sound"
  | "soundHistory"
  | "soundTimer"
  | "bounce"
  | "accelSpectrum"
  | "vibration"
  | "motionTimer"
  | "springK"
  | "radius"
  | "gps"
  | "brightness"
  | "color"
  | "opticalTimer"
  | "magnetometer"
  | "light"
  | "custom";
export type Vec = [number, number, number];
export interface Sample {
  runId: string;
  seq: number;
  source:
    | "motion"
    | "orientation"
    | "audio"
    | "gps"
    | "camera"
    | "magnetometer"
    | "light";
  data?: {
    values: number[];
    rate?: number;
    accuracy?: number;
    units?: string;
    settings?: Record<string, string | number | boolean | null>;
    profile?: number[];
  };
  t: number;
  eventTime: number;
  sensorIntervalMs?: number;
  segment?: number;
  g: Vec | null;
  a: Vec | null;
  w: Vec | null;
  rawRotation: Vec | null;
  angles: Vec | null;
  screen: number;
}
export interface Capabilities {
  gravity: boolean;
  linear: boolean;
  gyro: boolean;
  orientation: boolean;
  audio?: boolean;
  gps?: boolean;
  camera?: boolean;
  magnetometer?: boolean;
  light?: boolean;
}
export interface Calibration {
  at: string;
  g: Vec;
  bias: Vec;
  count: number;
}
export interface Quality {
  t: number;
  kind: string;
  detail?: string;
}
export type Mode = "phone" | "demo";
export interface Run {
  id: string;
  experiment: ExperimentId;
  mode: Mode;
  startedAt: string;
  params: Record<string, number>;
  calibration: Calibration | null;
  samples: Sample[];
  quality: Quality[];
  complete: boolean;
  transport?: import("./timing").ArrivalInfo;
  manifest?: import("./manifest").TeacherManifest;
}
export interface Point {
  x: number;
  y: number | null;
}
export interface Series {
  name: string;
  color: string;
  points: Point[];
}
export interface Analysis {
  period: number | null;
  frequency: number | null;
  gravity: number | null;
  correlation: Point[];
  spectrum: Point[];
  axis: number;
  reason: string;
  sampleRate: number;
  count: number;
}
export const EMPTY_CAPS: Capabilities = {
  gravity: false,
  linear: false,
  gyro: false,
  orientation: false,
};
export const COLORS = ["#14a69b", "#738ceb", "#e78e42", "#b18fe3"];
export const magnitude = (v: Vec) => Math.hypot(...v);
export const subtract = (a: Vec, b: Vec): Vec => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
export function validVec(v: unknown): v is Vec {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    v.every(
      (x) => typeof x === "number" && Number.isFinite(x) && Math.abs(x) < 1e6,
    )
  );
}
export function validSample(v: unknown): v is Sample {
  if (!v || typeof v !== "object") return false;
  const s = v as Sample;
  return (
    typeof s.runId === "string" &&
    s.runId.length < 100 &&
    Number.isSafeInteger(s.seq) &&
    s.seq >= 1 &&
    [
      "motion",
      "orientation",
      "audio",
      "gps",
      "camera",
      "magnetometer",
      "light",
    ].includes(s.source) &&
    (s.data === undefined ||
      (Array.isArray(s.data.values) &&
        s.data.values.length <= 4096 &&
        s.data.values.every((x) => Number.isFinite(x) && Math.abs(x) < 1e12) &&
        (s.data.rate === undefined ||
          (Number.isFinite(s.data.rate) &&
            s.data.rate > 0 &&
            s.data.rate <= 192000)) &&
        (s.data.profile === undefined ||
          (s.data.profile.length <= 320 &&
            s.data.profile.every(
              (x) => Number.isFinite(x) && x >= 0 && x <= 255,
            ))))) &&
    Number.isFinite(s.t) &&
    s.t >= 0 &&
    s.t < 86400 &&
    Number.isFinite(s.eventTime) &&
    (s.sensorIntervalMs === undefined ||
      (Number.isFinite(s.sensorIntervalMs) &&
        s.sensorIntervalMs >= 0 &&
        s.sensorIntervalMs < 60000)) &&
    Number.isFinite(s.screen) &&
    (s.segment === undefined ||
      (Number.isSafeInteger(s.segment) && s.segment >= 0)) &&
    [s.g, s.a, s.w, s.rawRotation, s.angles].every(
      (x) => x === null || validVec(x),
    )
  );
}
export function capabilities(samples: Sample[]): Capabilities {
  const c = { ...EMPTY_CAPS };
  for (const s of samples) {
    if (s.source === "motion") {
      c.gravity ||= !!s.g;
      c.linear ||= !!s.a;
      c.gyro ||= !!s.w;
    }
    c.orientation ||= s.source === "orientation" && !!s.angles;
    if (
      s.data?.values.length &&
      s.source !== "motion" &&
      s.source !== "orientation"
    )
      c[s.source] = true;
  }
  return c;
}
