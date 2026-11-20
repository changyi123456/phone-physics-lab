import type { Peer, DataConnection } from "peerjs";
// Keep the same browser identity after refreshing or reopening the QR link.
function deviceIdentity() {
  const key = "physics-device-v1";
  try {
    const saved = localStorage.getItem(key);
    if (saved && /^[\w-]{1,80}$/.test(saved)) return saved;
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
const peerOptions = {
  secure: true,
  debug: 0 as const,
  // PeerJS's former free TURN endpoints are no longer operational.
  config: {
    iceServers: [
      { urls: "stun:stun.cloudflare.com:3478" },
      { urls: "stun:stun.l.google.com:19302" },
    ],
  },
};
export type Wire = { type: string; [key: string]: unknown };
export type LinkStatus =
  | "waiting"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed";
export class Link {
  peer?: Peer;
  conn?: DataConnection;
  code = "";
  status: LinkStatus = "waiting";
  rtt = 0;
  issue = "";
  onStatus?: (s: LinkStatus) => void;
  onMessage?: (p: Wire) => void;
  welcome?: () => Wire;
  private epoch = 0;
  private pending: Promise<string> | null = null;
  private device = deviceIdentity();
  private owner = "";
  private timer?: ReturnType<typeof setInterval>;
  private lastSeen = 0;
  private role: "host" | "phone" = "host";
  private busy = false;
  private retryAt = 0;
  constructor(private loadPeer = () => import("peerjs")) {}
  setStatus(s: LinkStatus, issue = "") {
    this.issue = issue;
    this.status = s;
    this.onStatus?.(s);
  }
  host(): Promise<string> {
    if (this.pending) return this.pending;
    this.pending = this.openHost().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }
  private async openHost() {
    if (
      this.peer &&
      !this.peer.destroyed &&
      !["failed", "disconnected"].includes(this.status)
    )
      return this.code;
    this.close();
    this.role = "host";
    this.code = Array.from(
      crypto.getRandomValues(new Uint8Array(24)),
      (v) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[v % 32],
    ).join("");
    const epoch = this.epoch;
    const { Peer } = await this.loadPeer();
    if (epoch !== this.epoch) return "";
    this.peer = new Peer(`physics-v1-${this.code}`, peerOptions);
    this.setStatus("connecting");
    this.peer.on("open", () => {
      if (epoch === this.epoch)
        this.setStatus(this.conn?.open ? "connected" : "waiting");
    });
    this.peer.on("connection", (c) => {
      if (epoch !== this.epoch) return c.close();
      const m = c.metadata;
      if (
        m?.room !== this.code ||
        m?.protocol !== 1 ||
        typeof m.device !== "string" ||
        m.device.length > 80 ||
        (this.owner && this.owner !== m.device)
      ) {
        c.on("open", () => c.close());
        return;
      }
      // A refresh can arrive before the old data channel times out.
      // Only the already paired browser may replace that channel.
      const previous = this.conn;
      this.conn = undefined;
      previous?.close();
      this.owner = m.device;
      this.bind(c);
    });
    this.events();
    this.monitor();
    return this.code;
  }
  async phone(code: string) {
    this.close();
    this.role = "phone";
    this.code = code;
    if (!/^[A-Z2-9]{24}$/.test(code)) {
      this.setStatus("failed");
      return;
    }
    const epoch = this.epoch;
    const { Peer } = await this.loadPeer();
    if (epoch !== this.epoch) return;
    this.peer = new Peer(peerOptions);
    this.setStatus("connecting");
    this.peer.on("open", () => {
      if (epoch === this.epoch) this.dial();
    });
    this.events();
    this.monitor();
  }
  private events() {
    const peer = this.peer!;
    peer.on("error", (error) => {
      if (this.peer !== peer) return;
      const pending = this.conn;
      if (!pending?.open) {
        this.conn = undefined;
        pending?.close();
      }
      this.busy = false;
      this.retryAt = Date.now() + 5000;
      if (!this.conn?.open)
        this.setStatus("failed", error.type === "peer-unavailable"
          ? "peerUnavailable"
          : error.type === "webrtc" ? "transportFailed" : "signalingUnavailable");
    });
    peer.on("disconnected", () => {
      if (this.peer !== peer) return;
      if (!this.conn?.open) this.setStatus("disconnected");
      try {
        this.peer?.reconnect();
      } catch {}
    });
  }
  private dial() {
    if (
      this.role !== "phone" ||
      !this.peer ||
      this.peer.destroyed ||
      this.peer.disconnected ||
      this.conn ||
      this.busy
    )
      return;
    this.busy = true;
    this.setStatus("connecting");
    this.bind(
      this.peer.connect(`physics-v1-${this.code}`, {
        reliable: true,
        serialization: "binary",
        metadata: { room: this.code, protocol: 1, device: this.device },
      }),
    );
  }
  private bind(c: DataConnection) {
    this.conn = c;
    this.lastSeen = Date.now();
    c.on("open", () => {
      if (this.conn !== c) return c.close();
      this.busy = false;
      this.lastSeen = Date.now();
      this.setStatus("connected");
      if (this.role === "host")
        this.send(this.welcome?.() ?? { type: "welcome" });
    });
    c.on("data", (data) => {
      if (this.conn !== c) return;
      this.lastSeen = Date.now();
      if (
        !data ||
        typeof data !== "object" ||
        !("type" in data) ||
        typeof data.type !== "string"
      )
        return;
      const p = data as Wire;
      if (p.type === "ping") {
        if (typeof p.at === "number") this.send({ type: "pong", at: p.at });
        return;
      }
      if (p.type === "pong") {
        if (typeof p.at === "number")
          this.rtt = Math.max(0, performance.now() - p.at);
        return;
      }
      this.onMessage?.(p);
    });
    const gone = () => {
      if (this.conn !== c) return;
      this.conn = undefined;
      this.busy = false;
      this.retryAt = Date.now() + 2000;
      this.setStatus("disconnected");
    };
    c.on("close", gone);
    c.on("error", gone);
  }
  private monitor() {
    this.timer = setInterval(() => {
      if (this.conn?.open) {
        if (Date.now() - this.lastSeen > 10000) {
          this.conn.close();
          return;
        }
        this.send({ type: "ping", at: performance.now() });
      } else if (this.conn && Date.now() - this.lastSeen > 20000) {
        const pending = this.conn;
        this.conn = undefined;
        pending.close();
        this.busy = false;
        this.retryAt = Date.now() + 5000;
        this.setStatus("failed", "transportFailed");
      } else if (this.peer?.disconnected && !this.peer.destroyed && Date.now() > this.retryAt) {
        this.retryAt = Date.now() + 5000;
        try { this.peer.reconnect(); } catch {}
      } else if (this.role === "phone" && Date.now() > this.retryAt)
        this.dial();
    }, 2000);
  }
  send(p: Wire) {
    if (
      !this.conn?.open ||
      (this.conn.dataChannel?.bufferedAmount ?? 0) > 262144
    )
      return false;
    try {
      this.conn.send(p);
      return true;
    } catch {
      return false;
    }
  }
  url(lang: string, theme: string) {
    const u = new URL(location.href);
    u.search = "";
    u.hash = "";
    u.searchParams.set("sensor", this.code);
    u.searchParams.set("lang", lang);
    u.searchParams.set("theme", theme);
    return u.href;
  }
  close() {
    this.epoch++;
    clearInterval(this.timer);
    const old = this.conn;
    this.conn = undefined;
    old?.close();
    this.peer?.destroy();
    this.peer = undefined;
    this.owner = "";
    this.busy = false;
  }
}
