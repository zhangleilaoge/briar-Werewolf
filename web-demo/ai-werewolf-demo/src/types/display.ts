import type { Attributes } from './core';

export const ALIGNMENT_NAMES: Record<string, string> = {
  'lawful-good': '守序善良', 'lawful-neutral_good': '守序中立', 'lawful-evil': '守序邪恶',
  'neutral_law-good': '中立善良', 'neutral_law-neutral_good': '绝对中立', 'neutral_law-evil': '中立邪恶',
  'chaotic-good': '混乱善良', 'chaotic-neutral_good': '混乱中立', 'chaotic-evil': '混乱邪恶',
};

export const ATTRIBUTE_NAMES: Record<keyof Attributes, string> = {
  affinity: '亲和', logic: '逻辑', leadership: '领导',
  deception: '诡诈', stealth: '隐蔽', insight: '洞察',
};
