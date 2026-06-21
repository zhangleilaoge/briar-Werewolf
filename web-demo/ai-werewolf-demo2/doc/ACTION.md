# 动作系统（Action System）

> **动作是记忆的触发器。** 每个动作执行后都会产生记忆。动作本身不是目的，目的是通过动作产生可被记忆和推理的信息。

## 动作分类

### 夜间动作（Night）

| 动作 | 角色 | 说明 | 产生的记忆 |
|------|------|------|-----------|
| `check` | 预言家 | 选择一名玩家查验身份 | `check_result`（self，仅预言家自己） |
| `kill` | 狼人 | 投票选择击杀目标 | `night_kill_vote`（self，仅该狼人自己） |
| `sleep` | 村民 | 无行动 | 无 |

### 白天动作（Day）—— 先只设计这 5 种

| 动作 | 目标 | 说明 | 产生的记忆 |
|------|------|------|-----------|
| `silence` | 无 | 沉默：跳过本回合 | 无 |
| `claim_identity` | 无 | 公布身份：声明一个身份（可能真可能假） | `hear_claim`（speech，所有人） |
| `observe` | 有 | 观察：暗中观察目标，从行为推断其短期意图（攻击/保护/隐藏/收集信息） | `observe`（system，公开） |
| `suspect` | 有 | 怀疑：公开表达对某玩家的怀疑 | `hear_accuse`（speech，所有人） |
| `defend` | 有 | 袒护：公开为某玩家辩护 | `hear_defend`（speech，所有人） |
| `chat` | 无 | 闲聊：与随机玩家聊天，可能缓解或加剧压力 | `hear_chat`（speech，所有人） |

## 动作效果：闲聊（chat）

> 闲聊是**低风险社交行为**，效果取决于一次随机判定。判定成功率受**擅长度**影响（详见 [INTENTION.md](INTENTION.md) 擅长度映射）。

| 判定条件 | 成功（擅长度随机 > pressure基数） | 失败（≤） |
|----------|------|------|
| **压力** | 自己压力 -1 | 自己压力 +2 |
| **友好度** | 随机一名存活玩家友好度 +1 | 随机一名存活玩家友好度 -1 |

- **判定公式**：`rand(0, proficiency) > rand(0, pressure)`
  - `proficiency = (eloquence + affinity) / 2 × 1.5`（擅长度，由口才+亲和决定）
  - 擅长度范围：0（双属性=0）~ 15（双属性=10）
- 压力高时容易失败，擅长度高时容易成功
- 随机目标由系统选择（优先选友好度中立的玩家）

## 动作约束

| 约束 | 说明 |
|------|------|
| 不能对已死亡玩家执行 | 目标必须存活 |
| 不能对自己执行 suspect | 不能怀疑自己是狼 |
| 狼人不能 suspect 队友 | 硬约束 |
| 预言家 claim_identity 有次数限制 | 通常只能声称一次 |
| observe 可多次执行 | 无次数限制 |
| silence 不产生记忆 | 纯跳过 |
| **性格禁用** | 性格可能禁用某些行动（详见 [PERSONALITY.md](PERSONALITY.md)） |

## 暂不设计（后续扩展）

| 动作 | 说明 |
|------|------|
| `call_vote` | 号召投票给某人 |
| `block_vote` | 阻止投票给某人 |
| `guarantee` | 担保某目标一定是好人 |
| `strong_accuse` | 强烈指认某目标一定是狼人 |
| `exclude_all` | 全员排除 |
| `vote` | 投票（简化版先不做） |

## 文档索引

- [MAIN.md](MAIN.md) — 文档目录
- [MEMORY-SYSTEM.md](MEMORY-SYSTEM.md) — 记忆系统
- [RELATION.md](RELATION.md) — 关系系统
- [INFERENCE.md](INFERENCE.md) — 推理系统
- [PERSONALITY.md](PERSONALITY.md) — 性格系统（影响行动选择）
- [PRESSURE.md](PRESSURE.md) — 压力系统（影响行动选择）
- [STATE.md](STATE.md) — 状态系统（影响行动选择）
- [TRAIT.md](TRAIT.md) — 特质系统（只影响机制）
- [INTENTION.md](INTENTION.md) — 意图系统（最终决策系统）
- [ROLE.md](ROLE.md) — 职业文档（职业义务硬约束）
- [ROLE-SPECIFIC.md](ROLE-SPECIFIC.md) — 角色特定逻辑
- [MODERATOR.md](MODERATOR.md) — 游戏流程
- [ITEM.md](ITEM.md) — 物品系统
