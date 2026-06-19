// 通用计算表达式构建工具

/** 阶段名称映射 */
const STAGE_LABELS: Record<string, string> = {
  intention: '意图',
  plugin: '插件',
  duty: '职业义务',
  survival: '生存',
  information: '信息',
  social: '社交',
};

export function buildScoreExpr(
  totalScore: number,
  baseScore: number,
  intentionDrivenBonus: number | undefined,
  stageWeight: number,
  stageName: string,
  modifiers: { alignment: number; stress: number; relation: number }
): string {
  const parts: string[] = [`${baseScore}(基础分)`];
  if (intentionDrivenBonus && intentionDrivenBonus !== 0) {
    parts.push(`+${intentionDrivenBonus}(意图匹配)`);
  }
  if (stageWeight !== 0 || stageName) {
    const label = STAGE_LABELS[stageName] || stageName;
    parts.push(`${stageWeight >= 0 ? '+' : ''}${stageWeight}(${label})`);
  }
  if (modifiers.alignment !== 0) {
    parts.push(`${modifiers.alignment >= 0 ? '+' : ''}${modifiers.alignment}(阵营修正)`);
  }
  if (modifiers.stress !== 0) {
    parts.push(`${modifiers.stress >= 0 ? '+' : ''}${modifiers.stress}(压力修正)`);
  }
  if (modifiers.relation !== 0) {
    parts.push(`${modifiers.relation >= 0 ? '+' : ''}${modifiers.relation}(关系修正)`);
  }
  return `总分：${totalScore} = ${parts.join(' ')}`;
}

export function buildCheckExpr(
  roll: number,
  attr: string,
  base: number,
  align: number,
  stress: number,
  total: number
): string {
  const parts: string[] = [`${roll}(d20)`, `+${base}(${attr})`];
  if (align !== 0) parts.push(`${align >= 0 ? '+' : ''}${align}(阵营)`);
  if (stress !== 0) parts.push(`${stress >= 0 ? '+' : ''}${stress}(压力)`);
  return `${parts.join(' ')} = ${total}`;
}
