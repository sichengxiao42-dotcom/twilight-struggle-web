import type { Side } from '@ts/shared';
import { COUNTRIES } from './data/countries';
import type { GameState, Influence } from './state';

/** One country whose influence rose for a side during the step that just ended. */
export interface StrikeArrow { side: Side; country: string; amount: number }
/** Public summary of a finished step, used to animate arrows from the superpower to the countries it gained in. */
export interface Strike { id: number; arrows: StrikeArrow[] }

/**
 * Identifies the step a player is working through: setup placement for one side, the headline phase,
 * or one action round. The influence snapshot is compared when this key changes.
 */
function stepKey(s: GameState): string {
  const p = s.phase;
  if (p.kind === 'SETUP_PLACEMENT' || p.kind === 'CONFIRM_END' && p.context === 'SETUP') return 'setup-' + p.side;
  if (p.kind === 'GAME_OVER' || p.kind === 'M1_COMPLETE') return 'over';
  if (p.kind === 'HEADLINE' || p.kind === 'CONFIRM_END' && p.context === 'HEADLINE') return 'headline-' + s.turn;
  const finish = s.tasks.find(t => t.kind === 'FINISH_ACTION');
  const round = p.kind === 'ACTION_ROUND' || p.kind === 'CONFIRM_END' || p.kind === 'OPS' && p.round ? { side: p.side, round: p.round }
    : finish?.kind === 'FINISH_ACTION' ? { side: finish.side, round: finish.round } : null;
  // Event decisions and OPS outside an action round belong to the headline phase.
  return round ? `action-${s.turn}-${round.round}-${round.side}` : 'headline-' + s.turn;
}

function gains(base: Record<string, Influence>, now: Record<string, Influence>): StrikeArrow[] {
  return COUNTRIES.flatMap(c => (['USSR', 'US'] as const).flatMap(side => {
    const amount = now[c.id][side] - base[c.id][side];
    return amount > 0 ? [{ side, country: c.id, amount }] : [];
  }));
}

/** Runs after every validated action: when a step ends, records which countries each side gained influence in. */
export function trackStrikes(before: GameState, next: GameState): GameState {
  const base = before.strikeBase ?? before.influence;
  // A pending dice roll is part of the same step; keep the snapshot until the action resolves.
  if (next.phase.kind === 'DICE_ROLL') { next.strikeBase = structuredClone(base); return next; }
  if (stepKey(before) !== stepKey(next)) {
    const arrows = gains(base, next.influence);
    if (arrows.length) next.strike = { id: (before.strike?.id ?? 0) + 1, arrows };
    next.strikeBase = structuredClone(next.influence);
  } else next.strikeBase = structuredClone(base);
  return next;
}

/** Public outcome of one coup or realignment roll, animated on the board for both players. */
export type Clash = { id: number; side: Side; country: string } & (
  | { kind: 'COUP'; roll: number; total: number; need: number; removed: number; added: number; defconDrop: boolean }
  | { kind: 'REALIGN'; rolls: [number, number]; modifiers: [number, number]; winner: Side | null; removed: number }
);
