import type { GameState } from '@ts/game-core';
import type { Side } from '@ts/shared';
import { ACTION_ROUND_TRACK, DEFCON_TRACK, MIL_OPS_TRACK, SPACE_TRACK, TRACK_MARKER_RADIUS, TURN_TRACK, VP_TRACK } from './mapPositions';

export interface TrackPiece { id: string; owner: Side | 'neutral'; label: string; title: string; value: number; at: [number,number] }
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
/** Public track values only. The engine remains authoritative; dragging acknowledges a legal result. */
export function trackPieces(state: GameState): TrackPiece[] {
  const p=state.phase,finish=state.tasks.find(t=>t.kind==='FINISH_ACTION');
  const ar=p.kind==='ACTION_ROUND'||p.kind==='OPS'&&p.round?{side:p.side,round:p.round}:finish?.kind==='FINISH_ACTION'?finish:null;
  const turn=clamp(state.turn,1,10),defcon=clamp(state.defcon,1,5),vp=clamp(state.vp,-20,20);
  const pieces:TrackPiece[]=[
    {id:'turn',owner:'neutral',label:'回合',title:`回合标记 → 第 ${turn} 回合`,value:turn,at:TURN_TRACK[turn-1]},
    {id:'defcon',owner:'neutral',label:'核',title:`核威胁标记 → DEFCON ${defcon}`,value:defcon,at:DEFCON_TRACK[defcon]},
    {id:'vp',owner:'neutral',label:'VP',title:`胜利分标记 → ${vp>0?'美国 +'+vp:vp<0?'苏联 +'+-vp:'0'}`,value:vp,at:VP_TRACK[vp]},
  ];
  for(const side of ['USSR','US'] as const){
    const label=side==='US'?'美':'苏',name=side==='US'?'美国':'苏联',space=clamp(state.space[side],0,8),mil=clamp(state.milOps[side],0,5);
    const round=ar?clamp(side===ar.side||side==='USSR'?ar.round:ar.round-1,0,8):0;
    pieces.push({id:'space-'+side,owner:side,label,title:`${name}太空标记 → ${space}`,value:space,at:SPACE_TRACK[space]},
      {id:'mil-'+side,owner:side,label,title:`${name}军事行动标记 → ${mil}`,value:mil,at:MIL_OPS_TRACK[mil]},
      {id:'round-'+side,owner:side,label,title:`${name}行动轮标记 → ${round||'待行动'}`,value:round,at:round?ACTION_ROUND_TRACK[round-1]:[1455,465]});
  }
  // Keep each side on a fixed lane: an unchanged counter never needs a cosmetic recentering drag.
  return pieces.map(piece=>({...piece,at:[piece.at[0]+(piece.owner==='neutral'?0:(piece.owner==='USSR'?-0.8:0.8)*TRACK_MARKER_RADIUS),piece.at[1]]}));
}
export function trackNeedsMove(placed: TrackPiece | undefined, target: TrackPiece): boolean {
  return Boolean(placed&&(placed.value!==target.value||placed.at[0]!==target.at[0]||placed.at[1]!==target.at[1]));
}
