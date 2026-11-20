import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Link } from "../src/platform/link";
import { Sensors, requestAccess } from "../src/platform/sensors";
import { validSample, type Sample } from "../src/core/types";

class Connection extends EventEmitter {
  open = false;
  closed = false;
  dataChannel = { bufferedAmount: 0 };
  sent: unknown[] = [];
  constructor(public metadata: unknown) { super(); }
  send(value: unknown) { this.sent.push(value); }
  close() { this.open = false; this.closed = true; this.emit("close"); }
  connected() { this.open = true; this.emit("open"); }
}
class Peer extends EventEmitter {
  static instances: Peer[] = [];
  destroyed = false;
  disconnected = false;
  connections: Connection[] = [];
  constructor(..._args: unknown[]) { super(); Peer.instances.push(this); }
  connect(_id: string, options: { metadata: unknown }) {
    const conn = new Connection(options.metadata);
    this.connections.push(conn);
    return conn;
  }
  destroy() { this.destroyed = true; }
  reconnect() { this.disconnected = false; }
}
const loadPeer = async () => ({ Peer }) as unknown as typeof import("peerjs");
const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
} });

test("phone identity survives a new page instance; only the paired browser replaces a stale channel", async () => {
  const first = new Link(loadPeer), second = new Link(loadPeer), host = new Link(loadPeer);
  try {
    const room = await host.host();
    const hostPeer = Peer.instances.at(-1)!;
    await first.phone(room);
    Peer.instances.at(-1)!.emit("open");
    const metadata = Peer.instances.at(-1)!.connections[0].metadata as Record<string, unknown>;
    await second.phone(room);
    Peer.instances.at(-1)!.emit("open");
    assert.deepEqual(Peer.instances.at(-1)!.connections[0].metadata, metadata);
    const old = new Connection(metadata);
    hostPeer.emit("connection", old); old.connected();
    const stranger = new Connection({ ...metadata, device: "another-phone" });
    hostPeer.emit("connection", stranger); stranger.connected();
    assert.equal(stranger.closed, true);
    assert.equal(host.conn, old);
    const replacement = new Connection(metadata);
    hostPeer.emit("connection", replacement); replacement.connected();
    assert.equal(old.closed, true);
    assert.equal(host.conn, replacement);
    old.emit("close"); old.emit("data", { type: "start" });
    assert.equal(host.status, "connected");
  } finally { first.close(); second.close(); host.close(); }
});

test("an unavailable desktop releases the pending channel so a later retry can dial", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval", "Date"] });
  const link = new Link(loadPeer);
  try {
    await link.phone("A".repeat(24));
    const peer = Peer.instances.at(-1)!;
    peer.emit("open");
    peer.emit("error", { type: "peer-unavailable" });
    assert.equal(peer.connections[0].closed, true);
    assert.equal(link.conn, undefined);
    assert.equal(link.issue, "peerUnavailable");
    t.mock.timers.tick(8000);
    assert.equal(peer.connections.length, 2);
  } finally { link.close(); t.mock.timers.reset(); }
});

test("Android permission sources without requestPermission do not need an iOS prompt", async () => {
  assert.deepEqual(await requestAccess({}, {}), { motion: true, orientation: true });
});

class Sensor extends EventTarget {
  static instances: Sensor[] = [];
  x: number | null = null; y: number | null = null; z: number | null = null;
  timestamp: number | null = null;
  stopped = false;
  constructor(_options: unknown) { super(); Sensor.instances.push(this); }
  start() {}
  stop() { this.stopped = true; }
  reading(values: [number, number, number], time: number) {
    [this.x, this.y, this.z] = values; this.timestamp = time;
    this.dispatchEvent(new Event("reading"));
  }
}
function browserEnvironment(generic: boolean) {
  Sensor.instances = [];
  const window = Object.assign(new EventTarget(), {
    DeviceMotionEvent: {}, DeviceOrientationEvent: {},
    ...(generic ? { Accelerometer: Sensor, LinearAccelerationSensor: Sensor, Gyroscope: Sensor } : {}),
  });
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: window },
    document: { configurable: true, value: Object.assign(new EventTarget(), { hidden: false }) },
    screen: { configurable: true, value: { orientation: { angle: 0 } } },
    isSecureContext: { configurable: true, value: true },
  });
  return window;
}

test("Android fallback provides actual acceleration, rad/s gyro and original per-sensor timestamps", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  browserEnvironment(true);
  const sensors = new Sensors(), samples: Sample[] = [];
  sensors.onSample = (s) => samples.push(s);
  try {
    await sensors.enable();
    t.mock.timers.tick(1500);
    const [g, a, w] = Sensor.instances;
    g.reading([0, 0, 9.81], 2000);
    a.reading([0, 0, 0.5], 2000);
    w.reading([Math.PI, 0, 0], 2000);
    g.reading([0, 0, 9.81], 2017);
    const latest = samples.at(-1)!;
    assert.ok(validSample(latest));
    assert.deepEqual(latest.g, [0, 0, 9.81]);
    assert.deepEqual(latest.a, [0, 0, 0.5]);
    assert.deepEqual(latest.w, [Math.PI, 0, 0]);
    assert.equal(latest.rawRotation, null);
    assert.equal(latest.data?.settings?.wTimestampMs, 2000);
    assert.equal(samples.length, 2, "one source cadence, not three streams counted as Hz");
    g.reading([0, 0, 9.81], 2300);
    assert.equal(samples.at(-1)!.w, null, "stale optional readings are not repeated");
    sensors.dispose();
    assert.ok(Sensor.instances.every((s) => s.stopped));
  } finally { sensors.dispose(); t.mock.timers.reset(); }
});

test("empty Android motion events cannot report a fake sample rate or stay enabled", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const window = browserEnvironment(false);
  const sensors = new Sensors(), samples: Sample[] = [], issues: string[] = [];
  sensors.onSample = (s) => samples.push(s); sensors.onEvent = (s) => issues.push(s);
  try {
    await sensors.enable();
    window.dispatchEvent(new Event("devicemotion"));
    window.dispatchEvent(new Event("deviceorientation"));
    assert.equal(samples.length, 0);
    t.mock.timers.tick(6000);
    assert.equal(sensors.enabled, false);
    assert.deepEqual(issues, ["noSensor"]);
  } finally { sensors.dispose(); t.mock.timers.reset(); }
});

test("native motion remains preferred and does not start duplicate Android sensors", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const window = browserEnvironment(true), sensors = new Sensors(), samples: Sample[] = [];
  sensors.onSample = (s) => samples.push(s);
  try {
    await sensors.enable();
    const event = Object.assign(new Event("devicemotion"), {
      accelerationIncludingGravity: { x: 0, y: 0, z: 9.81 },
      acceleration: { x: 0, y: 0, z: 0 },
      rotationRate: { alpha: 0, beta: 90, gamma: 0 }, interval: 20,
    });
    window.dispatchEvent(event);
    t.mock.timers.tick(6000);
    assert.equal(Sensor.instances.length, 0);
    assert.equal(sensors.enabled, true);
    assert.equal(samples.length, 1);
    assert.deepEqual(samples[0].rawRotation, [90, 0, 0]);
    assert.deepEqual(samples[0].w, [Math.PI / 2, 0, 0]);
  } finally { sensors.dispose(); t.mock.timers.reset(); }
});
