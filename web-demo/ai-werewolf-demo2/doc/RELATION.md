# 关系系统（Relation System）

> **友好度是纯粹的关系，和推理无关。** 它只回答"我和谁关系好/坏"，不回答"谁是狼人"。

## 核心定义

```typescript
interface Relation {
  friendly: number; // 友好度，-10 ~ 10，初始 0
}
```

友好度：-10（极度敌对）→ 0（陌生人）→ 10（极度友好）。

## 友好度如何变化

当有人对我（`self`）做出行为时，友好度变化：

| 行为（目标是我） | 友好度变化 | 说明 |
|------|-----------|------|
| `hear_accuse`（被怀疑） | -3 | 被攻击，友好度下降 |
| `vote`（被投票） | -2 | 被针对，友好度下降 |
| `hear_defend`（被辩护） | +2 | 被保护，友好度上升 |
| `hear_chat`（被闲聊） | +1 / -1 | 判定成功+1，失败-1 |

只处理「目标是我」的记忆。我对别人做了什么，不影响友好度。

## 使用场景

- 狼人击杀目标选择：优先杀友好度低的（对我态度差的人）
- 村民怀疑目标选择：优先怀疑友好度低的（对我不好的人）
- 但不用于身份推理：友好度低 ≠ 他是狼人

## 与记忆系统的关系

```
记忆录入（有人攻击/投票/辩护我）
    ↓
RelationTracker.onMemoryAdded(memory) → 更新 friendly
    ↓
后续决策时可查询友好度
```

**具体实现见 `src/relation/relation.ts`**。

## 文档索引

- [MAIN.md](MAIN.md) — 文档目录
- [MEMORY-SYSTEM.md](MEMORY-SYSTEM.md) — 记忆系统
- [INFERENCE.md](INFERENCE.md) — 推理系统（角色概率计算）
- [INTENTION.md](INTENTION.md) — 意图系统（最终决策系统）
- [ROLE.md](ROLE.md) — 职业文档（定义角色能力）
- [PERSONALITY.md](PERSONALITY.md) — 性格系统（影响行动选择）
- [PRESSURE.md](PRESSURE.md) — 压力系统（记忆的产物）
- [STATE.md](STATE.md) — 状态系统（美德/崩溃）
- [TRAIT.md](TRAIT.md) — 特质系统（只影响机制）
