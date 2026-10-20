import { useEffect, useRef, useState } from 'react';
import type { Region, Side } from '@ts/shared';
import { CARD_BY_ID, COUNTRIES, EVENT_SUMMARIES, REGION_NAMES, activeSide, apply, canEvent, canPass, createGame, forcedMissileEnvy, formatLog, legalTargets, trapDiscards, trapped, type Action, type Effects, type OpsMode } from '@ts/game-core';
import { phaseGuide, StageGuide } from './StageGuide';
import { Board } from './Board';
import { CardView } from './CardView';
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
export function App() {
  const mapRef = useRef<HTMLElement>(null);
  const handRef = useRef<HTMLElement>(null);
  const actionRef = useRef<HTMLElement>(null);
  const [zoom, setZoom] = useState(1);
  const [localState, setState] = useState(() => createGame(1));
  const online=useOnline();
  const state=online.snapshot?displayState(online.snapshot.view):localState;
  const [roomId,setRoomId]=useState(()=>new URLSearchParams(location.hash.slice(1)).get('room')??'');
  const [seat,setSeat]=useState<Side>(()=>new URLSearchParams(location.hash.slice(1)).get('side')==='US'?'US':'USSR');
  const [copyStatus,setCopyStatus]=useState('');
  const [mode, setMode] = useState<OpsMode>('INFLUENCE');
  const [selected, setSelected] = useState<number | null>(null);
  const [use, setUse] = useState<'OPS'|'EVENT'|'SPACE'>('OPS');
  const [order, setOrder] = useState<'BEFORE'|'AFTER'>('BEFORE');
  const [regional, setRegional] = useState<'NONE'|'ASIA'|'SEA'>('NONE');
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState(false);
  const log=formatLog(state.log);
  const opsMode=state.phase.kind==='DECISION'&&state.phase.decision.kind==='OPS_MODE'?state.phase.decision:null;
  const actor=activeSide(state),side=online.session?.side??actor??state.phasingSide,p=state.phase;
  const onlineActive=Boolean(online.session);
  const canAct=!onlineActive||Boolean(online.ready&&!online.busy&&online.snapshot&&actor===side&&online.snapshot.seats.US.occupied&&online.snapshot.seats.USSR.occupied);
  const targets=canAct?(online.snapshot?online.snapshot.view.targets:legalTargets(state)):[];
  useEffect(()=>{setSelected(null);setRegional('NONE');},[online.snapshot?.revision,online.session?.roomId]);
  useEffect(()=>{setRevealed(false);},[online.session?.roomId]);
  const invite=online.session?location.origin+location.pathname+'#room='+online.session.roomId+'&side='+(online.session.side==='US'?'USSR':'US'):'';
  const dispatch = (action: Action) => {
    if (!side || !canAct) return;
    if(onlineActive){online.send(action);return;}
    try {
      const next = apply(state, side, action);
      if (activeSide(next) !== side) setRevealed(false);
      setState(next); setSelected(null); setRegional('NONE'); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const blocked = onlineActive ? !online.ready ? '正在恢复房间连接' : online.busy ? '正在确认你的操作' : !online.snapshot || !online.snapshot.seats.US.occupied || !online.snapshot.seats.USSR.occupied ? '等待另一位玩家加入' : online.snapshot.view.phase.kind==='WAITING' ? '等待'+sides[online.snapshot.view.phase.side]+'处理事件' : actor!==side ? '等待'+(actor?sides[actor]:'对方')+'行动' : undefined : undefined;
  const guide = phaseGuide(state, { selected, revealed, targetCount: targets.length, blocked });
  const focusTask = () => {
    const ref = guide.focus==='map'?mapRef:guide.focus==='hand'?handRef:actionRef;
    ref.current?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
    ref.current?.focus({preventScroll:true});
  };
  const onCountry = (id:string) => dispatch(p.kind === 'DECISION' ? {type:'CHOOSE',value:id} : { type: p.kind === 'SETUP_PLACEMENT' ? 'PLACE_SETUP' : 'TARGET', country:id });
  const deckCount = online.snapshot?.view.deckCount ?? state.deck.length;
  return <main className="command-room">
    <header className="masthead"><div className="brand"><span className="brand-symbol" aria-hidden="true">✦</span><div><h1>冷战热斗</h1><span className="brand-subtitle">TWILIGHT STRUGGLE · 1945—1989</span></div></div><div className="session-label"><i className={onlineActive?'live-dot online':'live-dot'}/>{onlineActive?'联机房间 · '+online.session!.roomId:'本地双人热座'}<span>{state.mode==='STANDARD'?'标准对局':'行动点练习'}</span></div></header>

    <details className="settings-panel">
      <summary>联机与对局设置 <span>邀请朋友 / 切换模式 / 重新开局</span></summary>
      <div className="settings-grid"><section className="online-panel"><h2>双人联机</h2><p className="field-help">创建房间后发送邀请链接。同一局域网内，请使用电脑的局域网地址打开页面。</p>
      {!online.session?<><label>阵营 <select value={seat} onChange={e=>setSeat(e.target.value as Side)}><option value="USSR">苏联</option><option value="US">美国</option></select></label>
        <button disabled={online.busy} onClick={()=>online.create(seat)}>创建房间</button>
        <label>房间号 <input value={roomId} onChange={e=>setRoomId(e.target.value)} maxLength={10} placeholder="朋友的房间号"/></label>
        <button disabled={online.busy||!roomId.trim()} onClick={()=>online.join(roomId,seat)}>加入房间</button>
        <button disabled={online.busy} onClick={online.resume}>恢复上次房间</button></>:<>
        <p>房间 <strong>{online.session.roomId}</strong> · 你是{sides[online.session.side]} · {online.ready?'已连接':'连接已中断，自动重连中'}</p>
        <p>{(['USSR','US'] as const).map(s=><span key={s}>{sides[s]}：{online.snapshot?.seats[s].connected?'在线':online.snapshot?.seats[s].occupied?'离线（保留席位）':'等待加入'} </span>)}</p>
        <input aria-label="邀请链接" readOnly value={invite}/><button onClick={()=>{if(!navigator.clipboard){setCopyStatus('请长按链接复制');return;}navigator.clipboard.writeText(invite).then(()=>setCopyStatus('已复制')).catch(()=>setCopyStatus('请长按链接复制'));}}>复制邀请链接</button><span>{copyStatus}</span>
        <button onClick={online.leave}>返回本地（保留恢复身份）</button>
        {online.hasPending&&<button disabled={!online.ready||online.busy} onClick={online.retry}>重试待确认操作</button>}
      </>}


      </section><section className="new-game-panel"><h2>本地对局</h2>
      <label>新局模式 <select disabled={onlineActive} value={state.mode} onChange={e=>{setState(createGame(state.seed+1,e.target.value as 'STANDARD'|'PRACTICE'));setRevealed(false);setSelected(null);setError('');}}><option value="STANDARD">标准对局 · 10 回合</option><option value="PRACTICE">行动点练习 · 1 回合</option></select></label>
      <button disabled={onlineActive} onClick={() => { setState(createGame((state.seed + 1) >>> 0,state.mode)); setRevealed(false); setSelected(null); setError(''); }}>重新开局</button>
      <p className="field-help">{onlineActive?'联机中不能重开本地对局，请先返回本地。':'本地热座由双方轮流操作同一设备。刷新页面将重开本地对局。'}</p></section></div>
    </details>

    <section className="situation-bar" aria-label="全球局势">
      <div><span>战争时期</span><strong>{state.turn<=3?'冷战早期':state.turn<=7?'冷战中期':'冷战后期'} <small>第 {state.turn} / 10 回合</small></strong></div>
      <div className={state.defcon<=2?'danger-metric':''}><span>核威胁 · DEFCON</span><strong>{state.defcon} <small>{state.defcon>=4?'局势缓和':state.defcon===3?'局势紧张':'核危机'}</small></strong></div>
      <div><span>胜利分 · VP</span><strong>{state.vp===0?'势均力敌':(state.vp>0?'美国 +':'苏联 +')+Math.abs(state.vp)}<small> / 20</small></strong></div>
      <div><span>军事行动</span><strong><em className="ink-ussr">苏 {state.milOps.USSR}</em><small> / </small><em className="ink-us">美 {state.milOps.US}</em></strong></div>
      <div><span>太空竞赛</span><strong><em className="ink-ussr">苏 {state.space.USSR}</em><small> / </small><em className="ink-us">美 {state.space.US}</em></strong></div>
      <div><span>中国牌</span><strong>{sides[state.chinaCard.holder]} <small>{state.chinaCard.faceUp?'可用':'背面待翻转'}</small></strong></div>
    </section>
    <StageGuide guide={guide} side={side} onFocus={focusTask}/>
    {(error||online.error)&&<p role="alert" className="error"><strong>操作未完成</strong> · {error||online.error}</p>}
    <div className="game-layout">
      <section className="map-panel surface" ref={mapRef} tabIndex={-1} aria-label="世界棋盘">
        <div className="panel-heading"><div><span className="eyebrow">全球局势</span><h2>世界棋盘</h2></div><div className="map-tools"><span className="target-legend"><i/>{targets.length?targets.length+' 个可选国家':'当前无需选择国家'}</span><button aria-label="缩小地图" disabled={zoom<=1} onClick={()=>setZoom(z=>Math.max(1,z-0.25))}>−</button><button className="zoom-reset" onClick={()=>setZoom(1)} title="重置为适应宽度">{Math.round(zoom*100)}%</button><button aria-label="放大地图" disabled={zoom>=2} onClick={()=>setZoom(z=>Math.min(2,z+0.25))}>＋</button></div></div>
        <Board state={state} targets={targets} onCountry={onCountry} scale={zoom}/>
      </section>
      <aside className="action-panel surface" ref={actionRef} tabIndex={-1} aria-label="操作区">
        <div className="panel-heading"><div><span className="eyebrow">{sides[side]}指挥席</span><h2>{blocked?'等待对局':p.kind==='SETUP_PLACEMENT'?'开局部署':p.kind==='OPS'?'执行行动':p.kind==='DECISION'||p.kind==='SUBPLAY'?'事件处理':'出牌与行动'}</h2></div><span className={'seat-tag seat-'+side}>{sides[side]}</span></div>
        <div className="action-content">
        {blocked?<div className="empty-action"><span aria-hidden="true">◷</span><h3>{blocked}</h3><p>你可以查看地图和自己的手牌。轮到你时，这里会显示可执行的操作。</p></div>:<>
        {p.kind==='SETUP_PLACEMENT'&&<div className="setup-instructions"><div className="remaining-points"><strong>{p.remaining}</strong><span>点影响力待放置</span></div><progress aria-label="开局布点进度" value={(side==='USSR'?6:7)-p.remaining} max={side==='USSR'?6:7}/><p>在{p.subRegion==='EASTERN_EUROPE'?'东欧':'西欧'}的金框国家点击放置，每次 1 点。</p><p className="field-help">放完后自动进入下一阶段，无需额外确认。</p></div>}
        {p.kind==='OPS'&&<div className="ops-instructions"><div className="remaining-points"><strong>{p.remaining}</strong><span>行动点剩余 · {modes[p.mode]}</span></div><p>点击地图上的金框国家执行操作。</p>{p.mode==='COUP'&&<p className="field-help warning">点击国家即发动政变，消耗全部剩余行动点。请先确认目标。</p>}<button className="secondary" onClick={()=>dispatch({type:'END_OPS'})}>结束操作 / 放弃余点</button></div>}
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
      {p.kind === 'SUBPLAY' && canAct && <div className="decision-panel">
          <h2>向苏联出售谷物：打出抽到的牌</h2>
          <div className="hand"><CardView card={CARD_BY_ID.get(p.card)!}/></div><p>{EVENT_SUMMARIES[p.card]}</p>
          {CARD_BY_ID.get(p.card)!.side!=='USSR'&&canEvent(state,p.card,'US')&&<button onClick={()=>dispatch({type:'PLAY_EVENT',card:p.card})}>作为事件</button>}
          {!CARD_BY_ID.get(p.card)!.scoring&&<><label> OPS 用途 <select value={mode} onChange={e=>setMode(e.target.value as OpsMode)}>{(Object.keys(modes) as OpsMode[]).map(m=><option key={m} value={m}>{modes[m]}</option>)}</select></label>
            <button onClick={()=>dispatch({type:'PLAY_OPS',card:p.card,mode,order})}>作为 OPS{CARD_BY_ID.get(p.card)!.side==='USSR'?'（苏联事件照常发生）':''}</button>
            <button onClick={()=>dispatch({type:'SPACE',card:p.card})}>用于太空竞赛</button></>}
        </div>}
      {p.kind === 'ACTION_ROUND' && canAct && state.effects.cmc===side && <div className="decision-panel">
          <h2>古巴导弹危机：本回合发动政变会直接输掉游戏</h2>
          {(side==='USSR'?['cuba']:['west_germany','turkey']).map(id=><button key={id} disabled={state.influence[id][side]<2} onClick={()=>dispatch({type:'CANCEL_CMC',country:id})}>移除{COUNTRIES.find(c=>c.id===id)!.nameZh} 2 点影响力以取消</button>)}
        </div>}

        {revealed&&<div className="special-actions">          {p.kind === 'ACTION_ROUND' && state.mode==='PRACTICE' && state.hands[side].every(id=>CARD_BY_ID.get(id)!.scoring) && <button onClick={()=>dispatch({type:'PASS_PRACTICE'})}>无 OPS 牌 · 跳过练习行动</button>}
          {canAct && p.kind==='ACTION_ROUND' && canPass(state,side) && <button onClick={()=>dispatch({type:'PASS_EMPTY'})}>{!state.hands[side].length?'手牌用尽 · 跳过行动':p.round>(state.turn<=3?6:7)?'放弃第 8 个行动轮':'没有可弃或可打的牌 · 跳过行动'}</button>}
          {canAct && p.kind==='ACTION_ROUND' && state.mode==='STANDARD' && trapped(state,side) && <div className="decision-panel"><h2>{side==='US'?'泥潭':'捕熊陷阱'}：弃一张至少 2 OPS 的牌，掷出 1–4 脱困</h2>
            {trapDiscards(state,side).map(id=><button key={id} onClick={()=>dispatch({type:'TRAP_DISCARD',card:id})}>弃置 {CARD_BY_ID.get(id)!.nameZh}</button>)}
            {!trapDiscards(state,side).length&&<p>没有可弃的牌：本行动轮只能打出计分牌。</p>}</div>}
          {canAct && p.kind==='ACTION_ROUND' && forcedMissileEnvy(state,side) && <p className="notice">导弹嫉妒：本行动轮必须把“导弹嫉妒”用作 OPS。</p>}
</div>}
{selected!==null && revealed && (p.kind==='HEADLINE'||p.kind==='ACTION_ROUND') && <section className="card-detail" aria-label="已选卡牌操作">
            <div className="eyebrow">已选卡牌 · #{selected}</div><h2>{CARD_BY_ID.get(selected)!.nameZh}</h2><p>{EVENT_SUMMARIES[selected]}</p>
            {p.kind==='HEADLINE' ? <button className="primary" disabled={!canAct||selected===32||selected===6} onClick={()=>dispatch({type:'SELECT_HEADLINE',card:selected})}>确定头条</button> : <>
              {state.mode==='STANDARD' && <label>出牌方式 <select value={selected===6?'OPS':use} onChange={e=>setUse(e.target.value as typeof use)}><option value="OPS" disabled={CARD_BY_ID.get(selected)!.scoring}>OPS 操作</option><option value="EVENT" disabled={selected===6||CARD_BY_ID.get(selected)!.side===(side==='US'?'USSR':'US')}>事件 / 计分</option><option value="SPACE" disabled={selected===6||CARD_BY_ID.get(selected)!.scoring}>太空竞赛</option></select></label>}
              {(state.mode==='PRACTICE'||use==='OPS'||selected===6) && <><label> OPS 用途 <select value={mode} onChange={e=>setMode(e.target.value as OpsMode)}>{(Object.keys(modes) as OpsMode[]).map(m=><option key={m} value={m}>{modes[m]}</option>)}</select></label>
                {state.mode==='STANDARD'&&<><label> 对手事件 <select value={order} onChange={e=>setOrder(e.target.value as typeof order)}><option value="BEFORE">OPS 前结算</option><option value="AFTER">OPS 后结算</option></select></label>
                  <label> 区域奖励 <select value={regional} onChange={e=>setRegional(e.target.value as typeof regional)}><option value="NONE">不限制地区</option>{selected===6&&<option value="ASIA">全部在亚洲 · 中国牌奖励</option>}{side==='USSR'&&state.effects.vietnam&&<option value="SEA">全部在东南亚 · 越南奖励{selected===6?' + 中国牌奖励':''}</option>}</select></label></>}
              </>}
              <p className="field-help">{selected===6?'中国牌只用于行动点，使用后交给对方。':CARD_BY_ID.get(selected)!.scoring?'计分牌立即结算对应区域，本回合内必须打出。':use==='SPACE'?'用于太空竞赛不会触发卡牌事件；行动点和尝试次数仍需满足要求。':use==='EVENT'?(canEvent(state,selected,side)?'执行卡牌事件；按提示完成后续选择。':'事件前置条件未满足：打出后事件不生效。'):CARD_BY_ID.get(selected)!.side===(side==='US'?'USSR':'US')?'这张牌属于对方：用于行动点时，对方事件仍会发生，请选择结算顺序。':'使用牌上的行动点执行所选操作。'}</p>
              <button disabled={!canAct||p.kind!=='ACTION_ROUND'} onClick={()=>dispatch(state.mode==='PRACTICE'||selected===6||use==='OPS'?{type:'PLAY_OPS',card:selected,mode,order,asiaOnly:regional==='ASIA',seaOnly:regional==='SEA'}:use==='EVENT'?{type:'PLAY_EVENT',card:selected}:{type:'SPACE',card:selected})} className="primary">确认出牌</button>
            </>}
            {p.kind==='HEADLINE'&&selected===32&&<p className="field-help warning">联合国干预不能作为头条，请换一张牌。</p>}
          </section>}
        {(p.kind==='HEADLINE'||p.kind==='ACTION_ROUND')&&(selected===null||!revealed)&&<div className="empty-action"><span aria-hidden="true">▤</span><h3>{revealed?'选择一张手牌':'先查看自己的手牌'}</h3><p>{revealed?'点击下方卡牌，这里会显示可用的出牌方式与事件说明。':'热座交接时手牌保持隐藏。确认由'+sides[side]+'玩家操作后，再显示手牌。'}</p><button className="primary" onClick={()=>handRef.current?.scrollIntoView({behavior:'smooth',block:'start'})}>前往手牌 ↓</button></div>}
        {(p.kind==='GAME_OVER'||p.kind==='M1_COMPLETE')&&<p>{guide.detail}</p>}
        </>}
        {targets.length>0&&<details className="target-picker" open={p.kind==='SETUP_PLACEMENT'}><summary>可操作国家 <span>{targets.length}</span></summary><p className="field-help">也可直接点击下方国名执行操作。</p><div className="target-list">{targets.map(id=><button key={id} onClick={()=>onCountry(id)}>{COUNTRIES.find(c=>c.id===id)!.nameZh}<small>美 {state.influence[id].US} / 苏 {state.influence[id].USSR}</small></button>)}</div></details>}
        <details className="quick-help"><summary>玩法速查</summary><dl><dt>行动点（OPS）</dt><dd>用于放置影响力、调整或政变。选择用途后，再点击合法目标。</dd><dt>事件与头条</dt><dd>头条只结算事件。行动轮用对方牌的行动点时，对方事件仍会触发。</dd><dt>计分牌</dt><dd>本回合内必须打出。留到回合末会判负。</dd><dt>地图标记</dt><dd>蓝色代表美国，红色代表苏联；实心影响力标记表示控制。金框代表当前合法目标。</dd></dl></details>
        </div>
      </aside>
      <section className="hand-panel surface" ref={handRef} tabIndex={-1} aria-label="我的手牌">
        <div className="panel-heading"><div><span className="eyebrow">{onlineActive?'仅自己可见':'热座交接 · 请保护手牌'}</span><h2>{sides[side]}手牌 <small>{state.hands[side].length} 张{state.mode==='STANDARD'&&p.kind==='ACTION_ROUND'&&state.chinaCard.holder===side&&state.chinaCard.faceUp?' ＋ 中国牌':''}</small></h2></div><button className={revealed?'secondary':'primary'} onClick={()=>setRevealed(r=>!r)}>{revealed?'隐藏手牌':'显示手牌'}</button></div>
        {!revealed?<div className="hand-curtain"><div className="card-backs" aria-hidden="true"><i/><i/><i/></div><div><h3>手牌暂时隐藏</h3><p>{onlineActive?'点击“显示手牌”查看自己的卡牌。':'请交给'+sides[side]+'玩家，再点击“显示手牌”。'}</p></div></div>:<>
        {p.kind==='HEADLINE'&&state.space[side]>=4&&state.space[side==='US'?'USSR':'US']<4&&state.headlines[side==='US'?'USSR':'US']!==undefined&&<p className="notice">太空特权：对方头条为 {CARD_BY_ID.get(state.headlines[side==='US'?'USSR':'US']!)!.nameZh}</p>}
        <p className="hand-hint">{!canAct?'等待对方行动；你仍可查看自己的手牌。':p.kind==='SETUP_PLACEMENT'?'当前先完成地图布点，进入头条或行动轮后可选牌。':p.kind==='HEADLINE'?'点击卡牌，再在操作区确认头条。':p.kind==='ACTION_ROUND'?'点击卡牌，在操作区选择用途并确认。':'正在结算行动，完成当前任务后再选择下一张牌。'}</p>
        <div className="hand">{[...state.hands[side],...(state.mode==='STANDARD'&&p.kind==='ACTION_ROUND'&&state.chinaCard.holder===side&&state.chinaCard.faceUp?[6]:[])].map(id=>{const card=CARD_BY_ID.get(id)!;const selectable=canAct&&(p.kind==='HEADLINE'||p.kind==='ACTION_ROUND')&&!(state.mode==='PRACTICE'&&card.scoring);return <button className={'card-button '+(selected===id?'selected':'')} key={id} aria-label={card.nameZh+(card.scoring?'，计分牌':'，'+card.ops+' 行动点')} aria-pressed={selected===id} disabled={!selectable} title={!selectable?'当前阶段不能选择这张牌':card.nameZh} onClick={()=>{setSelected(id);setRegional('NONE');setUse(card.scoring?'EVENT':'OPS');}}><CardView card={card}/><span className="card-caption">{card.nameZh}<small>{card.scoring?'计分牌':card.ops+' OPS'}</small></span></button>;})}</div>
        {state.effects.cia && side==='US' && <details><summary>中央情报局：本回合苏联公开手牌</summary><div className="hand">{state.hands.USSR.map(id=><CardView key={id} card={CARD_BY_ID.get(id)!}/>)}</div></details>}
        {state.effects.aldrich && side==='USSR' && <details><summary>奥德里奇·艾姆斯：本回合美国公开手牌</summary><div className="hand">{state.hands.US.map(id=><CardView key={id} card={CARD_BY_ID.get(id)!}/>)}</div></details>}

        </>}
        <div className="hand-footer"><span>牌库 {deckCount} 张 · 弃牌 {state.discard.length} 张</span>{online.snapshot&&<span>对方手牌 {online.snapshot.view.handCounts[side==='US'?'USSR':'US']} 张</span>}<span>中国牌 · {sides[state.chinaCard.holder]}持有</span></div>
      </section>
    </div>
    {activeEffects(state.effects).length>0&&<details className="effects-panel"><summary>生效中的事件 <span>{activeEffects(state.effects).length}</span></summary><div className="effect-chips">{activeEffects(state.effects).map(e=><span key={e}>{e}</span>)}</div></details>}
    <details className="log-panel"><summary>对局日志 <span>{log.length} 条记录</span></summary>{log.length?<ol className="log">{log.map((line,i)=><li key={i}>{line}</li>)}</ol>:<p className="field-help">对局开始后，布点、出牌和结算记录会显示在这里。</p>}</details>
    <footer className="table-footer"><span>冷战热斗 · 中文牌桌</span><span>苏联先手 · 美国后手</span></footer>
  </main>;
}
