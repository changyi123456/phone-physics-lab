import { Sensors } from "./sensors";
import { sourceFor } from "../core/advanced-registry";
import type { ExperimentId, Sample } from "../core/types";
import workletURL from "./pcm-worklet.js?url";
export class SourceHub extends Sensors {
  source: Sample["source"] = "motion";
  video?: HTMLVideoElement;
  settings: Record<string, string | number | boolean | null> = {};
  private stream?: MediaStream;
  private context?: AudioContext;
  private node?: AudioWorkletNode;
  private watch?: number;
  private generic?: { stop: () => void };
  private closed = true;
  private token = 0;
  configure(id: ExperimentId) {
    const source = sourceFor(id);
    if (source === this.source) return false;
    this.release();
    super.dispose();
    this.enabled = false;
    this.source = source;
    return true;
  }
  async enable() {
    if (!isSecureContext) throw new Error("secure");
    if (this.source === "motion") return super.enable();
    this.release();
    const token = ++this.token;
    this.closed = false;
    document.addEventListener("visibilitychange", this.visibilityExtra);
    try {
      if (this.source === "audio") await this.audio(token);
      else if (this.source === "camera") await this.camera(token);
      else if (this.source === "gps") this.gps();
      else this.sensor();
      if (token !== this.token) {
        throw new Error("sourceChanged");
      }
      this.enabled = true;
      void this.keepAwake();
      return { motion: false, orientation: false };
    } catch (e) {
      if (token === this.token) this.release();
      throw e;
    }
  }
  private emit(
    time: number,
    values: number[],
    extra: Partial<NonNullable<Sample["data"]>> = {},
  ) {
    if (this.closed || document.hidden) return;
    const sample = this.sample(this.source, { timeStamp: time });
    if (sample) {
      sample.data = { values, settings: this.settings, ...extra };
      this.onSample?.(sample);
    }
  }
  private async audio(token: number) {
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode)
      throw new Error("sourceUnsupported");
    const ctx = new AudioContext();
    this.context = ctx;
    const permission = navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });
    const resume = ctx.resume();
    const stream = await permission;
    if (token !== this.token) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.stream = stream;
    await resume;
    await ctx.audioWorklet.addModule(workletURL);
    if (token !== this.token) return;
    const settings = stream.getAudioTracks()[0].getSettings();
    this.settings = {
      sampleRate: ctx.sampleRate,
      channelCount: settings.channelCount ?? null,
      echoCancellation: settings.echoCancellation ?? null,
      noiseSuppression: settings.noiseSuppression ?? null,
      autoGainControl: settings.autoGainControl ?? null,
      clock: "AudioContext sample frame; input latency unknown",
    };
    const anchor = performance.now() - ctx.currentTime * 1000;
    const node = new AudioWorkletNode(ctx, "pcm-capture");
    this.node = node;
    node.port.onmessage = (e) =>
      this.emit(
        anchor + (e.data.frame / ctx.sampleRate) * 1000,
        Array.from(e.data.values as Float32Array),
        { rate: ctx.sampleRate, units: "FS" },
      );
    const mute = ctx.createGain();
    mute.gain.value = 0;
    ctx
      .createMediaStreamSource(stream)
      .connect(node)
      .connect(mute)
      .connect(ctx.destination);
    ctx.onstatechange = () => {
      if (ctx.state === "suspended" && !this.closed)
        this.onEvent?.("audioSuspended");
    };
  }
  private async camera(token: number) {
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error("sourceUnsupported");
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 640 },
        height: { ideal: 360 },
      },
      audio: false,
    });
    if (token !== this.token) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.stream = stream;
    const video = document.createElement("video");
    this.video = video;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    if (token !== this.token) return;
    const raw = stream.getVideoTracks()[0].getSettings() as MediaTrackSettings &
      Record<string, unknown>;
    this.settings = {
      width: raw.width ?? null,
      height: raw.height ?? null,
      frameRate: raw.frameRate ?? null,
      exposureMode:
        typeof raw.exposureMode === "string" ? raw.exposureMode : null,
      whiteBalanceMode:
        typeof raw.whiteBalanceMode === "string" ? raw.whiteBalanceMode : null,
      exposureTime:
        typeof raw.exposureTime === "number" ? raw.exposureTime : null,
      ROI: "centre 32x32 in 160x90",
      clock: "video expectedDisplayTime; capture latency unknown",
    };
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    let last = 0;
    const sample = (time: number) => {
      if (
        time - last < 95 ||
        video.readyState < 2 ||
        this.paused ||
        document.hidden
      )
        return;
      last = time;
      ctx.drawImage(video, 0, 0, 160, 90);
      const pixels = ctx.getImageData(64, 29, 32, 32).data;
      const rgb = [0, 0, 0];
      for (let i = 0; i < pixels.length; i += 4) {
        rgb[0] += pixels[i];
        rgb[1] += pixels[i + 1];
        rgb[2] += pixels[i + 2];
      }
      rgb.forEach((_, i) => (rgb[i] /= 1024));
      const y = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
      const line = ctx.getImageData(0, 44, 160, 3).data;
      const profile = Array.from({ length: 160 }, (_, x) => {
        let v = 0;
        for (let row = 0; row < 3; row++) {
          const i = 4 * (row * 160 + x);
          v += 0.2126 * line[i] + 0.7152 * line[i + 1] + 0.0722 * line[i + 2];
        }
        return v / 3;
      });
      this.emit(time, [...rgb, y], { profile, units: "pixel 0..255" });
    };
    const frame = (time: number, meta?: VideoFrameCallbackMetadata) => {
      if (this.closed || token !== this.token) return;
      sample(meta?.expectedDisplayTime ?? time);
      if (video.requestVideoFrameCallback)
        video.requestVideoFrameCallback(frame);
      else requestAnimationFrame(frame);
    };
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(frame);
    else requestAnimationFrame(frame);
  }
  private gps() {
    if (!navigator.geolocation) throw new Error("sourceUnsupported");
    this.settings = {
      clock: "GeolocationPosition.timestamp",
      provider: "browser location (GPS or network)",
    };
    this.watch = navigator.geolocation.watchPosition(
      (p) => {
        const c = p.coords;
        this.emit(
          p.timestamp - performance.timeOrigin,
          [c.latitude, c.longitude],
          {
            accuracy: c.accuracy,
            units: "degrees",
            settings: {
              ...this.settings,
              altitude: c.altitude,
              speed: c.speed,
              heading: c.heading,
              altitudeAccuracy: c.altitudeAccuracy,
            },
          },
        );
      },
      (e) => this.onEvent?.(e.code === 1 ? "denied" : "gpsUnavailable"),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  }
  private sensor() {
    const names: Record<string, string> = {
      magnetometer: "Magnetometer",
      light: "AmbientLightSensor",
    };
    if (!names[this.source]) throw new Error("sourceUnsupported");
    const Constructor = (
      window as unknown as Record<
        string,
        new (options: { frequency: number }) => any
      >
    )[names[this.source]];
    if (!Constructor) throw new Error("sourceUnsupported");
    const sensor = new Constructor({ frequency: 20 });
    this.generic = sensor;
    sensor.addEventListener("reading", () => {
      const values =
        this.source === "magnetometer"
          ? [sensor.x, sensor.y, sensor.z]
          : [sensor.illuminance];
      if (!values.every(Number.isFinite)) return;
      this.emit(sensor.timestamp, values, {
        units: ({ magnetometer: "µT", light: "lux" } as Record<string, string>)[
          this.source
        ],
      });
    });
    sensor.addEventListener("error", () => {
      this.enabled = false;
      this.onEvent?.("sourceUnsupported");
    });
    sensor.start();
  }
  override start(id: string) {
    super.start(id);
    this.node?.port.postMessage({ enabled: true });
  }
  override pause() {
    const checkpoint = super.pause();
    this.node?.port.postMessage({ enabled: false });
    return checkpoint;
  }
  override resume() {
    const checkpoint = super.resume();
    this.node?.port.postMessage({ enabled: true });
    return checkpoint;
  }
  private visibilityExtra = () => {
    this.onEvent?.(document.hidden ? "background" : "foreground");
    if (!document.hidden) void this.keepAwake();
  };
  private release() {
    this.closed = true;
    this.token++;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
    this.node?.disconnect();
    this.node = undefined;
    void this.context?.close().catch(() => {});
    this.context = undefined;
    if (this.watch !== undefined) navigator.geolocation.clearWatch(this.watch);
    this.watch = undefined;
    this.generic?.stop();
    this.generic = undefined;
    this.video?.remove();
    this.video = undefined;
    document.removeEventListener("visibilitychange", this.visibilityExtra);
  }
  override dispose() {
    this.release();
    super.dispose();
  }
}
