/**
 * 随机生成函数
 * 
 * 提供角色属性和阵营的随机生成功能
 */

import type { Attributes, Alignment, LawAxis, GoodAxis } from '@/types';
import {
  ATTRIBUTE_MIN,
  ATTRIBUTE_MAX,
  ATTRIBUTE_TOTAL_POINTS,
} from '@/types';

/**
 * 生成随机属性（72 点分配，限制方差）
 * 
 * 算法：
 * 1. 从平均值（12）开始
 * 2. 每个属性可偏离平均值 ±5
 * 3. 微调确保总和为 72
 */
export function generateRandomAttributes(): Attributes {
  const keys: (keyof Attributes)[] = ['affinity', 'logic', 'leadership', 'deception', 'stealth', 'insight'];

  // 平均值：72 / 6 = 12
  const average = ATTRIBUTE_TOTAL_POINTS / 6;

  // 从平均值开始
  const result: Attributes = {
    affinity: average,
    logic: average,
    leadership: average,
    deception: average,
    stealth: average,
    insight: average,
  };

  // 限制方差重新分配
  // 每个属性可偏离平均值最大 ±5
  const maxDeviation = 5;
  let remaining = 0;

  // 随机调整每个属性
  for (const key of keys) {
    const deviation = Math.floor(Math.random() * (maxDeviation * 2 + 1)) - maxDeviation;
    const newValue = Math.max(ATTRIBUTE_MIN, Math.min(ATTRIBUTE_MAX, result[key] + deviation));
    remaining += result[key] - newValue;
    result[key] = newValue;
  }

  // 分配剩余点数以维持总数
  let attempts = 0;
  while (remaining !== 0 && attempts < 1000) {
    const key = keys[Math.floor(Math.random() * keys.length)];
    if (remaining > 0 && result[key] < ATTRIBUTE_MAX) {
      const add = Math.min(remaining, ATTRIBUTE_MAX - result[key], 3); // 每次最多 +3
      result[key] += add;
      remaining -= add;
    } else if (remaining < 0 && result[key] > ATTRIBUTE_MIN) {
      const sub = Math.min(-remaining, result[key] - ATTRIBUTE_MIN, 3); // 每次最多 -3
      result[key] -= sub;
      remaining += sub;
    }
    attempts++;
  }

  return result;
}

/**
 * 生成随机阵营
 */
export function generateRandomAlignment(): Alignment {
  const laws: LawAxis[] = ['lawful', 'neutral_law', 'chaotic'];
  const goods: GoodAxis[] = ['good', 'neutral_good', 'evil'];
  return {
    law: laws[Math.floor(Math.random() * laws.length)],
    good: goods[Math.floor(Math.random() * goods.length)],
  };
}
