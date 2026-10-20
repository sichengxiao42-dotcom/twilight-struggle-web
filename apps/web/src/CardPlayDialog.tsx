import { useEffect, useRef, type ReactNode } from 'react';
import type { CardDef } from '@ts/game-core';
import { CardView } from './CardView';

export function CardPlayDialog({card,onClose,onSidebar,children}:{card:CardDef;onClose:()=>void;onSidebar:()=>void;children:ReactNode}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const dialog=ref.current!;dialog.showModal();return()=>dialog.close();},[]);
  return <dialog ref={ref} className="card-play-dialog" aria-label={'打出 '+card.nameZh} onCancel={e=>{e.preventDefault();onClose();}}>
    <header><h2>打出卡牌</h2><button type="button" aria-label="取消出牌" onClick={onClose}>×</button></header>
    <div className="card-play-body"><div className="card-play-preview"><CardView card={card}/></div><div>{children}</div></div>
    <footer><button className="secondary" onClick={onSidebar}>在操作区继续</button><span>选择用途后出牌 · Esc 取消</span></footer>
  </dialog>;
}
