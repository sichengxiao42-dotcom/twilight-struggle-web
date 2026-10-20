import { COUNTRIES, REGION_NAMES, controller, scoreRegion, scoreSoutheastAsia, type GameState } from '@ts/game-core';
import type { Region, Side } from '@ts/shared';

export type SidePanel = 'cards' | 'regions' | 'log' | 'rules' | 'effects' | 'room' | 'recent';
export const PANEL_TITLES: Record<SidePanel, string> = { cards:'卡牌操作', regions:'地区局势', log:'对局日志', rules:'规则速查', effects:'持续效果', room:'房间大厅', recent:'最近出牌' };
const TABS: {id:SidePanel; mark:string; label:string}[] = [
  {id:'cards',mark:'牌',label:'卡牌'}, {id:'regions',mark:'势',label:'局势'},
  {id:'log',mark:'录',label:'日志'}, {id:'rules',mark:'查',label:'规则'},
  {id:'recent',mark:'迹',label:'出牌'},
  {id:'effects',mark:'效',label:'效果'}, {id:'room',mark:'房',label:'房间'},
];
export function SideRail({panel,started,online,onSelect}:{panel:SidePanel;started:boolean;online:boolean;onSelect:(panel:SidePanel)=>void}) {
  return <nav className="side-rail" aria-label="右栏内容切换">{TABS.filter(tab=>tab.id!=='room'||online).map(tab=><button key={tab.id} aria-label={PANEL_TITLES[tab.id]} aria-pressed={panel===tab.id} aria-controls="side-panel-content" disabled={!started&&!['rules','room'].includes(tab.id)} onClick={()=>onSelect(tab.id)} title={PANEL_TITLES[tab.id]}><b aria-hidden="true">{tab.mark}</b><span>{tab.label}</span></button>)}</nav>;
}
const SIDES = {US:'美国',USSR:'苏联'};
const STATUS:Record<string,string> = {NONE:'无存在',PRESENCE:'存在',DOMINATION:'支配',CONTROL:'控制'};
const REGIONS:Region[] = ['EUROPE','ASIA','MIDDLE_EAST','AFRICA','CENTRAL_AMERICA','SOUTH_AMERICA'];
export function RegionPanel({state,side}:{state:GameState;side:Side}) {
  const enemy=side==='US'?'USSR':'US';
  return <section className="region-panel info-panel" aria-label="地区局势详情">
    <p className="panel-intro">以{SIDES[side]}视角查看 · 按当前公开局面估算</p>
    <div className="region-key"><span className={'ink-'+side}>你 · {SIDES[side]}</span><span className={'ink-'+enemy}>对方 · {SIDES[enemy]}</span></div>
    {REGIONS.map(region=>{
      const actual=scoreRegion(state,region), shuttle=Boolean(state.effects.shuttle&&(region==='ASIA'||region==='MIDDLE_EAST'));
      const forecast=shuttle?scoreRegion(state,region,{shuttle:true}):actual;
      const delta=forecast.delta*(side==='US'?1:-1);
      return <article className="region-report" key={region}>
        <header><h3>{REGION_NAMES[region]}</h3><strong className={forecast.winner?'ink-'+forecast.winner:delta>0?'ink-'+side:delta<0?'ink-'+enemy:''}>{forecast.winner?SIDES[forecast.winner]+'胜利':delta===0?'持平':delta>0?'你 +'+delta+' VP':'对方 +'+(-delta)+' VP'}</strong></header>
        <div className="region-comparison">{([side,enemy] as Side[]).map(s=><div key={s} className={'ink-'+s}><b>{STATUS[actual[s].status]}</b><span>控制国家 <strong>{actual[s].countries}</strong> · 战场国 <strong>{actual[s].battlegrounds}</strong></span></div>)}</div>
        {shuttle&&<small>计分预估已计入穿梭外交；上方数量为实际控制数。</small>}
      </article>;
    })}
    <details className="sea-report"><summary>东南亚单独计分</summary><p>{COUNTRIES.filter(c=>c.subRegions.includes('SOUTHEAST_ASIA')).map(c=>c.nameZh+'：'+(controller(state,c.id)?SIDES[controller(state,c.id)!]:'未控制')).join(' · ')}</p><p>当前净分：{scoreSoutheastAsia(state)*(side==='US'?1:-1)} VP（正数对你有利）；泰国 2 分，其余各 1 分。</p></details>
    <p className="panel-footnote">仅为当前计分预估，不会改变胜利分。事件和后续布点会改变结果；欧洲控制可直接获胜。</p>
  </section>;
}
export function LogPanel({lines}:{lines:string[]}) {
  return <section className="info-panel" aria-label="对局日志详情"><p className="panel-intro">最新记录在上 · 共 {lines.length} 条</p>{lines.length?<ol className="match-log" reversed>{[...lines].reverse().map((line,i)=><li key={lines.length-i}>{line}</li>)}</ol>:<p className="panel-empty">对局开始后，布点、出牌与结算会记录在这里。</p>}</section>;
}
export function RulesPanel() {
  return <section className="info-panel rules-panel" aria-label="规则速查详情"><p className="panel-intro">展开需要的规则，随时切回卡牌继续行动。</p>
    <details open><summary>如何推进当前步骤</summary><p>先看面板上方的当前步骤。点击手牌查看效果，选择用途并确认；地图金框是合法目标，可点击国家或拖入棋子。处理完行动后，点击“结束回合”继续。</p></details>
    <details><summary>影响力与国家控制</summary><p>一方影响力减去另一方影响力，达到该国稳定度即控制。放置 1 点影响力通常花费 1 OPS；对方控制国通常花费 2 OPS。合法目标由当前局面和事件决定。</p></details>
    <details><summary>头条、事件与行动点</summary><p>头条只执行事件。行动轮可以执行事件，或用行动点放置影响力、调整、政变。使用对方阵营卡的 OPS 时，对方事件通常仍会触发；太空竞赛可避免触发事件，但有 OPS 门槛与次数限制。</p></details>
    <details><summary>地区计分：存在、支配、控制</summary><p>控制至少一个国家即为存在。支配要求控制国家数、战场国数均多于对方，并至少控制一个非战场国。控制要求占领全部战场国且国家总数多于对方。战场国与邻接对方超级大国的国家还会加分，欧洲控制直接获胜。</p><p>“地区局势”可查看实时状态。计分牌必须在本回合打出，回合末仍持有会判负。</p></details>
    <details><summary>DEFCON、政变与军事行动</summary><p>DEFCON 为 4／3／2 时，依次禁止在欧洲／亚洲／中东进行通常的政变和调整。在战场国政变通常使 DEFCON 降低 1；降到 1 时，当前行动轮的行动方判负。回合末军事行动不足当前 DEFCON 的一方会受胜利分惩罚。</p></details>
    <details><summary>手牌、撤销与隐藏信息</summary><p>点击卡牌仅查看，确认用途才出牌。等待时也能看自己的牌；点击侧栏可查局势和日志。热座交接会隐藏手牌。撤销适合纠正误操作，已看到的信息无法收回。</p></details>
  </section>;
}
export function EffectsPanel({effects}:{effects:string[]}) {
  return <section className="info-panel" aria-label="持续效果详情"><p className="panel-intro">当前仍生效的公开事件</p>{effects.length?<ul className="ongoing-effects">{effects.map(effect=><li key={effect}><span aria-hidden="true">◆</span>{effect}</li>)}</ul>:<div className="panel-empty"><h3>暂无持续效果</h3><p>带有持续影响的事件生效后，会显示在这里。</p></div>}<p className="panel-footnote">效果的结束时机与限制由规则引擎结算。</p></section>;
}
