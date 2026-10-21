import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { CARD_BY_ID, type PublicPlay } from '@ts/game-core';
import type { Side } from '@ts/shared';
import { createPortal } from 'react-dom';
import { CardView } from './CardView';

const SIDES={US:'美国',USSR:'苏联'};
export const PLAY_USES:Record<PublicPlay['use'],string>={EVENT:'执行事件',HEADLINE:'头条',SPACE:'太空竞赛',DISCARD:'弃牌脱困',INFLUENCE:'OPS · 影响力',REALIGNMENT:'OPS · 调整',COUP:'OPS · 政变'};
const keyOf=(play:PublicPlay)=>`${play.id}-${play.side}-${play.card}`;
interface Flight {key:string;play:PublicPlay;style:CSSProperties}
const EMPTY:PublicPlay[]=[];

/** Keep fast-resolving cards readable, then animate from their actual board position to the archive. */
export function usePlayPresentation(plays:PublicPlay[]=EMPTY,scope:string) {
  const [boardPlays,setBoardPlays]=useState<PublicPlay[]>(()=>plays.filter(p=>!p.finished));
  const [flights,setFlights]=useState<Flight[]>([]);
  const seen=useRef(new Map<string,number>());
  const timers=useRef(new Map<string,ReturnType<typeof setTimeout>>());
  const previousScope=useRef<string|null>(null);
  const signature=JSON.stringify(plays);
  useEffect(()=>{
    const current=new Set(plays.map(keyOf));
    if(previousScope.current!==scope) {
      previousScope.current=scope;
      for(const timer of timers.current.values())clearTimeout(timer);
      timers.current.clear();seen.current=new Map(plays.map(play=>[keyOf(play),play.finished?-1:Date.now()]));
      setBoardPlays(plays.filter(play=>!play.finished));setFlights([]);
      return;
    }
    for(const [key,timer] of timers.current)if(!current.has(key)){clearTimeout(timer);timers.current.delete(key);}
    for(const key of seen.current.keys())if(!current.has(key))seen.current.delete(key);
    setBoardPlays(previous=>previous.filter(play=>current.has(keyOf(play))));
    setFlights(previous=>previous.filter(flight=>current.has(flight.key)));
    for(const play of plays) {
      const key=keyOf(play),firstSeen=seen.current.get(key);
      if(firstSeen===undefined) {
        seen.current.set(key,Date.now());
        setBoardPlays(previous=>[...previous,play]);
      }
      if(!play.finished)continue;
      // Only a new play or one still on the board needs a transfer; restored history stays quiet.
      if(timers.current.has(key)||firstSeen===-1)continue;
      const started=firstSeen??Date.now();
      const timer=setTimeout(()=>{
        timers.current.delete(key);seen.current.set(key,-1);
        const source=document.querySelector(`[data-public-play="${key}"]`);
        const target=document.querySelector(`[data-discard-dock="${play.side}"]`);
        if(source&&target&&!matchMedia('(prefers-reduced-motion: reduce)').matches) {
          const a=source.getBoundingClientRect(),b=target.getBoundingClientRect();
          if(a.width&&b.width)setFlights(previous=>[...previous,{key,play,style:{left:a.left,top:a.top,width:a.width,height:a.height,'--fly-x':`${b.left+b.width/2-a.left-a.width/2}px`,'--fly-y':`${b.top+b.height/2-a.top-a.height/2}px`} as CSSProperties}]);
        }
        setBoardPlays(previous=>previous.filter(p=>keyOf(p)!==key));
      },Math.max(0,1100-(Date.now()-started)));
      timers.current.set(key,timer);
    }
  },[signature,scope]);
  useEffect(()=>()=>{for(const timer of timers.current.values())clearTimeout(timer);},[]);
  return {boardPlays,flights,finishFlight:(key:string)=>setFlights(previous=>previous.filter(flight=>flight.key!==key))};
}

