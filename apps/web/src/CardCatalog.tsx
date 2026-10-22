import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CARDS, type CardDef } from '@ts/game-core';
import { CardView } from './CardView';
import { CATALOG_GROUPS } from './cardCatalogData';

export default function CardCatalog({onClose}:{onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const back=useRef<HTMLButtonElement>(null);
  const selectedTrigger=useRef<HTMLButtonElement|null>(null);
  const [selected,setSelected]=useState<CardDef|null>(null);
  useEffect(()=>{
    const element=dialog.current!,trigger=document.activeElement;
    element.showModal();
    return ()=>{element.close();if(trigger instanceof HTMLElement&&trigger.isConnected)trigger.focus({preventScroll:true});};
  },[]);
  useEffect(()=>{
    if(selected)back.current?.focus({preventScroll:true});
    else selectedTrigger.current?.focus({preventScroll:true});
  },[selected]);
  return createPortal(<dialog ref={dialog} className="discard-dialog catalog-dialog" aria-labelledby="catalog-title"
    onCancel={event=>{event.preventDefault();if(selected)setSelected(null);else onClose();}}
    onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
    <div className="discard-window catalog-window">
      <header><div><h2 id="catalog-title">卡牌图鉴 <span>{CARDS.length} 张中文卡面</span></h2><p>按时期与编号排列 · 点击卡面放大查看</p></div><button className="gallery-close" aria-label="关闭卡牌图鉴" autoFocus onClick={onClose}>×</button></header>
      <div className="catalog-scroll" hidden={Boolean(selected)} tabIndex={0} aria-label="三个时期的卡牌原图">
        <div className="catalog-columns">{CATALOG_GROUPS.map(group=><section className="catalog-period" key={group.id} aria-labelledby={'catalog-'+group.id}>
          <h3 id={'catalog-'+group.id}>{group.title}<small>{group.cards.length} 张</small></h3>
          <div className="catalog-cards">{group.cards.map(card=><figure key={card.id}>
            <button className="catalog-card" aria-label={'放大查看 '+card.nameZh+'，编号 '+card.id} onClick={event=>{selectedTrigger.current=event.currentTarget;setSelected(card);}}><CardView card={card}/></button>
            <figcaption><span>#{card.id}</span> {card.nameZh}</figcaption>
          </figure>)}</div>
        </section>)}</div>
      </div>
      {selected&&<div className="catalog-detail"><button ref={back} className="catalog-back" onClick={()=>setSelected(null)}>← 返回三栏图鉴</button><figure aria-label={selected.nameZh+'原图'}><CardView card={selected} original/><figcaption>#{selected.id} · {selected.nameZh}</figcaption></figure></div>}
      <footer>图鉴展示全部公开卡面，不代表当前手牌或牌库。<span>{selected?'Esc 返回三栏':'窄屏可横向滑动三栏 · Esc 关闭'}</span></footer>
    </div>
  </dialog>,document.body);
}
