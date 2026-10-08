import { AUDIO_ENVELOPE_S } from "./timing";
import { analyse, fftSpectrum, median } from "./analysis";
import {
  COLORS,
  magnitude,
  subtract,
  type Sample,
  type ExperimentId,
  type Calibration,
  type Point,
  type Series,
} from "./types";
import { sourceFor } from "./advanced-registry";
import { centripetalSeries, vectorSeries } from "../components/charts";
export interface Fit {
  slope: number;
  intercept: number;
  r2: number;
  stderr: number | null;
  residuals: Point[];
}
export interface EventPoint {
  t: number;
  interval: number | null;
  height: number | null;
  energy: number | null;
  segment: number;
}
export interface FrameSpectrum {
  t: number;
  maxFrequency: number;
  values: number[];
  segment: number;
}
export interface AdvancedAnalysis {
  metrics: { name: [string, string]; value: number | null; unit: string }[];
  plots: {
    title: [string, string];
    x: string;
    y: string;
    series: Series[];
    scatter?: boolean;
  }[];
  events: EventPoint[];
  heatmap: FrameSpectrum[];
  fit: Fit | null;
  frequency: number | null;
  period: number | null;
  note: [string, string];
}
const average = (v: number[]) =>
  v.reduce((a, b) => a + b, 0) / Math.max(1, v.length);
