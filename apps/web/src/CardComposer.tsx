import { RelatedCards } from './RelatedCards';
import { useEffect, useRef, useState } from 'react';
import { CARD_BY_ID, EVENT_SUMMARIES, type Action, type GameState } from '@ts/game-core';
import { opponent, type Side } from '@ts/shared';
import { cardSprite } from './assets';
import { CardView } from './CardView';
import { cardAction, cardChoices, isOpsUse, type CardUse } from './cardPlay';

export function CardComposer({id,state,side,canAct,blocked,onPlay,onClose}:{id:number;state:GameState;side:Side;canAct:boolean;blocked?:string;onPlay:(action:Action)=>void;onClose:()=>void}) {
  const closeRef=useRef<HTMLButtonElement>(null);
  const card=CARD_BY_ID.get(id)!,choices=cardChoices(state,side,id),enabled=choices.filter(c=>!c.reason);
  const hasArt=cardSprite(id)!==null;
  const [use,setUse]=useState<CardUse|null>(()=>enabled.length===1?enabled[0].id:null);
  const [order,setOrder]=useState<'BEFORE'|'AFTER'>('BEFORE');
  const [region,setRegion]=useState<'NONE'|'ASIA'|'SEA'>('NONE');
  const choice=choices.find(c=>c.id===use),ops=use!==null&&isOpsUse(use),enemy=card.side===opponent(side),vietnam=side==='USSR'&&state.effects.vietnam;
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    closeRef.current?.focus({preventScroll:true});
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();onClose();}};
    document.addEventListener('keydown',key);
    return()=>{document.removeEventListener('keydown',key);if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[onClose]);
  return <section className="card-composer" role="region" aria-label={'查看 '+card.nameZh}>
    <button ref={closeRef} className="icon-button composer-close" aria-label="收回卡牌" onClick={onClose}>×</button>
    {/* The card art already carries the printed text; a written summary is only the fallback when no art is available. */}
    <div className="composer-art"><CardView card={card}/></div>
    <div className="composer-content">{!hasArt&&<header><h2>{card.nameZh}</h2><p className="card-effect">{EVENT_SUMMARIES[id]}</p></header>}
      <RelatedCards key={id} id={id} state={state}/>
      {choices.length>0&&canAct?<><div className="play-choices" role="group" aria-label="选择卡牌用途">{choices.map(option=><button key={option.id} className={'play-choice '+(use===option.id?'chosen':'')} aria-pressed={use===option.id} disabled={Boolean(option.reason)} onClick={()=>{setUse(option.id);setRegion('NONE');}}><strong>{option.label}</strong><small>{option.reason??option.detail}</small></button>)}</div>
        {ops&&enemy&&<fieldset className="play-extra"><legend>对方事件仍会触发</legend><label><input type="radio" name="event-order" checked={order==='BEFORE'} onChange={()=>setOrder('BEFORE')}/>先结算事件</label><label><input type="radio" name="event-order" checked={order==='AFTER'} onChange={()=>setOrder('AFTER')}/>先使用行动点</label></fieldset>}
        {ops&&(id===6||vietnam)&&<fieldset className="play-extra"><legend>区域奖励</legend><label><input type="radio" name="region-bonus" checked={region==='NONE'} onChange={()=>setRegion('NONE')}/>不限制地区</label>{id===6&&<label><input type="radio" name="region-bonus" checked={region==='ASIA'} onChange={()=>setRegion('ASIA')}/>仅亚洲 +1</label>}{vietnam&&<label><input type="radio" name="region-bonus" checked={region==='SEA'} onChange={()=>setRegion('SEA')}/>仅东南亚 {id===6?'+2':'+1'}</label>}</fieldset>}
        <footer><span>{use&&choice&&!choice.reason?choice.id==='HEADLINE'?'确认后秘密锁定这张头条。':ops?'确认出牌后，在高亮国家执行。':'确认后执行所选用途。':'先选择这张牌要做什么。'}</span><button className="primary" disabled={!choice||Boolean(choice.reason)} onClick={()=>{if(choice&&!choice.reason)onPlay(cardAction(id,choice.id,{order,region}));}}>{choice&&!choice.reason?'确认 · '+choice.label:'选择用途后确认'}</button></footer>
      </>:<div className="preview-only"><p>{blocked??(choices.length===0?'当前阶段只查看卡牌；完成上方提示后继续。':'当前暂不能出牌，请先完成上方提示。')}</p><button className="secondary" onClick={onClose}>收回卡牌</button></div>}
    </div>
  </section>;
}
