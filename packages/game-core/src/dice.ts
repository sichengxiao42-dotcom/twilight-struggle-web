import type { Side } from '@ts/shared';
import { createRng, rollDie } from './rng';
import type { GameState } from './state';

export interface DiceRequest { title:string; detail:string; rollers:Side[] }
export interface DiceResult extends DiceRequest { id:number; values:number[] }

/** Suspension happens before drawing any die. The action wrapper retains a private
 * baseline so serializable actions can resume without duplicating earlier effects. */
export class DiceRequired extends Error {
  constructor(readonly state:GameState,readonly request:DiceRequest){super('等待玩家掷骰');}
}
export function nextDie(state:GameState){
  const rng=createRng(state.seed);for(let i=0;i<state.rngCalls;i++)rng();
  state.rngCalls++;return rollDie(rng);
}
export function rollDice(state:GameState,request:DiceRequest):number[]{
  if(state.manualDice){
    const replay=state.diceReplay;
    if(!replay||replay.used>=replay.allowed)throw new DiceRequired(state,request);
    replay.used++;
  }
  return request.rollers.map(()=>nextDie(state));
}