export function statistics(v: number[]) {
  const mean = average(v),
    std =
      v.length > 1
        ? Math.sqrt(v.reduce((a, x) => a + (x - mean) ** 2, 0) / (v.length - 1))
        : null;
  return {
    n: v.length,
    mean: v.length ? mean : null,
    std,
    sem: std === null ? null : std / Math.sqrt(v.length),
  };
}
export function linearFit(points: Point[]): Fit | null {
  const p = points.filter(
    (v): v is { x: number; y: number } =>
      v.y !== null && Number.isFinite(v.x) && Number.isFinite(v.y),
  );
  if (p.length < 3) return null;
  const mx = average(p.map((v) => v.x)),
    my = average(p.map((v) => v.y));
  const xx = p.reduce((a, v) => a + (v.x - mx) ** 2, 0);
  if (xx < 1e-10) return null;
  const slope = p.reduce((a, v) => a + (v.x - mx) * (v.y - my), 0) / xx,
    intercept = my - slope * mx;
  const residuals = p.map((v) => ({
      x: v.x,
      y: v.y - (slope * v.x + intercept),
    })),
    rss = residuals.reduce((a, v) => a + v.y ** 2, 0),
    yy = p.reduce((a, v) => a + (v.y - my) ** 2, 0);
  return {
    slope,
    intercept,
    r2: yy ? 1 - rss / yy : 0,
    stderr: Math.sqrt(rss / (p.length - 2) / xx),
    residuals,
  };
}
export function distance(a: number[], b: number[]) {
  const r = Math.PI / 180,
    dlat = (b[0] - a[0]) * r,
    dlon = (b[1] - a[1]) * r;
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dlon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function peakFrequency(values: number[], rate: number) {
  const rms = Math.sqrt(average(values.map((x) => x * x)));
  const spectrum = fftSpectrum(values, 1 / rate);
  if (rms < 1e-5 || spectrum.length < 3) return { frequency: null, spectrum };
  let k = 1;
  for (let i = 2; i < spectrum.length - 1; i++)
    if (spectrum[i].y! > spectrum[k].y!) k = i;
  const y0 = Math.log(Math.max(1e-12, spectrum[k - 1].y!)),
    y1 = Math.log(Math.max(1e-12, spectrum[k].y!)),
    y2 = Math.log(Math.max(1e-12, spectrum[k + 1]?.y ?? 1e-12)),
    den = y0 - 2 * y1 + y2;
  const offset = den
    ? Math.max(-0.5, Math.min(0.5, (0.5 * (y0 - y2)) / den))
    : 0;
  return {
    frequency: spectrum[k].x + offset * (spectrum[1].x - spectrum[0].x),
    spectrum,
  };
}
const metric = (
  name: [string, string],
  value: number | null,
  unit: string,
) => ({ name, value, unit });
const series = (name: string, points: Point[], color = COLORS[0]): Series => ({
  name,
  points,
  color,
});
const empty = (): AdvancedAnalysis => ({
  metrics: [],
  plots: [],
  events: [],
  heatmap: [],
  fit: null,
  frequency: null,
  period: null,
  note: [
    "以來源時間分析；請檢查訊號與模型條件。",
    "Analysis uses source time. Inspect the signal and model conditions.",
  ],
});
export function triggerEvents(
  samples: Sample[],
  source: Sample["source"],
  threshold: number,
  refractory: number,
  dark = false,
): EventPoint[] {
  const points: { t: number; value: number; segment: number }[] = [];
  for (const s of samples.filter((s) => s.source === source)) {
    const seg = s.segment ?? 0;
    if (source === "audio" && s.data?.rate) {
      const v = s.data.values,
        n = Math.max(1, Math.round(s.data.rate * AUDIO_ENVELOPE_S));
      for (let i = 0; i < v.length; i += n) {
        const slice = v.slice(i, i + n);
        points.push({
          t: s.t + i / s.data.rate,
          value: Math.sqrt(average(slice.map((x) => x * x))),
          segment: seg,
        });
      }
    } else {
      const value =
        source === "motion" ? (s.a ? magnitude(s.a) : null) : s.data?.values[3];
      if (value !== null && value !== undefined)
        points.push({ t: s.t, value: dark ? -value : value, segment: seg });
    }
  }
  const level = dark ? -threshold : threshold;
  let armed = true,
    last = -Infinity,
    lastSegment = -1,
    lastPoint = -Infinity,
    previousEvent: EventPoint | undefined;
  const events: EventPoint[] = [];
  for (const p of points) {
    if (
      p.segment !== lastSegment ||
      p.t - lastPoint > (source === "audio" ? 0.15 : 0.5)
    ) {
      armed = true;
      last = -Infinity;
      previousEvent = undefined;
      lastSegment = p.segment;
    }
    const reset = dark ? level - 10 : level * 0.5;
    if (p.value < reset) armed = true;
    if (armed && p.value >= level && p.t - last >= refractory) {
      const dt = previousEvent ? p.t - previousEvent.t : null;
      events.push({
        t: p.t,
        interval: dt,
        height: dt === null ? null : (9.80665 * dt * dt) / 8,
        energy: null,
        segment: p.segment,
      });
      previousEvent = events.at(-1);
      last = p.t;
      armed = false;
    }
    lastPoint = p.t;
  }
  let initial: number | null = null,
    seg = -1;
  for (const event of events) {
    if (event.segment !== seg || event.interval === null) {
      seg = event.segment;
      initial = null;
    }
    if (event.height !== null) {
      initial ??= event.height;
      event.energy = initial > 0 ? event.height / initial : null;
    }
  }
  return events;
}
export function advancedAnalyse(
  samples: Sample[],
  id: ExperimentId,
  params: Record<string, number>,
  calibration: Calibration | null,
): AdvancedAnalysis {
  const out = empty(),
    source = sourceFor(id),
    list = samples.filter((s) => s.source === source),
    last = list.at(-1);
  const plot = (
    title: [string, string],
    x: string,
    y: string,
    curves: Series[],
    scatter = false,
  ) => {
    const shown =
      x === "t (s)"
        ? curves.map((curve) => {
            const points = curve.points;
            const dt = median(
              points
                .slice(1)
                .map((p, i) => p.x - points[i].x)
                .filter((v) => v > 0),
            );
            let cursor = 0,
              priorSegment = -1;
            return {
              ...curve,
              points: points.flatMap((p, i) => {
                while (cursor < list.length - 1 && list[cursor + 1].t <= p.x)
                  cursor++;
                const segment = list[cursor]?.segment ?? 0;
                const gap =
                  i > 0 &&
                  (segment !== priorSegment ||
                    p.x - points[i - 1].x > Math.max(0.1, 3 * dt));
                priorSegment = segment;
                return gap ? [{ x: p.x - 0.000001, y: null }, p] : [p];
              }),
            };
          })
        : curves;
    out.plots.push({ title, x, y, series: shown, scatter });
  };
  if (source === "audio") {
    const blocks = list.filter((s) => s.data?.rate && s.data.values.length);
    let latestSpectrum: Point[] = [];
    const history: Point[] = [];
    for (const s of blocks) {
      const rate = s.data!.rate!,
        v = s.data!.values,
        peak = peakFrequency(v, rate);
      latestSpectrum = peak.spectrum;
      const t = s.t + v.length / (2 * rate);
      history.push({ x: t, y: peak.frequency });
      const bins = 120,
        maxFrequency = Math.min(10000, rate / 2);
      out.heatmap.push({
        t,
        maxFrequency,
        segment: s.segment ?? 0,
        values: Array.from({ length: bins }, (_, i) => {
          const lo = (i * maxFrequency) / bins,
            hi = ((i + 1) * maxFrequency) / bins;
          let m = 0;
          for (const p of peak.spectrum)
            if (p.x >= lo && p.x < hi) m = Math.max(m, p.y ?? 0);
          return m;
        }),
      });
      out.frequency = peak.frequency;
    }
    if (last?.data) {
      const rate = last.data.rate!,
        v = last.data.values;
      plot(["PCM 波形", "PCM waveform"], "t (s)", "amplitude (FS)", [
        series(
          "PCM",
          v
            .filter((_, i) => i % 4 === 0)
            .map((y, i) => ({ x: last.t + (i * 4) / rate, y })),
        ),
      ]);
      out.metrics.push(
        metric(["主頻", "Dominant frequency"], out.frequency, "Hz"),
        metric(
          ["數位 RMS", "Digital RMS"],
          Math.sqrt(average(v.map((x) => x * x))),
          "FS",
        ),
        metric(["取樣率", "Sample rate"], rate, "Hz"),
      );
    }
    plot(["聲音頻譜", "Sound spectrum"], "f (Hz)", "relative amplitude (1)", [
      series("FFT", latestSpectrum, COLORS[1]),
    ]);
    if (id === "soundHistory")
      plot(["主頻時間曲線", "Dominant frequency history"], "t (s)", "f (Hz)", [
        series("f", history),
      ]);
    if (id === "soundTimer" || id === "bounce") {
      out.events = triggerEvents(
        list,
        "audio",
        params.threshold ?? 0.12,
        params.refractory ?? 0.18,
      );
      plot(
        ["事件間隔", "Event intervals"],
        "event",
        "Δt (s)",
        [
          series(
            "Δt",
            out.events.map((e, i) => ({ x: i + 1, y: e.interval })),
          ),
        ],
        true,
      );
      out.metrics.push(
        metric(["事件數", "Event count"], out.events.length, ""),
        metric(
          ["最後間隔", "Last interval"],
          out.events.at(-1)?.interval ?? null,
          "s",
        ),
      );
      if (id === "bounce") {
        plot(
          ["模型反彈高度", "Model bounce height"],
          "event",
          "h (m)",
          [
            series(
              "h",
              out.events.map((e, i) => ({ x: i + 1, y: e.height })),
            ),
          ],
          true,
        );
        plot(
          ["相對能量", "Relative energy"],
          "event",
          "E/E₀",
          [
            series(
              "E/E₀",
              out.events.map((e, i) => ({ x: i + 1, y: e.energy })),
            ),
          ],
          true,
        );
      }
    }
  } else if (["accelSpectrum", "vibration", "springK"].includes(id)) {
    const result = analyse(samples, "spring", params, calibration);
    out.frequency = result.frequency;
    out.period = result.period;
    out.metrics.push(
      metric(["週期", "Period"], result.period, "s"),
      metric(["主頻", "Frequency"], result.frequency, "Hz"),
    );
    if (id === "springK")
      out.metrics.push(
        metric(
          ["彈簧常數 k", "Spring constant k"],
          result.period
            ? (4 * Math.PI ** 2 * (params.mass ?? 0.2)) / result.period ** 2
            : null,
          "N/m",
        ),
      );
    plot(
      ["線性加速度", "Linear acceleration"],
      "t (s)",
      "a (m/s²)",
      vectorSeries(samples, "spring", true, calibration).slice(0, 3),
    );
    plot(
      ["加速度頻譜", "Acceleration spectrum"],
      "f (Hz)",
      "relative amplitude (1)",
      [series("FFT", result.spectrum, COLORS[1])],
    );
    if (id === "vibration") {
      const history: Point[] = [];
      const motion = samples.filter((s) => s.source === "motion" && s.a);
      for (let i = 99; i < motion.length; i += 25) {
        const window = motion.slice(Math.max(0, i - 511), i + 1),
          r = analyse(window, "spring", params, calibration);
        history.push({ x: motion[i].t, y: r.frequency });
        if (r.spectrum.length)
          out.heatmap.push({
            t: motion[i].t,
            segment: motion[i].segment ?? 0,
            maxFrequency: r.spectrum.at(-1)!.x,
            values: r.spectrum
              .filter((_, i) => i % 2 === 0)
              .map((p) => p.y ?? 0),
          });
      }
      plot(["振動頻率歷史", "Vibration frequency history"], "t (s)", "f (Hz)", [
        series("f", history),
      ]);
    }
  } else if (id === "motionTimer") {
    out.events = triggerEvents(
      samples,
      "motion",
      params.threshold ?? 2,
      params.refractory ?? 0.18,
    );
    out.metrics.push(
      metric(["事件數", "Event count"], out.events.length, ""),
      metric(
        ["最後間隔", "Last interval"],
        out.events.at(-1)?.interval ?? null,
        "s",
      ),
    );
    plot(
      ["合線性加速度", "Linear acceleration magnitude"],
      "t (s)",
      "a (m/s²)",
      vectorSeries(samples, "spring", true, calibration).slice(3),
    );
    plot(
      ["運動事件間隔", "Motion event intervals"],
      "event",
      "Δt (s)",
      [
        series(
          "Δt",
          out.events.map((e, i) => ({ x: i + 1, y: e.interval })),
        ),
      ],
      true,
    );
  } else if (id === "radius") {
    const points = centripetalSeries(samples, calibration, true)[0].points;
    out.fit = linearFit(points);
    out.metrics.push(
      metric(["估計半徑", "Estimated radius"], out.fit?.slope ?? null, "m"),
      metric(["截距", "Intercept"], out.fit?.intercept ?? null, "m/s²"),
      metric(["擬合 R²", "Fit R²"], out.fit?.r2 ?? null, ""),
      metric(
        ["斜率標準誤", "Slope standard error"],
        out.fit?.stderr ?? null,
        "m",
      ),
    );
    plot(
      ["向心線性關係", "Centripetal linear relation"],
      "ω² (rad²/s²)",
      "a (m/s²)",
      [series("a", points)],
      true,
    );
    if (out.fit) {
      plot(["擬合線", "Fitted line"], "ω² (rad²/s²)", "a (m/s²)", [
        series(
          "fit",
          points.map((p) => ({
            x: p.x,
            y: out.fit!.slope * p.x + out.fit!.intercept,
          })),
          COLORS[1],
        ),
      ]);
      plot(
        ["殘差", "Residuals"],
        "ω² (rad²/s²)",
        "residual (m/s²)",
        [series("residual", out.fit.residuals)],
        true,
      );
    }
  } else if (source === "gps") {
    let total = 0,
      previous: Sample | undefined;
    const path: Point[] = [],
      speeds: Point[] = [],
      distancePoints: Point[] = [],
      accuracy: Point[] = [];
    for (const s of list) {
      const v = s.data!.values,
        ok = (s.data!.accuracy ?? Infinity) <= (params.accuracy ?? 20);
      let inferred: number | null = null;
      if (
        ok &&
        previous &&
        s.segment === previous.segment &&
        s.t > previous.t &&
        s.t - previous.t < 15
      ) {
        const d = distance(previous.data!.values, v);
        total += d;
        inferred = d / (s.t - previous.t);
      }
      previous = ok ? s : undefined;
      distancePoints.push({ x: s.t, y: total });
      speeds.push({
        x: s.t,
        y:
          typeof s.data!.settings?.speed === "number"
            ? s.data!.settings.speed
            : inferred,
      });
      accuracy.push({ x: s.t, y: s.data!.accuracy ?? null });
      if (ok) path.push({ x: v[1], y: v[0] });
    }
    out.metrics.push(
      metric(
        ["累積路程（含漂移）", "Path length (includes drift)"],
        list.length ? total : null,
        "m",
      ),
      metric(
        ["定位精度", "Location accuracy"],
        last?.data?.accuracy ?? null,
        "m",
      ),
      metric(
        ["速度（裝置／差分）", "Speed (device / difference)"],
        speeds.at(-1)?.y ?? null,
        "m/s",
      ),
      metric(
        ["高度", "Altitude"],
        typeof last?.data?.settings?.altitude === "number"
          ? last.data.settings.altitude
          : null,
        "m",
      ),
    );
    plot(["速度", "Speed"], "t (s)", "v (m/s)", [series("v", speeds)]);
    plot(["路程", "Path length"], "t (s)", "s (m)", [
      series("s", distancePoints),
    ]);
    plot(["定位精度", "Location accuracy"], "t (s)", "accuracy (m)", [
      series("accuracy", accuracy, COLORS[2]),
    ]);
    plot(
      ["定位軌跡", "Location track"],
      "longitude (°)",
      "latitude (°)",
      [series("track", path)],
      true,
    );
  } else if (source === "camera") {
    const rgb = last?.data?.values;
    out.metrics.push(
      ...[0, 1, 2, 3].map((i) =>
        metric(
          [
            ["紅", "Red"],
            ["綠", "Green"],
            ["藍", "Blue"],
            ["亮度", "Brightness"],
          ][i] as [string, string],
          rgb?.[i] ?? null,
          "1 (0…255)",
        ),
      ),
    );
    const axes = id === "color" ? [0, 1, 2] : [3];
    plot(
      ["相機 ROI 像素", "Camera ROI pixels"],
      "t (s)",
      "pixel (0..255)",
      axes.map((i) =>
        series(
          ["R", "G", "B", "Y"][i],
          list.map((s) => ({ x: s.t, y: s.data!.values[i] })),
          COLORS[i],
        ),
      ),
    );
    if (id === "opticalTimer") {
      out.events = triggerEvents(
        list,
        "camera",
        params.threshold ?? 100,
        params.refractory ?? 0.18,
        params.dark === 1,
      );
      out.metrics.push(
        metric(["光學事件數", "Optical event count"], out.events.length, ""),
      );
      plot(
        ["光學事件間隔", "Optical intervals"],
        "event",
        "Δt (s)",
        [
          series(
            "Δt",
            out.events.map((e, i) => ({ x: i + 1, y: e.interval })),
          ),
        ],
        true,
      );
    }
  } else if (source !== "motion") {
    const unit = last?.data?.units ?? "";
    const n = last?.data?.values.length ?? 1;
    out.metrics.push(
      ...Array.from({ length: n }, (_, i) =>
        metric(
          [`通道 ${i + 1}`, `Channel ${i + 1}`],
          last?.data?.values[i] ?? null,
          unit,
        ),
      ),
    );
    plot(
      ["原始感測數據", "Raw sensor values"],
      "t (s)",
      unit,
      Array.from({ length: n }, (_, i) =>
        series(
          String(i + 1),
          list.map((s) => ({ x: s.t, y: s.data?.values[i] ?? null })),
          COLORS[i],
        ),
      ),
    );
  } else if (id === "custom") {
    const field =
      params.customField === 1 ? "w" : params.customField === 2 ? "g" : "a";
    plot(
      ["自訂訊號", "Custom signal"],
      "t (s)",
      field === "w" ? "rad/s" : "m/s²",
      vectorSeries(
        samples,
        field === "w" ? "gyroscope" : field === "g" ? "acceleration" : "spring",
        field === "a",
        calibration,
      ).slice(0, 3),
    );
    const mapped = samples.map((s) => ({
      ...s,
      a:
        field === "w" && s.w
          ? calibration
            ? subtract(s.w, calibration.bias)
            : s.w
          : field === "g"
            ? s.g
            : s.a,
    }));
    const result = analyse(mapped, "spring", params, null);
    out.period = result.period;
    out.frequency = result.frequency;
    out.metrics.push(metric(["頻率", "Frequency"], result.frequency, "Hz"));
    out.events = triggerEvents(
      mapped,
      "motion",
      params.threshold ?? 2,
      params.refractory ?? 0.18,
    );
  }
  if (id !== "bounce")
    out.events = out.events.map((e) => ({ ...e, height: null, energy: null }));
  return out;
}
