import type { MissionDesign } from './types.js';
import { calculateResources } from './engine/resources.js';

export type TeamRole = 'director' | 'engineering' | 'science' | 'operations';
export type TeamPhase = 'design' | 'simulation' | 'report';
export type ProposalKind = 'design' | 'launch' | 'response' | 'redesign';
export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface TeamPlayer {
  id: string;
  name: string;
  roles: TeamRole[];
}

export interface TeamProposal {
  id: string;
  authorId: string;
  kind: ProposalKind;
  title: string;
  design?: MissionDesign;
  eventId?: string;
  choice?: string;
  votes: Record<string, boolean>;
  status: ProposalStatus;
  createdAt: number;
}

export interface TeamMessage {
  id: string;
  playerId: string;
  name: string;
  text: string;
  createdAt: number;
}

/** Structured activity keys are translated by the client. No HTML is accepted. */
export interface TeamLogEntry {
  id: string;
  type: 'joined' | 'left' | 'proposed' | 'approved' | 'rejected' | 'cancelled' | 'launched' | 'responded' | 'redesigned' | 'finished';
  actor: string;
  detail: string;
  createdAt: number;
}

/** Plain serializable state, also usable by offline hot-seat play. */
export interface TeamRoom {
  code: string;
  hostId: string;
  players: TeamPlayer[];
  design: MissionDesign;
  seed: string | number;
  phase: TeamPhase;
  day: number;
  revision: number;
  proposals: TeamProposal[];
  chat: TeamMessage[];
  log: TeamLogEntry[];
}

export type RoomError =
  | 'INVALID_INPUT' | 'ROOM_NOT_FOUND' | 'ROOM_FULL' | 'ALREADY_IN_ROOM'
  | 'NOT_IN_ROOM' | 'NOT_HOST' | 'WRONG_PHASE' | 'PROPOSAL_PENDING'
  | 'PROPOSAL_NOT_FOUND' | 'ALREADY_VOTED' | 'NEED_TEAM' | 'RATE_LIMIT'
  | 'INVALID_DESIGN' | 'INVALID_RESPONSE' | 'STALE_DESIGN' | 'MISSION_NOT_FINISHED';

export interface RoomAck {
  ok: boolean;
  error?: RoomError;
  room?: TeamRoom;
  playerId?: string;
}

export interface CreateRoomInput { name: string; design: MissionDesign; seed: string | number }
export interface JoinRoomInput { name: string; code: string }
export interface ProposeInput {
  kind: ProposalKind;
  title?: string;
  /** Optimistic concurrency: proposals based on an older revision are rejected. */
  revision: number;
  design?: MissionDesign;
  eventId?: string;
  choice?: string;
}
export interface VoteInput { proposalId: string; approve: boolean }
export interface ChatInput { text: string }
export interface AdvanceInput { day: number }

export interface ServerToClientEvents {
  'room:state': (room: TeamRoom) => void;
}
export interface ClientToServerEvents {
  'room:create': (input: CreateRoomInput, ack: (result: RoomAck) => void) => void;
  'room:join': (input: JoinRoomInput, ack: (result: RoomAck) => void) => void;
  'room:propose': (input: ProposeInput, ack: (result: RoomAck) => void) => void;
  'room:vote': (input: VoteInput, ack: (result: RoomAck) => void) => void;
  'room:chat': (input: ChatInput, ack: (result: RoomAck) => void) => void;
  'room:advance': (input: AdvanceInput, ack: (result: RoomAck) => void) => void;
  'room:finish': (ack: (result: RoomAck) => void) => void;
  'room:leave': (ack: (result: RoomAck) => void) => void;
}

/** Every responsibility remains assigned with 2 or 3 people. */
export function assignRoles(players: Pick<TeamPlayer, 'id' | 'name'>[]): TeamPlayer[] {
  const roleGroups: TeamRole[][] = players.length <= 2
    ? [['director', 'operations'], ['engineering', 'science']]
    : players.length === 3
      ? [['director', 'operations'], ['engineering'], ['science']]
      : [['director'], ['engineering'], ['science'], ['operations']];
  return players.map((player, index) => ({ ...player, roles: roleGroups[index] ?? [] }));
}

/** Strict majority; ties remain pending until everyone votes, then reject. */
export function resolveVote(votes: Record<string, boolean>, playerIds: string[]): ProposalStatus {
  const eligibleVotes = playerIds.filter(id => Object.hasOwn(votes, id));
  const yes = eligibleVotes.filter(id => votes[id]).length;
  const no = eligibleVotes.length - yes;
  const majority = Math.floor(playerIds.length / 2) + 1;
  if (yes >= majority) return 'approved';
  if (no >= majority || eligibleVotes.length === playerIds.length) return 'rejected';
  return 'pending';
}

/** Dissent resolved by majority or an accepted revision after rejection earns credit once. */
export function teamCollaboration(proposals: TeamProposal[], players: TeamPlayer[]): {
  participants: number; proposals: number; resolvedConflicts: number; participation: number;
} {
  const closed = proposals.filter(proposal => proposal.status === 'approved' || proposal.status === 'rejected');
  const participants = new Set(closed.flatMap(proposal => Object.keys(proposal.votes)).filter(id => players.some(player => player.id === id)));
  const rejected = new Set<string>();
  let resolvedConflicts = 0;
  for (const proposal of closed) {
    const negotiation = `${proposal.authorId}:${proposal.kind}`;
    if (proposal.status === 'rejected') rejected.add(negotiation);
    if (proposal.status === 'approved') {
      if (rejected.has(negotiation) || Object.values(proposal.votes).includes(false)) resolvedConflicts += 1;
      rejected.delete(negotiation);
    }
  }
  return {
    participants: participants.size,
    proposals: closed.length,
    resolvedConflicts,
    participation: players.length ? participants.size / players.length : 0,
  };
}

/** Shared evidence for local and online play. Role goals reward a balanced design. */
export function enrichTeamDesign(room: Pick<TeamRoom, 'design' | 'proposals' | 'players'>): MissionDesign {
  const summary = teamCollaboration(room.proposals, room.players);
  const resources = calculateResources(room.design);
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const goals = [
    clamp(resources.budgetMarginM / Math.max(resources.budgetM * 0.2, 0.01)),
    Math.min(clamp(resources.launchCapacityKg / Math.max(resources.massKg, 1)), clamp(resources.powerRatio)),
    clamp(resources.sciencePerDay / 10),
    clamp(resources.dataRatio),
  ];
  const mean = goals.reduce((sum, value) => sum + value, 0) / goals.length;
  return {
    ...room.design,
    collaboration: {
      participants: summary.participants,
      proposals: summary.proposals,
      resolvedConflicts: summary.resolvedConflicts,
      approvedChanges: room.proposals.filter(proposal => proposal.status === 'approved' && proposal.kind === 'design').length,
      roleBalance: (mean + Math.min(...goals)) / 2,
    },
  };
}
