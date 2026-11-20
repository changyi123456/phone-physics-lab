import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function roomForKey(key) {
  return [...createHash('sha256').update(key).digest().subarray(0, 24)]
    .map(v => ALPHABET[v % 32]).join('');
}
export function createRelay({ origins = ['https://changyi123456.github.io'], maxRooms = 128 } = {}) {
  const rooms = new Map();
  const server = createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(req.url === '/health' ? 200 : 404);
    res.end(JSON.stringify({ service: 'Phylab relay', protocol: 1 }));
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 524288, perMessageDeflate: false });
  server.on('upgrade', (req, socket, head) => {
    if (req.url !== '/pair' || !origins.includes(req.headers.origin) || wss.clients.size >= 300) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
  });
  const send = (ws, value) => {
    if (ws?.readyState !== WebSocket.OPEN) return false;
    if (ws.bufferedAmount > 262144) { ws.close(1013, 'Slow connection'); return false; }
    ws.send(JSON.stringify(value)); return true;
  };
  const ready = room => {
    if (room.host && room.phone) {
      for (const ws of [room.host, room.phone]) send(ws, { op: 'ready', device: room.owner });
    }
  };
  wss.on('connection', ws => {
    let room, role, alive = true, windowAt = Date.now(), bytes = 0;
    const joinDeadline = setTimeout(() => ws.close(1008, 'Join required'), 10000);
    ws.on('pong', () => { alive = true; });
    ws.on('error', () => {}); // Socket errors never log room keys or readings.
    ws.on('message', (raw, binary) => {
      if (binary) { ws.close(1008, 'JSON required'); return; }
      if (Date.now() - windowAt > 10000) { windowAt = Date.now(); bytes = 0; }
      bytes += raw.length;
      if (bytes > 8 * 1024 * 1024) { ws.close(1008, 'Rate limit'); return; }
      let p;
      try { p = JSON.parse(raw.toString()); } catch { ws.close(1008, 'Invalid JSON'); return; }
      if (!p || typeof p !== 'object') { ws.close(1008, 'Invalid packet'); return; }
      if (!room) {
        if (p.op !== 'join' || !/^[A-Z2-9]{24}$/.test(p.room) || !['host', 'phone'].includes(p.role)) {
          ws.close(1008, 'Invalid join'); return;
        }
        role = p.role;
        if (role === 'host') {
          if (typeof p.key !== 'string' || !/^[a-f0-9]{64}$/.test(p.key) || roomForKey(p.key) !== p.room) {
            ws.close(1008, 'Invalid host proof'); return;
          }
          room = rooms.get(p.room);
          if (!room) {
            if (rooms.size >= maxRooms) { ws.close(1013, 'Relay busy'); return; }
            room = { code: p.room, owner: '', host: null, phone: null, active: false, emptyAt: 0 };
            rooms.set(p.room, room);
          }
        } else {
          room = rooms.get(p.room);
          if (!room?.host) { send(ws, { op: 'error', issue: 'peerUnavailable' }); ws.close(1008, 'Host unavailable'); room = undefined; return; }
          if (typeof p.device !== 'string' || !/^[\w-]{1,80}$/.test(p.device) || (room.owner && room.owner !== p.device)) {
            send(ws, { op: 'error', issue: 'pairingBusy' }); ws.close(1008, 'Phone already paired'); room = undefined; return;
          }
          room.owner = p.device;
        }
        const previous = room[role];
        room[role] = ws;
        room.active = false;
        room.emptyAt = 0;
        previous?.close(1000, 'Replaced by same device');
        clearTimeout(joinDeadline);
        send(ws, { op: 'joined' });
        ready(room);
        return;
      }
      if (room[role] !== ws) return;
      if (p.op === 'activate' && role === 'host' && room.host && room.phone) {
        room.active = true;
        for (const client of [room.host, room.phone]) send(client, { op: 'active', device: room.owner });
      } else if (p.op === 'data' && room.active && p.packet && typeof p.packet === 'object' && typeof p.packet.type === 'string') {
        // Forward only to this room's other device. No histories, files or DB.
        send(room[role === 'host' ? 'phone' : 'host'], { op: 'data', packet: p.packet });
      }
    });
    ws.on('close', () => {
      clearTimeout(joinDeadline);
      if (!room || room[role] !== ws) return;
      room[role] = null;
      room.active = false;
      room.emptyAt = Date.now();
      send(room[role === 'host' ? 'phone' : 'host'], { op: 'unpaired' });
    });
    ws.checkAlive = () => {
      if (!alive) { ws.terminate(); return; }
      alive = false; ws.ping();
    };
  });
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) ws.checkAlive();
    for (const [key, room] of rooms) {
      if (room.emptyAt && Date.now() - room.emptyAt > 10 * 60 * 1000) {
        room.host?.close(1000, 'Room expired'); room.phone?.close(1000, 'Room expired'); rooms.delete(key);
      }
    }
  }, 25000);
  heartbeat.unref();
  return {
    server,
    async close() {
      clearInterval(heartbeat);
      for (const ws of wss.clients) ws.terminate();
      await new Promise(resolve => wss.close(resolve));
      if (server.listening) await new Promise(resolve => server.close(resolve));
    },
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = createRelay();
  app.server.listen(Number(process.env.PORT) || 8080, '0.0.0.0', () => console.log('Phylab relay ready'));
  process.on('SIGTERM', async () => { await app.close(); process.exit(0); });
}
