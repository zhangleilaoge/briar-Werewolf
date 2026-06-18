// 通用计算表达式构建工具

export function buildScoreExpr(
  totalScore: number,
  baseScore: number,
  intentionDrivenBonus: number | undefined,
  stageWeight: number,
  stageName: string,
  modifiers: { alignment: number; stress: number; relation: number }
): string {
  const parts: string[] = [`${baseScore}(基础)`];
  if (intentionDrivenBonus && intentionDrivenBonus !== 0) {
    parts.push(`+${intentionDrivenBonus}(意图驱动)`);
  }
  if (stageWeight !== 0 || stageName) {
    parts.push(`${stageWeight >= 0 ? '+' : ''}${stageWeight}(${stageName})`);
  }
  if (modifiers.alignment !== 0) {
    parts.push(`${modifiers.alignment >= 0 ? '+' : ''}${modifiers.alignment}(阵营)`);
  }
  if (modifiers.stress !== 0) {
    parts.push(`${modifiers.stress >= 0 ? '+' : ''}${modifiers.stress}(压力)`);
  }
  if (modifiers.relation !== 0) {
    parts.push(`${modifiers.relation >= 0 ? '+' : ''}${modifiers.relation}(关系)`);
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
