import {
  samplingInfo,
  AUDIO_ENVELOPE_S,
  PHONE_FLUSH_MS,
  UI_REFRESH_MS,
  ANALYSIS_REFRESH_MS,
} from "./timing";
import { unitsFor } from "./measurement-info";
import { sourceFor } from "./advanced-registry";
import { advancedAnalyse } from "./advanced-analysis";
import { activeDuration } from "./duration";
import { compareTrials, type Trial } from "./session";
import type { Lang, Run } from "./types";
import { analyse, angles, relativeAngle } from "./analysis";
import { capabilities, magnitude, subtract } from "./types";
import { getExperiment } from "./registry";
import { qualityText, tr, tx } from "./i18n";
export async function buildWorkbook(
  run: Run,
  lang: Lang,
  trials: Trial[] = [],
) {
  const zh = lang === "zh";
  const label = (cn: string, en: string) => (zh ? cn : en);
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const put = (name: string, rows: unknown[][]) => {
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = (rows[0] ?? []).map((_, i) => ({
      wch: i === 0 ? 24 : 20,
    }));
    XLSX.utils.book_append_sheet(wb, sheet, name.slice(0, 31));
  };
  const recent = run.samples.filter(
    (s) => s.t >= Math.max(0, (run.samples.at(-1)?.t ?? 0) - 20),
  );
  const result = analyse(recent, run.experiment, run.params, run.calibration);
  put(tr("infoSheet", lang), [
    [tr("details", lang), tr("value", lang)],
    [label("應用程式", "Application"), "Phylab 0.3.0"],
    [tr("schema", lang), 2],
    ["runId", run.id],
    [label("實驗", "Experiment"), tx(getExperiment(run.experiment).name, lang)],
    [
      tr("mode", lang),
      tr(run.mode === "demo" ? "demoMode" : "phoneMode", lang),
    ],
    [label("開始時間（電腦 ISO）", "Started at (desktop ISO)"), run.startedAt],
    [label("最終序號已確認", "Final sequence confirmed"), run.complete],
    [label("接收事件數", "Events received"), run.samples.length],
    [
      label("時間基準", "Time basis"),
      run.mode === "demo"
        ? label(
            "示範模型時間，非手機實測",
            "Simulated model time; not measured on a phone",
          )
        : label(
            "手機來源時間，相對本輪起點；非網路接收時間。音訊依 PCM frame，相機依 expectedDisplayTime；硬體捕捉延遲未知。",
            "Phone source time relative to run start; not network arrival time. Audio uses PCM frames; camera uses expectedDisplayTime. Hardware capture latency is unknown.",
          ),
    ],
    [
      label("座標定義", "Coordinates"),
      "Device x=right y=top z=out; gyro x=beta y=gamma z=alpha",
    ],
    [label("分析版本", "Analysis version"), "2.0"],
    ...Object.entries(capabilities(run.samples)).map(([key, value]) => [
      `${label("有效感測欄位", "Valid sensor field")}: ${key}`,
      value,
    ]),
    [
      label("有效錄製時間", "Active recorded duration"),
      activeDuration(run.samples.at(-1)?.t ?? 0, run.quality),
    ],
    [
      label("暫停處理", "Pause handling"),
      label(
        "原時間保留；分段獨立分析，不跨暫停插值",
        "Source time retained; segments analysed independently, no interpolation across pause",
      ),
    ],
    ...Object.entries(run.params),
  ]);

  const timing = samplingInfo(run.samples, sourceFor(run.experiment));
  const transport = run.transport;
  put(zh ? "單位與時間" : "Units and timing", [
    [
      label("量／條件", "Quantity / condition"),
      tr("value", lang),
      tr("unit", lang),
    ],
    [
      label(
        "取樣率（PCM 時鐘／來源間隔中位數）",
        "Sample rate (PCM clock / median source interval)",
      ),
      timing.rateHz,
      "Hz",
    ],
    [label("取樣點間隔", "Sample step"), timing.stepS, "s"],
    [
      label(
        "來源事件／音訊塊間隔中位數",
        "Median source-event / audio-block interval",
      ),
      timing.eventIntervalS,
      "s",
    ],
    [
      label("來源間隔最小值", "Minimum source interval"),
      timing.minIntervalS,
      "s",
    ],
    [
      label("來源間隔最大值", "Maximum source interval"),
      timing.maxIntervalS,
      "s",
    ],
    [
      label("統計視窗有效間隔數", "Window interval count"),
      timing.intervalCount,
      "1",
    ],
    [label("統計視窗跨度", "Window span"), timing.windowS, "s"],
    [
      label("視窗定義", "Window definition"),
      label(
        "最近 20 秒內最新分段、同一來源最多 300 筆事件；缺口保留，暫停不混算",
        "Up to 300 events from the same source in the latest segment within 20 s; gaps retained, pauses excluded",
      ),
      "",
    ],
    [
      label("瀏覽器回報硬體間隔", "Browser-reported hardware interval"),
      timing.reportedIntervalS,
      "s",
    ],
    [
      label("每音訊塊點數", "Samples per audio block"),
      timing.blockSamples,
      "1",
    ],
    [label("音訊塊長", "Audio block duration"), timing.blockDurationS, "s"],
    [
      label(
        "聲音 RMS 偵測窗目標（非準確度）",
        "Target sound RMS window (not accuracy)",
      ),
      sourceFor(run.experiment) === "audio" ? AUDIO_ENVELOPE_S : null,
      "s",
    ],
    [
      label(
        "批次檢查目標（音訊就緒立即送）",
        "Batch-check target (audio sent immediately)",
      ),
      PHONE_FLUSH_MS / 1000,
      "s",
    ],
    [
      label("讀值更新目標", "Readout refresh target"),
      UI_REFRESH_MS / 1000,
      "s",
    ],
    [
      label("分析最短排程", "Minimum analysis scheduling interval"),
      ANALYSIS_REFRESH_MS / 1000,
      "s",
    ],
    [
      label(
        "錄製資料封包數（含重送）",
        "Recording data packets (including retries)",
      ),
      transport?.packetCount ?? null,
      "1",
    ],
    [
      label(
        "接收間隔中位數（最近最多 100 間隔）",
        "Median arrival interval (up to 100 recent intervals)",
      ),
      transport?.medianMs === null || transport?.medianMs === undefined
        ? null
        : transport.medianMs / 1000,
      "s",
    ],
    [
      label("接收間隔視窗間隔數", "Arrival window interval count"),
      transport?.intervalCount ?? null,
      "1",
    ],
    [
      label("最後 RTT（非單向延遲）", "Last RTT (not one-way latency)"),
      transport?.rttMs ? transport.rttMs / 1000 : null,
      "s",
    ],
    [
      label("準確度限制", "Accuracy limits"),
      label(
        "取樣間隔與小數位不等於準確度；瀏覽器可能量化。未校準感測器或硬體時鐘。",
        "Sample spacing and decimal places are not accuracy. Browsers may quantise values. Sensors and hardware clocks are not calibrated.",
      ),
      "",
    ],
    ...unitsFor(run.experiment, run.params.customField).map((row) => [
      tx(row.quantity, lang),
      tx(row.note, lang),
      row.unit,
    ]),
  ]);
  const fields = zh
    ? [
        "序號",
        "時間 t (s)",
        "含重力 x (m/s²)",
        "含重力 y (m/s²)",
        "含重力 z (m/s²)",
        "線性 x (m/s²)",
        "線性 y (m/s²)",
        "線性 z (m/s²)",
        "角速度 x (rad/s)",
        "角速度 y (rad/s)",
        "角速度 z (rad/s)",
        "原 rotationRate beta (°/s)",
        "原 rotationRate gamma (°/s)",
        "原 rotationRate alpha (°/s)",
        "事件時間 (ms)",
        "螢幕角 (°)",
      ]
    : [
        "Sequence",
        "Time t (s)",
        "Gravity x (m/s²)",
        "Gravity y (m/s²)",
        "Gravity z (m/s²)",
        "Linear x (m/s²)",
        "Linear y (m/s²)",
        "Linear z (m/s²)",
        "Angular x (rad/s)",
        "Angular y (rad/s)",
        "Angular z (rad/s)",
        "Original beta rate (°/s)",
        "Original gamma rate (°/s)",
        "Original alpha rate (°/s)",
        "Event timestamp (ms)",
        "Screen angle (°)",
      ];
  put(tr("motionSheet", lang), [
    [
      ...fields,
      zh ? "分段" : "Segment",
      zh ? "硬體回報間隔 (ms)" : "Reported hardware interval (ms)",
    ],
    ...run.samples
      .filter((s) => s.source === "motion")
      .map((s) => [
        s.seq,
        s.t,
        ...(s.g ?? [null, null, null]),
        ...(s.a ?? [null, null, null]),
        ...(s.w ?? [null, null, null]),
        ...(s.rawRotation ?? [null, null, null]),
        s.eventTime,
        s.screen,
        s.segment ?? 0,
        s.sensorIntervalMs ?? null,
      ]),
  ]);
  const orient = run.samples.filter((s) => s.source === "orientation");
  if (orient.length)
    put(tr("orientationSheet", lang), [
      [
        zh ? "序號" : "Sequence",
        "t (s)",
        "alpha (°)",
        "beta (°)",
        "gamma (°)",
        zh ? "事件時間 (ms)" : "Event timestamp (ms)",
      ],
      ...orient.map((s) => [
        s.seq,
        s.t,
        ...(s.angles ?? [null, null, null]),
        s.eventTime,
      ]),
    ]);
  put(tr("analysisSheet", lang), [
    [tr("details", lang), tr("value", lang), tr("unit", lang)],
    [tr("period", lang), result.period, "s"],
    [tr("frequency", lang), result.frequency, "Hz"],
    [tr("gravity", lang), result.gravity, "m/s²"],
    [tr("rate", lang), result.sampleRate, "Hz"],
    [label("分析軸向", "Analysis axis"), ["x", "y", "z"][result.axis], ""],
    [label("模型", "Model"), getExperiment(run.experiment).formula, ""],
    [
      label("適用條件", "Conditions"),
      tx(getExperiment(run.experiment).physics, lang),
      "",
    ],
  ]);
  if (run.experiment === "inclination") {
    for (const mount of ["flat", "upright", "side", "plane"]) {
      const ref = run.calibration
        ? angles(run.calibration.g, mount)
        : [0, 0, 0];
      put(`${tr(mount as "flat", lang)} ${zh ? "傾角" : "angles"}`, [
        [
          zh ? "時間 t (s)" : "Time t (s)",
          zh ? "物理角 1 (°)" : "Physical angle 1 (°)",
          zh ? "物理角 2 (°)" : "Physical angle 2 (°)",
          zh ? "相對角 1 (°)" : "Relative angle 1 (°)",
          zh ? "相對角 2 (°)" : "Relative angle 2 (°)",
          "physical angle 1 (rad)",
          "physical angle 2 (rad)",
          "relative angle 1 (rad)",
          "relative angle 2 (rad)",
        ],
        ...run.samples
          .filter((s) => s.source === "motion")
          .map((s) => {
            const a = s.g ? angles(s.g, mount) : null;
            return [
              s.t,
              a?.[0] ?? null,
              a?.[1] ?? null,
              a ? relativeAngle(a[0], ref[0]) : null,
              a ? relativeAngle(a[1], ref[1]) : null,
              a ? (a[0] * Math.PI) / 180 : null,
              a ? (a[1] * Math.PI) / 180 : null,
              a ? (relativeAngle(a[0], ref[0]) * Math.PI) / 180 : null,
              a ? (relativeAngle(a[1], ref[1]) * Math.PI) / 180 : null,
            ];
          }),
      ]);
    }
  }
  if (run.experiment === "centripetal")
    put(zh ? "向心關係" : "Centripetal relation", [
      [
        zh ? "時間 t (s)" : "Time t (s)",
        "a (m/s²)",
        "ω (rad/s)",
        "ω² (rad²/s²)",
      ],
      ...run.samples
        .filter((s) => s.source === "motion")
        .map((s) => {
          const w = s.w
            ? magnitude(
                run.calibration ? subtract(s.w, run.calibration.bias) : s.w,
              )
            : null;
          return [
            s.t,
            s.a ? magnitude(s.a) : null,
            w,
            w === null ? null : w * w,
          ];
        }),
    ]);
  if (result.correlation.length)
    put(tr("autocorrelation", lang), [
      ["Δt (s)", zh ? "自相關係數" : "Correlation"],
      ...result.correlation.map((p) => [p.x, p.y]),
    ]);
  if (result.spectrum.length)
    put(tr("spectrum", lang), [
      ["f (Hz)", zh ? "相對幅度 (1)" : "Relative amplitude (1)"],
      ...result.spectrum.map((p) => [p.x, p.y]),
    ]);
  const extra = advancedAnalyse(
    run.samples,
    run.experiment,
    run.params,
    run.calibration,
  );
  if (extra.metrics.length)
    put(zh ? "擴充分析" : "Extended analysis", [
      [tr("details", lang), tr("value", lang), tr("unit", lang)],
      ...extra.metrics.map((m) => [tx(m.name, lang), m.value, m.unit]),
    ]);
  extra.plots.forEach((p, i) =>
    put(`${i + 1} ${tx(p.title, lang)}`, [
      [p.x, ...p.series.map((s) => `${s.name} (${p.y})`)],
      ...(p.series[0]?.points.map((point, j) => [
        point.x,
        ...p.series.map((s) => s.points[j]?.y ?? null),
      ]) ?? []),
    ]),
  );
  if (extra.events.length)
    put(zh ? "事件時間" : "Event times", [
      ["#", "t (s)", "Δt (s)", "h model (m)", "E/E₀ model", "segment"],
      ...extra.events.map((e, i) => [
        i + 1,
        e.t,
        e.interval,
        run.experiment === "bounce" ? e.height : null,
        run.experiment === "bounce" ? e.energy : null,
        e.segment,
      ]),
    ]);
  if (extra.fit)
    put(zh ? "擬合資訊" : "Fit info", [
      ["metric", "value", "unit"],
      ["slope", extra.fit.slope, "m"],
      ["intercept", extra.fit.intercept, "m/s²"],
      ["R²", extra.fit.r2, "1"],
      ["slope standard error", extra.fit.stderr, "m"],
    ]);
  if (extra.heatmap.length)
    put(zh ? "頻率時間熱圖" : "Spectrogram", [
      [
        "t source (s)",
        "f max (Hz)",
        "segment",
        "bin count",
        "relative FFT bin 0 →",
      ],
      ...extra.heatmap.map((f) => [
        f.t,
        f.maxFrequency,
        f.segment,
        f.values.length,
        ...f.values,
      ]),
    ]);
  const audio = run.samples.filter((s) => s.source === "audio" && s.data);
  if (audio.length) {
    const encode = (values: number[]) => {
      const bytes = new Uint8Array(values.length * 4),
        view = new DataView(bytes.buffer);
      values.forEach((v, i) => view.setFloat32(i * 4, v, true));
      let raw = "";
      for (const v of bytes) raw += String.fromCharCode(v);
      return btoa(raw);
    };
    put(zh ? "原始 PCM" : "Raw PCM", [
      [
        "seq",
        "t first sample (s)",
        "sampleRate (Hz)",
        "sample count",
        "segment",
        "encoding",
        "base64 PCM",
        "settings JSON",
      ],
      ...audio.map((s) => [
        s.seq,
        s.t,
        s.data!.rate,
        s.data!.values.length,
        s.segment ?? 0,
        "float32 little-endian",
        encode(s.data!.values),
        JSON.stringify(s.data!.settings ?? {}),
      ]),
    ]);
    const step = Math.max(
      1,
      Math.ceil(audio.reduce((n, s) => n + s.data!.values.length, 0) / 20000),
    );
    put(zh ? "PCM 波形預覽" : "PCM waveform preview", [
      ["t source (s)", "amplitude (FS)", "preview decimation", step],
      ...audio.flatMap((s) =>
        s.data!.values.flatMap((v, i) =>
          i % step === 0 ? [[s.t + i / s.data!.rate!, v]] : [],
        ),
      ),
    ]);
  }
  for (const source of ["gps", "camera", "magnetometer", "light"] as const) {
    const rows = run.samples.filter((s) => s.source === source && s.data);
    if (!rows.length) continue;
    put(`${source} ${zh ? "原始值" : "raw"}`, [
      [
        "seq",
        "t source (s)",
        "segment",
        "channel 1",
        "channel 2",
        "channel 3",
        "channel 4",
        "unit",
        "accuracy (m)",
        "settings JSON",
      ],
      ...rows.map((s) => [
        s.seq,
        s.t,
        s.segment ?? 0,
        ...Array.from({ length: 4 }, (_, i) => s.data!.values[i] ?? null),
        s.data!.units ?? "",
        s.data!.accuracy ?? null,
        JSON.stringify(s.data!.settings ?? {}),
      ]),
    ]);
    if (source === "camera")
      put(zh ? "像素剖面" : "Pixel profiles", [
        ["t source (s)", "segment", "pixel 0 →"],
        ...rows
          .filter((s) => s.data!.profile)
          .map((s) => [s.t, s.segment ?? 0, ...s.data!.profile!]),
      ]);
  }
  if (run.manifest)
    put(zh ? "教師設定" : "Teacher manifest", [
      ["schema", run.manifest.schema],
      ["JSON", JSON.stringify(run.manifest)],
    ]);
  if (trials.length)
    put(zh ? "本次多輪摘要" : "Session trial summaries", [
      [
        "runId",
        "experiment",
        "mode",
        "T (s)",
        "f (Hz)",
        "k (N/m)",
        "r (m)",
        "L (m)",
        "m (kg)",
        "event count",
        "complete",
      ],
      ...trials.map((t) => [
        t.id,
        t.experiment,
        t.mode,
        t.period,
        t.frequency,
        t.k,
        t.radius,
        t.params.length ?? null,
        t.params.mass ?? null,
        t.count,
        t.complete,
      ]),
    ]);
  if (trials.length) {
    const quantities = ["period", "frequency", "k", "radius"] as const;
    put(zh ? "重複統計" : "Repeat statistics", [
      ["quantity", "unit", "n", "mean", "sample SD", "SEM"],
      ...quantities.map((key, i) => {
        const { stats } = compareTrials(trials, run.experiment, run.mode, key);
        return [
          key,
          ["s", "Hz", "N/m", "m"][i],
          stats.n,
          stats.mean,
          stats.std,
          stats.sem,
        ];
      }),
    ]);
    const comparison = compareTrials(trials, run.experiment, run.mode);
    if (comparison.scan) {
      put(zh ? "參數掃描" : "Parameter scan", [
        [comparison.scan === "length" ? "L (m)" : "m (kg)", "T² (s²)"],
        ...comparison.points.map((p) => [p.x, p.y]),
      ]);
      if (comparison.fit) {
        const fit = comparison.fit;
        put(zh ? "多輪擬合" : "Trial fit", [
          ["quantity", "value", "unit"],
          ["slope", fit.slope, comparison.scan === "length" ? "s²/m" : "s²/kg"],
          ["intercept", fit.intercept, "s²"],
          ["R²", fit.r2, "1"],
          [
            "slope standard error",
            fit.stderr,
            comparison.scan === "length" ? "s²/m" : "s²/kg",
          ],
          [
            comparison.scan === "length" ? "g model (m/s²)" : "k model (N/m)",
            comparison.derived,
          ],
        ]);
        put(zh ? "多輪殘差" : "Trial residuals", [
          [comparison.scan === "length" ? "L (m)" : "m (kg)", "residual (s²)"],
          ...fit.residuals.map((p) => [p.x, p.y]),
        ]);
      }
    }
  }
  const c = run.calibration;
  put(tr("calibrationSheet", lang), [
    [tr("details", lang), tr("value", lang)],
    [label("校準時間", "Calibrated at"), c?.at ?? tr("calibrationNone", lang)],
    [label("樣本數", "Sample count"), c?.count ?? 0],
    ...["x", "y", "z"].flatMap((v, i) => [
      [
        `${label("重力基準", "Gravity reference")} ${v} (m/s²)`,
        c?.g[i] ?? null,
      ],
      [
        `${label("角速度偏移", "Angular bias")} ${v} (rad/s)`,
        c?.bias[i] ?? null,
      ],
    ]),
  ]);
  put(tr("qualitySheet", lang), [
    ["t (s)", zh ? "事件代碼" : "Event code", tr("details", lang)],
    ...run.quality.map((q) => [
      q.t,
      q.kind,
      `${qualityText(q.kind, lang)} ${q.detail ?? ""}`,
    ]),
  ]);
  return wb;
}
export async function workbookBytes(
  run: Run,
  lang: Lang,
  trials: Trial[] = [],
) {
  const XLSX = await import("xlsx");
  return XLSX.write(await buildWorkbook(run, lang, trials), {
    bookType: "xlsx",
    type: "array",
    compression: true,
  }) as ArrayBuffer;
}
