import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { createGameServer, type GameServer } from '../src/server.js';
import { createDefaultDesign, simulateMission } from '../../shared/index.js';
import type { RoomAck, TeamRoom } from '../../shared/team.js';

let game: GameServer;
let address: string;
const clients: Socket[] = [];

async function connect(origin?: string): Promise<Socket> {
  const socket = io(address, { transports: ['websocket'], forceNew: true, reconnection: false, ...(origin ? { extraHeaders: { Origin: origin } } : {}) });
  clients.push(socket);
  await new Promise<void>((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
  return socket;
}
async function request(socket: Socket, event: string, input?: unknown): Promise<RoomAck> {
  return input === undefined ? socket.timeout(2000).emitWithAck(event) : socket.timeout(2000).emitWithAck(event, input);
}
async function setupTeam(count = 2): Promise<{ sockets: Socket[]; room: TeamRoom }> {
  const sockets = [await connect()];
  const created = await request(sockets[0], 'room:create', { name: 'Director', design: createDefaultDesign(), seed: 'demo-2026' });
  expect(created.ok).toBe(true);
  let room = created.room!;
  for (let index = 1; index < count; index += 1) {
    const socket = await connect();
    sockets.push(socket);
    const joined = await request(socket, 'room:join', { name: `Player ${index + 1}`, code: room.code });
    expect(joined.ok).toBe(true);
    room = joined.room!;
  }
  return { sockets, room };
}
async function pass(sockets: Socket[], room: TeamRoom, input: Record<string, unknown>): Promise<TeamRoom> {
  const proposed = await request(sockets[0], 'room:propose', { ...input, revision: room.revision });
  expect(proposed.ok, JSON.stringify(proposed)).toBe(true);
  let next = proposed.room!;
  const proposalId = next.proposals.at(-1)!.id;
  for (let index = 1; index <= Math.floor(sockets.length / 2); index += 1) {
    const result = await request(sockets[index], 'room:vote', { proposalId, approve: true });
    expect(result.ok, JSON.stringify(result)).toBe(true);
    next = result.room!;
  }
  return next;
}

beforeEach(async () => {
  game = createGameServer();
  address = `http://127.0.0.1:${await game.listen(0, '127.0.0.1')}`;
});
afterEach(async () => {
  clients.splice(0).forEach(socket => socket.disconnect());
  await game.close();
});

describe('authoritative room protocol', () => {
  it('creates six-character rooms, combines roles, and caps membership at four', async () => {
    const { room } = await setupTeam(4);
    expect(room.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(room.players.flatMap(player => player.roles).sort()).toEqual(['director', 'engineering', 'operations', 'science']);
    const fifth = await connect();
    expect(await request(fifth, 'room:join', { name: 'Fifth', code: room.code })).toMatchObject({ ok: false, error: 'ROOM_FULL' });
  });

  it('rejects malformed designs and forged collaboration, and isolates unrelated sockets', async () => {
    const socket = await connect();
    expect(await request(socket, 'room:create', { name: 'Director', seed: 2026, design: {} })).toMatchObject({ ok: false, error: 'INVALID_DESIGN' });
    const design = createDefaultDesign();
    design.collaboration = { participants: 4, proposals: 999, resolvedConflicts: 99, approvedChanges: 99, roleBalance: 1 };
    design.responses = { fake: 'repair' };
    const created = await request(socket, 'room:create', { name: 'Director', seed: 2026, design });
    expect(created.room!.design.collaboration).toBeUndefined();
    expect(created.room!.design.responses).toEqual({});
    expect(created.room!.design.mode).toBe('online');
    const outsider = await connect();
    expect(await request(outsider, 'room:vote', { proposalId: 'forged', approve: true, playerId: socket.id })).toMatchObject({ ok: false, error: 'NOT_IN_ROOM' });
  });

  it('requires agreement, keeps canonical design through rejection, and records resolved negotiations', async () => {
    const { sockets, room } = await setupTeam();
    const changed = { ...room.design, name: 'Revised payload' };
    const proposed = await request(sockets[0], 'room:propose', { kind: 'design', design: changed, title: 'Payload proposal', revision: room.revision });
    expect(proposed.room!.design.name).toBe(room.design.name);
    const proposalId = proposed.room!.proposals[0].id;
    expect(await request(sockets[0], 'room:vote', { proposalId, approve: false })).toMatchObject({ ok: false, error: 'ALREADY_VOTED' });
    const rejected = await request(sockets[1], 'room:vote', { proposalId, approve: false });
    expect(rejected.room!.proposals[0].status).toBe('rejected');
    expect(rejected.room!.design.name).toBe(room.design.name);
    const accepted = await pass(sockets, rejected.room!, { kind: 'design', design: changed });
    expect(accepted.design.name).toBe('Revised payload');
    const launched = await pass(sockets, accepted, { kind: 'launch' });
    expect(launched.phase).toBe('simulation');
    expect(launched.design.collaboration).toMatchObject({ participants: 2, resolvedConflicts: 1, approvedChanges: 1 });
  });

  it('rejects stale proposals and cancels pending votes when membership changes', async () => {
    const { sockets, room } = await setupTeam();
    const chat = await request(sockets[1], 'room:chat', { text: 'Antenna check complete' });
    expect(await request(sockets[0], 'room:propose', { kind: 'launch', revision: room.revision })).toMatchObject({ ok: false, error: 'STALE_DESIGN' });
    const proposed = await request(sockets[0], 'room:propose', { kind: 'launch', revision: chat.room!.revision });
    expect(proposed.room!.proposals[0].status).toBe('pending');
    const third = await connect();
    const joined = await request(third, 'room:join', { name: 'Science', code: room.code.toLowerCase() });
    expect(joined.room!.proposals[0].status).toBe('cancelled');
    expect(joined.room!.phase).toBe('design');
  });

  it('does not launch a one-person room, transfers host, and deletes empty rooms', async () => {
    const { sockets, room } = await setupTeam();
    const left = await request(sockets[0], 'room:leave');
    expect(left.ok).toBe(true);
    const remaining = game.rooms.get(room.code)!;
    expect(remaining.hostId).toBe(sockets[1].id);
    expect(await request(sockets[1], 'room:propose', { kind: 'launch', revision: remaining.revision })).toMatchObject({ ok: false, error: 'NEED_TEAM' });
    await request(sockets[1], 'room:leave');
    expect(game.rooms.size).toBe(0);
  });

  it('synchronizes deterministic events, cannot skip a response, and guards finish', async () => {
    const { sockets, room } = await setupTeam();
    let current = await pass(sockets, room, { kind: 'launch' });
    const timeline = simulateMission(current.design, current.seed);
    const finalDay = timeline.days.at(-1)?.day ?? 0;
    expect(await request(sockets[1], 'room:advance', { day: finalDay })).toMatchObject({ ok: false, error: 'NOT_HOST' });
    if (finalDay > 0) {
      expect(await request(sockets[0], 'room:finish')).toMatchObject({ ok: false, error: 'MISSION_NOT_FINISHED' });
      expect(await request(sockets[0], 'room:advance', { day: finalDay + 1 })).toMatchObject({ ok: false, error: 'INVALID_INPUT' });
      const advanced = await request(sockets[0], 'room:advance', { day: finalDay });
      expect(advanced.ok).toBe(true);
      current = advanced.room!;
      expect(current.day).toBe(timeline.events[0]?.day ?? finalDay);
    }
    for (const event of timeline.events) {
      const advanced = current.day < event.day ? await request(sockets[0], 'room:advance', { day: event.day }) : { ok: true, room: current };
      current = advanced.room!;
      expect(await request(sockets[0], 'room:propose', { kind: 'response', eventId: event.id, choice: 'invented', revision: current.revision })).toMatchObject({ ok: false, error: 'INVALID_RESPONSE' });
      current = await pass(sockets, current, { kind: 'response', eventId: event.id, choice: event.choices[0].id });
      expect(current.design.responses[event.id]).toBe(event.choices[0].id);
    }
    if (current.day < finalDay) current = (await request(sockets[0], 'room:advance', { day: finalDay })).room!;
    const finished = await request(sockets[0], 'room:finish');
    expect(finished.ok, JSON.stringify(finished)).toBe(true);
    expect(finished.room!.phase).toBe('report');
    const redesigned = await pass(sockets, finished.room!, { kind: 'redesign' });
    expect(redesigned.phase).toBe('design');
    expect(redesigned.design.responses).toEqual({});
    expect(redesigned.design.scenarioId).toBe(room.design.scenarioId);
  });

  it('bounds and rate limits chat, serves a health endpoint, and rejects disallowed origins', async () => {
    const { sockets } = await setupTeam();
    expect(await request(sockets[0], 'room:chat', { text: 'a'.repeat(501) })).toMatchObject({ ok: false, error: 'INVALID_INPUT' });
    let limited = false;
    for (let count = 0; count < 20; count += 1) {
      const result = await request(sockets[0], 'room:chat', { text: 'bounded message' });
      if (result.error === 'RATE_LIMIT') limited = true;
    }
    expect(limited).toBe(true);
    expect(await (await fetch(`${address}/health`)).json()).toMatchObject({ status: 'ok', service: 'GameTechMx Frontier' });
    await expect(connect('https://untrusted.example')).rejects.toThrow();
  });
});
