import { opponent, type Region, type Side } from '@ts/shared';
import { activeSide, apply, canPass, legalTargets, trapDiscards } from './actions';
import { ADJACENCY } from './data/adjacency';
import { CARD_BY_ID } from './data/cards';
import { COUNTRY_BY_ID } from './data/countries';
import { roundsFor } from './engine';
import { controller } from './rules';
import { scoreRegion, scoreSoutheastAsia } from './scoring';
import type { Action, OpsMode } from './actions';
import type { Decision, GameState } from './state';

const regions: Record<number, Region> = {1:'ASIA',2:'EUROPE',3:'MIDDLE_EAST',37:'CENTRAL_AMERICA',79:'AFRICA',83:'SOUTH_AMERICA'};
const sign = (side:Side) => side==='US'?1:-1;
const defconCards = [4,50,89];

/** A deterministic, rules-based sparring partner. No deck order, RNG cursor, secret
 * headlines or opponent hand is consulted when ranking actions. Validation uses
 * apply(), but simulated dice/results are never used to choose a lucky action. */
export function chooseBotAction(state:GameState):Action|null {
  const side=activeSide(state);if(!side)return null;
  const p=state.phase, candidates:{action:Action;score:number}[]=[];
  const add=(action:Action,score=0)=>candidates.push({action,score});
  if(p.kind==='CONFIRM_END')add({type:'END_ACTION'});
  if(p.kind==='SETUP_PLACEMENT')for(const country of legalTargets(state))add({type:'PLACE_SETUP',country},placementValue(state,side,country));
  if(p.kind==='HEADLINE')for(const card of state.hands[side])if(card!==32){
    const c=CARD_BY_ID.get(card)!;
    add({type:'SELECT_HEADLINE',card},c.scoring?30+scoringValue(state,side,card):eventValue(state,side,card)+(c.side===opponent(side)?-35:0));
  }
  if(p.kind==='ACTION_ROUND'||p.kind==='SUBPLAY'){
    const cards=p.kind==='SUBPLAY'?[p.card]:[...state.hands[side],...(state.chinaCard.holder===side&&state.chinaCard.faceUp?[6]:[])];
    const urgent=p.kind==='ACTION_ROUND'&&state.hands[side].filter(id=>CARD_BY_ID.get(id)!.scoring).length>=roundsFor(state,side)-p.round+1;
    for(const card of cards){
      const c=CARD_BY_ID.get(card)!;
      if(c.scoring){add({type:'PLAY_EVENT',card},urgent?1000:35+scoringValue(state,side,card));continue;}
      add({type:'PLAY_EVENT',card},eventValue(state,side,card));
      add({type:'SPACE',card},c.side===opponent(side)?24-c.ops:2-c.ops);
      add({type:'TRAP_DISCARD',card},trapDiscards(state,side).includes(card)?50-c.ops: -200);
      for(const mode of ['INFLUENCE','COUP','REALIGNMENT'] as const){
        const risk=c.side===opponent(side)&&state.defcon<=2&&defconCards.includes(card)?-500:0;
        const cost=card===6?-12:0;
        add({type:'PLAY_OPS',card,mode,order:defconCards.includes(card)?'BEFORE':'AFTER'},modeValue(state,side,mode,c.ops)+c.ops+cost+risk);
      }
    }
    if(p.kind==='ACTION_ROUND'&&canPass(state,side))add({type:'PASS_EMPTY'},-50);
  }
  if(p.kind==='OPS'){
    for(const country of legalTargets(state)){
      if(p.mode==='COUP'&&!safeCoup(state,side,country))continue;
      add({type:'TARGET',country},p.mode==='INFLUENCE'?placementValue(state,side,country):attackValue(state,side,country,p.ops));
    }
    add({type:'END_OPS'},-100);
  }
  if(p.kind==='DECISION'){
    const d=p.decision;
    if(d.kind==='REVEAL')add({type:'CHOOSE',value:'confirm'});
    if(d.kind==='CHOICE')for(const option of d.options)add({type:'CHOOSE',value:option.id},choiceValue(state,side,d,option.id));
    if(d.kind==='COUNTRY'||d.kind==='INFLUENCE'){
      for(const country of legalTargets(state)){
        let value=attackValue(state,side,country,3);
        if(d.kind==='INFLUENCE'){
          const removing=d.operation==='REMOVE'||d.operation==='CLEAR';
          value=placementValue(state,d.affected,country);
          if(removing)value=removalValue(state,d.affected,country);
          if((d.affected!==side)!==removing)value=-value;
        }
        add({type:'CHOOSE',value:country},value);
      }
      if(d.kind==='INFLUENCE'&&d.optional)add({type:'CHOOSE',value:'done'},-100);
    }
    if(d.kind==='OPS_MODE'){
      for(const mode of d.modes??['INFLUENCE','COUP','REALIGNMENT'])add({type:'CHOOSE',value:mode},modeValue(state,side,mode,d.base,d.only,d.free));
      add({type:'CHOOSE',value:'skip'},-100);
    }
  }
  candidates.sort((a,b)=>b.score-a.score);
  for(const {action} of candidates){
    try{apply(state,side,action);return action;}catch{/* Try the next legal candidate, never mutate authority. */}
  }
  return null;
}

