import type { RoomSnapshot, SeatChoice, Side } from '@ts/shared';

const sides: Record<Side, string> = { USSR: '苏联', US: '美国' };

/** Room lobby shown in the side column until the game starts: share the invite, pick a side, then start. */
export function LobbyPanel({ snapshot, roomId, invite, busy, copyStatus, onCopy, onSeat, onStart }: {
  snapshot: Pick<RoomSnapshot, 'side' | 'seats' | 'members'> | null; roomId: string; invite: string; busy: boolean; copyStatus: string;
  onCopy: () => void; onSeat: (side: SeatChoice) => void; onStart: () => void;
}) {
  const mine = snapshot?.side ?? null, both = Boolean(snapshot?.seats.US.occupied && snapshot?.seats.USSR.occupied);
  return <section className="lobby-panel" aria-label="房间大厅">
    <header><h2>房间 {roomId}</h2><span>{snapshot ? snapshot.members + ' / 2 名玩家' : '正在连接…'}</span></header>
    <div className="lobby-invite"><input aria-label="邀请链接" readOnly value={invite} onFocus={e => e.currentTarget.select()}/><button onClick={onCopy}>复制邀请链接</button>{copyStatus && <small>{copyStatus}</small>}</div>
    <p className="lobby-hint">把房间码或邀请链接发给朋友。双方各选一边坐下后，任意一方点击“开始对局”。</p>
    <div className="lobby-seats">{(['USSR', 'US'] as const).map(side => {
      const seat = snapshot?.seats[side], isMine = mine === side;
      const status = isMine ? '你' : seat?.occupied ? (seat.connected ? '对方 · 在线' : '对方 · 离线') : '空位';
      return <div key={side} className={'lobby-seat seat-' + side + (isMine ? ' mine' : '') + (seat?.occupied ? ' taken' : '')}>
        <span className="lobby-seal">{side === 'USSR' ? '苏' : '美'}</span>
        <div><strong>{sides[side]}</strong><small>{status}</small></div>
        {isMine ? <button className="secondary" disabled={busy} onClick={() => onSeat(null)}>离座</button>
          : <button disabled={busy || !snapshot || Boolean(seat?.occupied)} onClick={() => onSeat(side)}>{mine ? '换到这边' : '坐这边'}</button>}
      </div>;
    })}</div>
    <div className="lobby-actions">
      <button className="secondary" disabled={busy || !snapshot || both && !mine} onClick={() => onSeat('RANDOM')}>随机分配阵营</button>
      <button className="primary" disabled={busy || !both || !mine} onClick={onStart}>开始对局</button>
    </div>
    <p className="field-help">{!mine ? '请先选择一边坐下。' : !both ? '等待另一名玩家入座。' : '双方已入座，可以开始。开局后阵营不能再更换。'}</p>
  </section>;
}
