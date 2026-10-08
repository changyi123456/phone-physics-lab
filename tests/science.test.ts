import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyse,
  angles,
  calibrate,
  fftSpectrum,
  relativeAngle,
} from "../src/core/analysis";
import { rotationToXYZ, requestAccess } from "../src/platform/sensors";
import type { Sample, Run } from "../src/core/types";
import { Recorder, ReplayBuffer } from "../src/core/recording";
import { buildWorkbook } from "../src/core/export";
import * as XLSX from "xlsx";
const s = (seq: number, t: number, id = "run", value = 0): Sample => ({
  runId: id,
  seq,
  source: "motion",
  t,
  eventTime: t * 1000,
  g: [0, 0, 9.81],
  a: [value, 0, 0],
  w: [value, 0, 0],
  rawRotation: [(value * 180) / Math.PI, 0, 0],
  angles: null,
  screen: 0,
});
const run = (id = "run"): Run => ({
  id,
  experiment: "pendulum",
  mode: "phone",
  startedAt: "2026-10-08T00:00:00Z",
  params: { length: 0.25 },
  calibration: null,
  samples: [],
  quality: [],
  complete: false,
});
test("browser angular rate maps beta/gamma/alpha to fixed xyz rad/s", () => {
  const rot = rotationToXYZ({ alpha: 90, beta: 180, gamma: -90 });
  assert.deepEqual(rot.raw, [180, -90, 90]);
  assert.deepEqual(rot.w, [Math.PI, -Math.PI / 2, Math.PI / 2]);
  assert.equal(rotationToXYZ({ alpha: null, beta: 1, gamma: 2 }).w, null);
});
test("both iOS permission requests start within the user gesture", async () => {
  const calls: string[] = [];
  const result = requestAccess(
    {
      requestPermission: () => {
        calls.push("motion");
        return Promise.resolve("granted");
      },
    },
    {
      requestPermission: () => {
        calls.push("orientation");
        return Promise.resolve("denied");
      },
    },
  );
  assert.deepEqual(calls, ["motion", "orientation"]);
  assert.deepEqual(await result, { motion: true, orientation: false });
});
test("calibration requires stable fresh readings and preserves gravity", () => {
  const stable = Array.from({ length: 80 }, (_, i) => s(i + 1, i * 0.02));
  stable.forEach((v) => (v.w = [0.01, -0.01, 0]));
  const c = calibrate(stable)!;
  assert.ok(c);
  assert.equal(c.g[0], 0);
  assert.equal(c.g[1], 0);
  assert.ok(Math.abs(c.g[2] - 9.81) < 1e-10);
  assert.ok(Math.abs(c.bias[0] - 0.01) < 1e-12);
  assert.equal(stable[0].g![2], 9.81);
  assert.equal(calibrate(stable.slice(0, 6)), null);
  const moving = stable.map((v, i) => ({
    ...v,
    g: [Math.sin(i) * 2, 0, 9.81] as [number, number, number],
  }));
  assert.equal(calibrate(moving), null);
});
test("gravity angle has 0° at horizontal and 30° at a known tilt", () => {
  assert.equal(angles([0, 0, 9.81])[1], 0);
  assert.ok(
    Math.abs(angles([4.905, 0, (9.81 * Math.sqrt(3)) / 2])[1] - 30) < 1e-10,
  );
});
for (const f of [0.5, 1.3, 3.7])
  test(`period estimator uses timestamps: ${f}Hz with event jitter`, () => {
    let t = 0;
    const data = Array.from({ length: 850 }, (_, i) => {
      t += 0.02 * (1 + 0.04 * Math.sin(i));
      return s(
        i + 1,
        t,
        "run",
        1.2 * Math.sin(2 * Math.PI * f * t) + 0.015 * Math.cos(t * 13),
      );
    });
    const result = analyse(data, "spring", {}, null);
    assert.ok(result.period);
    assert.ok(
      Math.abs(result.frequency! - f) / f < 0.012,
      `got ${result.frequency}`,
    );
  });
