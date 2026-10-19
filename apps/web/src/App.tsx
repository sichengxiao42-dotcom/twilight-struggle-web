import { useMemo, useState } from 'react';
import type { Region } from '@ts/shared';
import { CARD_BY_ID, COUNTRIES, controller, createGame } from '@ts/game-core';
import { CardView } from './CardView';

const REGION_LABEL: Record<Region, string> = {
  EUROPE: '欧洲', MIDDLE_EAST: '中东', ASIA: '亚洲',
  AFRICA: '非洲', CENTRAL_AMERICA: '中美洲', SOUTH_AMERICA: '南美洲',
};

// 骨架页：本地热座预览初始局面。地图将在 M1 换成 SVG 世界地图。
export function App() {
  const [seed, setSeed] = useState(1);
  const state = useMemo(() => createGame(seed), [seed]);

  return (
    <main>
      <header>
        <h1>冷战热斗 · 网页版</h1>
        <span>第 {state.turn} 回合 · DEFCON {state.defcon} · VP {state.vp}</span>
        <button onClick={() => setSeed((s) => s + 1)}>重新发牌</button>
      </header>

      <section className="regions">
        {(Object.keys(REGION_LABEL) as Region[]).map((region) => (
          <div key={region} className="region">
            <h2>{REGION_LABEL[region]}</h2>
            <ul>
              {COUNTRIES.filter((c) => c.region === region).map((c) => {
                const inf = state.influence[c.id];
                const ctrl = controller(state, c.id);
                return (
                  <li key={c.id} className={ctrl ? `ctrl-${ctrl}` : undefined}>
                    <span className={c.battleground ? 'bg' : undefined}>{c.nameZh}</span>
                    <small>稳{c.stability}</small>
                    <span className="inf">{inf.US || ''}</span>
                    <span className="inf ussr">{inf.USSR || ''}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      {(['USSR', 'US'] as const).map((side) => (
        <section key={side}>
          <h2>{side === 'USSR' ? '苏联' : '美国'}手牌</h2>
          <div className="hand">
            {state.hands[side].map((id) => <CardView key={id} card={CARD_BY_ID.get(id)!} />)}
          </div>
        </section>
      ))}
    </main>
  );
}
