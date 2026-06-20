import { TEMPERATURE_MIN } from '@/lib/constants/mind';
import type { EnrichedCandidate } from '@/types';

// ========== Softmax 选择 ==========

export function softmaxSelect(candidates: EnrichedCandidate[]): EnrichedCandidate {
  const temperature = calculateTemperature(candidates);
  const scores = candidates.map((c) => c.totalScore);
  const maxScore = Math.max(...scores);
  const expScores = scores.map((s) => Math.exp((s - maxScore) / temperature));
  const sumExp = expScores.reduce((sum, e) => sum + e, 0);
  const probs = expScores.map((e) => e / sumExp);

  let random = Math.random();
  for (let i = 0; i < candidates.length; i++) {
    random -= probs[i];
    if (random <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

// ========== 温度计算 ==========

export function calculateTemperature(candidates: EnrichedCandidate[]): number {
  const scores = candidates.map((c) => c.totalScore);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const range = maxScore - minScore;

  // 分数差距大时降低温度（更确定性），差距小时提高温度（更随机）
  if (range > 50) return TEMPERATURE_MIN;
  if (range > 20) return 1.0;
  if (range > 10) return 2.0;
  return 3.0;
}
