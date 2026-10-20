import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { CARD_BY_ID, EVENT_SUMMARIES, type PublicPlay } from '@ts/game-core';
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
        const target=document.querySelector('[data-recent-dock]');
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
    <footer>{play.finished?'操作完成 · 收入最近出牌':'正在结算'}</footer>
  </div>;
}
export function PlayFlights({flights,onFinish}:{flights:Flight[];onFinish:(key:string)=>void}) {
  return <>{flights.map(flight=><div key={flight.key} className="play-flight" style={flight.style} onAnimationEnd={()=>onFinish(flight.key)} aria-hidden="true"><CardView card={CARD_BY_ID.get(flight.play.card)!}/></div>)}</>;
}
export function RecentDock({plays,onOpen,receiving}:{plays:PublicPlay[];onOpen:()=>void;receiving:boolean}) {
  const completed=plays.filter(play=>play.finished),latest=completed.at(-1);
  return <button className={'recent-dock '+(receiving?'receiving':'')} data-recent-dock onClick={onOpen}><span>最近出牌 <small>{completed.length}</small></span><strong>{latest?SIDES[latest.side]+' · '+CARD_BY_ID.get(latest.card)!.nameZh:'暂无已完成的出牌'}</strong><span aria-hidden="true">›</span></button>;
}
export function RecentPlays({plays}:{plays:PublicPlay[]}) {
  const completed=plays.filter(play=>play.finished).slice().reverse();
  const [selected,setSelected]=useState<string|null>(null);
  const chosen=completed.find(play=>keyOf(play)===selected)??completed[0];
  return <section className="info-panel recent-plays" aria-label="最近出牌详情"><p className="panel-intro">已完成操作的公开出牌 · 最新在上</p>
    {chosen?<><div className="recent-preview"><CardView card={CARD_BY_ID.get(chosen.card)!}/><h3>{CARD_BY_ID.get(chosen.card)!.nameZh}</h3><p className={'ink-'+chosen.side}>{SIDES[chosen.side]} · 第 {chosen.turn} 回合 · {PLAY_USES[chosen.use]}</p><p>{EVENT_SUMMARIES[chosen.card]}</p><small>历史卡牌仅供查看，不会再次打出。</small></div>
    <div className="recent-list">{completed.map(play=><button key={keyOf(play)} aria-pressed={keyOf(chosen)===keyOf(play)} onClick={()=>setSelected(keyOf(play))}><span className={'ink-'+play.side}>{SIDES[play.side]}</span><strong>{CARD_BY_ID.get(play.card)!.nameZh}</strong><small>第 {play.turn} 回合 · {PLAY_USES[play.use]}</small></button>)}</div></>:<p className="panel-empty">打出的牌会先展示在棋盘上，操作结束后收进这里。</p>}
  </section>;
}
