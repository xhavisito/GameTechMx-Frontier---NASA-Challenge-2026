import { createServer, type Server as HttpServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { Server, type Socket } from 'socket.io';
import { parseDesign, simulateMission } from '../../shared/index.js';
import type { MissionDesign } from '../../shared/types.js';
import {
  assignRoles, resolveVote, enrichTeamDesign,
  type ClientToServerEvents, type ServerToClientEvents, type RoomAck, type RoomError,
  type TeamRoom, type TeamProposal, type TeamLogEntry,
} from '../../shared/team.js';

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type Ack = (value: RoomAck) => void;
type Input = Record<string, unknown>;
export interface GameServerOptions {
  /** Browser origins allowed by the deployment. Empty means local Vite only. */
  corsOrigins?: string[];
  maxRooms?: number;
  now?: () => number;
}
export interface GameServer {
  httpServer: HttpServer;
  io: Server<ClientToServerEvents, ServerToClientEvents>;
  /** Read-only by convention, exposed for lifecycle inspection and tests. */
  rooms: Map<string, TeamRoom>;
  listen: (port?: number, host?: string) => Promise<number>;
  close: () => Promise<void>;
}

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_ROOMS = 200;
const isObject = (value: unknown): value is Input => typeof value === 'object' && value !== null && !Array.isArray(value);
const validText = (value: unknown, max: number): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
const validSeed = (value: unknown): value is string | number => (typeof value === 'string' && validText(value, 80)) || (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffffff);

/** In-memory, server-authoritative rooms. A process restart intentionally ends rooms. */
export function createGameServer(options: GameServerOptions = {}): GameServer {
  const now = options.now ?? Date.now;
  const rooms = new Map<string, TeamRoom>();
  const membership = new Map<string, string>();
  const rateLimits = new Map<string, { tokens: number; last: number }>();
  const allowedOrigins = options.corsOrigins?.length ? options.corsOrigins : ['http://localhost:5173', 'http://127.0.0.1:5173'];
  const httpServer = createServer((req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ status: 'ok', service: 'GameTechMx Frontier', rooms: rooms.size }));
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
  });
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
    // Restrict WebSocket handshakes as well as browser HTTP polling.
    allowRequest: (req, callback) => callback(null, !req.headers.origin || allowedOrigins.includes(req.headers.origin)),
    maxHttpBufferSize: 24_000,
    serveClient: false,
    pingTimeout: 15_000,
  });

  const id = () => randomBytes(8).toString('hex');
  function log(room: TeamRoom, type: TeamLogEntry['type'], actor: string, detail = '') {
    room.log.push({ id: id(), type, actor, detail, createdAt: now() });
    room.log = room.log.slice(-100);
  }
  function publish(room: TeamRoom) {
    room.revision += 1;
    io.to(room.code).emit('room:state', structuredClone(room));
  }
  function reply(ack: unknown, value: RoomAck) {
    if (typeof ack === 'function') (ack as Ack)(value);
  }
  function fail(ack: unknown, error: RoomError) { reply(ack, { ok: false, error }); }
  function success(ack: unknown, socket: GameSocket, room?: TeamRoom) {
    reply(ack, { ok: true, ...(room ? { room: structuredClone(room) } : {}), playerId: socket.id });
  }
  function getRoom(socket: GameSocket, ack: unknown): TeamRoom | undefined {
    const code = membership.get(socket.id);
    const room = code ? rooms.get(code) : undefined;
    if (!room) fail(ack, 'NOT_IN_ROOM');
    return room;
  }
  // Token bucket: a short burst permits normal controls; sustained spam is bounded.
  function permitted(socket: GameSocket, ack: unknown, cost = 1) {
    const time = now();
    const bucket = rateLimits.get(socket.id) ?? { tokens: 30, last: time };
    bucket.tokens = Math.min(30, bucket.tokens + Math.max(0, time - bucket.last) / 250);
    bucket.last = time;
    rateLimits.set(socket.id, bucket);
    if (bucket.tokens < cost) { fail(ack, 'RATE_LIMIT'); return false; }
    bucket.tokens -= cost;
    return true;
  }
  function cleanDesign(value: unknown): MissionDesign | null {
    const design = parseDesign(value);
    if (!design) return null;
    // Collaboration evidence and event responses are earned inside this room.
    const clean = structuredClone(design);
    clean.mode = 'online';
    clean.responses = {};
    delete clean.collaboration;
    return clean;
  }
  function applyProposal(room: TeamRoom, proposal: TeamProposal) {
    if (proposal.kind === 'design' && proposal.design) {
      room.design = structuredClone(proposal.design);
    } else if (proposal.kind === 'launch') {
      room.phase = 'simulation';
      room.day = 0;
      room.design = enrichTeamDesign(room);
      log(room, 'launched', proposal.authorId, String(room.seed));
    } else if (proposal.kind === 'response' && proposal.eventId && proposal.choice) {
      room.design = { ...room.design, responses: { ...room.design.responses, [proposal.eventId]: proposal.choice } };
      room.design = enrichTeamDesign(room);
      log(room, 'responded', proposal.authorId, `${proposal.eventId}:${proposal.choice}`);
    } else if (proposal.kind === 'redesign') {
      room.phase = 'design';
      room.day = 0;
      room.design = { ...room.design, responses: {} };
      delete room.design.collaboration;
      log(room, 'redesigned', proposal.authorId);
    }
  }
  function resolve(room: TeamRoom, proposal: TeamProposal) {
    proposal.status = resolveVote(proposal.votes, room.players.map(player => player.id));
    if (proposal.status === 'approved') {
      log(room, 'approved', proposal.authorId, proposal.title);
      applyProposal(room, proposal);
    } else if (proposal.status === 'rejected') {
      log(room, 'rejected', proposal.authorId, proposal.title);
    }
  }
  function leave(socket: GameSocket) {
    const code = membership.get(socket.id);
    membership.delete(socket.id);
    if (!code) return;
    void socket.leave(code);
    const room = rooms.get(code);
    if (!room) return;
    const departing = room.players.find(player => player.id === socket.id);
    room.players = assignRoles(room.players.filter(player => player.id !== socket.id));
    if (!room.players.length) { rooms.delete(code); return; }
    if (room.hostId === socket.id) room.hostId = room.players[0].id;
    log(room, 'left', departing?.name ?? socket.id);
    // Membership changes invalidate pending ballots instead of silently approving them.
    for (const proposal of room.proposals) {
      if (proposal.status === 'pending') {
        proposal.status = 'cancelled';
        log(room, 'cancelled', departing?.name ?? socket.id, proposal.title);
      }
    }
    publish(room);
  }

  io.on('connection', socket => {
    socket.on('room:create', (raw, ack) => {
      if (!permitted(socket, ack, 3)) return;
      if (membership.has(socket.id)) return fail(ack, 'ALREADY_IN_ROOM');
      if (!isObject(raw) || !validText(raw.name, 32) || !validSeed(raw.seed)) return fail(ack, 'INVALID_INPUT');
      const design = cleanDesign(raw.design);
      if (!design) return fail(ack, 'INVALID_DESIGN');
      if (rooms.size >= (options.maxRooms ?? MAX_ROOMS)) return fail(ack, 'ROOM_FULL');
      let code = '';
      do { code = Array.from(randomBytes(6), byte => ROOM_ALPHABET[byte % ROOM_ALPHABET.length]).join(''); } while (rooms.has(code));
      const room: TeamRoom = {
        code, hostId: socket.id, players: assignRoles([{ id: socket.id, name: raw.name.trim() }]),
        design, seed: raw.seed, phase: 'design', day: 0, revision: 0, proposals: [], chat: [], log: [],
      };
      rooms.set(code, room);
      membership.set(socket.id, code);
      void socket.join(code);
      log(room, 'joined', raw.name.trim());
      publish(room);
      success(ack, socket, room);
    });
    socket.on('room:join', (raw, ack) => {
      if (!permitted(socket, ack, 3)) return;
      if (membership.has(socket.id)) return fail(ack, 'ALREADY_IN_ROOM');
      if (!isObject(raw) || !validText(raw.name, 32) || typeof raw.code !== 'string' || !/^[A-Z2-9]{6}$/i.test(raw.code)) return fail(ack, 'INVALID_INPUT');
      const room = rooms.get(raw.code.toUpperCase());
      if (!room) return fail(ack, 'ROOM_NOT_FOUND');
      if (room.players.length >= 4) return fail(ack, 'ROOM_FULL');
      if (room.phase !== 'design') return fail(ack, 'WRONG_PHASE');
      // Changing the electorate requires a new proposal.
      room.proposals.filter(proposal => proposal.status === 'pending').forEach(proposal => { proposal.status = 'cancelled'; log(room, 'cancelled', raw.name.trim(), proposal.title); });
      room.players = assignRoles([...room.players, { id: socket.id, name: raw.name.trim(), roles: [] }]);
      membership.set(socket.id, room.code);
      void socket.join(room.code);
      log(room, 'joined', raw.name.trim());
      publish(room);
      success(ack, socket, room);
    });
    socket.on('room:propose', (raw, ack) => {
      if (!permitted(socket, ack, 2)) return;
      const room = getRoom(socket, ack);
      if (!room) return;
      if (!isObject(raw) || !['design', 'launch', 'response', 'redesign'].includes(String(raw.kind)) || !Number.isInteger(raw.revision) || (raw.title !== undefined && !validText(raw.title, 120))) return fail(ack, 'INVALID_INPUT');
      if (raw.revision !== room.revision) return fail(ack, 'STALE_DESIGN');
      if (room.players.length < 2) return fail(ack, 'NEED_TEAM');
      if (room.proposals.some(proposal => proposal.status === 'pending')) return fail(ack, 'PROPOSAL_PENDING');
      const kind = raw.kind as TeamProposal['kind'];
      if ((kind === 'design' || kind === 'launch') && room.phase !== 'design') return fail(ack, 'WRONG_PHASE');
      if (kind === 'response' && room.phase !== 'simulation') return fail(ack, 'WRONG_PHASE');
      if (kind === 'redesign' && room.phase !== 'report') return fail(ack, 'WRONG_PHASE');
      const proposal: TeamProposal = {
        id: id(), authorId: socket.id, kind, title: typeof raw.title === 'string' ? raw.title.trim() : kind,
        votes: { [socket.id]: true }, status: 'pending', createdAt: now(),
      };
      if (kind === 'design') {
        const design = cleanDesign(raw.design);
        if (!design) return fail(ack, 'INVALID_DESIGN');
        proposal.design = design;
      }
      if (kind === 'response') {
        if (!validText(raw.eventId, 80) || !validText(raw.choice, 32)) return fail(ack, 'INVALID_INPUT');
        const event = simulateMission(room.design, room.seed).events.find(item => item.id === raw.eventId);
        if (!event || event.day > room.day || room.design.responses[event.id] || !event.choices.some(choice => choice.id === raw.choice)) return fail(ack, 'INVALID_RESPONSE');
        proposal.eventId = raw.eventId;
        proposal.choice = raw.choice;
      }
      room.proposals.push(proposal);
      room.proposals = room.proposals.slice(-100);
      log(room, 'proposed', socket.id, proposal.title);
      resolve(room, proposal);
      publish(room);
      success(ack, socket, room);
    });
    socket.on('room:vote', (raw, ack) => {
      if (!permitted(socket, ack)) return;
      const room = getRoom(socket, ack);
      if (!room) return;
      if (!isObject(raw) || !validText(raw.proposalId, 32) || typeof raw.approve !== 'boolean') return fail(ack, 'INVALID_INPUT');
      const proposal = room.proposals.find(item => item.id === raw.proposalId && item.status === 'pending');
      if (!proposal) return fail(ack, 'PROPOSAL_NOT_FOUND');
      if (Object.hasOwn(proposal.votes, socket.id)) return fail(ack, 'ALREADY_VOTED');
      proposal.votes[socket.id] = raw.approve;
      resolve(room, proposal);
      publish(room);
      success(ack, socket, room);
    });
    socket.on('room:chat', (raw, ack) => {
      if (!permitted(socket, ack, 2)) return;
      const room = getRoom(socket, ack);
      if (!room) return;
      if (!isObject(raw) || !validText(raw.text, 500)) return fail(ack, 'INVALID_INPUT');
      room.chat.push({ id: id(), playerId: socket.id, name: room.players.find(player => player.id === socket.id)!.name, text: raw.text.trim(), createdAt: now() });
      room.chat = room.chat.slice(-100);
      publish(room);
      success(ack, socket, room);
    });
    socket.on('room:advance', (raw, ack) => {
      if (!permitted(socket, ack, 0.25)) return;
      const room = getRoom(socket, ack);
      if (!room) return;
      if (room.hostId !== socket.id) return fail(ack, 'NOT_HOST');
      if (room.phase !== 'simulation') return fail(ack, 'WRONG_PHASE');
      if (!isObject(raw) || !Number.isInteger(raw.day) || Number(raw.day) <= room.day) return fail(ack, 'INVALID_INPUT');
      const timeline = simulateMission(room.design, room.seed);
      const finalDay = timeline.days.at(-1)?.day ?? 0;
      if (Number(raw.day) > finalDay) return fail(ack, 'INVALID_INPUT');
      // The host controls animation speed, but cannot skip an unanswered event.
      const pendingEvent = timeline.events.find(event => !event.responded && event.day <= Number(raw.day));
      room.day = pendingEvent ? pendingEvent.day : Number(raw.day);
      publish(room);
      success(ack, socket, room);
    });
    socket.on('room:finish', ack => {
      if (!permitted(socket, ack)) return;
      const room = getRoom(socket, ack);
      if (!room) return;
      if (room.hostId !== socket.id) return fail(ack, 'NOT_HOST');
      if (room.phase !== 'simulation') return fail(ack, 'WRONG_PHASE');
      const timeline = simulateMission(room.design, room.seed);
      const finalDay = timeline.days.at(-1)?.day ?? 0;
      if (room.day < finalDay || timeline.events.some(event => !event.responded && event.day <= finalDay)) return fail(ack, 'MISSION_NOT_FINISHED');
      room.phase = 'report';
      room.design = enrichTeamDesign(room);
      log(room, 'finished', socket.id);
      publish(room);
      success(ack, socket, room);
    });
    socket.on('room:leave', ack => { leave(socket); success(ack, socket); });
    socket.on('disconnect', () => { leave(socket); rateLimits.delete(socket.id); });
  });

  return {
    httpServer, io, rooms,
    listen: (port = 3001, host = '0.0.0.0') => new Promise((resolve, reject) => {
      httpServer.once('error', reject);
      httpServer.listen(port, host, () => {
        httpServer.off('error', reject);
        const address = httpServer.address();
        resolve(typeof address === 'object' && address ? address.port : port);
      });
    }),
    close: () => new Promise(resolve => {
      io.close(() => { rooms.clear(); membership.clear(); rateLimits.clear(); resolve(); });
    }),
  };
}
