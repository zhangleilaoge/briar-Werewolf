# 推理系统（Inference Engine）

> **推理不是记忆，是动态计算。** 每次从当前记忆实时推导，不缓存，不存储。

## 角色推理（Role Inference）

> 回答「谁是狼人」。

### 核心输出

```typescript
interface RoleInference {
  playerId: string;
  werewolfProb: number;  // 0~1，认为是狼人的概率
  villagerProb: number;  // 0~1，认为是村民的概率
  basis: string[];       // 支撑推理的记忆ID
}
```

### 推理逻辑

1. **硬信息优先**：`system` / `self` 来源的记忆（查验结果、队友揭示）直接覆盖角色概率
2. **软信息加权**：`speech` / `observe` 来源的记忆按可信度加权综合
3. **无信息默认**：没有相关记忆时，默认狼人概率 0.3，村民概率 0.7

### 与记忆系统的关系

```
MemStore（记忆库）
    ↓ 读取非遗忘记忆
InferenceEngine.inferAll() → 实时计算角色概率
    ↓ 输出 RoleInference
后续决策使用
```

**关键**：推理不修改记忆，也不存储自己。每次调用都重新计算。

## 局势推理（Situation Inference）

> 局势推理回答「当前场上谁在被攻击、谁在主导」，和角色推理（「谁是狼人」）是两条独立的线。

### 核心输出

```typescript
interface PlayerCrisis {
  playerId: string;
  score: number;         // 危机度，越高越危险（被攻击越多）
  dominant: number;      // 主导度 = -score，越高越主导
  factors: {
    accuseCount: number;    // 被指控次数
    voteCount: number;      // 被投票次数
    defendCount: number;    // 被辩护次数
    observeCount: number;   // 被观察次数
    claimWolfCount: number; // 被声称查杀次数
  };
  basis: string[];       // 支撑的记忆ID
}
```

### 两层局势推理

**1. 个人危机度（`inferSelfCrisis`）**
- 通过所有人对我（`selfId`）的行为，判断我当前有多危险
- 和 `Relation.friendly` **完全独立**：
  - `friendly` =「我对谁好/坏」（我主动的感情）
  - `crisis` =「谁对我好/坏」（别人对我的行为）

**2. 场上危机分布（`inferFieldCrisis`）**
- 计算所有人的危机度，返回：
  - `mostAtRisk`：危机度最高（最被攻击）的人
  - `mostDominant`：危机度最低（最主导）的人

### 危机度计算

只统计「别人对该玩家」的行为（该玩家是 `targetId`）：

| 行为 | 权重 | 说明 |
|------|------|------|
| 被投票（`vote`） | +3 | 最危险，直接致死 |
| 被声称查杀（`hear_claim`） | +4 | 被公开指认为狼 |
| 被指控（`hear_accuse`） | +2 | 被怀疑 |
| 被观察（`observe_pattern`） | +1 | 被暗中关注 |
| 被辩护（`hear_defend`） | -2 | 被保护，减少危机 |

`score = 指控×2 + 投票×3 + 观察×1 + 声称查杀×4 - 辩护×2`

### 使用场景

- 预言家被多个人指控 → 危机度高 → 考虑 `defend` 或 `claim_identity` 自证
- 狼人发现某人危机度很低（主导度高）→ 优先击杀（能带节奏的人）
- 村民发现某人危机度极高 → 可能是被抗推的好人，考虑 `defend`

## 文档索引

- [MAIN.md](MAIN.md) — 文档目录
- [MEMORY-SYSTEM.md](MEMORY-SYSTEM.md) — 记忆系统（推理的输入）
- [RELATION.md](RELATION.md) — 关系系统（友好度，纯粹的关系）
- [INTENTION.md](INTENTION.md) — 意图系统（推理的输出消费者）
- [ROLE.md](ROLE.md) — 职业文档（角色能力来源）
- [PERSONALITY.md](PERSONALITY.md) — 性格系统（影响行动选择）
- [PRESSURE.md](PRESSURE.md) — 压力系统（满后失去推理能力）
- [STATE.md](STATE.md) — 状态系统（影响推理准确度）
- [TRAIT.md](TRAIT.md) — 特质系统（只影响机制）
