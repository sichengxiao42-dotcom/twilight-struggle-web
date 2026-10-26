import type { Region, Side } from '@ts/shared';
import { CARDS, CHINA_CARD_ID } from './data/cards';
import { COUNTRIES } from './data/countries';
import { createRng, shuffle } from './rng';
import type { Action } from './actions';
import type { DiceRequest, DiceResult } from './dice';

export type Influence = Record<Side, number>;
export type OpsKind = 'INFLUENCE' | 'REALIGNMENT' | 'COUP';
/** Restrictions for OPS granted by an event: allowed countries, free coup (no military ops, ignores DEFCON regions), Che's follow-up. */
export interface OpsGrant { only?: string[]; free?: boolean; che?: boolean }

export type Phase =
  | { kind:'DICE_ROLL'; side:Side; id:number; request:DiceRequest; values:number[] }
  | { kind: 'CONFIRM_END'; side: Side; round: number; context: 'ACTION' | 'SETUP' | 'HEADLINE' }
  | { kind: 'SETUP_PLACEMENT'; side: Side; remaining: number; subRegion: 'EASTERN_EUROPE' | 'WESTERN_EUROPE' }
  | { kind: 'HEADLINE'; side: Side }
  | { kind: 'DECISION'; side: Side; decision: Decision }
  | { kind: 'M1_COMPLETE' }
  | ({ kind: 'OPS'; side: Side; round: number; mode: OpsKind; remaining: number; ops: number; eligible: string[]; china?: boolean; asiaOnly?: boolean; seaOnly?: boolean; militaryOps?: number } & OpsGrant)
  | { kind: 'ACTION_ROUND'; round: number; side: Side }
  /** Grain Sales: the US plays a card taken from the USSR hand as if it were its own. */
  | { kind: 'SUBPLAY'; side: Side; card: number }
  | { kind: 'GAME_OVER'; winner: Side | 'DRAW'; reason: string };


export type Decision =
  | { kind: 'INFLUENCE'; prompt: string; targets: string[]; affected: Side; operation: 'ADD' | 'REMOVE' | 'CLEAR' | 'MATCH' | 'DOUBLE'; remaining: number; perCountry: number; used: Record<string, number>; optional?: boolean; relocation?: boolean; singleCountry?: boolean; relocationPlaced?: Record<string, number>; relocationOriginal?: Record<string, number> }
  /** memo carries event-specific card lists (cards drawn, a taken card, a discard count). */
  | { kind: 'CHOICE'; prompt: string; options: { id: string; label: string }[]; event: number; actor: Side; phasing: Side; memo?: number[] }
  /** Pick one country on the board for an event (war targets, region-free choices). */
  | { kind: 'COUNTRY'; prompt: string; targets: string[]; event: number; actor: Side }
  | ({ kind: 'OPS_MODE'; prompt: string; base: number; china?: boolean; phasing: Side; modes?: OpsKind[] } & OpsGrant)
  | { kind: 'REVEAL'; prompt: string; cards: number[] };
export type Task =
  | { kind: 'EVENT'; card: number; actor: Side; phasing: Side; headline?: boolean }
  | { kind: 'DISPOSE'; card: number; event: boolean }
  | ({ kind: 'START_OPS'; side: Side; base: number; mode?: OpsKind; modes?: OpsKind[]; china?: boolean; asiaOnly?: boolean; seaOnly?: boolean } & OpsGrant)
  | { kind: 'SPACE_ROLL'; side: Side }
  | { kind: 'FINISH_ACTION'; side: Side; round: number; confirmed?: boolean }
  | { kind: 'FINISH_HEADLINES' }
  | { kind: 'END_TURN'; final?: boolean }
  | { kind: 'HELD_DISCARD'; side: Side }
  | { kind: 'CAMBRIDGE_PLACEMENT'; regions: Region[] };
