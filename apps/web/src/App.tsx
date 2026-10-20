import { useCallback, useEffect, useRef, useState } from 'react';
import type { Region, Side } from '@ts/shared';
import { CARD_BY_ID, COUNTRIES, REGION_NAMES, activeSide, apply, influencePlacement, placementCost, canPass, createGame, forcedMissileEnvy, formatLog, legalTargets, trapped, type GameState, type Action, type Effects, type OpsMode } from '@ts/game-core';
import { phaseGuide, StageGuide } from './StageGuide';
import { Board, type PlacementFeedback } from './Board';
import { CardComposer } from './CardComposer';
import { cardChoices } from './cardPlay';
import { CardView } from './CardView';
import { PhaseAnnouncer, phaseAnnouncement } from './PhaseAnnouncer';
import { LobbyPanel } from './LobbyPanel';
import { displayState, useOnline } from './useOnline';
const sides: Record<Side, string> = { USSR: '苏联', US: '美国' };
const modes: Record<OpsMode, string> = { INFLUENCE: '放置影响力', REALIGNMENT: '调整', COUP: '政变' };
const EFFECT_NAMES: Partial<Record<keyof Effects, string>> = {
  containment: '遏制政策', vietnam: '越南起义', cia: '中央情报局', nato: '北约', warsaw: '华约', marshall: '马歇尔计划', deGaulle: '戴高乐', japan: '美日安保',
  formosan: '台湾决议案', norad: '北美防空', cmc: '古巴导弹危机', nuclearSubs: '核潜艇', salt: '限制战略武器谈判', brezhnev: '勃列日涅夫主义', u2: 'U-2 事件',
  iranContra: '伊朗门', yuri: '尤里和萨曼莎', aldrich: '艾姆斯', deathSquads: '拉美敢死队', chernobyl: '切尔诺贝利', northSeaRound: '北海油田第 8 轮',
  quagmire: '泥潭', bearTrap: '捕熊陷阱', missileEnvy: '导弹嫉妒', buryYou: '我们会埋葬你们', shuttle: '穿梭外交', flowerPower: '花朵力量', evilEmpire: '邪恶帝国',
  iranianHostage: '伊朗人质危机', ironLady: '铁娘子', northSeaOil: '北海油田', reformer: '改革家', campDavid: '戴维营协议', johnPaul: '约翰·保罗二世',
  awacs: '预警机出售', tearDown: '推倒这堵墙', willyBrandt: '维利·勃兰特',
};
/** Short labels for the ongoing effects bar. */
function activeEffects(effects: Effects): string[] {
  const list: string[] = [];
  for (const side of ['USSR', 'US'] as const) if (effects.purge[side]) list.push('大清洗/红色恐慌（' + sides[side] + ' OPS −1）');
  for (const [key, name] of Object.entries(EFFECT_NAMES) as [keyof Effects, string][]) {
    const value = effects[key];
    if (!value) continue;
    list.push(key === 'chernobyl' ? name + '（' + REGION_NAMES[value as Region] + '）' : value === 'US' || value === 'USSR' ? name + '（' + sides[value] + '）' : name);
  }
  return list;
}
const newLocalGame=(seed:number,mode:'STANDARD'|'PRACTICE'='STANDARD'):GameState=>({...createGame(seed,mode),manualEnd:true});
const LOBBY_PREVIEW=createGame(1);
export function App() {
  const mapRef = useRef<HTMLElement>(null);
  const handRef = useRef<HTMLElement>(null);
  const actionRef = useRef<HTMLElement>(null);
  const [actionsOpen,setActionsOpen]=useState(false);
  const [zoom, setZoom] = useState(1);
  const [lastPlacement, setLastPlacement] = useState<PlacementFeedback | null>(null);
  const [localState, setState] = useState(() => newLocalGame(1));
  const [history,setHistory]=useState<{state:typeof localState;action:Action}[]>([]);
  const [countrySelection,setCountrySelection]=useState<{country:string;side:Side}|null>(null);
  const [undoVersion,setUndoVersion]=useState(0);
  const online=useOnline();
  // Before taking a seat there is no player view; the board shows a neutral opening preview.
  const state=online.snapshot?.view?displayState(online.snapshot.view):online.session?LOBBY_PREVIEW:localState;
  const [roomId,setRoomId]=useState(()=>new URLSearchParams(location.hash.slice(1)).get('room')??'');
  const [copyStatus,setCopyStatus]=useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const closeCard=useCallback(()=>setSelected(null),[]);
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState(false);
  const log=formatLog(state.log);
  const opsMode=state.phase.kind==='DECISION'&&state.phase.decision.kind==='OPS_MODE'?state.phase.decision:null;
  const actor=activeSide(state),side=online.snapshot?.side??actor??state.phasingSide,p=state.phase;
  const onlineActive=Boolean(online.session),inLobby=onlineActive&&!online.snapshot?.started;
  const canAct=(!onlineActive||Boolean(online.ready&&!online.busy&&online.snapshot?.started&&online.snapshot.side&&actor===side));
  const targets=canAct?(online.snapshot?online.snapshot.view?.targets??[]:legalTargets(state)):[];
  useEffect(()=>{setSelected(null);},[online.snapshot?.revision,online.session?.roomId]);
  useEffect(()=>{setRevealed(false);},[online.session?.roomId]);
  useEffect(()=>{setSelected(null);setCountrySelection(null);setActionsOpen(false);},[side]);
  useEffect(()=>{if(p.kind==='CONFIRM_END')setActionsOpen(false);if(p.kind==='DECISION'&&!['INFLUENCE','COUNTRY'].includes(p.decision.kind))setActionsOpen(true);},[p]);
  useEffect(()=>{setLastPlacement(null);setCountrySelection(null);},[state.seed,online.session?.roomId]);
  const invite=online.session?location.origin+location.pathname+'#room='+online.session.roomId:'';
  const copyInvite=()=>{if(!navigator.clipboard){setCopyStatus('请手动选中链接复制');return;}navigator.clipboard.writeText(invite).then(()=>setCopyStatus('已复制')).catch(()=>setCopyStatus('请手动选中链接复制'));};
  const dispatch = (action: Action) => {
    if (!side || !canAct) return;
    const placement=influencePlacement(state,action);
    if(placement){setCountrySelection(placement);setLastPlacement({...placement,before:state.influence[placement.country][placement.side]});}
    if(onlineActive){setSelected(null);online.send(action);return;}
    try {
      const next = apply(state, side, action);
      if (activeSide(next) !== side) setRevealed(false);
      setHistory(previous=>action.type==='END_ACTION'?[]:[...previous.slice(-31),{state,action}]);
      setState(next);setSelected(null);setError('');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const canUndo=onlineActive?Boolean(online.ready&&!online.busy&&!online.hasPending&&online.snapshot?.canUndo):history.length>0;
  const undo=(country?:string)=>{
    if(!canUndo)return;
    if(onlineActive)online.send(country?{type:'UNDO_PLACEMENT',country}:{type:'UNDO'});
    else{const restored=history[history.length-1].state;if((activeSide(restored)??restored.phasingSide)!==side)setRevealed(false);setState(restored);setHistory(previous=>previous.slice(0,-1));setUndoVersion(v=>v+1);}
    if(!country)setCountrySelection(null);
    setSelected(null);setLastPlacement(null);setError('');
  };
  const blocked = onlineActive ? !online.ready ? '正在恢复房间连接' : online.busy ? '正在确认你的操作' : !online.snapshot?.started ? '等待双方入座并开始对局' : online.snapshot.view&&online.snapshot.view.phase.kind==='WAITING' ? '等待'+sides[online.snapshot.view.phase.side]+'处理事件' : actor!==side ? '等待'+(actor?sides[actor]:'对方')+'行动' : undefined : undefined;
  const guide = phaseGuide(state, { selected, revealed, targetCount: targets.length, blocked });
  const focusTask = () => {
    if(p.kind==='SUBPLAY'&&canAct){setRevealed(true);setSelected(p.card);return;}
    if (guide.focus==='hand'&&!revealed) setRevealed(true);
    if (guide.focus==='actions')setActionsOpen(true);
    const ref = guide.focus==='map'?mapRef:guide.focus==='hand'?handRef:actionRef;
    ref.current?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
    ref.current?.focus({preventScroll:true});
  };
  const placingInfluence=p.kind==='SETUP_PLACEMENT'||p.kind==='OPS'&&p.mode==='INFLUENCE'||p.kind==='DECISION'&&p.decision.kind==='INFLUENCE'&&p.decision.operation==='ADD';
  const placementSide=p.kind==='DECISION'&&p.decision.kind==='INFLUENCE'?p.decision.affected:side;
  const localLast=history.at(-1);
  const undoPlacement=onlineActive?online.snapshot?.undoPlacement:localLast?influencePlacement(localLast.state,localLast.action):null;
  const canDecrease=Boolean(canUndo&&countrySelection&&undoPlacement?.country===countrySelection.country&&undoPlacement.side===countrySelection.side);
  const canIncrease=Boolean(countrySelection&&placingInfluence&&canAct&&placementSide===countrySelection.side&&targets.includes(countrySelection.country));
  const placeSelected=()=>{
    if(!canIncrease||!countrySelection)return;
    dispatch(p.kind==='DECISION'?{type:'CHOOSE',value:countrySelection.country}:{type:p.kind==='SETUP_PLACEMENT'?'PLACE_SETUP':'TARGET',country:countrySelection.country});
  };
  const onCountry = (id:string) => {
    if (!canAct || !targets.includes(id)) return;
    if(placingInfluence){setCountrySelection({country:id,side:placementSide});dispatch(p.kind==='DECISION'?{type:'CHOOSE',value:id}:{type:p.kind==='SETUP_PLACEMENT'?'PLACE_SETUP':'TARGET',country:id});return;}
    dispatch(p.kind === 'DECISION' ? {type:'CHOOSE',value:id} : {type:'TARGET',country:id});
  };
  const deckCount = online.snapshot?.view?.deckCount ?? state.deck.length;
  const turnActor = inLobby || p.kind === 'GAME_OVER' || p.kind === 'M1_COMPLETE' ? null : actor;
  const turnLabel = p.kind === 'GAME_OVER' ? '对局已结束' : inLobby ? '等待对局开始' : turnActor ? sides[turnActor] + '正在行动' : '等待下一阶段';
  const turnDetail = turnActor ? onlineActive ? !online.ready ? '连接恢复中' : online.busy ? '操作确认中' : turnActor === online.snapshot?.side ? '轮到你行动' : '等待对方行动' : '请由' + sides[turnActor] + '玩家操作' : '';

  return <main className="command-room board-table">
    <header className="masthead"><div className="brand"><h1>冷战热斗</h1><span className={'seat-tag seat-'+side}>{inLobby&&!online.snapshot?.side?'未入座':sides[side]}</span><span className="session-label">{onlineActive?'房间 '+online.session!.roomId:'本地热座'}</span></div><div className={'turn-indicator '+(turnActor?'turn-'+turnActor:'turn-idle')} role="status" aria-live="polite" aria-atomic="true"><i aria-hidden="true"/><div><strong>{turnLabel}</strong>{turnDetail&&<small>{turnDetail}</small>}</div></div><nav aria-label="牌桌工具">{canAct&&p.kind==='CONFIRM_END'&&<button className="primary end-action" onClick={()=>dispatch({type:'END_ACTION'})}>结束回合</button>}<button className="secondary" disabled={!canUndo} onClick={()=>undo()}>撤销</button><button className="secondary" aria-controls="table-actions" aria-expanded={actionsOpen} onClick={()=>setActionsOpen(v=>!v)}>{actionsOpen?'收起面板':'菜单与操作'}</button></nav></header>


    {(error||online.error)&&<p role="alert" className="error"><strong>操作未完成</strong> · {error||online.error}</p>}
    <div className="game-layout">
      <section className="map-panel surface" ref={mapRef} tabIndex={-1} aria-label="世界棋盘">
        <div className="panel-heading"><div><span className="eyebrow">全球局势</span><h2>世界棋盘</h2></div><div className="map-tools"><span className="target-legend"><i/>{targets.length?targets.length+' 个可选国家':'当前无需选择国家'}</span><button aria-label="缩小地图" disabled={zoom<=1} onClick={()=>setZoom(z=>Math.max(1,z-0.25))}>−</button><button className="zoom-reset" onClick={()=>setZoom(1)} title="重置为同屏适应">{Math.round(zoom*100)}%</button><button aria-label="放大地图" disabled={zoom>=2} onClick={()=>setZoom(z=>Math.min(2,z+0.25))}>＋</button></div></div>
        {countrySelection&&(placingInfluence||canDecrease)&&<div className="influence-editor" role="group" aria-label="国家影响力调整">
          <div className="influence-country"><strong>{COUNTRIES.find(c=>c.id===countrySelection.country)!.nameZh}</strong><span>美国 {state.influence[countrySelection.country].US} · 苏联 {state.influence[countrySelection.country].USSR}</span></div>
          <div className={'influence-stepper seat-'+countrySelection.side}><button aria-label="减少一点刚放置的影响力" disabled={!canDecrease} onClick={()=>undo(countrySelection.country)}>−</button><output aria-live="polite">{state.influence[countrySelection.country][countrySelection.side]}<small>{sides[countrySelection.side]}影响力</small></output><button aria-label="增加一点影响力" disabled={!canIncrease} onClick={placeSelected}>＋</button></div>
          <p>{canIncrease?(p.kind==='OPS'?'每加 1 点消耗 '+placementCost(state,countrySelection.country,side)+' OPS':'每次增加 1 点影响力'):canDecrease?'本次放置已完成，仍可用减号撤回最后一点':'当前不能继续放置，请按阶段提示操作'}<small>减号仅撤回该国最近的放置；其他误操作用“撤销上一步”。</small></p>
          <button className="secondary" onClick={()=>setCountrySelection(null)}>收起</button>
        </div>}
        <Board selectedCountry={countrySelection?.country} key={(online.session?.roomId??'local-'+state.seed)+'-undo-'+(online.snapshot?.undoVersion??undoVersion)} canInteract={canAct} onAction={dispatch} state={state} targets={targets} onCountry={onCountry} scale={zoom} lastPlacement={lastPlacement}/>
      </section>
      <aside id="table-actions" className={'action-panel command-dock surface table-actions '+(actionsOpen?'is-open':'')} hidden={!actionsOpen} ref={actionRef} tabIndex={-1} aria-label="操作区">
        <div className="panel-heading"><div><span className="eyebrow">{sides[side]}指挥席</span><h2>{blocked?'等待对局':p.kind==='SETUP_PLACEMENT'?'开局部署':p.kind==='OPS'?'执行行动':p.kind==='DECISION'||p.kind==='SUBPLAY'?'事件处理':'出牌与行动'}</h2></div><button className="secondary" aria-label="关闭操作区" onClick={()=>setActionsOpen(false)}>×</button></div>
        <div className="dock-body"><div className="action-content">
        {blocked?<div className="empty-action"><span aria-hidden="true">◷</span><h3>{blocked}</h3><p>你可以查看地图和自己的手牌。轮到你时，这里会显示可执行的操作。</p></div>:<>
        {p.kind==='SETUP_PLACEMENT'&&<div className="setup-instructions"><div className="remaining-points"><strong>{p.remaining}</strong><span>点影响力待放置</span></div><progress aria-label="开局布点进度" value={(side==='USSR'?6:7)-p.remaining} max={side==='USSR'?6:7}/><p>点击{p.subRegion==='EASTERN_EUROPE'?'东欧':'西欧'}的高亮国家，部署 1 点影响力。</p><p className="field-help">放完后请检查，点击“结束回合”才会交给下一位玩家。</p></div>}
        {p.kind==='OPS'&&<div className="ops-instructions"><div className="remaining-points"><strong>{p.remaining}</strong><span>行动点剩余 · {modes[p.mode]}</span></div><p>{p.mode==='INFLUENCE'?'点击高亮国家部署 1 点，也可拖动备用棋子。':'点击地图上的金框国家执行操作。'}</p>{p.mode==='COUP'&&<p className="field-help warning">点击国家即发动政变，消耗全部剩余行动点。请先确认目标。</p>}<button className="secondary" onClick={()=>dispatch({type:'END_OPS'})}>结束操作 / 放弃余点</button></div>}
      {/* Decisions stay visible while the hand is hidden, otherwise hot-seat players see no buttons after a hand-off. */}
      {p.kind === 'DECISION' && canAct && <div className="decision-panel">
          <h2>{p.decision.prompt}</h2>
          {p.decision.kind === 'REVEAL' && (revealed ? <><div className="hand">{p.decision.cards.map(id=><CardView key={id} card={CARD_BY_ID.get(id)!}/>)}</div><button onClick={()=>dispatch({type:'CHOOSE',value:'confirm'})}>已查看 · 继续</button></> : <p>这是{sides[side]}的秘密信息，请先点击下方“显示手牌”再查看。</p>)}
          {p.decision.kind === 'CHOICE' && p.decision.options.map(o=><button key={o.id} onClick={()=>dispatch({type:'CHOOSE',value:o.id})}>{o.label}</button>)}
          {p.decision.kind === 'INFLUENCE' && <><p>点击金色边框的国家 · 剩余 {p.decision.remaining} 点/次</p>{p.decision.optional && <button onClick={()=>dispatch({type:'CHOOSE',value:'done'})}>{p.decision.relocation?'移除完毕 · 进入重新放置':'完成 · 放弃剩余点数'}</button>}</>}
          {p.decision.kind === 'COUNTRY' && <p>点击金色边框的国家</p>}
          {p.decision.kind === 'OPS_MODE' && <>
            <p>可用 {p.decision.base} OPS{p.decision.free?'（免费：不计军事行动，无视 DEFCON 地区限制）':''}</p>
            {(p.decision.modes??Object.keys(modes) as OpsMode[]).map(m=><span key={m}><button onClick={()=>dispatch({type:'CHOOSE',value:m})}>{modes[m]}</button>{side==='USSR'&&state.effects.vietnam&&!opsMode?.only&&<button onClick={()=>dispatch({type:'CHOOSE',value:m+':SEA'})}>{modes[m]} · 限东南亚奖励</button>}</span>)}
            <button onClick={()=>dispatch({type:'CHOOSE',value:'skip'})}>放弃这些 OPS</button>
          </>}
        </div>}
      {p.kind==='SUBPLAY'&&canAct&&<div className="decision-panel"><h2>使用抽到的卡牌</h2><button onClick={()=>{setRevealed(true);setSelected(p.card);}}>查看 {CARD_BY_ID.get(p.card)!.nameZh}</button></div>}
      {p.kind === 'ACTION_ROUND' && canAct && state.effects.cmc===side && <div className="decision-panel">
          <h2>古巴导弹危机：本回合发动政变会直接输掉游戏</h2>
          {(side==='USSR'?['cuba']:['west_germany','turkey']).map(id=><button key={id} disabled={state.influence[id][side]<2} onClick={()=>dispatch({type:'CANCEL_CMC',country:id})}>移除{COUNTRIES.find(c=>c.id===id)!.nameZh} 2 点影响力以取消</button>)}
        </div>}

        {revealed&&<div className="special-actions">          {p.kind === 'ACTION_ROUND' && state.mode==='PRACTICE' && state.hands[side].every(id=>CARD_BY_ID.get(id)!.scoring) && <button onClick={()=>dispatch({type:'PASS_PRACTICE'})}>无 OPS 牌 · 跳过练习行动</button>}
          {canAct && p.kind==='ACTION_ROUND' && canPass(state,side) && <button onClick={()=>dispatch({type:'PASS_EMPTY'})}>{!state.hands[side].length?'手牌用尽 · 跳过行动':p.round>(state.turn<=3?6:7)?'放弃第 8 个行动轮':'没有可弃或可打的牌 · 跳过行动'}</button>}
          {canAct&&p.kind==='CONFIRM_END'&&<button className="primary end-action" onClick={()=>dispatch({type:'END_ACTION'})}>结束回合</button>}
      {canAct&&p.kind==='ACTION_ROUND'&&state.mode==='STANDARD'&&trapped(state,side)&&<p className="notice">点击底部手牌，选择“弃牌尝试脱困”；没有可弃牌时打计分牌或跳过。</p>}
          {canAct && p.kind==='ACTION_ROUND' && forcedMissileEnvy(state,side) && <p className="notice">导弹嫉妒：本行动轮必须把“导弹嫉妒”用作 OPS。</p>}
</div>}

        {(p.kind==='HEADLINE'||p.kind==='ACTION_ROUND')&&(selected===null||!revealed)&&<div className="empty-action"><span aria-hidden="true">▤</span><h3>{revealed?'选择一张手牌':'先查看自己的手牌'}</h3><p>{revealed?'点击下方手牌，选择用途后确认出牌。':'热座交接时手牌保持隐藏。确认由'+sides[side]+'玩家操作后，再显示手牌。'}</p><button className="primary" onClick={()=>{setRevealed(true);setActionsOpen(false);}}>查看手牌</button></div>}
        {(p.kind==='GAME_OVER'||p.kind==='M1_COMPLETE')&&<p>{guide.detail}</p>}
        </>}
        {targets.length>0&&<details className="target-picker" open={p.kind==='SETUP_PLACEMENT'}><summary>可操作国家 <span>{targets.length}</span></summary><p className="field-help">也可点击下方国名选择国家。</p><div className="target-list">{targets.map(id=><button key={id} onClick={()=>onCountry(id)}>{COUNTRIES.find(c=>c.id===id)!.nameZh}<small>美 {state.influence[id].US} / 苏 {state.influence[id].USSR}</small></button>)}</div></details>}
    <details className="settings-panel">
      <summary>联机与对局设置 <span>邀请朋友 / 切换模式 / 重新开局</span></summary>
      <div className="settings-grid"><section className="online-panel"><h2>双人联机</h2><p className="field-help">创建房间后发送邀请链接。同一局域网内，请使用电脑的局域网地址打开页面。</p>
      {!online.session?<><button className="primary" disabled={online.busy} onClick={online.create}>创建房间</button><p className="field-help">进入房间后再选择阵营。</p>
        <label>房间号 <input value={roomId} onChange={e=>setRoomId(e.target.value)} maxLength={10} placeholder="朋友的房间号"/></label>
        <button disabled={online.busy||!roomId.trim()} onClick={()=>online.join(roomId)}>加入房间</button>
        <button disabled={online.busy} onClick={online.resume}>恢复上次房间</button></>:<>
        <p>房间 <strong>{online.session.roomId}</strong> · {online.snapshot?.side?'你是'+sides[online.snapshot.side]:'尚未入座'} · {online.ready?'已连接':'连接已中断，自动重连中'}</p>
        <p>{(['USSR','US'] as const).map(s=><span key={s}>{sides[s]}：{online.snapshot?.seats[s].mine?'你':online.snapshot?.seats[s].connected?'在线':online.snapshot?.seats[s].occupied?'离线（保留席位）':'空位'} </span>)}</p>
        <input aria-label="邀请链接" readOnly value={invite}/><button onClick={copyInvite}>复制邀请链接</button><span>{copyStatus}</span>
        <button onClick={online.leave}>返回本地（保留恢复身份）</button>
        {online.hasPending&&<button disabled={!online.ready||online.busy} onClick={online.retry}>重试待确认操作</button>}
      </>}


      </section><section className="new-game-panel"><h2>本地对局</h2>
      <label>新局模式 <select disabled={onlineActive} value={state.mode} onChange={e=>{setHistory([]);setState(newLocalGame(state.seed+1,e.target.value as 'STANDARD'|'PRACTICE'));setRevealed(false);setSelected(null);setError('');}}><option value="STANDARD">标准对局 · 10 回合</option><option value="PRACTICE">行动点练习 · 1 回合</option></select></label>
      <button disabled={onlineActive} onClick={() => { setHistory([]);setState(newLocalGame((state.seed + 1) >>> 0,state.mode)); setRevealed(false); setSelected(null); setError(''); }}>重新开局</button>
      <p className="field-help">{onlineActive?'联机中不能重开本地对局，请先返回本地。':'本地热座由双方轮流操作同一设备。刷新页面将重开本地对局。'}</p></section></div>
    </details>
    {activeEffects(state.effects).length>0&&<details className="effects-panel"><summary>生效中的事件 <span>{activeEffects(state.effects).length}</span></summary><div className="effect-chips">{activeEffects(state.effects).map(e=><span key={e}>{e}</span>)}</div></details>}
    <details className="log-panel"><summary>对局日志 <span>{log.length} 条记录</span></summary>{log.length?<ol className="log">{log.map((line,i)=><li key={i}>{line}</li>)}</ol>:<p className="field-help">对局开始后，布点、出牌和结算记录会显示在这里。</p>}</details>

        <details className="quick-help"><summary>玩法速查</summary><dl><dt>行动点（OPS）</dt><dd>用于放置影响力、调整或政变。选择用途后，再点击合法目标。</dd><dt>事件与头条</dt><dd>头条只结算事件。行动轮用对方牌的行动点时，对方事件仍会触发。</dd><dt>计分牌</dt><dd>本回合内必须打出。留到回合末会判负。</dd><dt>地图标记</dt><dd>蓝色代表美国，红色代表苏联；实心影响力标记表示控制。金框代表当前合法目标。</dd></dl></details>
        </div>

        </div>
      </aside>
      <section className="hand-panel hand-dock" ref={handRef} tabIndex={-1} aria-label="我的手牌">
        <div className="panel-heading"><div><span className="eyebrow">{onlineActive?'仅自己可见':'热座交接 · 请保护手牌'}</span><h2>{sides[side]}手牌 <small>{state.hands[side].length} 张{state.mode==='STANDARD'&&p.kind==='ACTION_ROUND'&&state.chinaCard.holder===side&&state.chinaCard.faceUp?' ＋ 中国牌':''}</small></h2></div><button className={revealed?'secondary':'primary'} onClick={()=>{setSelected(null);setRevealed(r=>!r);}}>{revealed?'隐藏手牌':'显示手牌'}</button></div>
        {!revealed?<div className="hand-curtain"><div className="card-backs" aria-hidden="true"><i/><i/><i/></div><div><h3>手牌暂时隐藏</h3><p>{onlineActive?'点击“显示手牌”查看自己的卡牌。':'请交给'+sides[side]+'玩家，再点击“显示手牌”。'}</p></div></div>:<>

        <p className="hand-hint">{!canAct?'等待对方行动；你仍可查看自己的手牌。':p.kind==='SETUP_PLACEMENT'?'当前先完成地图布点，进入头条或行动轮后可选牌。':p.kind==='HEADLINE'?'点击手牌，在右侧确认头条。':p.kind==='ACTION_ROUND'?'点击手牌，在右侧选择用途并确认出牌。':'正在结算行动，完成当前任务后再选择下一张牌。'}</p>
        <div className="hand hand-fan">{[...state.hands[side],...(state.mode==='STANDARD'&&p.kind==='ACTION_ROUND'&&state.chinaCard.holder===side&&state.chinaCard.faceUp?[6]:[])].map(id=>{const card=CARD_BY_ID.get(id)!;const playable=canAct&&cardChoices(state,side,id).some(option=>!option.reason);return <button className={'card-button '+(playable?'playable ':'')+(selected===id?'selected':'')} data-hand-card={id} key={id} aria-label={card.nameZh+(card.scoring?'，计分牌':'，'+card.ops+' 行动点')} aria-pressed={selected===id} title={card.nameZh+' · 在上方查看'+(playable?'并出牌':'')} onClick={()=>{setSelected(current=>current===id?null:id);}}><span className={'card-head side-'+card.side}><b>{card.scoring?'计分':card.ops}</b><span><span className="card-head-title">{card.nameZh}</span><small>{card.starred?'一次性事件':card.scoring?'区域计分':sides[card.side as Side]??'中立事件'}</small></span></span><CardView card={card}/><span className="card-caption">{card.nameZh}<small>{card.scoring?'计分牌':card.ops+' OPS'}</small></span></button>;})}</div>
        {state.effects.cia && side==='US' && <details><summary>中央情报局：本回合苏联公开手牌</summary><div className="hand">{state.hands.USSR.map(id=><CardView key={id} card={CARD_BY_ID.get(id)!}/>)}</div></details>}
        {state.effects.aldrich && side==='USSR' && <details><summary>奥德里奇·艾姆斯：本回合美国公开手牌</summary><div className="hand">{state.hands.US.map(id=><CardView key={id} card={CARD_BY_ID.get(id)!}/>)}</div></details>}

        </>}
        <div className="hand-footer"><span>牌库 {deckCount} 张 · 弃牌 {state.discard.length} 张</span>{online.snapshot?.view&&<span>对方手牌 {online.snapshot.view.handCounts[side==='US'?'USSR':'US']} 张</span>}<span>中国牌 · {sides[state.chinaCard.holder]}持有</span></div>
      </section>
      <aside className="card-workspace surface" aria-label="卡牌操作区">
        <header className="workspace-heading"><h2>{inLobby?'房间大厅':'卡牌操作'}</h2><span>{inLobby?'先选阵营，再开始':'先选牌，再选用途'}</span></header>
        {!onlineActive&&<section className="room-entry" aria-label="联机房间"><h3>与朋友联机</h3><button disabled={online.busy} onClick={online.create}>创建房间</button><form onSubmit={e=>{e.preventDefault();if(roomId.trim()&&!online.busy)online.join(roomId);}}><input aria-label="房间码" placeholder="输入朋友的房间码" value={roomId} maxLength={10} onChange={e=>setRoomId(e.target.value.toUpperCase())}/><button disabled={online.busy||!roomId.trim()}>加入</button></form><button className="secondary" disabled={online.busy} onClick={online.resume}>恢复上次房间</button></section>}
        {onlineActive&&<section className="room-controls" aria-label="房间管理"><strong>房间码：{online.session!.roomId}</strong><button onClick={()=>{navigator.clipboard?.writeText(online.session!.roomId).then(()=>setCopyStatus('房间码已复制')).catch(()=>setCopyStatus('请手动复制房间码'));}}>复制房间码</button>{copyStatus&&<small>{copyStatus}</small>}{online.snapshot?.isHost&&<><button disabled={online.busy||!online.ready} onClick={()=>{if(window.confirm('重新开局会清除当前对局，双方回到大厅，房间码和座位保留。确定吗？'))online.restart();}}>重新开局</button><button disabled={online.busy||!online.ready} onClick={()=>{if(window.confirm('关闭后双方会退出房间，当前对局将被清除。确定关闭？'))online.close();}}>关闭房间</button></>}</section>}
        {inLobby?<LobbyPanel snapshot={online.snapshot} roomId={online.session!.roomId} invite={invite} busy={online.busy||!online.ready} copyStatus={copyStatus} onCopy={copyInvite} onSeat={online.seat} onStart={online.start}/>:<>
        {revealed&&p.kind==='HEADLINE'&&state.space[side]>=4&&state.space[side==='US'?'USSR':'US']<4&&state.headlines[side==='US'?'USSR':'US']!==undefined&&<p className="notice">太空特权：对方头条为 {CARD_BY_ID.get(state.headlines[side==='US'?'USSR':'US']!)!.nameZh}</p>}
    <StageGuide guide={guide} side={side} onFocus={focusTask} showFocus={guide.focus==='hand'&&!revealed||guide.focus==='actions'&&selected===null} actionLabel={guide.focus==='hand'&&!revealed?'显示手牌':undefined}>
      {canAct&&p.kind==='CONFIRM_END'&&<button className="primary end-action" onClick={()=>dispatch({type:'END_ACTION'})}>结束回合</button>}
      {canAct&&p.kind==='ACTION_ROUND'&&state.mode==='PRACTICE'&&state.hands[side].every(id=>CARD_BY_ID.get(id)!.scoring)&&<button className="secondary" onClick={()=>dispatch({type:'PASS_PRACTICE'})}>跳过练习行动</button>}
      {canAct&&p.kind==='OPS'&&<button className="secondary" onClick={()=>dispatch({type:'END_OPS'})}>完成操作，检查后结束回合</button>}
      {canAct&&p.kind==='DECISION'&&p.decision.kind==='INFLUENCE'&&p.decision.optional&&<button className="secondary" onClick={()=>dispatch({type:'CHOOSE',value:'done'})}>{p.decision.relocation?'移除完毕':'完成选择'}</button>}
      {canAct&&p.kind==='ACTION_ROUND'&&canPass(state,side)&&<button className="secondary" onClick={()=>dispatch({type:'PASS_EMPTY'})}>跳过本轮</button>}
    </StageGuide>
      {selected!==null&&revealed&&<CardComposer key={selected} id={selected} state={state} side={side} canAct={canAct} blocked={blocked} onPlay={dispatch} onClose={closeCard}/>}
        {p.kind!=='CONFIRM_END'&&(selected===null||!revealed)&&<div className="card-workspace-empty"><span aria-hidden="true">▤</span><h3>{revealed?'点击下方的一张手牌':'手牌暂时隐藏'}</h3><p>{revealed?'卡牌效果、用途与确认按钮会显示在这里。':'确认由'+sides[side]+'玩家操作后，显示手牌。'}</p>{!revealed&&<button className="primary" onClick={()=>setRevealed(true)}>显示自己的手牌</button>}</div>}</>}
      </aside>


    </div>
    <PhaseAnnouncer announcement={canAct&&!blocked&&actor===side?phaseAnnouncement(state):null}/>
    <footer className="table-footer"><span>冷战热斗 · 中文牌桌</span><span>苏联先手 · 美国后手</span></footer>
  </main>;
}