export function PublicCard({play}:{play:PublicPlay}) {
  return <div className={'public-play public-'+play.side} data-public-play={keyOf(play)} aria-label={SIDES[play.side]+'打出'+CARD_BY_ID.get(play.card)!.nameZh+'，'+PLAY_USES[play.use]}>
    <header><b>{SIDES[play.side]}</b><span>{PLAY_USES[play.use]}</span></header><CardView card={CARD_BY_ID.get(play.card)!}/>
    <footer>{play.finished?'操作完成 · 收入弃牌堆':'正在结算'}</footer>
  </div>;
}
export function PlayFlights({flights,onFinish}:{flights:Flight[];onFinish:(key:string)=>void}) {
  return <>{flights.map(flight=><div key={flight.key} className="play-flight" style={flight.style} onAnimationEnd={()=>onFinish(flight.key)} aria-hidden="true"><CardView card={CARD_BY_ID.get(flight.play.card)!}/></div>)}</>;
}
export function completedPlays(plays:PublicPlay[],side:Side) {
  return plays.filter(play=>play.finished&&play.side===side).slice().reverse();
}

export function RecentDock({plays,onOpen,receiving,compact=false}:{plays:PublicPlay[];onOpen:(side:Side)=>void;receiving:Side[];compact?:boolean}) {
  return <section className={'discard-piles'+(compact?' compact':'')} aria-label="双方弃牌堆">
    {(['USSR','US'] as const).map(side=>{
      const completed=completedPlays(plays,side),latest=completed[0];
      return <button key={side} className={'discard-pile pile-'+side+(receiving.includes(side)?' receiving':'')} data-discard-dock={side} onClick={()=>onOpen(side)} aria-label={`${SIDES[side]}弃牌堆，${completed.length} 张，点击查看卡面`} aria-haspopup="dialog">
        <span className={'pile-cards'+(!latest?' empty':'')} aria-hidden="true">{latest?<CardView card={CARD_BY_ID.get(latest.card)!}/>:<span>{side==='USSR'?'苏':'美'}</span>}</span>
        <span className="pile-caption"><strong>{SIDES[side]}弃牌堆</strong><span>{completed.length} 张</span><small>{compact?'点击展开':latest?'最近：'+CARD_BY_ID.get(latest.card)!.nameZh:'暂时没有用过的牌'}</small></span>
      </button>;
    })}
    {!compact&&<p>点击牌堆，展开查看该方用过的所有卡面。</p>}
  </section>;
}

export function DiscardGallery({plays,side,onSide,onClose}:{plays:PublicPlay[];side:Side;onSide:(side:Side)=>void;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const completed=completedPlays(plays,side);
  useEffect(()=>{
    const element=dialog.current!,trigger=document.activeElement;
    element.showModal();
    return ()=>{element.close();if(trigger instanceof HTMLElement&&trigger.isConnected)trigger.focus({preventScroll:true});};
  },[]);
  return createPortal(<dialog ref={dialog} className={'discard-dialog gallery-'+side} aria-labelledby="discard-title" onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
    <div className="discard-window">
      <header><div><h2 id="discard-title">{SIDES[side]}弃牌堆 <span>{completed.length} 张</span></h2><p>按出牌方归档的用牌记录 · 最新在前</p></div><button className="gallery-close" aria-label="关闭弃牌堆" autoFocus onClick={onClose}>×</button></header>
      <div className="gallery-sides" aria-label="选择弃牌堆">{(['USSR','US'] as const).map(s=><button key={s} className={'ink-'+s} aria-pressed={side===s} onClick={()=>onSide(s)}>{SIDES[s]} <span>{completedPlays(plays,s).length}</span></button>)}</div>
      <div className="discard-gallery" key={side} tabIndex={0} aria-label="已用卡面列表">
        {completed.length?completed.map(play=><figure key={keyOf(play)} aria-label={CARD_BY_ID.get(play.card)!.nameZh+'，第'+play.turn+'回合，'+PLAY_USES[play.use]}><CardView card={CARD_BY_ID.get(play.card)!}/><figcaption><strong>{CARD_BY_ID.get(play.card)!.nameZh}</strong><span>第 {play.turn} 回合 · {PLAY_USES[play.use]}</span></figcaption></figure>):<div className="gallery-empty"><span aria-hidden="true">{side==='USSR'?'苏':'美'}</span><h3>还没有用过的牌</h3><p>该方的出牌结算结束后，会自动收进这里。</p></div>}
      </div>
      <footer>包含事件、头条、OPS、太空及弃牌记录；移出游戏或已洗回的牌也保留记录。<span>Esc 关闭</span></footer>
    </div>
  </dialog>,document.body);
}
