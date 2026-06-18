/**
 * 阵营相关函数
 * 
 * 提供阵营名称映射等工具函数
 */

import type { Alignment } from '@/types';
import { ALIGNMENT_NAMES } from '@/types';

/**
 * 获取阵营的中文名称
 * 
 * @param alignment - 阵营对象
 * @returns 中文名称，如"守序善良"、"混乱邪恶"等
 */
export function getAlignmentName(alignment: Alignment): string {
  return ALIGNMENT_NAMES[`${alignment.law}-${alignment.good}`] || '未知';
}
