# 游戏流程（Game Flow）

> **主持人不是玩家，是规则执行者。** 只负责推动游戏流程、触发阶段切换。本身没有信念、不做决策、不参与推理。

## 简化版流程（先只实现）

```
init → 分配角色，告知狼人队友
  ↓
night 第 N 夜 → 预言家查验 → 狼人投票杀人 → 公布死亡
  ↓
day 第 N 天 → 轮流行动（每人一个白天动作）→ 投票 → 公布结果
  ↓
检查游戏结束 → 是则结束，否则回到 night
```

## 阶段切换

| 阶段 | 触发条件 | 进入下一阶段条件 |
|------|---------|---------------|
| init | 游戏开始 | 角色分配完成 |
| night_start | 白天结束 | 自动进入 |
| night_action | night_start 后 | 所有行动收集完成 |
| night_end | night_action 后 | 死亡计算完成 |
| day_start | night_end 后 | 死亡公布完成 |
| speech | day_start 后 | 所有玩家行动完成 |
| vote | speech 后 | 所有玩家投票完成 |
| vote_result | vote 后 | 结果公布完成 |
| 回到 night_start | vote_result 后 | 游戏未结束 |

## 暂不实现

- 女巫救/毒、猎人开枪、白痴翻牌
- 复杂的投票机制
- 游戏结束判定

## 文档索引

- [MAIN.md](MAIN.md) — 文档目录
- [MEMORY-SYSTEM.md](MEMORY-SYSTEM.md) — 记忆系统
- [RELATION.md](RELATION.md) — 关系系统
- [INFERENCE.md](INFERENCE.md) — 推理系统
- [PERSONALITY.md](PERSONALITY.md) — 性格系统
- [PRESSURE.md](PRESSURE.md) — 压力系统
- [ROLE-SPECIFIC.md](ROLE-SPECIFIC.md) — 角色特定逻辑
- [ACTION.md](ACTION.md) — 动作系统定义
- [INTENTION.md](INTENTION.md) — 意图系统（最终决策系统）
- [ROLE.md](ROLE.md) — 职业文档（职业定义）
- [STATE.md](STATE.md) — 状态系统
- [TRAIT.md](TRAIT.md) — 特质系统（只影响机制）
- [ITEM.md](ITEM.md) — 物品系统
