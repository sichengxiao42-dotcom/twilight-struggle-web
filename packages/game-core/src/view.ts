import { opponent, type Side } from '@ts/shared';
import { activeSide, legalTargets } from './actions';
import type { GameState, Phase } from './state';

export type ViewPhase = Phase | { kind: 'WAITING'; side: Side };
export interface PlayerView {
  currentAction?: {side:Side;round:number};
  turn: number; phase: ViewPhase; vp: number; defcon: number;
  milOps: GameState['milOps']; space: GameState['space']; spaceAttempts: GameState['spaceAttempts'];
  influence: GameState['influence']; effects: GameState['effects'];
  hands: Record<Side,number[]>; handCounts: Record<Side,number>;
  discard: number[]; removed: number[]; deckCount: number;
  chinaCard: GameState['chinaCard']; log: string[];
  headlines: Partial<Record<Side,number>>; headlineCommitted: Record<Side,boolean>;
  targets: string[];
}
/** Whitelist public fields. Never serialize the seed, RNG cursor, task queue or deck order. */
export function viewFor(state:GameState,viewer:Side):PlayerView {
  const p=state.phase,finish=state.tasks.find(t=>t.kind==='FINISH_ACTION');
  const currentAction=p.kind==='ACTION_ROUND'||p.kind==='OPS'&&p.round?{side:p.side,round:p.round}:finish?.kind==='FINISH_ACTION'?{side:finish.side,round:finish.round}:undefined;
  const enemy=opponent(viewer), ownHeadline=state.headlines[viewer], otherHeadline=state.headlines[enemy];
  const headlines:Partial<Record<Side,number>>={};
  if(ownHeadline!==undefined)headlines[viewer]=ownHeadline;
  if(state.phase.kind==='HEADLINE'&&state.space[viewer]>=4&&state.space[enemy]<4&&otherHeadline!==undefined)headlines[enemy]=otherHeadline;
  const phase=state.phase.kind==='DECISION'&&state.phase.side!==viewer?{kind:'WAITING' as const,side:state.phase.side}:state.phase;
  return structuredClone({
    currentAction,
    turn:state.turn,phase,vp:state.vp,defcon:state.defcon,milOps:state.milOps,space:state.space,spaceAttempts:state.spaceAttempts,
    influence:state.influence,effects:state.effects,
    hands:{[viewer]:state.hands[viewer],[enemy]:(viewer==='US'&&state.effects.cia)||(viewer==='USSR'&&state.effects.aldrich)?state.hands[enemy]:[]} as Record<Side,number[]>,
    handCounts:{US:state.hands.US.length,USSR:state.hands.USSR.length},
    discard:state.discard,removed:state.removed,deckCount:state.deck.length,chinaCard:state.chinaCard,
    log:state.log.filter(line=>!line.startsWith('Game created with seed ')),headlines,
    headlineCommitted:{US:state.headlines.US!==undefined,USSR:state.headlines.USSR!==undefined},
    targets:activeSide(state)===viewer?legalTargets(state):[],
  });
}
