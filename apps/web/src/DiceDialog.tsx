import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GameState } from '@ts/game-core';

const sides={US:'美国',USSR:'苏联'};
const dots:Record<number,number[]>={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
type DicePhase=Extract<GameState['phase'],{kind:'DICE_ROLL'}>;

export function DiceDialog({phase,canAct,busy,error,pending,onRoll,onContinue,onRetry}:{phase:DicePhase;canAct:boolean;busy:boolean;error:string;pending:boolean;onRoll:()=>void;onContinue:()=>void;onRetry:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null);
  const [animating,setAnimating]=useState<number|null>(null);
  const previousCount=useRef(phase.values.length);
  const complete=phase.values.length===phase.request.rollers.length;
  useEffect(()=>{
    const element=dialog.current!,trigger=document.activeElement;
    element.showModal();
    return ()=>{element.close();if(trigger instanceof HTMLElement&&trigger.isConnected)trigger.focus({preventScroll:true});};
  },[]);
  useEffect(()=>{
    if(phase.values.length>previousCount.current)setAnimating(phase.values.length-1);
    previousCount.current=phase.values.length;
  },[phase.values.length]);
  useEffect(()=>{if(animating===null)return;const timer=setTimeout(()=>setAnimating(null),650);return ()=>clearTimeout(timer);},[animating]);
  return createPortal(<dialog ref={dialog} className={'dice-dialog dice-'+phase.side} aria-labelledby="dice-title" aria-describedby="dice-instructions" onCancel={event=>event.preventDefault()}>
    <div className="dice-window"><header><span>掷骰结算</span><h2 id="dice-title">{phase.request.title}</h2><p>{phase.request.detail}</p></header>
      <div className="dice-table">{phase.request.rollers.map((roller,index)=>{
        const value=phase.values[index],active=index===phase.values.length,rolling=animating===index;
        return <div className={'die-seat die-'+roller} key={index}><strong>{sides[roller]}</strong>
          <button className={'die-button'+(rolling?' rolling':'')+(value?' rolled':'')} aria-label={value?`${sides[roller]}骰点 ${value}`:`${sides[roller]}：点击骰子投掷`} disabled={!active||!canAct||busy||pending||animating!==null} onClick={()=>{setAnimating(index);onRoll();}}>
            {value&&!rolling?<span className="die-face" aria-hidden="true">{Array.from({length:9},(_,dot)=><i key={dot} className={dots[value].includes(dot)?'pip':'blank'}/>)}</span>:<span className="die-ready" aria-hidden="true">{rolling?'⚄':'?'}</span>}
          </button>
          <span className="die-caption">{rolling?'投掷中…':value?'掷出 '+value:active?(canAct?'点击骰子':'等待'+sides[roller]+'掷骰'):'等待上一枚骰子'}</span>
        </div>;
      })}</div>
      <div className="dice-result" role="status" aria-live="polite" id="dice-instructions">{animating!==null?'骰子正在落定…':complete?phase.values.map((value,i)=>sides[phase.request.rollers[i]]+' '+value+' 点').join(' · '):canAct?'点击你的骰子，投出本次点数。':'等待'+sides[phase.side]+'点击骰子。'}</div>
      {error&&<p className="dice-error" role="alert">{error}</p>}
      {pending&&!busy&&<button className="secondary" onClick={onRetry}>重试待确认操作</button>}
      {complete&&<button className="primary dice-continue" disabled={!canAct||busy||pending||animating!==null} onClick={onContinue}>{canAct?'继续结算':'等待'+sides[phase.side]+'继续结算'}</button>}
      <footer>查看骰点后，点击“继续结算”推进行动</footer>
    </div>
  </dialog>,document.body);
}
