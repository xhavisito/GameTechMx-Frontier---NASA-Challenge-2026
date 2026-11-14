import { create } from 'zustand';
import { io, type Socket } from 'socket.io-client';
import { parseDesign, simulateMission } from '../../shared/index';
import { assignRoles, resolveVote, enrichTeamDesign, type TeamRoom, type TeamProposal, type RoomAck, type RoomError, type ClientToServerEvents, type ServerToClientEvents, type ProposeInput } from '../../shared/team';
import type { MissionDesign } from '../../shared/types';

export type TeamAction =
  | { kind: 'design'; design: MissionDesign }
  | { kind: 'launch' }
  | { kind: 'response'; eventId: string; choice: string }
  | { kind: 'redesign' }
  | { kind: 'advance'; day: number }
  | { kind: 'finish' }
  | { kind: 'seed'; seed: string };
type TeamError = RoomError | 'CONNECTION_FAILED' | 'NOT_CONNECTED' | 'INVALID_SERVER' | 'SEED_LOCKED' | 'TIMEOUT';
type Connection = 'idle' | 'connecting' | 'connected' | 'disconnected';
interface TeamState {
  room: TeamRoom | null;
  transport: 'local' | 'online' | null;
  playerId: string | null;
  connection: Connection;
  error: TeamError | null;
  handoff: boolean;
  initLocal: (names: string[], design: MissionDesign, seed: string) => void;
  connectOnline: (endpoint: string, name: string, design: MissionDesign, seed: string, code?: string) => void;
  dispatch: (action: TeamAction) => void;
  vote: (proposalId: string, approve: boolean) => void;
  chat: (text: string) => void;
  pass: (playerId?: string) => void;
  ready: () => void;
  leave: () => void;
  clearError: () => void;
}

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
let sequence = 0;
const uid = () => `${Date.now().toString(36)}-${(++sequence).toString(36)}`;
const clone = <T,>(value: T): T => structuredClone(value);

const withEvidence = (room: TeamRoom): MissionDesign => enrichTeamDesign(room);

function localLog(room: TeamRoom, type: TeamRoom['log'][number]['type'], actor: string, detail = '') {
  room.log.push({ id: uid(), type, actor, detail, createdAt: Date.now() });
  room.log = room.log.slice(-100);
}

function settle(room: TeamRoom, proposal: TeamProposal) {
  proposal.status = resolveVote(proposal.votes, room.players.map(player => player.id));
  if (proposal.status === 'pending') return;
  const actor = room.players.find(player => player.id === proposal.authorId)?.name || '';
  localLog(room, proposal.status === 'approved' ? 'approved' : 'rejected', actor, proposal.title);
  if (proposal.status !== 'approved') return;
  if (proposal.kind === 'design' && proposal.design) room.design = { ...clone(proposal.design), mode: 'local', responses: {} };
  if (proposal.kind === 'launch') {
    room.design = { ...room.design, responses: {} };
    room.phase = 'simulation';
    room.day = 0;
    localLog(room, 'launched', actor);
  }
  if (proposal.kind === 'response' && proposal.eventId && proposal.choice) {
    room.design = { ...room.design, responses: { ...room.design.responses, [proposal.eventId]: proposal.choice } };
    localLog(room, 'responded', actor, proposal.eventId);
  }
  if (proposal.kind === 'redesign') {
    room.phase = 'design';
    room.day = 0;
    room.design = { ...room.design, responses: {} };
    localLog(room, 'redesigned', actor);
  }
  room.design = withEvidence(room);
}

const ackResult = (ack: RoomAck) => {
  if (!ack.ok) useTeam.setState({ error: ack.error || 'INVALID_INPUT' });
  else useTeam.setState({ ...(ack.room ? { room: ack.room } : {}), ...(ack.playerId ? { playerId: ack.playerId } : {}), error: null });
};

