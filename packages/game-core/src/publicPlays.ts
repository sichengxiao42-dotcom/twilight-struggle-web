import { opponent, type Side } from '@ts/shared';
import type { Action } from './actions';
import type { GameState, PublicPlay } from './state';

/** Runs only after a validated action. Stores public presentation data, never private choices. */
export function trackPublicPlays(before:GameState,next:GameState,side:Side,action:Action):GameState {
  const plays=next.publicPlays??[], p=before.phase;
  const add=(card:number,owner:Side,use:PublicPlay['use'],round:number)=>plays.push({id:(plays.at(-1)?.id??0)+1,card,side:owner,use,turn:before.turn,round,finished:false});
  if(('card' in action)&&['PLAY_EVENT','PLAY_OPS','SPACE','TRAP_DISCARD'].includes(action.type)&&(p.kind==='ACTION_ROUND'||p.kind==='SUBPLAY')) {
    // Some pre-play penalties can end the game without actually playing the chosen card.
    const played=p.kind==='SUBPLAY'||(action.card===6?next.chinaCard.holder!==before.chinaCard.holder:before.hands[side].includes(action.card)&&!next.hands[side].includes(action.card));
    if(played) {
      const use=action.type==='PLAY_OPS'?action.mode:action.type==='SPACE'?'SPACE':action.type==='TRAP_DISCARD'?'DISCARD':'EVENT';
      const round=p.kind==='ACTION_ROUND'?p.round:plays.find(play=>!play.finished)?.round??0;
      add(action.card,side,use,round);
    }
  }
  const committed=action.type==='SELECT_HEADLINE'&&!before.manualEnd&&p.kind==='HEADLINE'?action.card:action.type==='END_ACTION'&&p.kind==='CONFIRM_END'&&p.context==='HEADLINE'?before.pendingHeadline:undefined;
  if(committed!==undefined&&before.headlines[opponent(side)]!==undefined) {
    add(side==='US'?committed:before.headlines.US!,'US','HEADLINE',0);
    add(side==='USSR'?committed:before.headlines.USSR!,'USSR','HEADLINE',0);
  }
  const completed=next.turn!==before.turn||next.phase.kind==='ACTION_ROUND'||next.phase.kind==='GAME_OVER'||next.phase.kind==='M1_COMPLETE'||action.type==='END_ACTION'&&p.kind==='CONFIRM_END'&&p.context==='ACTION';
  if(completed)for(const play of plays)play.finished=true;
  if(plays.length||before.publicPlays)next.publicPlays=plays;
  return next;
}
