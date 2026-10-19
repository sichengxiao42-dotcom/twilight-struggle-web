import { opponent, type Side, type Region } from '@ts/shared';
import { COUNTRIES, COUNTRY_BY_ID } from './data/countries';
import { ADJACENCY } from './data/adjacency';
import { CARD_BY_ID } from './data/cards';
import { controller, vpWinner } from './rules';
import { createRng, shuffle } from './rng';
import { scoreRegion } from './scoring';
import type { Decision, GameState, Task, Phase } from './state';

export function random(s:GameState) {
  const rng=createRng(s.seed);for(let i=0;i<s.rngCalls;i++)rng();s.rngCalls++;return rng();
}
export const die=(s:GameState)=>1+Math.floor(random(s)*6);
export function addVp(s:GameState,side:Side,n:number) {
  s.vp+=(side==='US'?1:-1)*n;
  s.log.push(side+' 获得 '+n+' VP（总计 '+s.vp+'）');
  const winner=vpWinner(s.vp);if(winner)s.phase={kind:'GAME_OVER',winner,reason:'VP 达到 20'};
}
export function changeDefcon(s:GameState,delta:number) {
  s.defcon=Math.min(5,s.defcon+delta);s.log.push('DEFCON → '+s.defcon);
  if(s.defcon===1)s.phase={kind:'GAME_OVER',winner:opponent(s.phasingSide),reason:s.phasingSide+' 引发核战争'};
  if(s.defcon===2&&delta<0&&s.effects.norad)s.noradPending=true;
}
export const modifiedOps=(s:GameState,side:Side,base:number)=>Math.max(1,Math.min(4,base+Number(Boolean(side==='US'&&s.effects.containment))-Number(Boolean(s.effects.purge[side]))));
export function protectedCountry(s:GameState,id:string,side:Side) {
  return side==='USSR' && ((id==='japan'&&s.effects.japan) || (s.effects.nato&&COUNTRY_BY_ID.get(id)!.region==='EUROPE'&&controller(s,id)==='US'&&!(id==='france'&&s.effects.deGaulle)));
}
export function influenceTargets(d:Extract<Decision,{kind:'INFLUENCE'}>,s:GameState) {
  return d.targets.filter(id=>(d.used[id]??0)<d.perCountry && (d.operation==='REMOVE'||d.operation==='CLEAR'?s.influence[id][d.affected]>0:d.operation==='MATCH'?s.influence[id].US<s.influence[id].USSR:true));
}
function influence(s:GameState,side:Side,targets:string[],remaining:number,perCountry:number,operation:Extract<Decision,{kind:'INFLUENCE'}>['operation']='ADD',affected:Side=side,prompt='选择国家',optional=false,relocation=false,singleCountry=false) {
  const decision:Extract<Decision,{kind:'INFLUENCE'}>={kind:'INFLUENCE',prompt,targets,remaining,perCountry,operation,affected,used:{},optional,relocation,singleCountry};
  if(remaining>0&&influenceTargets(decision,s).length)s.phase={kind:'DECISION',side,decision};
}
function choice(s:GameState,side:Side,event:number,actor:Side,options:[string,string][],prompt:string,phasing=s.phasingSide) {
  s.phase={kind:'DECISION',side,decision:{kind:'CHOICE',event,actor,phasing,prompt,options:options.map(([id,label])=>({id,label}))}};
}
function reveal(s:GameState,side:Side,cards:number[],prompt:string) {
  s.phase={kind:'DECISION',side,decision:{kind:'REVEAL',cards:[...cards],prompt}};
}
const ids=(predicate:(c:typeof COUNTRIES[number])=>boolean)=>COUNTRIES.filter(predicate).map(c=>c.id);
const east=()=>ids(c=>c.subRegions.includes('EASTERN_EUROPE'));
const west=()=>ids(c=>c.subRegions.includes('WESTERN_EUROPE'));
const sign=(side:Side)=>side==='US'?1:-1;
function control(s:GameState,id:string,side:Side) { s.influence[id][side]=Math.max(s.influence[id][side],s.influence[id][opponent(side)]+COUNTRY_BY_ID.get(id)!.stability); }
function remove(s:GameState,id:string,side:Side,n:number) {s.influence[id][side]=Math.max(0,s.influence[id][side]-n);}
function war(s:GameState,side:Side,target:string,israel=false) {
  const enemy=opponent(side),mod=ADJACENCY[target].filter(id=>controller(s,id)===enemy).length+Number(israel&&controller(s,target)===enemy),roll=die(s);
  s.milOps[side]=Math.min(5,s.milOps[side]+2);
  s.log.push(side+' 战争 '+COUNTRY_BY_ID.get(target)!.nameZh+'：骰 '+roll+' − 修正 '+mod);
  if(roll-mod>=4){s.influence[target][side]+=s.influence[target][enemy];s.influence[target][enemy]=0;addVp(s,side,2);}
}
const SPACE_VP:Record<number,[number,number]>={1:[2,1],3:[2,0],5:[3,1],7:[4,2],8:[2,0]};
export function advanceSpace(s:GameState,side:Side) {
  if(s.space[side]>=8)return;
  const next=++s.space[side],values=SPACE_VP[next];s.log.push(side+' 太空竞赛 → '+next);
  if(values)addVp(s,side,values[s.space[opponent(side)]>=next?1:0]);
}
export function scoring(s:GameState,region:Region) {
  const r=scoreRegion(s,region);
  s.log.push(region+' 计分：美 '+r.US.status+' '+r.US.points+'（战场 '+r.US.battlegrounds+' / 邻接 '+r.US.adjacent+'），苏 '+r.USSR.status+' '+r.USSR.points+'（战场 '+r.USSR.battlegrounds+' / 邻接 '+r.USSR.adjacent+'）');
  if(r.winner)s.phase={kind:'GAME_OVER',winner:r.winner,reason:'控制欧洲'};
  else {s.vp+=r.delta;const winner=vpWinner(s.vp);if(winner)s.phase={kind:'GAME_OVER',winner,reason:'VP 达到 20'};}
}
export const SCORING_REGIONS:Record<number,Region>={1:'ASIA',2:'EUROPE',3:'MIDDLE_EAST'};
export function canEvent(s:GameState,id:number) {
  if(id===6)return false;
  if(id===21)return Boolean(s.effects.marshall||s.effects.warsaw);
  if(id===105)return controller(s,'uk')==='US';
  if(id===104)return s.turn<8;
  return true;
}
function event(s:GameState,t:Extract<Task,{kind:'EVENT'}>) {
  const card=CARD_BY_ID.get(t.card)!,side=card.side==='NEUTRAL'?t.actor:card.side;
  s.phasingSide=t.phasing;
  if(!canEvent(s,card.id)){s.log.push(card.nameZh+'：前置条件不满足，事件不生效');return;}
  // Turn the scheduled disposal into removal only if this event can take effect.
  const disposal=s.tasks.find(x=>x.kind==='DISPOSE'&&x.card===card.id);if(disposal?.kind==='DISPOSE')disposal.event=true;
  s.log.push('事件：'+card.nameZh+'（'+side+'）');
  if(SCORING_REGIONS[card.id]){scoring(s,SCORING_REGIONS[card.id]);return;}
  switch(card.id) {
    case 4: changeDefcon(s,-1);if(s.phase.kind!=='GAME_OVER')addVp(s,'US',5-s.defcon);break;
    case 5: {
      if(!s.hands.USSR.length)break;
      const id=s.hands.USSR.splice(Math.floor(random(s)*s.hands.USSR.length),1)[0];
      s.log.push('五年计划随机弃牌：'+CARD_BY_ID.get(id)!.nameZh);
      s.tasks.unshift(...(CARD_BY_ID.get(id)!.side==='US'?[{kind:'EVENT',card:id,actor:'US',phasing:t.phasing} as Task]:[]),{kind:'DISPOSE',card:id,event:false});break;
    }
    case 7: influence(s,'USSR',west(),3,2,'REMOVE','US','社会主义政府：移除 3 点美国影响力，每国最多 2');break;
    case 8: s.influence.cuba.US=0;control(s,'cuba','USSR');break;
    case 9: s.influence.vietnam.USSR+=2;s.effects.vietnam=true;break;
    case 10: choice(s,'US',10,side,[...s.hands.US.filter(id=>!CARD_BY_ID.get(id)!.scoring&&modifiedOps(s,'US',CARD_BY_ID.get(id)!.ops)>=3).map(id=>[String(id),'弃置 '+CARD_BY_ID.get(id)!.nameZh] as [string,string]),['lose','移除西德全部美国影响力']],'封锁：弃置至少 3 OPS 的牌，或失去西德影响力');break;
    case 11: war(s,'USSR','south_korea');break;
    case 12: s.influence.romania.US=0;control(s,'romania','USSR');break;
    case 13: war(s,'USSR','israel',true);break;
    case 14: influence(s,'USSR',east().filter(id=>controller(s,id)!=='US'),4,1,'ADD','USSR','经互会：4 个非美国控制的东欧国家各 +1');break;
    case 15: s.influence.egypt.USSR+=2;s.influence.egypt.US=Math.floor(s.influence.egypt.US/2);break;
    case 16: s.effects.warsaw=true;choice(s,'USSR',16,side,[['remove','移除 4 个东欧国家的全部美国影响力'],['add','在东欧增加 5 点苏联影响力，每国最多 2']],'华沙条约：选择效果');break;
    case 17: remove(s,'france','US',2);s.influence.france.USSR++;s.effects.deGaulle=true;break;
    case 18: advanceSpace(s,side);break;
    case 19: influence(s,'US',ids(c=>c.region==='EUROPE'&&controller(s,c.id)===null),1,1,'CLEAR','USSR','杜鲁门主义：清除一个未被控制欧洲国家的苏联影响力');break;
    case 20: choice(s,opponent(side),20,side,[['participate','参加奥运会'],['boycott','抵制：DEFCON −1，对方获得 4 OPS']],'奥运会：是否参加？');break;
    case 21: s.effects.nato=true;break;
    case 22: influence(s,'US',['yugoslavia','romania','bulgaria','hungary','czechoslovakia'],1,1,'MATCH','US','独立的共产党人：将一国美国影响力补至苏联数值');break;
    case 23: s.effects.marshall=true;influence(s,'US',west().filter(id=>controller(s,id)!=='USSR'),7,1,'ADD','US','马歇尔计划：7 个非苏联控制的西欧国家各 +1');break;
    case 24: choice(s,side,24,side,[['india','进攻印度'],['pakistan','进攻巴基斯坦']],'印巴战争：选择目标');break;
    case 25: s.effects.containment=true;break;
    case 26: s.effects.cia=true;s.tasks.unshift({kind:'START_OPS',side:'US',base:1});reveal(s,'US',s.hands.USSR,'中央情报局：查看苏联手牌，本回合继续公开；确认后执行 OPS');break;
    case 27: control(s,'japan','US');s.effects.japan=true;break;
    case 28: influence(s,'USSR',['france','uk','israel'],4,2,'REMOVE','US','苏伊士危机：移除 4 点美国影响力，每国最多 2');break;
    case 29: influence(s,'US',east(),3,1,'REMOVE','USSR','东欧动乱：3 个东欧国家各移除 1 点苏联影响力');break;
    case 30: influence(s,'USSR',ids(c=>c.region==='AFRICA'||c.subRegions.includes('SOUTHEAST_ASIA')),4,1,'ADD','USSR','去殖民化：4 个非洲或东南亚国家各 +1');break;
    case 31: s.effects.purge[opponent(side)]=true;break;
    case 32: {
      const available=s.hands[side].filter(id=>CARD_BY_ID.get(id)!.side===opponent(side));
      if(available.length)choice(s,side,32,side,available.map(id=>[String(id),CARD_BY_ID.get(id)!.nameZh]),'联合国干预：选择对手事件牌，仅使用 OPS');
      break;
    }
    case 33: influence(s,'USSR',ids(c=>s.influence[c.id].USSR>0),4,Number.MAX_SAFE_INTEGER,'REMOVE','USSR','去斯大林化：先移除最多 4 点苏联影响力，完成后重新放置',true,true);break;
    case 34: {const vp=s.defcon-2;addVp(s,side,vp);if(s.phase.kind!=='GAME_OVER')changeDefcon(s,2);break;}
    case 35: s.effects.formosan=true;break;
    case 103: if(!t.headline&&t.phasing==='USSR')addVp(s,'US',1);break;
    case 104: {
      const cards=s.hands.US.filter(id=>SCORING_REGIONS[id]);
      const regions=cards.map(id=>SCORING_REGIONS[id]);
      if(regions.length)s.tasks.unshift({kind:'CAMBRIDGE_PLACEMENT',regions});
      reveal(s,'USSR',cards,'剑桥五杰：查看美国计分牌；确认后在其中一个地区放置 1 点');break;
    }
    case 105: if(s.effects.nato){addVp(s,'US',2);if(s.phase.kind!=='GAME_OVER')influence(s,'US',west(),2,2,'ADD','US','特殊关系：在一个西欧国家增加 2 点',false,false,true);}else influence(s,'US',ADJACENCY.uk,1,1,'ADD','US','特殊关系：英国相邻国家 +1');break;
    case 106: s.effects.norad=true;break;
    default: throw new Error('事件尚未实现：'+card.id);
  }
}
export function beginHeadline(s:GameState) {
  s.headlines={};s.tasks=[];s.noradPending=false;s.actionStartInfluence=null;
  const privileged=(side:Side)=>s.space[side]>=4&&s.space[opponent(side)]<4;
  s.phase={kind:'HEADLINE',side:privileged('USSR')?'US': 'USSR'};
  s.log.push('第 '+s.turn+' 回合头条阶段');
}
export function beginAction(s:GameState,side:Side,round:number) {
  s.phase={kind:'ACTION_ROUND',side,round};s.phasingSide=side;s.actionStartInfluence=structuredClone(s.influence);s.noradPending=false;
}
export function startOps(s:GameState,t:Extract<Task,{kind:'START_OPS'}>) {
  if(!t.mode){s.phase={kind:'DECISION',side:t.side,decision:{kind:'OPS_MODE',prompt:'选择 OPS 用途（可以放弃）',base:t.base,china:t.china,phasing:s.phasingSide}};return;}
  const snapshot=s.actionStartInfluence??s.influence;
  const eligible=ids(c=>c.adjacentTo===t.side||snapshot[c.id][t.side]>0||ADJACENCY[c.id].some(id=>snapshot[id][t.side]>0));
  const base=modifiedOps(s,t.side,t.base),bonus=Number(Boolean((t.asiaOnly||t.seaOnly)&&t.china))+Number(Boolean(t.seaOnly&&s.effects.vietnam&&t.side==='USSR'));
  const raw=t.base+Number(Boolean(t.side==='US'&&s.effects.containment))-Number(Boolean(s.effects.purge[t.side]));
  const total=bonus ? Math.max(1,Math.min(4,raw)+bonus) : base;
  s.phase={kind:'OPS',side:t.side,round:0,mode:t.mode,remaining:total,ops:total,militaryOps:total,eligible,china:t.china,asiaOnly:t.asiaOnly,seaOnly:t.seaOnly};
}
function endTurn(s:GameState,final=false) {
  if(!final){
  for(const side of ['USSR','US'] as const){const n=Math.max(0,s.defcon-s.milOps[side]);s.vp-=sign(side)*n;s.log.push(side+' 军事行动不足，失去 '+n+' VP');}
  const winner=vpWinner(s.vp);if(winner){s.phase={kind:'GAME_OVER',winner,reason:'军事行动结算后 VP 达到 20'};return;}
  const offenders=(['USSR','US'] as Side[]).filter(side=>s.hands[side].some(id=>CARD_BY_ID.get(id)!.scoring));
  if(offenders.length){s.phase={kind:'GAME_OVER',winner:offenders.length===2?'DRAW':opponent(offenders[0]),reason:'回合结束仍持有计分牌'+(offenders.length===2?'（双方均违规，本地判平）':'')};return;}
  const privileged=(side:Side)=>s.space[side]>=6&&s.space[opponent(side)]<6;
  s.tasks.unshift(...(['USSR','US'] as Side[]).filter(privileged).map(side=>({kind:'HELD_DISCARD',side} as Task)),{kind:'END_TURN',final:true});
  return;
  }
  s.chinaCard.faceUp=true;
  if(s.turn===3){s.phase={kind:'EARLY_WAR_COMPLETE'};s.log.push('早期战争 3 回合结束；中期卡牌与完整终局留待 M4');return;}
  s.turn++;s.defcon=Math.min(5,s.defcon+1);s.milOps={US:0,USSR:0};s.spaceAttempts={US:0,USSR:0};
  s.effects.purge={};delete s.effects.containment;delete s.effects.vietnam;delete s.effects.cia;
  for(;;){let dealt=false;for(const side of ['USSR','US'] as const)if(s.hands[side].length<8){
    if(!s.deck.length&&s.discard.length){s.deck=shuffle(s.discard,()=>random(s));s.discard=[];s.log.push('洗入弃牌堆');}
    if(s.deck.length){s.hands[side].push(s.deck.shift()!);dealt=true;}
  }if(!dealt||(['USSR','US'] as const).every(side=>s.hands[side].length>=8))break;}
  beginHeadline(s);
}
export function drain(s:GameState) {
  while(s.tasks.length&&s.phase.kind!=='GAME_OVER'){
    const t=s.tasks.shift()!;
    // Neutral idle phase prevents old decisions from accidentally pausing a new task.
    s.phase={kind:'HEADLINE',side:s.phasingSide};
    if(t.kind==='EVENT') {
      event(s,t);
    } else if(t.kind==='DISPOSE') {
      const removed=t.event&&CARD_BY_ID.get(t.card)!.starred;
      (removed?s.removed:s.discard).push(t.card);
    } else if(t.kind==='START_OPS')startOps(s,t);
    else if(t.kind==='FINISH_HEADLINES'){s.headlines={};beginAction(s,'USSR',1);}
    else if(t.kind==='END_TURN')endTurn(s,t.final);
    else if(t.kind==='CAMBRIDGE_PLACEMENT')influence(s,'USSR',ids(c=>t.regions.includes(c.region)),1,1,'ADD','USSR','剑桥五杰：在揭示的计分地区 +1');
    else if(t.kind==='HELD_DISCARD'){
      if(s.hands[t.side].length)choice(s,t.side,-6,t.side,[['keep','保留手牌'],...s.hands[t.side].map(id=>[String(id),'弃置 '+CARD_BY_ID.get(id)!.nameZh] as [string,string])],'太空特权：可弃置一张留牌');
    }
    else {
      if(s.noradPending&&s.effects.norad&&controller(s,'canada')==='US'){
        s.noradPending=false;s.tasks.unshift(t);
        influence(s,'US',ids(c=>s.influence[c.id].US>0),1,1,'ADD','US','NORAD：在已有美国影响力的国家 +1');
      } else {
        s.noradPending=false;
        if(t.side==='USSR')beginAction(s,'US',t.round);
        else if(t.round<6)beginAction(s,'USSR',t.round+1);
        else {s.tasks.unshift({kind:'END_TURN'});}
      }
    }
    if(['DECISION','OPS','ACTION_ROUND','GAME_OVER','EARLY_WAR_COMPLETE'].includes((s.phase as Phase).kind))return;
  }
}
export function chooseDecision(s:GameState,value:string) {
  if(s.phase.kind!=='DECISION')throw new Error('当前没有待处理决策');
  const {decision:d,side}=s.phase;
  if(d.kind==='REVEAL') {if(value!=='confirm')throw new Error('请确认信息');}
  else if(d.kind==='INFLUENCE') {
    if(value==='done'){
      if(!d.optional)throw new Error('需要完成该事件的放置/移除');
    } else {
      if(!influenceTargets(d,s).includes(value))throw new Error('无效的事件目标');
      const inf=s.influence[value];
      if(d.operation==='ADD')inf[d.affected]++;
      if(d.operation==='REMOVE')inf[d.affected]--;
      if(d.operation==='CLEAR')inf[d.affected]=0;
      if(d.operation==='MATCH')inf.US=inf.USSR;
      if(d.singleCountry)d.targets=[value];
      d.used[value]=(d.used[value]??0)+1;d.remaining--;
      s.log.push(d.prompt+'：'+COUNTRY_BY_ID.get(value)!.nameZh);
      if(d.remaining>0&&influenceTargets(d,s).length)return;
    }
    if(d.relocation){const count=Object.values(d.used).reduce((a,b)=>a+b,0);if(count){influence(s,'USSR',ids(c=>controller(s,c.id)!=='US'),count,2,'ADD','USSR','去斯大林化：重新放置移除的影响力，每国最多 2');if(s.phase.kind==='DECISION'&&s.phase.decision!==d)return;}}
  } else if(d.kind==='OPS_MODE') {
    if(value!=='skip'){
      const [mode,region]=value.split(':');
      if(!['INFLUENCE','REALIGNMENT','COUP'].includes(mode))throw new Error('无效 OPS 用途');
      if(region&&!['ASIA','SEA'].includes(region))throw new Error('无效区域限制');
      if(region==='ASIA'&&!d.china)throw new Error('仅中国牌可选亚洲奖励');
      if(region==='SEA'&&!(side==='USSR'&&s.effects.vietnam))throw new Error('越南奖励未生效');
      startOps(s,{kind:'START_OPS',side,base:d.base,mode:mode as 'INFLUENCE'|'REALIGNMENT'|'COUP',china:d.china,asiaOnly:region==='ASIA',seaOnly:region==='SEA'});return;
    }
  } else {
    if(!d.options.some(o=>o.id===value))throw new Error('无效选项');
    if(d.event===-6&&value!=='keep'){const id=Number(value);s.hands[side]=s.hands[side].filter(c=>c!==id);s.discard.push(id);}
    if(d.event===10){if(value==='lose')s.influence.west_germany.US=0;else {const id=Number(value);s.hands.US=s.hands.US.filter(c=>c!==id);s.discard.push(id);}}
    if(d.event===16)influence(s,'USSR',east(),value==='add'?5:4,value==='add'?2:1,value==='add'?'ADD':'CLEAR',value==='add'?'USSR':'US','华沙条约：'+(value==='add'?'东欧 +5，每国最多 2':'移除东欧美国影响力'));
    if(d.event===20){
      if(value==='boycott'){changeDefcon(s,-1);if((s.phase as Phase).kind!=='GAME_OVER')s.tasks.unshift({kind:'START_OPS',side:d.actor,base:4});}
      else {let a:number,b:number;do{a=die(s)+2;b=die(s);}while(a===b);s.log.push('奥运会：主办方 '+a+'，对手 '+b);addVp(s,a>b?d.actor:opponent(d.actor),2);}
    }
    if(d.event===24)war(s,d.actor,value);
    if(d.event===32){const id=Number(value);s.hands[side]=s.hands[side].filter(c=>c!==id);s.discard.push(id);s.tasks.unshift({kind:'START_OPS',side,base:CARD_BY_ID.get(id)!.ops});}
    if((s.phase as Phase).kind==='GAME_OVER')return;
    if(s.phase.kind==='DECISION'&&s.phase.decision!==d)return;
  }
  drain(s);
}
