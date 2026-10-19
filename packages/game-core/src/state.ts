import type { Side } from '@ts/shared';
import { CARDS, CHINA_CARD_ID } from './data/cards';
import { COUNTRIES } from './data/countries';
import { createRng, shuffle } from './rng';

export type Influence = Record<Side, number>;

export type Phase =
  | { kind: 'SETUP_PLACEMENT'; side: Side; remaining: number; subRegion: 'EASTERN_EUROPE' | 'WESTERN_EUROPE' }
  | { kind: 'HEADLINE'; side: Side }
  | { kind: 'DECISION'; side: Side; decision: Decision }
  | { kind: 'EARLY_WAR_COMPLETE' }
  | { kind: 'M1_COMPLETE' }
  | { kind: 'OPS'; side: Side; round: number; mode: 'INFLUENCE' | 'REALIGNMENT' | 'COUP'; remaining: number; ops: number; eligible: string[]; china?: boolean; asiaOnly?: boolean; seaOnly?: boolean; militaryOps?: number }
  | { kind: 'ACTION_ROUND'; round: number; side: Side }
  | { kind: 'GAME_OVER'; winner: Side | 'DRAW'; reason: string };


export type Decision =
  | { kind: 'INFLUENCE'; prompt: string; targets: string[]; affected: Side; operation: 'ADD' | 'REMOVE' | 'CLEAR' | 'MATCH'; remaining: number; perCountry: number; used: Record<string, number>; optional?: boolean; relocation?: boolean; singleCountry?: boolean }
  | { kind: 'CHOICE'; prompt: string; options: { id: string; label: string }[]; event: number; actor: Side; phasing: Side }
  | { kind: 'OPS_MODE'; prompt: string; base: number; china?: boolean; phasing: Side }
  | { kind: 'REVEAL'; prompt: string; cards: number[] };
export type Task =
  | { kind: 'EVENT'; card: number; actor: Side; phasing: Side; headline?: boolean }
  | { kind: 'DISPOSE'; card: number; event: boolean }
  | { kind: 'START_OPS'; side: Side; base: number; mode?: 'INFLUENCE' | 'REALIGNMENT' | 'COUP'; china?: boolean; asiaOnly?: boolean; seaOnly?: boolean }
  | { kind: 'FINISH_ACTION'; side: Side; round: number }
  | { kind: 'FINISH_HEADLINES' }
  | { kind: 'END_TURN'; final?: boolean }
  | { kind: 'HELD_DISCARD'; side: Side }
  | { kind: 'CAMBRIDGE_PLACEMENT'; regions: import('@ts/shared').Region[] };
export interface Effects {
  containment?: boolean; vietnam?: boolean; purge: Partial<Record<Side, boolean>>;
  nato?: boolean; warsaw?: boolean; marshall?: boolean; deGaulle?: boolean;
  japan?: boolean; formosan?: boolean; norad?: boolean; cia?: boolean;
}

export interface GameState {
  mode: 'PRACTICE' | 'EARLY_WAR';
  tasks: Task[];
  effects: Effects;
  headlines: Partial<Record<Side, number>>;
  spaceAttempts: Influence;
  phasingSide: Side;
  actionStartInfluence: Record<string, Influence> | null;
  noradPending: boolean;
  seed: number;
  /** 已消耗的随机数次数，用于从 seed 恢复 RNG。 */
  rngCalls: number;
  turn: number;
  phase: Phase;
  /** 正数 = 美国领先，负数 = 苏联领先。 */
  vp: number;
  defcon: number;
  milOps: Influence;
  space: Influence;
  influence: Record<string, Influence>;
  hands: Record<Side, number[]>;
  deck: number[];
  discard: number[];
  removed: number[];
  chinaCard: { holder: Side; faceUp: boolean };
  log: string[];
}

export const HAND_SIZE = { early: 8, midLate: 9 } as const;

// 初始影响力（豪华版规则 3.0），需对照规则书复核。
const INITIAL_INFLUENCE: Record<Side, Record<string, number>> = {
  USSR: { syria: 1, iraq: 1, north_korea: 3, east_germany: 3, finland: 1 },
  US: {
    canada: 2, iran: 1, israel: 1, japan: 1, australia: 4, philippines: 1,
    south_korea: 1, panama: 1, south_africa: 1, uk: 5,
  },
};

export function createGame(seed: number, mode: GameState['mode'] = 'EARLY_WAR'): GameState {
  const rng = createRng(seed);
  let rngCalls = 0;
  const counted = () => { rngCalls++; return rng(); };

  const earlyWar = CARDS.filter((c) => c.period === 'EARLY' && c.id !== CHINA_CARD_ID).map((c) => c.id);
  const deck = shuffle(earlyWar, counted);

  const influence: Record<string, Influence> = {};
  for (const country of COUNTRIES) {
    influence[country.id] = {
      USSR: INITIAL_INFLUENCE.USSR[country.id] ?? 0,
      US: INITIAL_INFLUENCE.US[country.id] ?? 0,
    };
  }

  const hands: Record<Side, number[]> = { USSR: deck.splice(0, HAND_SIZE.early), US: deck.splice(0, HAND_SIZE.early) };

  return {
    mode, tasks: [], effects: { purge: {} }, headlines: {}, spaceAttempts: { USSR: 0, US: 0 }, phasingSide: 'USSR', actionStartInfluence: null, noradPending: false,
    seed,
    rngCalls,
    turn: 1,
    // 苏联先在东欧自由放置 6 点，然后美国在西欧放置 7 点。
    phase: { kind: 'SETUP_PLACEMENT', side: 'USSR', remaining: 6, subRegion: 'EASTERN_EUROPE' },
    vp: 0,
    defcon: 5,
    milOps: { USSR: 0, US: 0 },
    space: { USSR: 0, US: 0 },
    influence,
    hands,
    deck,
    discard: [],
    removed: [],
    chinaCard: { holder: 'USSR', faceUp: true },
    log: [`Game created with seed ${seed}`],
  };
}
