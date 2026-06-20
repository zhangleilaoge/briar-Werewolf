import { describe, it, expect } from 'vitest';
import {
  getAlignmentBehaviorModifier,
  getStressBehaviorModifier,
} from '../behavior-modifiers';
import type { Alignment } from '@/types';
import {
  // 阵营行动取向常量（仅导入测试中使用的）
  ALIGNMENT_TENDENCY_GOOD_DEFEND, ALIGNMENT_TENDENCY_EVIL_DEFEND,ALIGNMENT_TENDENCY_EVIL_SUSPECT,
  ALIGNMENT_TENDENCY_LAWFUL_BLOCK_VOTE, 
  ALIGNMENT_TENDENCY_CHAOTIC_ACCUSE, ALIGNMENT_TENDENCY_LAWFUL_ACCUSE,
  ALIGNMENT_TENDENCY_CHAOTIC_EXTREME, ALIGNMENT_TENDENCY_LAWFUL_EXTREME, ALIGNMENT_TENDENCY_EVIL_EXTREME,
  ALIGNMENT_TENDENCY_EVIL_JOIN_SUSPECT, 
  ALIGNMENT_TENDENCY_GOOD_JOIN_DEFEND, 
  ALIGNMENT_TENDENCY_LAWFUL_OBSERVE, ALIGNMENT_TENDENCY_CHAOTIC_OBSERVE,
  STRESS_EXTREMELY_CALM, STRESS_CALM,
  STRESS_MILDLY_TENSE_MIN,
  STRESS_ANXIOUS_MIN,
  STRESS_NEAR_OVERLOAD,
  STRESS_MIN, STRESS_MAX,
} from '@/types';

// ---------- 阵营行动取向 ----------
describe('getAlignmentBehaviorModifier', () => {
  describe('阵营行动取向计算', () => {
    it('善良阵营对 defend 行动有加成', () => {
      const alignment: Alignment = { law: 'neutral_law', good: 'good' };
      expect(getAlignmentBehaviorModifier(alignment, 'defend')).toBe(ALIGNMENT_TENDENCY_GOOD_DEFEND);
    });

    it('邪恶阵营对 defend 行动有惩罚', () => {
      const alignment: Alignment = { law: 'neutral_law', good: 'evil' };
      expect(getAlignmentBehaviorModifier(alignment, 'defend')).toBe(ALIGNMENT_TENDENCY_EVIL_DEFEND);
    });

    it('守序阵营对 accuse 行动有惩罚（谨慎）', () => {
      const alignment: Alignment = { law: 'lawful', good: 'neutral_good' };
      expect(getAlignmentBehaviorModifier(alignment, 'accuse')).toBe(ALIGNMENT_TENDENCY_LAWFUL_ACCUSE);
    });

    it('混乱阵营对 accuse 行动有高加成（激进）', () => {
      const alignment: Alignment = { law: 'chaotic', good: 'neutral_good' };
      expect(getAlignmentBehaviorModifier(alignment, 'accuse')).toBe(ALIGNMENT_TENDENCY_CHAOTIC_ACCUSE);
    });

    it('邪恶阵营对 suspect 行动有加成', () => {
      const alignment: Alignment = { law: 'neutral_law', good: 'evil' };
      expect(getAlignmentBehaviorModifier(alignment, 'suspect')).toBe(ALIGNMENT_TENDENCY_EVIL_SUSPECT);
    });

    it('守序阵营对 observe 行动有加成（耐心观察）', () => {
      const alignment: Alignment = { law: 'lawful', good: 'neutral_good' };
      expect(getAlignmentBehaviorModifier(alignment, 'observe')).toBe(ALIGNMENT_TENDENCY_LAWFUL_OBSERVE);
    });

    it('混乱阵营对 observe 行动有惩罚（不耐烦）', () => {
      const alignment: Alignment = { law: 'chaotic', good: 'neutral_good' };
      expect(getAlignmentBehaviorModifier(alignment, 'observe')).toBe(ALIGNMENT_TENDENCY_CHAOTIC_OBSERVE);
    });

    it('混乱邪恶对 exclude_all 行动有最高加成（混乱+邪恶叠加）', () => {
      const alignment: Alignment = { law: 'chaotic', good: 'evil' };
      // 混乱倾向(25) + 邪恶倾向(10) = 35
      expect(getAlignmentBehaviorModifier(alignment, 'exclude_all')).toBe(ALIGNMENT_TENDENCY_CHAOTIC_EXTREME + ALIGNMENT_TENDENCY_EVIL_EXTREME);
    });

    it('守序阵营对 exclude_all 行动有惩罚（避免极端）', () => {
      const alignment: Alignment = { law: 'lawful', good: 'neutral_good' };
      expect(getAlignmentBehaviorModifier(alignment, 'exclude_all')).toBe(ALIGNMENT_TENDENCY_LAWFUL_EXTREME);
    });

    it('守序阵营对 block_vote 行动有加成', () => {
      const alignment: Alignment = { law: 'lawful', good: 'neutral_good' };
      expect(getAlignmentBehaviorModifier(alignment, 'block_vote')).toBe(ALIGNMENT_TENDENCY_LAWFUL_BLOCK_VOTE);
    });

    it('邪恶阵营对 join_suspect 有加成', () => {
      const alignment: Alignment = { law: 'neutral_law', good: 'evil' };
      expect(getAlignmentBehaviorModifier(alignment, 'join_suspect')).toBe(ALIGNMENT_TENDENCY_EVIL_JOIN_SUSPECT);
    });

    it('善良阵营对 join_defend 有加成', () => {
      const alignment: Alignment = { law: 'neutral_law', good: 'good' };
      expect(getAlignmentBehaviorModifier(alignment, 'join_defend')).toBe(ALIGNMENT_TENDENCY_GOOD_JOIN_DEFEND);
    });

    it('未知行动返回 0', () => {
      const alignment: Alignment = { law: 'lawful', good: 'good' };
      expect(getAlignmentBehaviorModifier(alignment, 'unknown_action')).toBe(0);
    });

    it('vote 行动不受阵营修正', () => {
      const alignment: Alignment = { law: 'chaotic', good: 'evil' };
      expect(getAlignmentBehaviorModifier(alignment, 'vote')).toBe(0);
    });
  });
});

