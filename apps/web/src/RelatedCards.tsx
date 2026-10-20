import { CARD_BY_ID, EVENT_SUMMARIES, canEvent, type GameState } from '@ts/game-core';
import { CardView } from './CardView';

import { relatedCards } from './cardRelations';

export function RelatedCards({id,state}:{id:number;state:GameState}) {
  const related=relatedCards(id);
  if(!related.length)return null;
  return <section className="related-cards" aria-label="关联卡牌">
    <h3>关联卡牌</h3>
    {related.map(relation=>{
      const card=CARD_BY_ID.get(relation.id)!;
      const permitted=canEvent(state,card.id,card.side==='NEUTRAL'?state.phasingSide:card.side);
      return <details key={card.id}>
        <summary>{card.nameZh}<span>查看效果</span></summary>
        <p>{relation.text}</p>
        <div className="related-card-preview"><CardView card={card}/></div>
        <p className="related-effect">{EVENT_SUMMARIES[card.id]}</p>
        <p className={'related-condition '+(permitted?'available':'unavailable')}>当前事件条件：{permitted?'满足':'不满足'}</p>
      </details>;
    })}
  </section>;
}
