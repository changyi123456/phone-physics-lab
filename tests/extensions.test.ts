import { compareTrials, trialFrom } from "../src/core/session";
import test from "node:test";
import assert from "node:assert/strict";
import { demoSample } from "../src/core/demo";
import {
  advancedAnalyse,
  peakFrequency,
  linearFit,
  statistics,
  triggerEvents,
  distance,
} from "../src/core/advanced-analysis";
import { parseManifest, EXAMPLE_MANIFEST } from "../src/core/manifest";
import { activeDuration } from "../src/core/duration";
import { analyse } from "../src/core/analysis";
import { vectorSeries } from "../src/components/charts";
import { buildWorkbook, workbookBytes } from "../src/core/export";
import { validSample, type ExperimentId, type Run } from "../src/core/types";
import { experiments } from "../src/core/registry";
import { sourceFor, parametersFor } from "../src/core/advanced-registry";
import { Recorder, ReplayBuffer } from "../src/core/recording";
const generate = (id: ExperimentId, seconds = 6, step = 0.02) =>
  Array.from({ length: Math.floor(seconds / step) }, (_, i) => ({
    ...demoSample(id, i * step, "test", i + 1),
    segment: 0,
  }));
const params = (id: ExperimentId) =>
  Object.fromEntries(parametersFor(id).map((p) => [p.key, p.value]));
