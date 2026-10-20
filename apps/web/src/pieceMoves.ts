import { controller, type Action, type GameState } from '@ts/game-core';
import type { Side } from '@ts/shared';

export type InfluencePiece = { kind: 'reserve'; side: Side } | { kind: 'influence'; side: Side; country: string };
export type Piece = InfluencePiece | { kind: 'track'; id: string };
export type Drop = { kind: 'country'; id: string } | { kind: 'reserve'; side: Side } | { kind: 'track'; id: string };

/** Drag gestures produce ordinary authority-validated actions, never a rewritten game state. */
export function influenceDrop(state: GameState, piece: InfluencePiece, drop: Drop, targets: string[]): Action | null {
  const p = state.phase;
  if (piece.kind === 'influence' && !(state.influence[piece.country]?.[piece.side] > 0)) return null;
  if (piece.kind === 'reserve' && drop.kind === 'country' && targets.includes(drop.id)) {
    if (p.kind === 'SETUP_PLACEMENT' && p.side === piece.side) return { type: 'PLACE_SETUP', country: drop.id };
    if (p.kind === 'OPS' && p.mode === 'INFLUENCE' && p.side === piece.side) return { type: 'TARGET', country: drop.id };
    if (p.kind === 'DECISION' && p.decision.kind === 'INFLUENCE' && p.decision.affected === piece.side && ['ADD', 'MATCH', 'DOUBLE'].includes(p.decision.operation)) return { type: 'CHOOSE', value: drop.id };
  }
  if (piece.kind === 'influence' && p.kind === 'DECISION' && p.decision.kind === 'INFLUENCE' && p.decision.affected === piece.side) {
    const d = p.decision;
    if (drop.kind === 'reserve' && drop.side === piece.side && targets.includes(piece.country) && ['REMOVE', 'CLEAR'].includes(d.operation)) return { type: 'CHOOSE', value: piece.country };
    if (drop.kind === 'country' && d.relocation && d.operation === 'REMOVE' && piece.country !== drop.id && targets.includes(piece.country) && state.influence[drop.id] && controller(state, drop.id) !== 'US' && (d.relocationPlaced?.[drop.id] ?? 0) < 2) return { type: 'RELOCATE_INFLUENCE', from: piece.country, to: drop.id };
  }
  return null;
}

export function parseDrop(element: Element | null): Drop | null {
  const node = element?.closest('[data-country-id],[data-reserve-side],[data-track-drop]');
  const country = node?.getAttribute('data-country-id');
  if (country) return { kind: 'country', id: country };
  const side = node?.getAttribute('data-reserve-side');
  if (side === 'US' || side === 'USSR') return { kind: 'reserve', side };
  const track = node?.getAttribute('data-track-drop');
  return track ? { kind: 'track', id: track } : null;
}
