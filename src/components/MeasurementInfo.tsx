import { Gauge, ChevronDown } from "lucide-react";
import { sourceFor } from "../core/advanced-registry";
import { unitsFor, sourceNames } from "../core/measurement-info";
import {
  AUDIO_ENVELOPE_S,
  CAMERA_MIN_INTERVAL_MS,
  GENERIC_SENSOR_HZ,
  PHONE_FLUSH_MS,
  UI_REFRESH_MS,
  ANALYSIS_REFRESH_MS,
  type SamplingInfo,
  type ArrivalInfo,
} from "../core/timing";
import type { ExperimentId, Lang, Mode } from "../core/types";
const number = (value: number | null, digits = 2) =>
  value === null
    ? "—"
    : value.toLocaleString("en-US", { maximumFractionDigits: digits });
export function interval(value: number | null) {
  if (value === null) return "—";
  return value < 0.001
    ? `${number(value * 1e6)} µs`
    : value < 1
      ? `${number(value * 1000)} ms`
      : `${number(value)} s`;
}
export function MeasurementInfo({
  lang,
  id,
  mode,
  phase,
  timing,
  transport,
  customField,
}: {
  lang: Lang;
  id: ExperimentId;
  mode: Mode;
  phase: string;
  timing: SamplingInfo;
  transport: ArrivalInfo;
  customField: number;
}) {
  const zh = lang === "zh",
    text = (cn: string, en: string) => (zh ? cn : en);
  const source = sourceFor(id),
    audio = source === "audio";
  const sourceNote =
    source === "motion"
      ? text(
          "加速度與陀螺儀由手機／瀏覽器決定頻率，網站不能指定硬體 Hz。上方是來源事件間隔的中位數；請以本機實測為準。",
          "Motion cadence is controlled by the phone and browser, not this website. The rate above is the reciprocal median source-event interval; use the measurement on your device.",
        )
      : audio
        ? text(
            "取樣率是 AudioContext 的 PCM 時鐘，可能包含硬體重取樣；不代表麥克風原生規格。每塊即時傳送，封包率與 PCM Hz 不同。",
            "Sample rate comes from the AudioContext PCM clock and may include hardware resampling; it is not a microphone hardware specification. Blocks are sent immediately; packet cadence differs from PCM Hz.",
          )
        : source === "camera"
          ? text(
              `ROI 最快每 ${CAMERA_MIN_INTERVAL_MS} ms 取一次（上限約 ${(1000 / CAMERA_MIN_INTERVAL_MS).toFixed(1)} Hz），仍受影格率影響。影格時間採 expectedDisplayTime，曝光／讀取延遲未知，光學秒錶無法宣稱毫秒精度。`,
              `ROI sampling is capped at one sample per ${CAMERA_MIN_INTERVAL_MS} ms (about ${(1000 / CAMERA_MIN_INTERVAL_MS).toFixed(1)} Hz), further limited by video cadence. Timestamps use expectedDisplayTime; exposure and capture latency are unknown. Optical timing does not establish millisecond accuracy.`,
            )
          : source === "gps"
            ? text(
                "定位更新由系統決定，沒有固定或可保證的頻率。使用定位時間戳；適合戶外慢速變化，快速運動需考慮定位精度。",
                "Location updates are controlled by the system with no guaranteed cadence. Position timestamps are used; inspect accuracy before analysing fast motion.",
              )
            : text(
                `向瀏覽器請求 ${GENERIC_SENSOR_HZ} Hz（${1000 / GENERIC_SENSOR_HZ} ms），實際頻率依支援度與隱私限制；請求值不是保證。`,
                `The browser is asked for ${GENERIC_SENSOR_HZ} Hz (${1000 / GENERIC_SENSOR_HZ} ms); support and privacy limits determine the actual cadence. This is a request, not a guarantee.`,
              );
  const events = [
    "soundTimer",
    "bounce",
    "motionTimer",
    "opticalTimer",
    "custom",
  ].includes(id);
  return (
    <details className="measurement-info panel">
      <summary>
        <span>
          <Gauge size={18} />
          {text("單位與時間解析度", "Units & time resolution")}
        </span>
        <small>
          {timing.rateHz
            ? `Fs ${number(timing.rateHz, 1)} Hz · Δt ${interval(timing.stepS)}`
            : text("待感測資料", "Awaiting sensor data")}
        </small>
        <ChevronDown className="measurement-chevron" size={16} />
      </summary>
      <div className="measurement-body">
        <p className="measurement-intro">
          {mode === "demo"
            ? text(
                "目前為示範模型，以下數值不是手機硬體規格。",
                "Simulated model: these values do not describe your phone hardware.",
              )
            : `${text("來源", "Source")}: ${sourceNames[source][zh ? 0 : 1]}`}
          {["paused", "finished"].includes(phase)
            ? ` · ${text("保留最後量測值", "Last measurement retained")}`
            : ""}
        </p>
        <dl className="timing-readouts">
          <div>
            <dt>
              {audio
                ? text("PCM 取樣率", "PCM sample rate")
                : text("觀測取樣率", "Observed sample rate")}
            </dt>
            <dd>
              {number(timing.rateHz, 1)} <small>Hz</small>
            </dd>
          </div>
          <div>
            <dt>{text("取樣點間隔 Δt", "Sample step Δt")}</dt>
            <dd>{interval(timing.stepS)}</dd>
          </div>
          <div>
            <dt>
              {audio
                ? text("音訊塊來源間隔", "Source block interval")
                : text("來源間隔範圍", "Source interval range")}
            </dt>
            <dd>
              {audio
                ? interval(timing.eventIntervalS)
                : `${interval(timing.minIntervalS)} – ${interval(timing.maxIntervalS)}`}
            </dd>
          </div>
          <div>
            <dt>{text("封包接收間隔（實測）", "Packet arrival interval")}</dt>
            <dd>
              {mode === "phone"
                ? interval(
                    transport.medianMs === null
                      ? null
                      : transport.medianMs / 1000,
                  )
                : "—"}
            </dd>
          </div>
        </dl>
        <p className="timing-caption">
          {text(
            "統計視窗：最近 20 秒內最新分段、同一來源最多 300 筆事件；",
            "Window: up to 300 events from the same source in the latest segment within 20 s; ",
          )}
          {timing.intervalCount}{" "}
          {text("個有效間隔，跨度", "valid intervals, spanning")}{" "}
          {interval(timing.windowS || null)}
          {text(
            "。暫停及其他來源不混算；缺口會反映在範圍中。",
            ". Pauses and other sources are excluded; gaps remain visible in the range.",
          )}
        </p>
        <p>{sourceNote}</p>
        {audio && timing.blockSamples ? (
          <p>
            {text("目前每塊", "Current block")}: {timing.blockSamples}{" "}
            {text("點", "samples")} / {interval(timing.blockDurationS)}.{" "}
            {text(
              "原始 PCM 完整保留於 Excel；波形畫面每 4 點顯示 1 點。",
              "Raw PCM is preserved in Excel; the displayed waveform shows one in four samples.",
            )}
          </p>
        ) : null}
        {timing.reportedIntervalS ? (
          <p>
            {text("瀏覽器回報硬體間隔", "Browser-reported hardware interval")}:{" "}
            {interval(timing.reportedIntervalS)}
            {text(
              "；與觀測事件間隔分別記錄。",
              "; recorded separately from the observed event interval.",
            )}
          </p>
        ) : null}
        {events ? (
          <p className="measurement-callout">
            {audio
              ? text(
                  `聲音觸發以約 ${AUDIO_ENVELOPE_S * 1000} ms RMS 小窗判定（每塊尾窗可能較短），時間標記在窗起點。PCM 的 µs 間隔不等於事件判定準確度。`,
                  `Sound triggers use approximately ${AUDIO_ENVELOPE_S * 1000} ms RMS windows (a block's final window may be shorter), timestamped at the window start. PCM microsecond spacing is not event-timing accuracy.`,
                )
              : text(
                  "觸發事件受上方實測來源間隔限制；不會因為顯示更多小數就取得更細的時間資訊。",
                  "Trigger timing is limited by the observed source intervals above; displaying more decimal places adds no time information.",
                )}
            {text(
              "「觸發間隔下限」另外限制兩個事件可多接近。",
              " The minimum event interval separately limits how close detected events may be.",
            )}
          </p>
        ) : null}
        <dl className="timing-details">
          <div>
            <dt>{text("手機傳送", "Phone transmission")}</dt>
            <dd>
              {audio
                ? text(
                    "每個 PCM 塊就緒立即傳送",
                    "Send when each PCM block is ready",
                  )
                : text(
                    `每 ${PHONE_FLUSH_MS} ms 批次檢查（約 ${(1000 / PHONE_FLUSH_MS).toFixed(2)} 次/s）`,
                    `Batch check every ${PHONE_FLUSH_MS} ms (about ${(1000 / PHONE_FLUSH_MS).toFixed(2)} checks/s)`,
                  )}
            </dd>
          </div>
          <div>
            <dt>{text("電腦顯示／分析", "Desktop display / analysis")}</dt>
            <dd>
              {text(
                `約 ${UI_REFRESH_MS} ms 更新讀值；分析最短排程 ${ANALYSIS_REFRESH_MS} ms`,
                `Readout refresh about ${UI_REFRESH_MS} ms; analysis scheduled no faster than ${ANALYSIS_REFRESH_MS} ms`,
              )}
            </dd>
          </div>
          <div>
            <dt>{text("連線 RTT（往返）", "Connection RTT (round trip)")}</dt>
            <dd>
              {mode === "phone"
                ? interval(
                    transport.rttMs === null ? null : transport.rttMs / 1000,
                  )
                : "—"}
              {text(
                "；非單向延遲，非感測精度。",
                "; neither one-way latency nor sensor accuracy.",
              )}
            </dd>
          </div>
        </dl>
        <p className="measurement-callout">
          {text(
            "時間以手機來源時間計算，網路延遲通常影響看見資料的時間；缺包、暫停、背景限制會另記品質事件。電腦開始指令到手機的延遲仍存在，多組手機沒有共用時鐘。",
            "Calculations use phone source timestamps; network delay usually changes when data becomes visible. Packet loss, pauses and background restrictions are logged. Start-command delay still exists, and different phones do not share a clock.",
          )}
        </p>
        <p>
          {text(
            "SI 時間基準為秒（s）。時間戳的小數精度、取樣間隔及實際測量準確度是三件事；瀏覽器可降低時間戳精度，本站未校準硬體時鐘或感測誤差。頻譜須留意 Nyquist 上限 Fs/2、取樣抖動、窗長及混疊；峰值插值不會提高原始解析度。",
            "The SI time base is the second (s). Timestamp precision, sampling interval and measurement accuracy are distinct. Browsers may reduce timestamp precision; hardware clocks and sensor errors are not calibrated here. Spectra require attention to Fs/2, jitter, window length and aliasing; peak interpolation adds no original resolution.",
          )}
        </p>
        <table className="unit-table">
          <thead>
            <tr>
              <th>{text("量", "Quantity")}</th>
              <th>{text("單位／尺度", "Unit / scale")}</th>
              <th>{text("教師備註", "Teacher notes")}</th>
            </tr>
          </thead>
          <tbody>
            {unitsFor(id, customField).map((row) => (
              <tr key={row.quantity[1]}>
                <td>{row.quantity[zh ? 0 : 1]}</td>
                <td>{row.unit}</td>
                <td>{row.note[zh ? 0 : 1]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="measurement-sources">
          <a
            href="https://www.bipm.org/en/publications/si-brochure"
            target="_blank"
            rel="noreferrer"
          >
            BIPM SI
          </a>{" "}
          ·{" "}
          <a
            href="https://www.w3.org/TR/orientation-event/"
            target="_blank"
            rel="noreferrer"
          >
            W3C Motion
          </a>{" "}
          ·{" "}
          <a
            href="https://www.w3.org/TR/webaudio/"
            target="_blank"
            rel="noreferrer"
          >
            Web Audio
          </a>{" "}
          ·{" "}
          <a
            href="https://www.w3.org/TR/hr-time/"
            target="_blank"
            rel="noreferrer"
          >
            {text("時間戳規範", "Timestamp specification")}
          </a>
        </p>
      </div>
    </details>
  );
}