export interface Effects {
  containment?: boolean; vietnam?: boolean; purge: Partial<Record<Side, boolean>>;
  nato?: boolean; warsaw?: boolean; marshall?: boolean; deGaulle?: boolean;
  japan?: boolean; formosan?: boolean; norad?: boolean; cia?: boolean;
  // Lasting for the current turn only (cleared in endTurn).
  /** Cuban Missile Crisis: this side loses if it attempts a coup. */
  cmc?: Side;
  nuclearSubs?: boolean; salt?: boolean; brezhnev?: boolean; u2?: boolean; iranContra?: boolean; yuri?: boolean; aldrich?: boolean;
  /** Latin American Death Squads beneficiary. */
  deathSquads?: Side;
  chernobyl?: Region;
  /** North Sea Oil: the US may take an eighth action round this turn. */
  northSeaRound?: boolean;
  // Lasting until cancelled, used, or for the rest of the game.
  quagmire?: boolean; bearTrap?: boolean;
  /** Missile Envy: this side must play card 49 for OPS on its next action round. */
  missileEnvy?: Side;
  /** "We Will Bury You": USSR gains 3 VP before the next US action unless UN Intervention is played. */
  buryYou?: boolean;
  shuttle?: boolean; flowerPower?: boolean; evilEmpire?: boolean; iranianHostage?: boolean; ironLady?: boolean;
  northSeaOil?: boolean; reformer?: boolean; campDavid?: boolean; johnPaul?: boolean; awacs?: boolean;
  tearDown?: boolean; willyBrandt?: boolean;
}

export interface GameState {
  manualDice?:boolean;
  /** Private continuation; never included in player views. Baselines do not nest. */
  pendingDice?:{base:GameState;actor:Side;action:Action;approved:number};
  /** Transaction-local counter, removed before returning any state. */
  diceReplay?:{allowed:number;used:number};
  diceHistory?:DiceResult[];
  /** Only publicly played cards; secret headline selections are never recorded here. */
  publicPlays?: PublicPlay[];
  /** Influence gains of the last finished step, animated as arrows on the board for both players. */
  strike?: import('./strikes').Strike;
  /** Last coup or realignment outcome, animated on the board for both players. */
  clash?: import('./strikes').Clash;
  /** Influence when the current step began; private bookkeeping, never sent to players. */
  strikeBase?: Record<string, Influence>;
  manualEnd?: boolean;
  pendingHeadline?: number;
  mode: 'PRACTICE' | 'STANDARD';
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

export interface PublicPlay {
  id: number;
  card: number;
  side: Side;
  use: 'EVENT' | 'HEADLINE' | 'SPACE' | 'DISCARD' | OpsKind;
  turn: number;
  round: number;
  finished: boolean;
}

export const HAND_SIZE = { early: 8, midLate: 9 } as const;

// 初始影响力（豪华版规则 3.2/3.3，已对照 2015 官方规则书核对）。
const INITIAL_INFLUENCE: Record<Side, Record<string, number>> = {
  USSR: { syria: 1, iraq: 1, north_korea: 3, east_germany: 3, finland: 1 },
  US: {
    canada: 2, iran: 1, israel: 1, japan: 1, australia: 4, philippines: 1,
    south_korea: 1, panama: 1, south_africa: 1, uk: 5,
  },
};

/** Static opening board only: no shuffle, deal, random seed or active local game. */
export function createBoardPreview():GameState {
  const influence: Record<string, Influence> = {};
  for (const country of COUNTRIES) {
    influence[country.id] = {
      USSR: INITIAL_INFLUENCE.USSR[country.id] ?? 0,
      US: INITIAL_INFLUENCE.US[country.id] ?? 0,
    };
  }

  return {
    mode:'STANDARD', tasks: [], effects: { purge: {} }, headlines: {}, spaceAttempts: { USSR: 0, US: 0 }, phasingSide: 'USSR', actionStartInfluence: null, noradPending: false,
    seed:0,
    rngCalls:0,
    turn: 1,
    // 苏联先在东欧自由放置 6 点，然后美国在西欧放置 7 点。
    phase: { kind: 'SETUP_PLACEMENT', side: 'USSR', remaining: 6, subRegion: 'EASTERN_EUROPE' },
    vp: 0,
    defcon: 5,
    milOps: { USSR: 0, US: 0 },
    space: { USSR: 0, US: 0 },
    influence,
    hands:{USSR:[],US:[]},
    deck:[],
    discard: [],
    removed: [],
    chinaCard: { holder: 'USSR', faceUp: true },
    log: [],
  };
}

export function createGame(seed:number,mode:GameState['mode']='STANDARD'):GameState {
  const rng=createRng(seed);let rngCalls=0;
  const counted=()=>{rngCalls++;return rng();};
  const deck=shuffle(CARDS.filter(c=>c.period==='EARLY'&&c.id!==CHINA_CARD_ID).map(c=>c.id),counted);
  const hands={USSR:deck.splice(0,HAND_SIZE.early),US:deck.splice(0,HAND_SIZE.early)};
  return {...createBoardPreview(),mode,seed,rngCalls,hands,deck,log:[`Game created with seed ${seed}`]};
}
