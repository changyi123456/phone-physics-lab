import { test } from "node:test";
import assert from "node:assert/strict";
import { samplingInfo, arrivalInfo } from "../src/core/timing";
import { sampleRate } from "../src/core/analysis";
import { unitsFor } from "../src/core/measurement-info";
import { experiments } from "../src/core/registry";
import { demoSample } from "../src/core/demo";
import { advancedAnalyse } from "../src/core/advanced-analysis";
import { buildWorkbook } from "../src/core/export";
import type { Sample, Run } from "../src/core/types";
import * as XLSX from "xlsx";
const rows = (wb: XLSX.WorkBook, name: string) =>
  XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1 });
test("timing separates 48 kHz PCM samples from 1024-point source blocks and network batching", () => {
  const audio = Array.from({ length: 6 }, (_, i) => ({
    ...demoSample("sound", (i * 1024) / 48000, "audio", i + 1),
    data: { values: Array(1024).fill(0), rate: 48000 },
  }));
  const info = samplingInfo(audio);
  assert.equal(info.rateHz, 48000);
  assert.ok(Math.abs(info.stepS! - 20.833333333e-6) < 1e-12);
  assert.ok(Math.abs(info.eventIntervalS! - 1024 / 48000) < 1e-12);
  assert.equal(info.blockSamples, 1024);
  assert.equal(info.blockDurationS, 1024 / 48000);
  assert.equal(sampleRate(audio), 48000);
  assert.equal(arrivalInfo([0, 120, 240, 360]).medianMs, 120);
});
test("source cadence excludes orientation, previous runs and pause segments while retaining gaps", () => {
  const s = (
    t: number,
    segment = 0,
    source: Sample["source"] = "motion",
    runId = "run",
  ): Sample => ({
    ...demoSample("acceleration", t, runId, Math.round(t * 100) + 1),
    source,
    segment,
  });
  const list = [
    s(0, 0, "motion", "preview"),
    s(0.001, 0, "orientation"),
    s(1),
    s(1.02),
    s(11, 1),
    s(11.02, 1),
    s(11.04, 1),
    s(11.14, 1),
  ];
  const info = samplingInfo(list);
  assert.equal(info.intervalCount, 3);
  assert.ok(Math.abs(info.rateHz! - 50) < 1e-8);
  assert.ok(Math.abs(info.minIntervalS! - 0.02) < 1e-10);
  assert.ok(Math.abs(info.maxIntervalS! - 0.1) < 1e-10);
  assert.equal(
    samplingInfo([s(0, 0, "orientation"), s(0.1, 0, "orientation")]).rateHz,
    10,
  );
  assert.equal(samplingInfo([s(1), s(11, 1)]).rateHz, null);
  assert.equal(samplingInfo([]).rateHz, null);
});
test("jitter medians use both middle intervals and browser hardware reports stay separate", () => {
  const samples = [0, 0.02, 0.06].map((t, i) => ({
    ...demoSample("acceleration", t, "r", i + 1),
    sensorIntervalMs: 16.67,
  }));
  const timing = samplingInfo(samples);
  assert.ok(Math.abs(timing.eventIntervalS! - 0.03) < 1e-12);
  assert.equal(timing.reportedIntervalS, 0.01667);
  const arrival = arrivalInfo([0, 100, 220], 20, 40);
  assert.equal(arrival.medianMs, 110);
  assert.equal(arrival.packetCount, 20);
  assert.equal(arrival.rttMs, 40);
});
test("all 22 modules have unit notes; illuminance is lx and camera values remain digital codes", () => {
  assert.equal(experiments.length, 22);
  for (const module of experiments)
    assert.ok(unitsFor(module.id).length >= 2, module.id);
  assert.ok(unitsFor("inclination").some((r) => r.unit === "° ↔ rad"));
  assert.ok(unitsFor("custom", 1).some((r) => r.unit === "rad/s"));
  assert.equal(demoSample("light", 0, "r", 1).data!.units, "lx");
  assert.equal(
    advancedAnalyse([demoSample("light", 0, "r", 1)], "light", {}, null)
      .metrics[0].unit,
    "lx",
  );
  const camera = advancedAnalyse(
    [demoSample("brightness", 0, "r", 1)],
    "brightness",
    {},
    null,
  );
  assert.equal(camera.metrics[0].unit, "1 (0…255)");
  assert.ok(
    unitsFor("brightness").some((r) =>
      r.note[1].includes("not converted to lx"),
    ),
  );
});
test("Excel keeps SI radians, original degrees, capture cadence and arrival interval as separate provenance", async () => {
  const samples = [0, 0.02, 0.04].map((t, i) => ({
    ...demoSample("inclination", t, "r", i + 1),
    g: [9.81 / Math.sqrt(2), 0, 9.81 / Math.sqrt(2)] as [
      number,
      number,
      number,
    ],
    sensorIntervalMs: 20,
  }));
  const run: Run = {
    id: "r",
    experiment: "inclination",
    mode: "phone",
    startedAt: new Date().toISOString(),
    params: {},
    calibration: null,
    samples,
    quality: [],
    complete: true,
    transport: arrivalInfo([0, 120, 240], 3, 50),
  };
  const wb = await buildWorkbook(run, "en");
  const sheet = rows(wb, "Units and timing");
  assert.ok(
    sheet.some(
      (r) =>
        r[0] === "Sample step" &&
        Math.abs(Number(r[1]) - 0.02) < 1e-12 &&
        r[2] === "s",
    ),
  );
  assert.ok(
    sheet.some(
      (r) =>
        String(r[0]).startsWith("Median arrival interval") &&
        r[1] === 0.12 &&
        r[2] === "s",
    ),
  );
  const angleSheet = wb.SheetNames.find((n) => n.endsWith(" angles"))!;
  const angles = rows(wb, angleSheet),
    head = angles[0];
  const deg = head.indexOf("Physical angle 2 (°)"),
    rad = head.indexOf("physical angle 2 (rad)");
  assert.ok(deg >= 0 && rad >= 0);
  assert.ok(Math.abs(Number(angles[1][deg]) - 45) < 1e-9);
  assert.ok(Math.abs(Number(angles[1][rad]) - Math.PI / 4) < 1e-12);
});

test("timing window gives the same cadence for live recent samples and a full exported run", () => {
  const samples = Array.from({ length: 60 }, (_, i) =>
    demoSample("gps", i, "r", i + 1),
  );
  const full = samplingInfo(samples),
    live = samplingInfo(samples.filter((s) => s.t >= 39));
  assert.deepEqual(full, live);
  assert.equal(full.windowS, 20);
  assert.equal(full.intervalCount, 20);
  assert.equal(full.rateHz, 1);
});