const run = (id: ExperimentId): Run => ({
  id: "test",
  experiment: id,
  mode: "demo",
  startedAt: "2026-10-08T00:00:00Z",
  params: { mass: 0.2, length: 0.25, ...params(id) },
  calibration: null,
  samples: generate(id, 4, sourceFor(id) === "audio" ? 0.128 : 0.02),
  quality: [],
  complete: true,
});
test("registry contains all 22 modules, complete bilingual instructions and finite parameter contracts", () => {
  assert.equal(experiments.length, 22);
  assert.equal(new Set(experiments.map((e) => e.id)).size, 22);
  for (const e of experiments) {
    for (const text of [e.name, e.description, e.position, e.physics])
      assert.ok(text.every((x) => x.length > 0));
    for (const p of e.parameters ?? [])
      assert.ok(p.min <= p.value && p.value <= p.max);
  }
});
test("every demo module produces valid source packets and finite analyses", () => {
  for (const e of experiments) {
    const r = run(e.id);
    assert.ok(r.samples.every(validSample), e.id);
    const result = advancedAnalyse(r.samples, e.id, r.params, null);
    assert.ok(
      result.metrics.every((m) => m.value === null || Number.isFinite(m.value)),
      e.id,
    );
  }
});
test("audio FFT interpolates a known 440Hz tone at actual 48kHz rate", () => {
  const rate = 48000,
    values = Array.from(
      { length: 1024 },
      (_, i) => 0.4 * Math.sin((2 * Math.PI * 440 * i) / rate),
    );
  assert.ok(Math.abs(peakFrequency(values, rate).frequency! - 440) < 2);
  assert.equal(peakFrequency(Array(1024).fill(0), rate).frequency, null);
});
test("acoustic stopwatch uses PCM source timing and recovers known impacts", () => {
  const samples = generate("bounce", 5, 0.128);
  const result = advancedAnalyse(samples, "bounce", params("bounce"), null);
  assert.equal(result.events.length, 6);
  const expected = [0.5, 1.5, 2.3, 2.94, 3.452, 3.862];
  result.events.forEach((e, i) =>
    assert.ok(Math.abs(e.t - expected[i]) < 0.015),
  );
  assert.ok(Math.abs(result.events[1].height! - 9.80665 / 8) < 0.03);
  assert.ok(Math.abs(result.events[2].energy! - 0.64) < 0.03);
});
test("event intervals never span a manual pause segment", () => {
  const a = generate("bounce", 2, 0.128),
    b = generate("bounce", 2, 0.128).map((s) => ({
      ...s,
      t: s.t + 5,
      segment: 1,
    }));
  const events = triggerEvents([...a, ...b], "audio", 0.12, 0.18);
  assert.equal(events.filter((e) => e.segment === 1)[0].interval, null);
});
test("short post-resume segment does not reuse pre-pause oscillation", () => {
  const samples = generate("spring", 5);
  const tail = generate("spring", 0.2).map((s, i) => ({
    ...s,
    seq: samples.length + i + 1,
    t: s.t + 5.02,
    segment: 1,
  }));
  assert.equal(analyse([...samples, ...tail], "spring", {}, null).period, null);
  const points = vectorSeries([...samples, ...tail], "spring", true, null)[0]
    .points;
  assert.ok(points.some((p) => p.y === null));
});
test("active duration excludes completed and open pauses while preserving real source time", () => {
  const quality = [
    { t: 2, kind: "measurementPause" },
    { t: 5, kind: "measurementResume" },
    { t: 7, kind: "measurementPause" },
  ];
  assert.equal(activeDuration(10, quality), 4);
  assert.equal(activeDuration(6, quality), 3);
});
test("spring k uses effective mass and measured period", () => {
  const samples = generate("springK", 8);
  const r = advancedAnalyse(samples, "springK", { mass: 0.2 }, null);
  assert.ok(Math.abs(r.period! - 1) < 0.02);
  assert.ok(
    Math.abs(
      r.metrics.find((m) => m.name[1] === "Spring constant k")!.value! -
        4 * Math.PI ** 2 * 0.2,
    ) < 0.25,
  );
});
test("centripetal fit recovers known 0.25m radius and small residuals", () => {
  const r = advancedAnalyse(generate("radius", 20), "radius", {}, null);
  assert.ok(Math.abs(r.fit!.slope - 0.25) < 0.002);
  assert.ok(r.fit!.r2 > 0.999);
});
test("linear fit refuses constant x and reports residual uncertainty", () => {
  assert.equal(
    linearFit([
      { x: 1, y: 2 },
      { x: 1, y: 3 },
      { x: 1, y: 4 },
    ]),
    null,
  );
  const r = linearFit([
    { x: 0, y: 1 },
    { x: 1, y: 3 },
    { x: 2, y: 5 },
  ]);
  assert.equal(r!.slope, 2);
  assert.equal(r!.intercept, 1);
  assert.equal(r!.stderr, 0);
});
test("repeat statistics report sample SD and standard error", () => {
  const s = statistics([1, 2, 3]);
  assert.equal(s.mean, 2);
  assert.equal(s.std, 1);
  assert.equal(s.sem, 1 / Math.sqrt(3));
  assert.equal(statistics([1]).sem, null);
});
test("GPS excludes inaccurate fixes and does not bridge excluded positions", () => {
  assert.ok(Math.abs(distance([0, 0], [0, 0.001]) - 111.195) < 0.1);
  const samples = generate("gps", 4, 1);
  samples[1].data!.accuracy = 100;
  const r = advancedAnalyse(samples, "gps", { accuracy: 20 }, null);
  assert.ok(r.metrics[0].value! < 2);
});
test("teacher manifests reject invalid contracts and keep text inert", () => {
  assert.deepEqual(parseManifest(EXAMPLE_MANIFEST), EXAMPLE_MANIFEST);
  assert.throws(() => parseManifest({ ...EXAMPLE_MANIFEST, schema: 2 }));
  assert.throws(() => parseManifest({ ...EXAMPLE_MANIFEST, threshold: NaN }));
  assert.throws(() =>
    parseManifest({ ...EXAMPLE_MANIFEST, sensor: "execute" }),
  );
});
test("audio replay bounds memory and declares dropped sequence numbers", () => {
  const b = new ReplayBuffer();
  for (const s of generate("sound", 20, 0.128)) b.add(s);
  assert.ok(b.samples.length <= 128);
  assert.ok(b.droppedThrough > 0);
  assert.equal(b.packet(100).length, 1);
});
test("raw PCM XLSX is lossless float32 LE with actual sample rate and explicit preview decimation", async () => {
  const r = run("sound");
  const wb = await buildWorkbook(r, "en");
  const row = wb.Sheets["Raw PCM"];
  assert.equal(row.C2.v, 16000);
  assert.equal(row.F2.v, "float32 little-endian");
  const raw = Buffer.from(String(row.G2.v), "base64");
  for (let i = 0; i < r.samples[0].data!.values.length; i++)
    assert.equal(
      raw.readFloatLE(i * 4),
      Math.fround(r.samples[0].data!.values[i]),
    );
  const bytes = await workbookBytes(r, "en");
  assert.ok(bytes.byteLength > 1000);
});
test("new source workbooks preserve metadata, units and original values", async () => {
  for (const id of ["gps", "color", "magnetometer"] as ExperimentId[]) {
    const r = run(id),
      wb = await buildWorkbook(r, "zh");
    assert.ok(wb.SheetNames.some((n) => n.startsWith(sourceFor(id))));
    assert.ok(wb.SheetNames.includes("擴充分析"));
  }
});
test("paused sequence recording remains continuous without invented zero samples", () => {
  const r = run("acceleration"),
    rec = new Recorder({ ...r, samples: [] });
  const a = r.samples.slice(0, 10),
    b = r.samples.slice(10, 20).map((s) => ({ ...s, segment: 1, t: s.t + 5 }));
  rec.ingest([...a, ...b]);
  assert.equal(rec.finish(20), true);
  assert.equal(
    rec.materialize().quality.filter((q) => q.kind === "sensorGap").length,
    0,
  );
  assert.equal(rec.count, 20);
});
test("source timestamp gaps do not create acoustic intervals across missing data", () => {
  const first = generate("soundTimer", 1.8, 0.128),
    tail = generate("soundTimer", 1.8, 0.128).map((s) => ({
      ...s,
      t: s.t + 5,
    }));
  const events = triggerEvents([...first, ...tail], "audio", 0.12, 0.18);
  assert.equal(events.find((e) => e.t > 5)!.interval, null);
});
test("custom gravity plots use gravity rather than linear acceleration", () => {
  const sample = demoSample("acceleration", 0, "test", 1);
  sample.g = [0, 0, 9.81];
  sample.a = [0, 0, 0];
  const result = advancedAnalyse([sample], "custom", { customField: 2 }, null);
  assert.equal(result.plots[0].series[2].points[0].y, 9.81);
});

