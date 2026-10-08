import type { Sample, Vec } from "../core/types";
interface PermissionSource {
  requestPermission?: () => Promise<string>;
}
const read = (
  a: number | null | undefined,
  b: number | null | undefined,
  c: number | null | undefined,
): Vec | null =>
  [a, b, c].every((v) => typeof v === "number" && Number.isFinite(v))
    ? [a!, b!, c!]
    : null;
export function rotationToXYZ(
  r: { alpha: number | null; beta: number | null; gamma: number | null } | null,
): { w: Vec | null; raw: Vec | null } {
  const raw = r ? read(r.beta, r.gamma, r.alpha) : null;
  return { raw, w: (raw?.map((v) => (v * Math.PI) / 180) as Vec) ?? null };
}
export async function requestAccess(
  m: PermissionSource | undefined,
  o: PermissionSource | undefined,
) {
  const ask = (s: PermissionSource | undefined) => {
    if (!s) return Promise.resolve(false);
    try {
      return s.requestPermission
        ? s.requestPermission().then(
            (v) => v === "granted",
            () => false,
          )
        : Promise.resolve(true);
    } catch {
      return Promise.resolve(false);
    }
  };
  const [motion, orientation] = await Promise.all([ask(m), ask(o)]);
  return { motion, orientation };
}
export class Sensors {
  onSample?: (s: Sample) => void;
  onEvent?: (kind: string) => void;
  enabled = false;
  runId = "";
  seq = 0;
  origin = 0;
  private previewSeq = 0;
  private wake?: WakeLockSentinel;
  async enable() {
    if (!isSecureContext) throw new Error("secure");
    const m = window.DeviceMotionEvent as unknown as
        | PermissionSource
        | undefined,
      o = window.DeviceOrientationEvent as unknown as
        | PermissionSource
        | undefined;
    const allowed = await requestAccess(m, o);
    if (!allowed.motion && !allowed.orientation) throw new Error("denied");
    this.remove();
    if (allowed.motion) window.addEventListener("devicemotion", this.motion);
    if (allowed.orientation)
      window.addEventListener("deviceorientation", this.orientation);
    document.addEventListener("visibilitychange", this.visibility);
    this.enabled = true;
    void this.keepAwake();
    return allowed;
  }
  start(id: string) {
    this.runId = id;
    this.seq = 0;
    this.origin = performance.now();
  }
  stop() {
    const seq = this.seq;
    this.runId = "";
    return seq;
  }
  private sample(source: "motion" | "orientation", e: Event) {
    const eventTime =
      e.timeStamp > 1e12 ? e.timeStamp - performance.timeOrigin : e.timeStamp;
    const running = !!this.runId;
    const relative = (eventTime - (running ? this.origin : 0)) / 1000;
    if (relative < 0) return null;
    return {
      runId: running ? this.runId : "preview",
      seq: running ? ++this.seq : ++this.previewSeq,
      source,
      t: relative,
      eventTime,
      g: null,
      a: null,
      w: null,
      rawRotation: null,
      angles: null,
      screen:
        screen.orientation?.angle ??
        (window as unknown as { orientation?: number }).orientation ??
        0,
    } as Sample;
  }
  private motion = (e: DeviceMotionEvent) => {
    if (document.hidden) return;
    const s = this.sample("motion", e);
    if (!s) return;
    s.g = read(
      e.accelerationIncludingGravity?.x,
      e.accelerationIncludingGravity?.y,
      e.accelerationIncludingGravity?.z,
    );
    s.a = read(e.acceleration?.x, e.acceleration?.y, e.acceleration?.z);
    const rot = rotationToXYZ(e.rotationRate);
    s.w = rot.w;
    s.rawRotation = rot.raw;
    this.onSample?.(s);
  };
  private orientation = (e: DeviceOrientationEvent) => {
    if (document.hidden) return;
    const s = this.sample("orientation", e);
    if (!s) return;
    s.angles = read(e.alpha, e.beta, e.gamma);
    this.onSample?.(s);
  };
  private visibility = () => {
    this.onEvent?.(document.hidden ? "background" : "foreground");
    if (!document.hidden) void this.keepAwake();
  };
  private async keepAwake() {
    try {
      this.wake = await navigator.wakeLock?.request("screen");
    } catch {}
  }
  private remove() {
    window.removeEventListener("devicemotion", this.motion);
    window.removeEventListener("deviceorientation", this.orientation);
    document.removeEventListener("visibilitychange", this.visibility);
  }
  dispose() {
    this.remove();
    void this.wake?.release();
  }
}
