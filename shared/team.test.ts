import { describe, expect, it } from 'vitest';
import { assignRoles, resolveVote, teamCollaboration, type TeamProposal } from './team.js';

const proposal = (status: TeamProposal['status'], votes: Record<string, boolean>): TeamProposal => ({ id: 'proposal', authorId: 'a', kind: 'design', title: 'Proposal', votes, status, createdAt: 0 });

describe('shared local/online team rules', () => {
  it.each([2, 3, 4])('assigns all four responsibilities to %i players', count => {
    const players = assignRoles(Array.from({ length: count }, (_, index) => ({ id: String(index), name: `Player ${index}` })));
    expect(players.flatMap(player => player.roles).sort()).toEqual(['director', 'engineering', 'operations', 'science']);
  });
  it('ignores votes by outsiders and rejects tied completed ballots', () => {
    expect(resolveVote({ a: true, outsider: true }, ['a', 'b'])).toBe('pending');
    expect(resolveVote({ a: true, b: false }, ['a', 'b'])).toBe('rejected');
    expect(resolveVote({ a: true, b: true }, ['a', 'b', 'c'])).toBe('approved');
  });
  it('credits a negotiated revision once and counts participation', () => {
    const players = assignRoles([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]);
    const evidence = teamCollaboration([
      proposal('rejected', { a: true, b: false }),
      proposal('approved', { a: true, b: true }),
      proposal('approved', { a: true, b: true }),
    ], players);
    expect(evidence).toEqual({ participants: 2, proposals: 3, resolvedConflicts: 1, participation: 1 });
  });
});