export const useTeam = create<TeamState>((set, get) => ({
  room: null,
  transport: null,
  playerId: null,
  connection: 'idle',
  error: null,
  handoff: false,
  initLocal(names, design, seed) {
    if (names.length < 2 || names.length > 4 || names.some(name => !name.trim() || name.trim().length > 24)) return set({ error: 'INVALID_INPUT' });
    socket?.disconnect();
    socket = null;
    const players = assignRoles(names.map((name, index) => ({ id: `local-${index + 1}`, name: name.trim() })));
    const room: TeamRoom = {
      code: 'LOCAL', hostId: players[0].id, players, design: { ...clone(design), mode: 'local', responses: {} },
      seed, phase: 'design', day: 0, revision: 1, proposals: [], chat: [], log: [],
    };
    players.forEach(player => localLog(room, 'joined', player.name));
    room.design = withEvidence(room);
    set({ room, playerId: players[0].id, transport: 'local', connection: 'connected', error: null, handoff: false });
  },
  connectOnline(endpoint, name, design, seed, code) {
    try {
      const url = new URL(endpoint);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
      if (location.protocol === 'https:' && url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error();
    } catch { return set({ error: 'INVALID_SERVER' }); }
    if (!name.trim() || name.trim().length > 24 || (code && !/^[A-Z0-9]{6}$/.test(code))) return set({ error: 'INVALID_INPUT' });
    socket?.disconnect();
    set({ room: null, playerId: null, transport: 'online', connection: 'connecting', error: null });
    const next = io(endpoint, { reconnection: false, timeout: 8000, transports: ['websocket', 'polling'] });
    socket = next;
    next.on('room:state', room => set({ room, error: null }));
    next.on('connect_error', () => set({ connection: 'disconnected', error: 'CONNECTION_FAILED' }));
    next.on('disconnect', () => set({ connection: 'disconnected', error: 'NOT_CONNECTED' }));
    next.on('connect', () => {
      set({ connection: 'connected' });
      const ack = (error: Error | null, result: RoomAck) => {
        if (error) return set({ error: 'TIMEOUT', connection: 'disconnected' });
        ackResult(result);
      };
      if (code) next.timeout(8000).emit('room:join', { name: name.trim(), code }, ack);
      else next.timeout(8000).emit('room:create', { name: name.trim(), design, seed }, ack);
    });
  },
  dispatch(action) {
    const { room, transport, playerId, connection } = get();
    if (!room || !playerId || (transport === 'online' && connection !== 'connected')) return set({ error: 'NOT_CONNECTED' });
    if (action.kind === 'seed') return set({ error: 'SEED_LOCKED' });
    if (transport === 'online') {
      if (!socket?.connected) return set({ error: 'NOT_CONNECTED' });
      if (action.kind === 'advance') {
        if (room.hostId === playerId) socket.emit('room:advance', { day: action.day }, ackResult);
      } else if (action.kind === 'finish') {
        if (room.hostId === playerId) socket.emit('room:finish', ackResult);
      } else {
        const proposal: ProposeInput = { ...action, revision: room.revision };
        socket.emit('room:propose', proposal, ackResult);
      }
      return;
    }
    const next = clone(room);
    if (action.kind === 'advance' || action.kind === 'finish') {
      if (room.phase !== 'simulation') return;
      const timeline = simulateMission(room.design, room.seed);
      const lastDay = timeline.days.at(-1)?.day || 0;
      if (action.kind === 'advance') {
        if (!Number.isFinite(action.day) || action.day <= room.day) return;
        const unanswered = timeline.events.find(event => !room.design.responses[event.id] && event.day >= room.day && event.day <= action.day);
        next.day = Math.min(Math.floor(action.day), unanswered?.day ?? lastDay, lastDay);
      } else {
        if (room.day < lastDay || timeline.events.some(event => event.day <= lastDay && !room.design.responses[event.id])) return set({ error: 'MISSION_NOT_FINISHED' });
        next.phase = 'report';
        localLog(next, 'finished', next.players.find(player => player.id === playerId)?.name || '');
      }
      next.revision++;
      return set({ room: next, error: null });
    }
    if (next.proposals.some(proposal => proposal.status === 'pending')) return set({ error: 'PROPOSAL_PENDING' });
    if ((action.kind === 'design' || action.kind === 'launch') && room.phase !== 'design') return set({ error: 'WRONG_PHASE' });
    if (action.kind === 'response' && room.phase !== 'simulation') return set({ error: 'WRONG_PHASE' });
    if (action.kind === 'redesign' && room.phase !== 'report') return set({ error: 'WRONG_PHASE' });
    if (action.kind === 'design' && !parseDesign(action.design)) return set({ error: 'INVALID_DESIGN' });
    if (action.kind === 'response') {
      const event = simulateMission(room.design, room.seed).events.find(event => event.id === action.eventId && event.day <= room.day);
      if (!event || !event.choices.some(choice => choice.id === action.choice) || room.design.responses[action.eventId]) return set({ error: 'INVALID_RESPONSE' });
    }
    const proposal: TeamProposal = {
      id: uid(), authorId: playerId, kind: action.kind, title: action.kind,
      ...(action.kind === 'design' ? { design: clone(action.design) } : {}),
      ...(action.kind === 'response' ? { eventId: action.eventId, choice: action.choice } : {}),
      votes: { [playerId]: true }, status: 'pending', createdAt: Date.now(),
    };
    next.proposals.push(proposal);
    next.proposals = next.proposals.slice(-100);
    localLog(next, 'proposed', next.players.find(player => player.id === playerId)?.name || '', proposal.title);
    settle(next, proposal);
    next.revision++;
    set({ room: next, error: null });
  },
  vote(proposalId, approve) {
    const { room, playerId, transport } = get();
    if (!room || !playerId) return;
    if (transport === 'online') {
      if (!socket?.connected) return set({ error: 'NOT_CONNECTED' });
      socket.emit('room:vote', { proposalId, approve }, ackResult);
      return;
    }
    const next = clone(room);
    const proposal = next.proposals.find(proposal => proposal.id === proposalId && proposal.status === 'pending');
    if (!proposal) return set({ error: 'PROPOSAL_NOT_FOUND' });
    if (Object.hasOwn(proposal.votes, playerId)) return set({ error: 'ALREADY_VOTED' });
    proposal.votes[playerId] = approve;
    settle(next, proposal);
    next.design = withEvidence(next);
    next.revision++;
    set({ room: next, error: null });
  },
  chat(text) {
    const { room, playerId, transport } = get();
    const message = text.trim().slice(0, 500);
    if (!room || !playerId || !message) return;
    if (transport === 'online') {
      if (!socket?.connected) return set({ error: 'NOT_CONNECTED' });
      socket.emit('room:chat', { text: message }, ackResult);
      return;
    }
    const next = clone(room);
    const player = room.players.find(player => player.id === playerId)!;
    next.chat.push({ id: uid(), playerId, name: player.name, text: message, createdAt: Date.now() });
    next.chat = next.chat.slice(-100);
    next.revision++;
    set({ room: next, error: null });
  },
  pass(id) {
    const { room, playerId, transport } = get();
    if (!room || transport !== 'local') return;
    const index = room.players.findIndex(player => player.id === playerId);
    const next = id ? room.players.find(player => player.id === id) : room.players[(index + 1) % room.players.length];
    if (next) set({ playerId: next.id, handoff: true, error: null });
  },
  ready: () => set({ handoff: false }),
  leave() {
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }
    set({ room: null, playerId: null, transport: null, connection: 'idle', error: null, handoff: false });
  },
  clearError: () => set({ error: null }),
}));
