import type { Wire } from './link';
type EventName = 'open' | 'data' | 'close' | 'error' | 'ready' | 'waiting';
type Handler = (value?: any) => void;
export async function roomFromKey(key: string) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)));
  return [...hash.slice(0, 24)].map(v => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[v % 32]).join('');
}
// Keep disabled in production until an approved, deployed endpoint is configured.
export const relayURL = import.meta.env?.VITE_RELAY_URL ?? '';
export class RelayConnection {
  open = false;
  alive = true;
  metadata: { room: string; protocol: number; device: string };
  private socket: WebSocket;
  private handlers = new Map<EventName, Set<Handler>>();
  private deadline: ReturnType<typeof setTimeout>;
  constructor(url: string, room: string, role: 'host' | 'phone', device: string, key = '') {
    this.metadata = { room, protocol: 1, device };
    this.socket = new WebSocket(url);
    this.deadline = setTimeout(() => this.close(), 25000);
    this.socket.addEventListener('open', () => {
      this.socket.send(JSON.stringify({ op: 'join', room, role, device, ...(role === 'host' ? { key } : {}) }));
    });
    this.socket.addEventListener('message', event => {
      if (!this.alive || typeof event.data !== 'string') return;
      let p;
      try { p = JSON.parse(event.data); } catch { return; }
      if (!p || typeof p !== 'object') return;
      if (p.op === 'joined') { clearTimeout(this.deadline); this.emit('waiting'); }
      if (p.op === 'ready' && typeof p.device === 'string') {
        this.metadata.device = p.device; this.emit('ready');
      }
      if (p.op === 'active' && typeof p.device === 'string') {
        this.metadata.device = p.device; this.open = true; this.emit('open');
      }
      if (p.op === 'unpaired') {
        const wasOpen = this.open; this.open = false;
        if (wasOpen) this.emit('close');
        this.emit('waiting');
      }
      if (p.op === 'error') this.emit('error', typeof p.issue === 'string' ? p.issue : 'relayUnavailable');
      if (p.op === 'data' && this.open) this.emit('data', p.packet);
    });
    this.socket.addEventListener('error', () => this.emit('error', 'relayUnavailable'));
    this.socket.addEventListener('close', () => {
      clearTimeout(this.deadline);
      if (!this.alive) return;
      this.alive = false; this.open = false; this.emit('close');
    });
  }
  get dataChannel() { return { bufferedAmount: this.socket.bufferedAmount }; }
  on(event: EventName, handler: Handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler); return this;
  }
  off(event: EventName, handler: Handler) { this.handlers.get(event)?.delete(handler); return this; }
  private emit(event: EventName, value?: unknown) {
    for (const handler of [...(this.handlers.get(event) ?? [])]) handler(value);
  }
  activate() {
    if (this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ op: 'activate' }));
  }
  send(packet: Wire) {
    if (!this.open || this.socket.readyState !== WebSocket.OPEN) throw new Error('Relay disconnected');
    this.socket.send(JSON.stringify({ op: 'data', packet }));
  }
  close() {
    clearTimeout(this.deadline);
    if (!this.alive) return;
    this.alive = false; this.open = false; this.socket.close(); this.emit('close');
  }
}
