import { COUNTRIES, controller, type GameState } from '@ts/game-core';
import type { Side } from '@ts/shared';

export interface CountryChange {
  country: string;
  deltas: { side: Side; amount: number }[];
  controlChanged: boolean;
  control: Side | null;
  label: string;
}

/** Compare public board information only: works for local and filtered online states. */
export function boardChanges(before: GameState, after: GameState): CountryChange[] {
  return COUNTRIES.flatMap(country => {
    const deltas = (['US', 'USSR'] as const).flatMap(side => {
      const amount = after.influence[country.id][side] - before.influence[country.id][side];
      return amount ? [{ side, amount }] : [];
    });
    const control = controller(after, country.id);
    const controlChanged = controller(before, country.id) !== control;
    if (!deltas.length && !controlChanged) return [];
    const parts = deltas.map(d => `${d.side === 'US' ? '美国' : '苏联'} ${d.amount > 0 ? '+' : '−'}${Math.abs(d.amount)}`);
    if (controlChanged) parts.push(control ? `${control === 'US' ? '美国' : '苏联'}取得控制` : '恢复无控制');
    return [{ country: country.id, deltas, controlChanged, control, label: `${country.nameZh}：${parts.join('，')}` }];
  });
}
