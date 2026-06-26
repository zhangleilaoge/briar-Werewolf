import React from 'react';

interface FormulaDisplayProps {
  formula: string;
  className?: string;
}

/**
 * 公式展示组件
 * 输入格式：-2(被投票影响) × 0.3(旁观者衰减系数) = -0.6
 * 渲染为：数值 标注(灰色小字) 运算符 ...
 */
export function FormulaDisplay({ formula, className = '' }: FormulaDisplayProps) {
  if (!formula) return null;

  // 正则匹配：数值(标注) → 如 -2(被投票影响) 或 0.3(旁观者衰减系数)
  // 同时捕获纯数字（无标注）和运算符/等号
  const parts: ({ type: 'val'; value: string; label: string } | { type: 'op'; text: string } | { type: 'text'; text: string })[] = [];

  const regex = /([+-]?\d+(?:\.\d+)?)\(([^)]+)\)|([+-]?\d+(?:\.\d+)?)|([×=\+\-\/])/g;
  let match;
  let lastIndex = 0;

  while ((match = regex.exec(formula)) !== null) {
    // 补全中间的非匹配文本（如空格）
    if (match.index > lastIndex) {
      const gap = formula.slice(lastIndex, match.index);
      if (gap.trim()) {
        parts.push({ type: 'text', text: gap.trim() });
      }
    }

    if (match[1] && match[2]) {
      // 带标注的数值: match[1]=数值, match[2]=标注
      parts.push({ type: 'val', value: match[1], label: match[2] });
    } else if (match[3]) {
      // 纯数值（无标注）
      parts.push({ type: 'val', value: match[3], label: '' });
    } else if (match[4]) {
      // 运算符
      parts.push({ type: 'op', text: match[4] });
    }
    lastIndex = regex.lastIndex;
  }

  // 尾部未匹配文本
  if (lastIndex < formula.length) {
    const tail = formula.slice(lastIndex).trim();
    if (tail) parts.push({ type: 'text', text: tail });
  }

  return (
    <span className={`inline-flex items-center gap-0.5 font-mono text-xs ${className}`}>
      {parts.map((p, i) => {
        if (p.type === 'val') {
          return (
            <span key={i} className="inline-flex items-baseline gap-0.5">
              <span className="text-slate-200 font-bold">{p.value}</span>
              {p.label && (
                <span className="text-[10px] text-slate-500">({p.label})</span>
              )}
            </span>
          );
        }
        if (p.type === 'op') {
          return (
            <span key={i} className="text-slate-400 mx-0.5">{p.text}</span>
          );
        }
        return <span key={i} className="text-slate-400">{p.text}</span>;
      })}
    </span>
  );
}
