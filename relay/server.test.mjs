import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { WebSocket } from 'ws';
import { createRelay, roomForKey } from './server.mjs';
const origin = 'https://changyi123456.github.io';
async function setup(t) {
  const relay = createRelay();
  await new Promise(resolve => relay.server.listen(0, '127.0.0.1', resolve));
  const url = `ws://127.0.0.1:${relay.server.address().port}/pair`;
  t.after(() => relay.close());
  const connect = async (join, customOrigin = origin) => {
    const ws = new WebSocket(url, { origin: customOrigin });
    const inbox = [];
    ws.on('message', value => inbox.push(JSON.parse(value)));
    await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
    ws.send(JSON.stringify(join));
    return { ws, inbox };
  };
  return { connect, url };
}
async function until(predicate) {
  for (let i = 0; i < 100; i++) { if (predicate()) return; await new Promise(r => setTimeout(r, 5)); }
  assert.fail('Expected relay state was not reached');
}
const hostJoin = () => { const key = randomBytes(32).toString('hex'); return { op: 'join', role: 'host', key, room: roomForKey(key) }; };

test('paired browsers exchange control and sensor packets, isolated from other rooms', async t => {
  const { connect } = await setup(t), a = hostJoin(), b = hostJoin();
  const host = await connect(a), other = await connect(b);
  await until(() => host.inbox.some(p => p.op === 'joined'));
  const phone = await connect({ op: 'join', role: 'phone', room: a.room, device: 'phone-1' });
  await until(() => host.inbox.some(p => p.op === 'ready'));
  host.ws.send(JSON.stringify({ op: 'activate' }));
  await until(() => phone.inbox.some(p => p.op === 'active'));
  const packet = { type: 'preview', samples: [{ g: [0, 0, 9.81], t: 0.25 }] };
  phone.ws.send(JSON.stringify({ op: 'data', packet }));
  await until(() => host.inbox.some(p => p.op === 'data'));
  assert.deepEqual(host.inbox.find(p => p.op === 'data').packet, packet);
  assert.equal(other.inbox.some(p => p.op === 'data'), false);
  host.ws.send(JSON.stringify({ op: 'data', packet: { type: 'start', runId: 'a' } }));
  await until(() => phone.inbox.some(p => p.packet?.type === 'start'));
});

test('a QR capability cannot impersonate the desktop; different phones cannot replace the owner', async t => {
  const { connect } = await setup(t), join = hostJoin();
  const host = await connect(join);
  await until(() => host.inbox.some(p => p.op === 'joined'));
  const impostor = await connect({ ...join, key: randomBytes(32).toString('hex') });
  await until(() => impostor.ws.readyState === WebSocket.CLOSED);
  const phone = await connect({ op: 'join', role: 'phone', room: join.room, device: 'owner' });
  await until(() => phone.inbox.some(p => p.op === 'ready'));
  const stranger = await connect({ op: 'join', role: 'phone', room: join.room, device: 'stranger' });
  await until(() => stranger.inbox.some(p => p.issue === 'pairingBusy'));
  const replacement = await connect({ op: 'join', role: 'phone', room: join.room, device: 'owner' });
  await until(() => replacement.inbox.some(p => p.op === 'ready'));
  await until(() => phone.ws.readyState === WebSocket.CLOSED);
  assert.equal(host.ws.readyState, WebSocket.OPEN);
});

test('unapproved origins and missing hosts are rejected', async t => {
  const { connect, url } = await setup(t);
  const denied = new WebSocket(url, { origin: 'https://unrelated.example' });
  await new Promise(resolve => denied.once('error', resolve));
  const missing = await connect({ op: 'join', role: 'phone', room: 'A'.repeat(24), device: 'phone' });
  await until(() => missing.inbox.some(p => p.issue === 'peerUnavailable'));
});
