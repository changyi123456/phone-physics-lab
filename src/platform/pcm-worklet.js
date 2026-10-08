class PCMCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(1024);
    this.used = 0;
    this.first = 0;
    this.enabled = true;
    this.port.onmessage = (e) => {
      this.enabled = e.data.enabled;
      this.used = 0;
    };
  }
  process(inputs) {
    const data = inputs[0]?.[0];
    if (!data || !this.enabled) return true;
    for (let i = 0; i < data.length; i++) {
      if (!this.used) this.first = currentFrame + i;
      this.buffer[this.used++] = data[i];
      if (this.used === this.buffer.length) {
        const values = this.buffer.slice();
        this.port.postMessage({ frame: this.first, values }, [values.buffer]);
        this.used = 0;
      }
    }
    return true;
  }
}
registerProcessor("pcm-capture", PCMCapture);
