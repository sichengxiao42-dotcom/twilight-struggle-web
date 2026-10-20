import { useEffect, useState } from 'react';
import type { Region, Side } from '@ts/shared';
import { CARD_BY_ID, COUNTRIES, EVENT_SUMMARIES, REGION_NAMES, activeSide, apply, canEvent, canPass, createGame, forcedMissileEnvy, formatLog, legalTargets, roundsFor, trapDiscards, trapped, type Action, type Effects, type OpsMode } from '@ts/game-core';
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
  const actor=activeSide(state),side=online.session?.side??actor,p=state.phase;
  const onlineActive=Boolean(online.session);
  const canAct=!onlineActive||Boolean(online.ready&&!online.busy&&online.snapshot&&actor===side&&online.snapshot.seats.US.occupied&&online.snapshot.seats.USSR.occupied);
  const targets=canAct?(online.snapshot?online.snapshot.view.targets:legalTargets(state)):[];
  useEffect(()=>{setSelected(null);setRegional('NONE');},[online.snapshot?.revision,online.session?.roomId]);
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
  const status = onlineActive&&!online.ready?'连接中 / 等待恢复房间':online.snapshot?.view.phase.kind==='WAITING'?'等待'+sides[online.snapshot.view.phase.side]+'处理事件':p.kind === 'SETUP_PLACEMENT' ? sides[p.side] + '在' + (p.subRegion === 'EASTERN_EUROPE' ? '东欧' : '西欧') + '布点 · 剩余 ' + p.remaining
    : p.kind === 'ACTION_ROUND' ? sides[p.side] + ' · 行动轮 ' + p.round + '/' + roundsFor(state,p.side) + ' · ' + (state.mode==='STANDARD'&&trapped(state,p.side)?(p.side==='US'?'泥潭：弃牌掷骰':'捕熊陷阱：弃牌掷骰'):'选择卡牌')
    : p.kind === 'OPS' ? sides[p.side] + ' · ' + modes[p.mode] + ' · 剩余 ' + p.remaining + ' OPS'
    : p.kind === 'HEADLINE' ? sides[p.side] + ' · 暗选头条'
    : p.kind === 'DECISION' ? sides[p.side] + ' · ' + p.decision.prompt
    : p.kind === 'SUBPLAY' ? sides[p.side] + ' · 打出从苏联手中抽到的 ' + CARD_BY_ID.get(p.card)!.nameZh
    : p.kind === 'GAME_OVER' ? (p.winner === 'DRAW' ? '平局' : sides[p.winner]) + '获胜：' + p.reason
    : '练习回合完成，可重新开局';
  return <main>
    <header><h1>冷战热斗</h1><span>{state.mode === 'STANDARD' ? '标准对局 · 10 回合' : 'M1 · OPS 练习'}</span><button disabled={onlineActive} onClick={() => { setState(createGame((state.seed + 1) >>> 0,state.mode)); setRevealed(false); setSelected(null); setError(''); }}>重新开局</button></header>
    <section className="online-panel">
      <h2>双人联机</h2><p>同一局域网联机时，请先通过电脑的局域网 IP 打开页面，再复制邀请链接。</p>
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
      {online.error&&<p role="alert" className="error">{online.error}</p>}
    </section>
    <p className="notice">{state.mode === 'STANDARD' ? (onlineActive?'联机对局：操作由服务器结算，只下发各自可见的信息。':'本地双人热座：开局布点 → 每回合暗选头条 → 6 轮行动（第 4 回合起 7 轮）→ 回合结束；第 4、8 回合加入中期、后期卡牌，第 10 回合后终局计分。') : 'OPS 练习：跳过头条与事件，只进行第一回合。'}</p>
    <label>新局模式 <select disabled={onlineActive} value={state.mode} onChange={e=>{setState(createGame(state.seed+1,e.target.value as 'STANDARD'|'PRACTICE'));setRevealed(false);setSelected(null);setError('');}}><option value="STANDARD">标准对局（10 回合）</option><option value="PRACTICE">M1 OPS 练习</option></select></label>
    <div className="tracks"><b>第 {state.turn} 回合</b><b>DEFCON {state.defcon}</b><b>VP {state.vp}</b><span>军事行动：苏 {state.milOps.USSR} / 美 {state.milOps.US}</span><span>中国牌：{sides[state.chinaCard.holder]} · {state.chinaCard.faceUp?'正面':'背面'}</span><span>太空：苏 {state.space.USSR} / 美 {state.space.US}</span><span>牌库：{state.deck.length||online.snapshot?.view.deckCount||0} 张</span></div>
    {activeEffects(state.effects).length>0&&<p className="effects">生效中：{activeEffects(state.effects).join('、')}</p>}
    <section className="toolbar"><strong aria-live="polite">{status}</strong>{p.kind === 'OPS' && canAct && <button onClick={() => dispatch({ type: 'END_OPS' })}>结束操作 / 放弃余点</button>}</section>
    {error && <p role="alert" className="error">{error}</p>}
    <Board state={state} targets={targets} onCountry={id=>dispatch(p.kind === 'DECISION' ? {type:'CHOOSE',value:id} : { type: p.kind === 'SETUP_PLACEMENT' ? 'PLACE_SETUP' : 'TARGET', country:id })}/>
    {side && <section className="play-panel">
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
      <h2>{sides[side]}手牌 · {state.hands[side].length} 张</h2>
      {!revealed ? <button onClick={()=>setRevealed(true)}>{onlineActive?'显示我的手牌':'交给'+sides[side]+'玩家 · 显示手牌'}</button> : <>
        <button onClick={()=>setRevealed(false)}>隐藏手牌</button>

        {p.kind === 'HEADLINE' && state.space[side]>=4 && state.space[side==='US'?'USSR':'US']<4 && state.headlines[side==='US'?'USSR':'US']!==undefined && <p>太空特权：对方头条为 {CARD_BY_ID.get(state.headlines[side==='US'?'USSR':'US']!)!.nameZh}</p>}
        {(p.kind === 'ACTION_ROUND' || p.kind === 'HEADLINE' || p.kind === 'SETUP_PLACEMENT') && <>
          {p.kind === 'ACTION_ROUND' && state.mode==='PRACTICE' && state.hands[side].every(id=>CARD_BY_ID.get(id)!.scoring) && <button onClick={()=>dispatch({type:'PASS_PRACTICE'})}>无 OPS 牌 · 跳过练习行动</button>}
          {canAct && p.kind==='ACTION_ROUND' && canPass(state,side) && <button onClick={()=>dispatch({type:'PASS_EMPTY'})}>{!state.hands[side].length?'手牌用尽 · 跳过行动':p.round>(state.turn<=3?6:7)?'放弃第 8 个行动轮':'没有可弃或可打的牌 · 跳过行动'}</button>}
          {canAct && p.kind==='ACTION_ROUND' && state.mode==='STANDARD' && trapped(state,side) && <div className="decision-panel"><h2>{side==='US'?'泥潭':'捕熊陷阱'}：弃一张至少 2 OPS 的牌，掷出 1–4 脱困</h2>
            {trapDiscards(state,side).map(id=><button key={id} onClick={()=>dispatch({type:'TRAP_DISCARD',card:id})}>弃置 {CARD_BY_ID.get(id)!.nameZh}</button>)}
            {!trapDiscards(state,side).length&&<p>没有可弃的牌：本行动轮只能打出计分牌。</p>}</div>}
          {canAct && p.kind==='ACTION_ROUND' && forcedMissileEnvy(state,side) && <p className="notice">导弹嫉妒：本行动轮必须把“导弹嫉妒”用作 OPS。</p>}
          <div className="hand">{[...state.hands[side],...(state.mode==='STANDARD'&&p.kind==='ACTION_ROUND'&&state.chinaCard.holder===side&&state.chinaCard.faceUp?[6]:[])].map(id=>{const card=CARD_BY_ID.get(id)!;return <button className={'card-button '+(selected===id?'selected':'')} key={id} disabled={!canAct||p.kind==='SETUP_PLACEMENT'||(state.mode==='PRACTICE'&&Boolean(card.scoring))} onClick={()=>{setSelected(id);setRegional('NONE');setUse(card.scoring?'EVENT':'OPS');}}><CardView card={card}/></button>;})}</div>
          {selected!==null && <section className="card-detail">
            <h2>{CARD_BY_ID.get(selected)!.nameZh}</h2><p>{EVENT_SUMMARIES[selected]}</p>
            {p.kind==='HEADLINE' ? <button disabled={!canAct||selected===32||selected===6} onClick={()=>dispatch({type:'SELECT_HEADLINE',card:selected})}>确定头条 · 交给另一方</button> : <>
              {state.mode==='STANDARD' && <label>出牌方式 <select value={selected===6?'OPS':use} onChange={e=>setUse(e.target.value as typeof use)}><option value="OPS" disabled={CARD_BY_ID.get(selected)!.scoring}>OPS 操作</option><option value="EVENT" disabled={selected===6||CARD_BY_ID.get(selected)!.side===(side==='US'?'USSR':'US')}>事件 / 计分</option><option value="SPACE" disabled={selected===6||CARD_BY_ID.get(selected)!.scoring}>太空竞赛</option></select></label>}
              {(use==='OPS'||selected===6) && <><label> OPS 用途 <select value={mode} onChange={e=>setMode(e.target.value as OpsMode)}>{(Object.keys(modes) as OpsMode[]).map(m=><option key={m} value={m}>{modes[m]}</option>)}</select></label>
                {state.mode==='STANDARD'&&<><label> 对手事件 <select value={order} onChange={e=>setOrder(e.target.value as typeof order)}><option value="BEFORE">OPS 前结算</option><option value="AFTER">OPS 后结算</option></select></label>
                  <label> 区域奖励 <select value={regional} onChange={e=>setRegional(e.target.value as typeof regional)}><option value="NONE">不限制地区</option>{selected===6&&<option value="ASIA">全部在亚洲 · 中国牌奖励</option>}{side==='USSR'&&state.effects.vietnam&&<option value="SEA">全部在东南亚 · 越南奖励{selected===6?' + 中国牌奖励':''}</option>}</select></label></>}
              </>}
              <button disabled={!canAct||p.kind!=='ACTION_ROUND'} onClick={()=>dispatch(state.mode==='PRACTICE'||selected===6||use==='OPS'?{type:'PLAY_OPS',card:selected,mode,order,asiaOnly:regional==='ASIA',seaOnly:regional==='SEA'}:use==='EVENT'?{type:'PLAY_EVENT',card:selected}:{type:'SPACE',card:selected})}>确认出牌</button>
            </>}
          </section>}
        </>}
        {state.effects.cia && side==='US' && <details><summary>中央情报局：本回合苏联公开手牌</summary><div className="hand">{state.hands.USSR.map(id=><CardView key={id} card={CARD_BY_ID.get(id)!}/>)}</div></details>}
        {state.effects.aldrich && side==='USSR' && <details><summary>奥德里奇·艾姆斯：本回合美国公开手牌</summary><div className="hand">{state.hands.US.map(id=><CardView key={id} card={CARD_BY_ID.get(id)!}/>)}</div></details>}

      </>}
    </section>}
    {online.snapshot&&<p>对方手牌：{online.snapshot.view.handCounts[side==='US'?'USSR':'US']} 张 · 牌库：{online.snapshot.view.deckCount} 张 · 局面版本 {online.snapshot.revision}</p>}
    <details open><summary>对局日志 · {log.length} 条</summary><ol className="log">{log.map((line,i)=><li key={i}>{line}</li>)}</ol></details>
  </main>;
}
