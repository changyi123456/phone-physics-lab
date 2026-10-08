import type { Run, Sample, Quality } from "./types";
import { validSample } from "./types";
export class Recorder {
  private samples = new Map<number, Sample>();
  cursor = 0;
  droppedThrough = 0;
  constructor(public run: Run) {}
  ingest(batch: unknown[], drop = 0) {
    if (!Number.isSafeInteger(drop) || drop < 0 || drop > 1000000)
      return this.cursor;
    if (drop > this.droppedThrough) {
      if (drop > this.cursor)
        this.run.quality.push({
          t: this.lastTime,
          kind: "bufferDrop",
          detail: `seq ≤ ${drop}`,
        });
      this.droppedThrough = drop;
    }
    for (const item of batch) {
      if (
        validSample(item) &&
        item.runId === this.run.id &&
        !this.samples.has(item.seq)
      )
        this.samples.set(item.seq, item);
    }
    this.cursor = Math.max(this.cursor, this.droppedThrough);
    while (this.samples.has(this.cursor + 1)) this.cursor++;
    return this.cursor;
  }
  get lastTime() {
    let t = 0;
    for (const sample of this.samples.values()) t = Math.max(t, sample.t);
    return t;
  }
  get count() {
    return this.samples.size;
  }
  materialize() {
    this.run.samples = Array.from(this.samples.values()).sort(
      (a, b) => a.seq - b.seq,
    );
    for (const source of ["motion", "orientation"] as const) {
      const list = this.run.samples
        .filter((s) => s.source === source)
        .sort((a, b) => a.t - b.t);
      const intervals = list
        .slice(1)
        .map((s, i) => s.t - list[i].t)
        .filter((t) => t > 0)
        .sort((a, b) => a - b);
      const threshold = Math.max(
        0.25,
        4 * (intervals[Math.floor(intervals.length / 2)] ?? 0),
      );
      for (let i = 1; i < list.length; i++) {
        if (
          list[i].t - list[i - 1].t > threshold &&
          !this.run.quality.some(
            (q) => q.kind === "sensorGap" && q.t === list[i].t,
          )
        ) {
          this.run.quality.push({
            t: list[i].t,
            kind: "sensorGap",
            detail: `${source}; Δt=${(list[i].t - list[i - 1].t).toFixed(3)} s`,
          });
        }
      }
    }
    return this.run;
  }
  recent(seconds = 20) {
    const min = this.lastTime - seconds;
    return Array.from(this.samples.values())
      .filter((s) => s.t >= min)
      .sort((a, b) => a.t - b.t);
  }
  event(event: Quality) {
    if (
      Number.isFinite(event.t) &&
      event.t >= 0 &&
      typeof event.kind === "string" &&
      event.kind.length < 100
    )
      this.run.quality.push(event);
  }
  finish(lastSeq: number) {
    this.run.complete =
      Number.isSafeInteger(lastSeq) &&
      this.cursor >= lastSeq &&
      this.samples.size === lastSeq;
    return this.run.complete;
  }
}
export class ReplayBuffer {
  samples: Sample[] = [];
  droppedThrough = 0;
  ack = 0;
  lastSent = 0;
  lastSendAt = 0;
  add(s: Sample) {
    this.samples.push(s);
    while (
      this.samples.length > 8192 ||
      (this.samples.at(-1)?.t ?? 0) - (this.samples[0]?.t ?? 0) > 60
    ) {
      const old = this.samples.shift()!;
      this.droppedThrough = old.seq;
    }
  }
  acknowledge(seq: number) {
    if (!Number.isSafeInteger(seq) || seq < this.ack) return;
    this.ack = seq;
    this.samples = this.samples.filter((s) => s.seq > seq);
  }
  packet(now: number, force = false) {
    const resend = force || now - this.lastSendAt > 1000;
    const out = this.samples
      .filter((s) => resend || s.seq > this.lastSent)
      .slice(0, 256);
    if (out.length) {
      this.lastSent = out.at(-1)!.seq;
      this.lastSendAt = now;
    }
    return out;
  }
  reset() {
    this.samples = [];
    this.droppedThrough = 0;
    this.ack = 0;
    this.lastSent = 0;
    this.lastSendAt = 0;
  }
}
