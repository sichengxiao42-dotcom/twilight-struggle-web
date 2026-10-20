import { CARD_BY_ID, canEvent, forcedMissileEnvy, modifiedOps, roundsFor, trapped, trapDiscards, type Action, type GameState } from '@ts/game-core';
import { opponent, type Side } from '@ts/shared';

export type CardUse = 'HEADLINE' | 'EVENT' | 'INFLUENCE' | 'COUP' | 'REALIGNMENT' | 'SPACE' | 'TRAP_DISCARD';
export interface CardChoice { id: CardUse; label: string; detail: string; reason?: string }
export interface PlaySettings { order: 'BEFORE' | 'AFTER'; region: 'NONE' | 'ASIA' | 'SEA' }
export const isOpsUse = (use: CardUse) => ['INFLUENCE','COUP','REALIGNMENT'].includes(use);

/** Read-only affordances; actual plays always go through the authoritative engine. */
export function cardChoices(state: GameState, side: Side, id: number): CardChoice[] {
  const card=CARD_BY_ID.get(id),p=state.phase;
  if(!card || !('side' in p) || p.side!==side || !['HEADLINE','ACTION_ROUND','SUBPLAY'].includes(p.kind))return [];
  const china=id===6,held=p.kind==='SUBPLAY'?p.card===id:china?state.chinaCard.holder===side&&state.chinaCard.faceUp:state.hands[side].includes(id);
  if(!held)return [];
  if(p.kind==='HEADLINE')return [{id:'HEADLINE',label:'设为头条',detail:'秘密选定，双方选好后一起揭示。',reason:china?'中国牌不能作为头条':id===32?'联合国干预不能作为头条':undefined}];
  if(p.kind!=='ACTION_ROUND'&&p.kind!=='SUBPLAY')return [];
  if(state.mode==='STANDARD'&&p.kind==='ACTION_ROUND'&&trapped(state,side)){
    const discards=trapDiscards(state,side);
    if(card.scoring&&!discards.length)return [{id:'EVENT',label:'区域计分',detail:'立即结算对应地区。'}];
    return [{id:'TRAP_DISCARD',label:'弃牌尝试脱困',detail:'弃掉此牌并掷骰；1–4 脱困。',reason:discards.includes(id)?undefined:discards.length?'请选择至少 2 OPS 的非计分牌':'没有可弃的牌，请打计分牌或跳过行动'}];
  }
  if(card.scoring)return [{id:'EVENT',label:'区域计分',detail:'立即结算对应地区。',reason:state.mode==='PRACTICE'?'练习模式不使用计分牌':p.kind==='ACTION_ROUND'&&forcedMissileEnvy(state,side)?'本轮必须把导弹嫉妒用于行动点':undefined}];
  const ops=modifiedOps(state,side,card.ops),choices:CardChoice[]=[];
  if(state.mode==='STANDARD')choices.push({id:'EVENT',label:'触发事件',detail:canEvent(state,id,side)?'执行这张牌的事件。':'前置条件未满足，打出后事件不生效。',reason:p.kind==='SUBPLAY'&&!canEvent(state,id,side)?'该事件当前不能生效':china?'中国牌只提供行动点':card.side===opponent(side)?'对方事件不能主动触发；可用行动点或尝试太空':undefined});
  choices.push({id:'INFLUENCE',label:'放置影响力',detail:`使用 ${ops} 行动点，在棋盘部署。`},
    {id:'COUP',label:'发动政变',detail:state.effects.cmc===side?'古巴导弹危机期间政变会立即判负。':`使用全部 ${ops} 行动点，选一个国家政变。`,reason:state.effects.cmc===side?'先在操作区解除古巴导弹危机':undefined},
    {id:'REALIGNMENT',label:'调整影响力',detail:`使用 ${ops} 行动点，削弱对方影响力。`});
  if(state.mode==='STANDARD'){
    const pos=state.space[side],limit=pos>=2&&state.space[opponent(side)]<2?2:1,required=pos<4?2:pos<7?3:4;
    choices.push({id:'SPACE',label:'太空竞赛',detail:'尝试推进太空，不触发牌上事件。',reason:china?'中国牌不能用于太空':pos>=8?'已完成太空竞赛':state.spaceAttempts[side]>=limit?'本回合太空尝试次数已用完':ops<required?`需要至少 ${required} OPS，这张牌当前只有 ${ops}`:undefined});
  }
  return choices.map(choice=>{
    if(state.mode==='STANDARD'&&p.kind==='ACTION_ROUND'&&forcedMissileEnvy(state,side)&&!(id===49&&isOpsUse(choice.id)))return {...choice,reason:'本轮必须把导弹嫉妒用于行动点'};
    if(china&&p.kind==='ACTION_ROUND'&&state.hands[side].filter(cardId=>CARD_BY_ID.get(cardId)!.scoring).length>roundsFor(state,side)-p.round)return {...choice,reason:'需先打出计分牌，避免回合结束时留牌'};
    return choice;
  });
}

export function cardAction(id:number,use:CardUse,settings:PlaySettings):Action {
  if(use==='HEADLINE')return {type:'SELECT_HEADLINE',card:id};
  if(use==='TRAP_DISCARD')return {type:'TRAP_DISCARD',card:id};
  if(use==='EVENT')return {type:'PLAY_EVENT',card:id};
  if(use==='SPACE')return {type:'SPACE',card:id};
  return {type:'PLAY_OPS',card:id,mode:use,order:settings.order,asiaOnly:id===6&&settings.region==='ASIA',seaOnly:settings.region==='SEA'};
}
