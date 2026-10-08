import { Link, type LinkStatus, type Wire } from "../platform/link";
import { analyse, calibrate, sampleRate } from "./analysis";
import { demoSample } from "./demo";
import { Recorder } from "./recording";
import { canMeasure } from "./registry";
import {
  capabilities,
  EMPTY_CAPS,
  validSample,
  type Analysis,
  type Calibration,
  type Capabilities,
  type ExperimentId,
  type Mode,
  type Run,
  type Sample,
} from "./types";
export type Phase = "idle" | "starting" | "recording" | "stopping" | "finished";
export interface LabSnapshot {
  experiment: ExperimentId;
  mode: Mode;
  phase: Phase;
  link: LinkStatus;
  code: string;
  caps: Capabilities;
  calibration: Calibration | null;
  message: string;
  recent: Sample[];
  latest: Sample | null;
  rate: number;
  count: number;
  elapsed: number;
  analysis: Analysis;
  quality: Run["quality"];
  complete: boolean;
  rtt: number;
  params: Record<string, number>;
}
export class Lab {
  readonly link = new Link();
  recorder?: Recorder;
  exported = false;
  private disposed = false;
  private listeners = new Set<() => void>();
  private preview: Sample[] = [];
  private timer: ReturnType<typeof setInterval>;
  private worker: Worker;
  private job = 0;
  private generation = 0;
  private lastAnalysis = 0;
  private lastReceived = 0;
  private demoOrigin = 0;
  private nextDemo = 0;
  private finishResolve?: () => void;
  private deadline = 0;
  state: LabSnapshot = {
    experiment: "acceleration",
    mode: "phone",
    phase: "idle",
    link: "waiting",
    code: "",
    caps: { ...EMPTY_CAPS },
    calibration: null,
    message: "",
    recent: [],
    latest: null,
    rate: 0,
    count: 0,
    elapsed: 0,
    analysis: analyse([], "acceleration", {}, null),
    quality: [],
    complete: false,
    rtt: 0,
    params: { length: 0.25 },
  };
  constructor() {
    this.link.onStatus = (s) => {
      const previous = this.state.link;
      this.patch({ link: s });
      if (
        this.recorder &&
        (this.state.phase === "recording" || this.state.phase === "stopping")
      ) {
        if (s === "disconnected")
          this.recorder.event({
            t: this.recorder.lastTime,
            kind: "networkLost",
          });
        if (s === "connected" && previous === "disconnected")
          this.recorder.event({
            t: this.recorder.lastTime,
            kind: "networkRestored",
          });
      }
    };
    this.link.welcome = () => ({
      type: "welcome",
      experiment: this.state.experiment,
      runId: this.recorder?.run.id ?? null,
      phase: this.state.phase,
      ack: this.recorder?.cursor ?? 0,
      calibrated: !!this.state.calibration,
    });
    this.link.onMessage = (p) => this.receive(p);
    this.worker = new Worker(new URL("./analysis.worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.onmessage = (e) => {
      if (e.data.job === this.job && this.state.phase !== "finished")
        this.patch({ analysis: e.data.result });
    };
    this.timer = setInterval(() => this.tick(), 100);
  }
  subscribe = (f: () => void) => {
    this.listeners.add(f);
    return () => {
      this.listeners.delete(f);
    };
  };
  getSnapshot = () => this.state;
  private patch(p: Partial<LabSnapshot>) {
    this.state = { ...this.state, ...p };
    this.listeners.forEach((f) => f());
  }
  async pair() {
    if (this.state.phase === "recording" || this.state.phase === "stopping")
      return;
    if (this.state.mode === "demo") this.usePhone();
    const previous = this.state.code;
    const code = await this.link.host();
    if (!this.disposed) {
      if (previous && previous !== code) {
        this.preview = [];
        this.patch({ caps: { ...EMPTY_CAPS }, calibration: null });
      }
      this.patch({ code });
    }
  }
  select(id: ExperimentId) {
    if (
      this.state.phase === "recording" ||
      this.state.phase === "starting" ||
      this.state.phase === "stopping"
    )
      return;
    this.generation++;
    this.recorder = undefined;
    this.exported = false;
    this.patch({
      experiment: id,
      phase: "idle",
      recent: [],
      count: 0,
      elapsed: 0,
      quality: [],
      message: "",
      analysis: analyse([], id, this.state.params, this.state.calibration),
    });
    this.link.send({ type: "select", experiment: id });
  }
  parameter(key: string, value: number) {
    if (
      this.state.phase === "recording" ||
      this.state.phase === "starting" ||
      this.state.phase === "stopping"
    )
      return;
    if (Number.isFinite(value) && value > 0 && value <= 10)
      this.patch({ params: { ...this.state.params, [key]: value } });
  }
  demo() {
    if (
      this.state.phase === "recording" ||
      this.state.phase === "starting" ||
      this.state.phase === "stopping"
    )
      return;
    this.reset();
    this.link.close();
    this.preview = [];
    this.patch({
      mode: "demo",
      link: "connected",
      code: "",
      caps: { gravity: true, linear: true, gyro: true, orientation: false },
      calibration: null,
      message: "",
      phase: "idle",
    });
  }
  usePhone() {
    this.reset();
    this.preview = [];
    this.patch({
      mode: "phone",
      link: "waiting",
      caps: { ...EMPTY_CAPS },
      calibration: null,
      message: "",
      phase: "idle",
    });
  }
  zero() {
    if (
      this.state.phase === "recording" ||
      this.state.phase === "starting" ||
      this.state.phase === "stopping"
    ) {
      this.patch({ message: "calibrationLocked" });
      return;
    }
    const c =
      this.state.mode === "demo" ||
      (this.state.link === "connected" && Date.now() - this.lastReceived < 1000)
        ? calibrate(this.preview)
        : null;
    this.patch({
      calibration: c ?? this.state.calibration,
      message: c ? "calibrated" : "calibrationFailed",
    });
    this.link.send({ type: "calibration", ok: !!c });
  }
  start(linear = false) {
    if (!["idle", "finished"].includes(this.state.phase)) return;
    if (!canMeasure(this.state.experiment, this.state.caps, linear)) {
      this.patch({ message: "unsupported" });
      return;
    }
    if (this.state.mode === "phone" && this.state.link !== "connected") {
      this.patch({ message: "noPermission" });
      return;
    }
    if (this.state.mode === "phone" && Date.now() - this.lastReceived > 2000) {
      this.patch({ message: "stale" });
      return;
    }
    const run: Run = {
      id: crypto.randomUUID(),
      experiment: this.state.experiment,
      mode: this.state.mode,
      startedAt: new Date().toISOString(),
      params: { ...this.state.params },
      calibration: this.state.calibration,
      samples: [],
      quality: [],
      complete: false,
    };
    this.recorder = new Recorder(run);
    this.exported = false;
    this.generation++;
    this.patch({
      phase: this.state.mode === "demo" ? "recording" : "starting",
      count: 0,
      elapsed: 0,
      recent: [],
      quality: [],
      complete: false,
      message: "",
      analysis: analyse([], run.experiment, run.params, run.calibration),
    });
    this.deadline = Date.now() + 10000;
    if (this.state.mode === "demo") {
      this.demoOrigin = performance.now();
      this.nextDemo = 0;
    } else
      this.link.send({
        type: "start",
        runId: run.id,
        experiment: run.experiment,
      });
  }
  finish() {
    if (this.state.phase === "finished") return Promise.resolve();
    if (!this.recorder || !["recording", "starting"].includes(this.state.phase))
      return Promise.resolve();
    this.patch({ phase: "stopping" });
    this.deadline = Date.now() + 10000;
    return new Promise<void>((resolve) => {
      this.finishResolve = resolve;
      if (this.state.mode === "demo") {
        this.recorder!.finish(this.recorder!.count);
        this.finalize();
      } else this.link.send({ type: "stop", runId: this.recorder!.run.id });
    });
  }
  private finalize() {
    if (!this.recorder) return;
    this.job++;
    const recent = this.recorder.recent();
    this.recorder.materialize();
    this.patch({
      phase: "finished",
      recent,
      analysis: analyse(
        recent,
        this.state.experiment,
        this.recorder.run.params,
        this.recorder.run.calibration,
      ),
      quality: this.recorder.run.quality.slice(),
      complete: this.recorder.run.complete,
    });
    this.finishResolve?.();
    this.finishResolve = undefined;
  }
  reset() {
    if (
      this.state.phase === "recording" ||
      this.state.phase === "starting" ||
      this.state.phase === "stopping"
    )
      return;
    this.recorder = undefined;
    this.exported = false;
    this.generation++;
    this.patch({
      phase: "idle",
      elapsed: 0,
      count: 0,
      recent: [],
      quality: [],
      analysis: analyse(
        [],
        this.state.experiment,
        this.state.params,
        this.state.calibration,
      ),
      message: "",
    });
  }
  private receive(p: Wire) {
    if (
      p.type === "preview" &&
      Array.isArray(p.samples) &&
      p.samples.length <= 256
    ) {
      const samples = p.samples.filter(validSample);
      this.preview.push(...samples);
      const t = this.preview.at(-1)?.t ?? 0;
      this.preview = this.preview.filter((s) => s.t >= t - 2).slice(-300);
      const motion = samples.filter((s) => s.source === "motion").at(-1);
      this.lastReceived = Date.now();
      this.patch({
        caps: capabilities(this.preview),
        ...(this.state.phase === "idle"
          ? {
              latest: motion ?? this.state.latest,
              rate: sampleRate(this.preview),
            }
          : {}),
      });
    }
    if (
      p.type === "batch" &&
      Array.isArray(p.samples) &&
      p.samples.length <= 256 &&
      p.runId === this.recorder?.run.id &&
      this.state.phase !== "finished"
    ) {
      const ack = this.recorder!.ingest(
        p.samples,
        typeof p.drop === "number" ? p.drop : 0,
      );
      this.link.send({ type: "ack", runId: p.runId, seq: ack });
      this.lastReceived = Date.now();
    }
    if (
      p.type === "started" &&
      p.runId === this.recorder?.run.id &&
      this.state.phase === "starting"
    )
      this.patch({ phase: "recording" });
    if (
      p.type === "stopped" &&
      p.runId === this.recorder?.run.id &&
      typeof p.seq === "number"
    ) {
      this.recorder!.finish(p.seq);
      this.finalize();
    }
    if (
      p.type === "quality" &&
      p.runId === this.recorder?.run.id &&
      typeof p.kind === "string" &&
      typeof p.t === "number"
    )
      this.recorder!.event({ t: p.t, kind: p.kind });
    if (p.type === "calibrate-request") this.zero();
    if (p.type === "resume-unavailable" && p.runId === this.recorder?.run.id) {
      this.recorder!.event({
        t: this.recorder!.lastTime,
        kind: "stopTimeout",
        detail: "Phone measurement state unavailable",
      });
      this.finalize();
    }
    if (p.type === "status" && p.hidden === true)
      this.patch({ message: "pauseSensor" });
    if (
      p.type === "status" &&
      p.hidden === false &&
      this.state.message === "pauseSensor"
    )
      this.patch({ message: "" });
  }
  private tick() {
    const now = performance.now();
    if (this.state.mode === "demo") {
      if (this.state.phase === "recording" && this.recorder) {
        const elapsed = (now - this.demoOrigin) / 1000;
        let guard = 0;
        const batch: Sample[] = [];
        while (this.nextDemo * 0.02 <= elapsed && guard++ < 100) {
          const seq = ++this.nextDemo;
          batch.push(
            demoSample(
              this.state.experiment,
              (seq - 1) * 0.02,
              this.recorder.run.id,
              seq,
            ),
          );
        }
        this.recorder.ingest(batch);
      } else if (
        this.state.phase === "idle" ||
        this.state.phase === "finished"
      ) {
        const s = demoSample(
          this.state.experiment,
          now / 1000,
          "preview",
          Math.round(now) + 1,
        );
        s.g = [0, 0, 9.81];
        s.a = [0, 0, 0];
        s.w = [0, 0, 0];
        this.preview.push(s);
        this.preview = this.preview.filter((v) => v.t > s.t - 1.5);
        if (this.state.phase === "idle") this.patch({ latest: s, rate: 50 });
      }
    }
    if (
      this.recorder &&
      ["recording", "starting", "stopping"].includes(this.state.phase)
    ) {
      const recent = this.recorder.recent();
      const latest =
        recent.filter((s) => s.source === "motion").at(-1) ?? this.state.latest;
      this.patch({
        recent,
        latest,
        count: this.recorder.count,
        elapsed: this.recorder.lastTime,
        rate: sampleRate(recent),
        quality: this.recorder.run.quality.slice(),
        rtt: this.link.rtt,
      });
      if (now - this.lastAnalysis > 600) {
        this.lastAnalysis = now;
        this.worker.postMessage({
          job: ++this.job,
          generation: this.generation,
          samples: recent,
          id: this.state.experiment,
          params: this.recorder.run.params,
          calibration: this.recorder.run.calibration,
        });
      }
      if (this.state.phase === "recording" && this.recorder.lastTime >= 600) {
        this.patch({ message: "runLimit" });
        void this.finish();
      }
      if (this.state.phase === "starting" && Date.now() > this.deadline) {
        this.recorder.event({ t: 0, kind: "startTimeout" });
        this.finalize();
      }
      if (this.state.phase === "stopping" && Date.now() > this.deadline) {
        this.recorder.event({ t: this.recorder.lastTime, kind: "stopTimeout" });
        this.finalize();
      }
      if (
        this.state.mode === "phone" &&
        this.lastReceived &&
        Date.now() - this.lastReceived > 2500 &&
        this.state.phase === "recording" &&
        this.state.message === ""
      )
        this.patch({ message: "stale" });
      if (
        this.state.message === "stale" &&
        Date.now() - this.lastReceived < 500
      )
        this.patch({ message: "" });
    }
  }
  dispose() {
    this.disposed = true;
    clearInterval(this.timer);
    this.link.close();
    this.worker.terminate();
  }
}