test("constant signal and short post-gap data do not claim a period", () => {
  const zero = Array.from({ length: 500 }, (_, i) => s(i + 1, i * 0.02));
  assert.equal(analyse(zero, "spring", {}, null).period, null);
  const before = Array.from({ length: 250 }, (_, i) =>
    s(i + 1, i * 0.02, "run", Math.sin(i * 0.02 * 2 * Math.PI)),
  );
  const after = Array.from({ length: 40 }, (_, i) =>
    s(i + 251, 9 + i * 0.02, "run", Math.sin(i * 0.02 * 2 * Math.PI)),
  );
  assert.equal(analyse([...before, ...after], "spring", {}, null).period, null);
});
test("FFT removes DC and identifies known dominant frequency", () => {
  const spec = fftSpectrum(
    Array.from(
      { length: 512 },
      (_, i) => 9.81 + Math.sin((2 * Math.PI * 1.5 * i) / 50),
    ),
    0.02,
  );
  const peak = spec.reduce((a, b) => ((b.y ?? 0) > (a.y ?? 0) ? b : a));
  assert.ok(Math.abs(peak.x - 1.5) < 50 / 512);
});
test("pendulum g agrees with known period and length", () => {
  const L = 0.25,
    f = Math.sqrt(9.81 / L) / (2 * Math.PI),
    data = Array.from({ length: 600 }, (_, i) =>
      s(i + 1, i * 0.02, "run", Math.sin(2 * Math.PI * f * i * 0.02)),
    );
  assert.ok(
    Math.abs(analyse(data, "pendulum", { length: L }, null).gravity! - 9.81) <
      0.1,
  );
});
test("sequence ACK waits for missing events; duplicates and foreign runs are isolated", () => {
  const r = new Recorder(run());
  assert.equal(r.ingest([s(1, 0), s(3, 0.04), s(2, 0.02, "foreign")]), 1);
  assert.equal(r.count, 2);
  assert.equal(r.ingest([s(2, 0.02), s(3, 0.04)]), 3);
  assert.equal(r.count, 3);
  assert.equal(r.finish(3), true);
});
test("bounded replay declares losses and recovered ACK removes pending data", () => {
  const b = new ReplayBuffer();
  for (let i = 1; i <= 4000; i++) b.add(s(i, i * 0.02));
  assert.ok(b.droppedThrough > 0);
  const r = new Recorder(run());
  const batch = b.packet(2000, true);
  r.ingest(batch, b.droppedThrough);
  assert.ok(r.run.quality.some((v) => v.kind === "bufferDrop"));
  assert.equal(r.finish(4000), false);
  b.acknowledge(batch.at(-1)!.seq);
  assert.ok(b.samples.every((v) => v.seq > b.ack));
});
test("event timestamp gaps are exported without fabricated zero samples", () => {
  const r = new Recorder(run());
  r.ingest([s(1, 0), s(2, 0.02), s(3, 0.04), s(4, 3), s(5, 3.02)]);
  const data = r.materialize();
  assert.equal(data.samples.length, 5);
  assert.ok(data.quality.some((q) => q.kind === "sensorGap"));
  r.materialize();
  assert.equal(data.quality.filter((q) => q.kind === "sensorGap").length, 1);
});
test("30 independent runs retain 10 minutes at 50Hz without mixing", () => {
  const stores = Array.from(
    { length: 30 },
    (_, i) => new Recorder(run(`room-${i}`)),
  );
  const empty = { g: null, a: null, w: null, rawRotation: null, angles: null };
  for (let start = 1; start <= 30000; start += 200) {
    for (let group = 0; group < 30; group++) {
      const batch = Array.from({ length: 200 }, (_, i) => ({
        ...s(start + i, (start + i - 1) / 50, `room-${group}`),
        ...empty,
        g: [group, 0, 9.81] as [number, number, number],
      }));
      stores[group].ingest(batch);
    }
  }
  for (let group = 0; group < 30; group++) {
    const r = stores[group];
    assert.equal(r.count, 30000);
    assert.equal(r.cursor, 30000);
    assert.equal(r.finish(30000), true);
    assert.ok(
      r
        .materialize()
        .samples.every((v) => v.runId === `room-${group}` && v.g![0] === group),
    );
    assert.equal(r.lastTime, 599.98);
  }
});
for (const lang of ["zh", "en"] as const)
  test(`Excel ${lang} is a real workbook with numeric cells, missing values and provenance`, async () => {
    const r = run();
    r.mode = "demo";
    r.samples = [s(1, 0), { ...s(2, 0.02), a: null }];
    r.complete = true;
    r.quality = [{ t: 0.02, kind: "background" }];
    const wb = await buildWorkbook(r, lang);
    const bytes = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    assert.equal(bytes[0], 0x50);
    assert.equal(bytes[1], 0x4b);
    const decoded = XLSX.read(bytes, { type: "buffer" }),
      motion = decoded.Sheets[lang === "zh" ? "Motion 資料" : "Motion data"];
    assert.equal(motion.B3.t, "n");
    assert.equal(motion.B3.v, 0.02);
    assert.equal(motion.F3, undefined);
    const info = XLSX.utils
      .sheet_to_json(decoded.Sheets[decoded.SheetNames[0]], { header: 1 })
      .flat();
    assert.ok(
      info.includes(
        lang === "zh" ? "示範資料 · 非實測" : "Demo data · Not a measurement",
      ),
    );
    assert.ok(
      decoded.SheetNames.includes(
        lang === "zh" ? "品質事件" : "Quality events",
      ),
    );
  });

test("relative direction wraps across 180 degrees and derived inclination exports numeric angles", async () => {
  assert.equal(relativeAngle(-179, 179), 2);
  const r = run();
  r.experiment = "inclination";
  r.samples = [{ ...s(1, 0), g: [4.905, 0, (9.81 * Math.sqrt(3)) / 2] }];
  const wb = await buildWorkbook(r, "en");
  const row = XLSX.utils.sheet_to_json(wb.Sheets["Flat angles"], {
    header: 1,
  })[1] as number[];
  assert.ok(Math.abs(row[2] - 30) < 1e-10);
  assert.ok(Math.abs(row[4] - row[2]) < 1e-10);
});