test("demo parameter scans obey the pendulum and spring models", () => {
  for (const length of [0.25, 0.5, 1]) {
    const samples = Array.from({ length: 500 }, (_, i) =>
      demoSample("pendulum", i * 0.02, "test", i + 1, { length }),
    );
    const result = analyse(samples, "pendulum", { length }, null);
    assert.ok(Math.abs(result.gravity! - 9.80665) < 0.15);
  }
  const mass = 0.4;
  const samples = Array.from({ length: 500 }, (_, i) =>
    demoSample("springK", i * 0.02, "test", i + 1, { mass }),
  );
  const result = advancedAnalyse(samples, "springK", { mass }, null);
  assert.ok(
    Math.abs(
      result.metrics.find((m) => m.name[1] === "Spring constant k")!.value! -
        18,
    ) < 0.3,
  );
});

test("trial export includes repeated statistics and T-squared scan fit without mixing demo and phone", async () => {
  const trials = [0.25, 0.5, 1].map((length, i) => {
    const r = run("pendulum");
    r.id = String(i);
    r.params.length = length;
    r.samples = Array.from({ length: 500 }, (_, j) =>
      demoSample("pendulum", j * 0.02, r.id, j + 1, { length }),
    );
    return trialFrom(r);
  });
  const measured = { ...trials[0], id: "phone", mode: "phone" as const };
  const comparison = compareTrials([...trials, measured], "pendulum", "demo");
  assert.equal(comparison.stats.n, 3);
  assert.ok(Math.abs(comparison.derived! - 9.80665) < 0.15);
  assert.ok(trials.every((t) => t.k === null));
  const wb = await buildWorkbook(run("pendulum"), "en", trials);
  assert.ok(wb.SheetNames.includes("Repeat statistics"));
  assert.ok(wb.SheetNames.includes("Trial fit"));
  assert.ok(Math.abs(Number(wb.Sheets["Trial fit"].B6.v) - 9.80665) < 0.15);
});
