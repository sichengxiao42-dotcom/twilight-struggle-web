import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatLog, formatLogLine } from '../src/index';

test('log codes are translated for display', () => {
  assert.equal(formatLogLine('USSR 打出 中国牌 用于 INFLUENCE，对手事件 BEFORE'), '苏联 打出 中国牌 用于 放置影响力，对手事件 在 OPS 前结算');
  assert.equal(formatLogLine('事件：剑桥五杰（USSR）'), '事件：剑桥五杰（苏联）');
  assert.equal(formatLogLine('US 获得 2 VP（总计 2）'), '美国 获得 2 VP（总计 2）');
  assert.equal(
    formatLogLine('MIDDLE_EAST 计分：美 NONE 0（战场 0 / 邻接 0），苏 PRESENCE 3（战场 0 / 邻接 0）'),
    '中东 计分：美 无 0（战场 0 / 邻接 0），苏 存在 3（战场 0 / 邻接 0）',
  );
  assert.equal(formatLogLine('DEFCON → 4'), 'DEFCON → 4');
});

test('seed line is hidden from the displayed log', () => {
  assert.deepEqual(formatLog(['Game created with seed 1', 'US 开局布点：法国 +1']), ['美国 开局布点：法国 +1']);
});
