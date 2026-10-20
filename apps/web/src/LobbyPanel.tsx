import type { RoomSnapshot, SeatChoice, Side } from '@ts/shared';

const sides: Record<Side, string> = { USSR: '苏联', US: '美国' };

/** Room lobby shown in the side column until the game starts: share the invite, pick a side, then start. */
export function LobbyPanel({ snapshot, roomId, invite, busy, copyStatus, onCopy, onSeat, onStart, onBot }: {
  snapshot: Pick<RoomSnapshot, 'side' | 'seats' | 'members' | 'isHost'> | null; roomId: string; invite: string; busy: boolean; copyStatus: string;
  onCopy: () => void; onSeat: (side: SeatChoice) => void; onStart: () => void; onBot:(enabled:boolean)=>void;
}) {
  const mine = snapshot?.side ?? null, both = Boolean(snapshot?.seats.US.occupied && snapshot?.seats.USSR.occupied), connected=Boolean(snapshot?.seats.US.connected&&snapshot?.seats.USSR.connected);
  const hasBot=Boolean(snapshot?.seats.US.bot||snapshot?.seats.USSR.bot);
  return <section className="lobby-panel" aria-label="房间大厅">
    <header><h2>房间 {roomId}</h2><span>{snapshot ? snapshot.members + ' / 2 名玩家' : '正在连接…'}</span></header>
    <div className="lobby-invite"><input aria-label="邀请链接" readOnly value={invite} onFocus={e => e.currentTarget.select()}/><button onClick={onCopy}>复制邀请链接</button>{copyStatus && <small>{copyStatus}</small>}</div>
    <p className="lobby-hint">{hasBot?'基础陪练已入座。点击“开始对局”，机器人会自动行动；你可以先随机分配阵营。':'邀请朋友入座，或添加基础陪练机器人，独自练习完整对局。'}</p>
    <div className="lobby-seats">{(['USSR', 'US'] as const).map(side => {
      const seat = snapshot?.seats[side], isMine = mine === side;
      const status = isMine ? '你' : seat?.bot ? '机器人 · 基础陪练' : seat?.occupied ? (seat.connected ? '对方 · 在线' : '对方 · 离线') : '空位';
      return <div key={side} className={'lobby-seat seat-' + side + (isMine ? ' mine' : '') + (seat?.occupied ? ' taken' : '')}>
        <span className="lobby-seal">{side === 'USSR' ? '苏' : '美'}</span>
        <div><strong>{sides[side]}</strong><small>{status}</small></div>
        {seat?.bot ? <button className="secondary" disabled={busy||!snapshot?.isHost} onClick={()=>onBot(false)}>移除</button> : isMine ? <button className="secondary" disabled={busy} onClick={() => onSeat(null)}>离座</button>
          : <button disabled={busy || !snapshot || Boolean(seat?.occupied)} onClick={() => onSeat(side)}>{mine ? '换到这边' : '坐这边'}</button>}
      </div>;
    })}</div>
    {snapshot?.isHost&&!hasBot&&snapshot.members===1&&<button className="add-bot" disabled={busy} onClick={()=>onBot(true)}>＋ 添加基础陪练</button>}
    <div className="lobby-actions">
      <button className="secondary" disabled={busy || !snapshot || both && !mine} onClick={() => onSeat('RANDOM')}>随机分配阵营</button>
      <button className="primary" disabled={busy || !both || !connected || !mine} onClick={onStart}>开始对局</button>
    </div>
    <p className="field-help">{!mine ? '请先选择一边坐下。' : !both ? '等待另一名玩家入座，或添加基础陪练。' : !connected ? '等待另一位玩家重新连接。' : hasBot?'陪练会自动处理选牌、地图操作与事件选择。开始后才发牌。':'双方已入座，开始后才发牌。开局后阵营不能再更换。'}</p>
  </section>;
}
