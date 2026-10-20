import { useEffect, useRef, type ReactNode } from 'react';
import type { CardDef } from '@ts/game-core';
import { CardView } from './CardView';

export function CardPlayDialog({card,onClose,onSidebar,children}:{card:CardDef;onClose:()=>void;onSidebar:()=>void;children:ReactNode}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const dialog=ref.current!;dialog.showModal();return()=>dialog.close();},[]);
  return <dialog ref={ref} className="card-play-dialog" aria-label={'卡牌详情 '+card.nameZh} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}}>
    <header><h2>卡牌详情</h2><button type="button" aria-label="取消出牌" onClick={onClose}>×</button></header>
    <div className="card-play-body"><div className="card-play-preview"><CardView card={card}/></div><div>{children}</div></div>
    <footer><button className="secondary" onClick={onSidebar}>在操作区继续</button><span>确认后才出牌 · Esc 收回</span></footer>
  </dialog>;
}