function scoringValue(s:GameState,side:Side,card:number){
  return sign(side)*(card===38?scoreSoutheastAsia(s):regions[card]?scoreRegion(s,regions[card],{shuttle:Boolean(s.effects.shuttle)&&[1,3].includes(card)}).delta:0)*3;
}
function eventValue(s:GameState,side:Side,id:number){
  const c=CARD_BY_ID.get(id)!;
  if(s.defcon<=2&&defconCards.includes(id))return -500;
  if(c.side===opponent(side))return -100;
  if(c.scoring)return 35+scoringValue(s,side,id);
  if(id===6)return -200;
  // Reliable board development, OPS bonuses, purge and free space advances.
  const strong=[9,18,23,25,27,30,31,33,35,41,44,51,58,65,71,83,87,94];
  return (strong.includes(id)?29:14)+c.ops;
}
function placementValue(s:GameState,side:Side,id:string){
  const c=COUNTRY_BY_ID.get(id)!,inf=s.influence[id],gap=c.stability+inf[opponent(side)]-inf[side];
  const owner=controller(s,id);
  if(owner===side)return gap===0?2:-8-Math.abs(gap);
  const access=ADJACENCY[id].filter(n=>!s.influence[n][side]).length*.2;
  return (c.battleground?20:9)/Math.max(1,gap)+(gap===1?12:0)+access+(c.region==='ASIA'?1:0)-(owner===opponent(side)?3:0);
}
function removalValue(s:GameState,side:Side,id:string){
  const c=COUNTRY_BY_ID.get(id)!,inf=s.influence[id];
  const margin=inf[side]-inf[opponent(side)]-c.stability;
  return (c.battleground?15:7)+(controller(s,id)===side&&margin===0?12:0)-(margin>0?margin:0);
}
function safeCoup(s:GameState,side:Side,id:string){
  return s.effects.cmc!==side&&!(s.defcon<=2&&COUNTRY_BY_ID.get(id)!.battleground&&!(side==='US'&&s.effects.nuclearSubs));
}
function attackValue(s:GameState,side:Side,id:string,ops:number){
  const c=COUNTRY_BY_ID.get(id)!;
  return (c.battleground?12:3)+Math.max(0,3.5+ops-c.stability*2)*3+Math.min(3,s.influence[id][opponent(side)]);
}
function modeValue(s:GameState,side:Side,mode:OpsMode,ops:number,only?:string[],free?:boolean){
  if(mode==='INFLUENCE')return 20;
  const targets=[...COUNTRY_BY_ID.values()].filter(c=>(!only||only.includes(c.id))&&s.influence[c.id][opponent(side)]>0&&(free||!(s.defcon<=4&&c.region==='EUROPE'||s.defcon<=3&&c.region==='ASIA'||s.defcon<=2&&c.region==='MIDDLE_EAST')));
  if(mode==='COUP'){
    const best=Math.max(-100,...targets.filter(c=>safeCoup(s,side,c.id)).map(c=>attackValue(s,side,c.id,ops)));
    return best+(s.milOps[side]<s.defcon&&!free?8:0)-5;
  }
  return targets.length?5:-100;
}
function choiceValue(s:GameState,side:Side,d:Extract<Decision,{kind:'CHOICE'}>,value:string){
  if(d.event===20)return value==='participate'?20:-100;
  if(d.event===45)return value==='up'?20:value==='none'?10:-100;
  if(d.event===46)return value==='2'?20:value==='1'?-100:Number(value);
  if(d.event===100)return value==='end'?(sign(side)*s.vp>6?100:-100):0;
  if(d.event===16)return value==='add'?20:0;
  if(d.event===53)return value==='split'?20:0;
  if(d.event===67)return value==='return'?10:0;
  if(d.event===94)return value==='ASIA'?10:0;
  const card=CARD_BY_ID.get(Number(value));
  if(card){
    if(d.event===43||d.event===85)return eventValue(s,side,card.id)+card.ops;
    if(d.event===98)return card.scoring?30:card.ops*4+(card.side===opponent(side)?8:0);
    if(d.event===108)return card.side===opponent(side)?20: -20;
    if(d.event===77)return card.side===opponent(side)?20: -20;
    if(d.event===49)return card.side===side?20:0;
    return (card.side===opponent(side)?15:0)-card.ops;
  }
  if(COUNTRY_BY_ID.has(value))return attackValue(s,side,value,3);
  if(value==='done'||value==='keep'||value==='continue')return 1;
  if(value==='lose'||value==='refuse')return -30;
  return 0;
}
