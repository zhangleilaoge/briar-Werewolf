# 状态系统（State System）

> **状态是压力满的产物。** 美德（25%）和崩溃（75%）各产生不同类型的状态。状态影响行为和属性，但不是机制修改。

## 核心原则

- 状态只有**压力满**时才能获得
- 美德和崩溃是**概率事件**，不是确定的
- 状态是**行为修饰**，影响行动权重、属性、推理准确度
- 状态**不是机制修改**（机制修改是特质的工作）
- 每个玩家可以有**多个状态**（多次满累积）
- 状态是**永久的**，不会消失

## 状态 vs 特质

| | 状态（State） | 特质（Trait） |
|---|---|---|
| 来源 | 压力满 | 职业默认或机制触发 |
| 作用 | 影响行为/属性/推理 | 影响游戏规则机制 |
| 例子 | 偏执（suspect×1.5） | 孤狼（独立击杀协调） |
| 是否可叠加 | 可以 | 可以 |
| 是否消失 | 否（永久） | 否（永久） |

## 状态接口

```typescript
interface State {
  id: string;
  name: string;
  type: 'virtue' | 'breakdown';  // 美德 or 崩溃
  description: string;
  effects: StateEffects;
}

interface StateEffects {
  // 对压力的影响
  pressureMaxMod?: number;      // 压力上限修正（如 +5 表示更难满）
  pressureReduction?: number;   // 每回合自动减压（如 -1）
  
  // 对推理的影响
  roleInferenceBonus?: number;  // 角色推理修正（如 +0.1 表示更准）
  crisisInferenceBonus?: number; // 局势推理修正
  
  // 对行动的影响
  disabledActions?: ActionType[]; // 额外禁用的行动
  actionWeightMods?: Record<ActionType, number>; // 额外行动权重修正
  
  // 对关系的影响
  friendlyInitMod?: number;     // 初始友好度修正
  
  // 特殊效果
  onDeath?: 'revenge' | 'sacrifice' | 'confession'; // 死亡时特殊行为
  onBurst?: 'clear_pressure' | 'double_burst';      // 满时特殊行为
}
```

## 美德示例（Virtue）

| 状态 | 效果 | 说明 |
|------|------|------|
| **坚韧（Resilient）** | `pressureMaxMod: +5` | 压力上限增加，更难满 |
| **洞察（Insightful）** | `roleInferenceBonus: +0.1` | 角色推理更准确 |
| **冷静（Calm）** | `pressureReduction: -1` | 每回合自动减少1点压力 |
| **领袖（Leader）** | `actionWeightMods: { claim_identity: 1.3 }` | 更倾向跳身份带队 |
| **牺牲（Sacrifice）** | `onDeath: 'sacrifice'` | 死亡时可能带走一个狼人 |

## 崩溃示例（Breakdown）

| 状态 | 效果 | 说明 |
|------|------|------|
| **偏执（Paranoid）** | `actionWeightMods: { suspect: 1.5, defend: 0.3 }` | 总是怀疑，不辩护 |
| **怯懦（Cowardly）** | `disabledActions: ['claim_identity']` | 不敢跳身份 |
| **冲动（Impulsive）** | `actionWeightMods: { suspect: 2.0, observe: 0.3 }` | 急于指控，不观察 |
| **多疑（Distrustful）** | `friendlyInitMod: -2` | 初始友好度更低 |

## 状态与性格的叠加

状态**叠加**在性格之上：

```
原始行动权重 = 基础权重（职业义务 + 推理 + 关系）
  ↓
× 性格权重修正（Personality.actionWeightMods）
  ↓
× 状态权重修正（State.effects.actionWeightMods）
  ↓
最终行动权重
```

例如：
- 好斗型 + 偏执 = `suspect` ×2.0 ×1.5 = ×3.0（极度好斗）
- 谨慎型 + 冷静 = 压力上限不变，但每回合自动减压
- 操控型 + 冲动 = `suspect` ×1.5 ×2.0 = ×3.0（疯狂但还有操控意识）

## 状态的获取

```typescript
// 第一次满时判定
if (burstCount === 1) {
  const roll = Math.random();
  if (roll < 0.25) {
    gainState(randomVirtue());  // 25% 美德
  } else {
    gainState(randomBreakdown()); // 75% 崩溃
  }
}
```

## 第二次满的特殊状态

第二次满时，无论之前有什么状态，都会额外获得：

```typescript
{
  id: 'mental_breakdown',
  name: '精神崩溃',
  type: 'breakdown',
  description: '失去推理能力，可能暴露身份',
  effects: {
    roleInferenceBonus: -999,  // 禁用角色推理
    crisisInferenceBonus: -999, // 禁用局势推理
    onBurst: 'confession',      // 可能暴露身份
  }
}
```

## 设计原则

1. **状态是行为修饰**：影响行动权重、属性、推理准确度
2. **状态不是机制修改**：机制修改是特质的工作（如孤狼的独立击杀）
3. **状态是永久的**：一旦获得，不会消失
4. **状态可叠加**：多次满可以获得多个状态
5. **状态与职业无关**：任何职业都可能获得任何状态（但某些状态对某些职业影响更大）

## 文档索引

- [MAIN.md](MAIN.md) — 文档目录
- [PRESSURE.md](PRESSURE.md) — 压力系统（状态的触发来源）
- [PERSONALITY.md](PERSONALITY.md) — 性格系统（与状态叠加）
- [INTENTION.md](INTENTION.md) — 意图系统（状态影响决策）
- [TRAIT.md](TRAIT.md) — 特质系统（机制修改，与状态区分）
- [MEMORY-SYSTEM.md](MEMORY-SYSTEM.md) — 记忆系统
- [INFERENCE.md](INFERENCE.md) — 推理系统（受状态影响）