// ---------- 压力修正 ----------
describe('getStressBehaviorModifier', () => {
  describe('压力修正计算', () => {
    it('极度冷静 (<= -5) 对 observe 有正修正', () => {
      const mod = getStressBehaviorModifier(STRESS_EXTREMELY_CALM, 'observe');
      expect(mod).toBe(3);
    });

    it('极度冷静对 accuse 有负修正', () => {
      const mod = getStressBehaviorModifier(STRESS_EXTREMELY_CALM, 'accuse');
      expect(mod).toBe(-3);
    });

    it('冷静 (<= -2) 对 defend 有正修正', () => {
      const mod = getStressBehaviorModifier(STRESS_CALM, 'defend');
      expect(mod).toBe(1);
    });

    it('轻微紧张 (2~5) 对 suspect 有正修正', () => {
      const mod = getStressBehaviorModifier(STRESS_MILDLY_TENSE_MIN, 'suspect');
      expect(mod).toBe(2);
    });

    it('焦虑 (6~8) 对 accuse 有高正修正', () => {
      const mod = getStressBehaviorModifier(STRESS_ANXIOUS_MIN, 'accuse');
      expect(mod).toBe(3);
    });

    it('接近过载 (>= 9) 对 accuse 有最大修正', () => {
      const mod = getStressBehaviorModifier(STRESS_NEAR_OVERLOAD, 'accuse');
      expect(mod).toBe(5);
    });

    it('正常范围 (-1 ~ +1) 无修正', () => {
      expect(getStressBehaviorModifier(0, 'accuse')).toBe(0);
      expect(getStressBehaviorModifier(1, 'suspect')).toBe(0);
      expect(getStressBehaviorModifier(-1, 'defend')).toBe(0);
    });

    it('未知行动在任何压力下返回 0', () => {
      expect(getStressBehaviorModifier(0, 'unknown_action')).toBe(0);
      expect(getStressBehaviorModifier(STRESS_NEAR_OVERLOAD, 'unknown_action')).toBe(0);
    });
  });

  describe('边界值', () => {
    it('压力最小值 -10', () => {
      const mod = getStressBehaviorModifier(STRESS_MIN, 'observe');
      expect(mod).toBe(3); // 极度冷静
    });

    it('压力最大值 +10', () => {
      const mod = getStressBehaviorModifier(STRESS_MAX, 'accuse');
      expect(mod).toBe(5); // 接近过载
    });

    it('压力边界 -5 (极度冷静阈值)', () => {
      const mod = getStressBehaviorModifier(-5, 'silence');
      expect(mod).toBe(-2); // 极度冷静
    });

    it('压力边界 -2 (冷静阈值)', () => {
      const mod = getStressBehaviorModifier(-2, 'observe');
      expect(mod).toBe(2); // 冷静
    });

    it('压力边界 2 (轻微紧张最小值)', () => {
      const mod = getStressBehaviorModifier(2, 'call_vote');
      expect(mod).toBe(1); // 轻微紧张
    });

    it('压力边界 5 (轻微紧张最大值)', () => {
      const mod = getStressBehaviorModifier(5, 'call_vote');
      expect(mod).toBe(1); // 轻微紧张
    });

    it('压力边界 6 (焦虑最小值)', () => {
      const mod = getStressBehaviorModifier(6, 'rebut');
      expect(mod).toBe(3); // 焦虑
    });

    it('压力边界 9 (接近过载)', () => {
      const mod = getStressBehaviorModifier(9, 'exclude_all');
      expect(mod).toBe(4); // 接近过载
    });
  });
});
