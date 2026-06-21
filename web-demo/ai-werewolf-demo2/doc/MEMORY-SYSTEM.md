# 记忆系统（Memory System）

## 核心原则

> **记忆不是全知的，而是被触发的。** 每条记忆有明确的触发时机、来源、可信度。记忆不可变，但会遗忘。

## 记忆条目结构

```typescript
interface MemoryEntry {
  id: string;
  triggerAt: MemoryTrigger;      // 触发时机：init / night_start / night_action / ...
  round: number;                  // 第几回合
  eventType: MemoryEventType;     // 事件类型
  actorId: string;               // 行为者
  targetId?: string;              // 目标
  content: Record<string, unknown>;
  source: MemorySource;          // 来源（决定可信度）
  credibility: number;           // 0~1，可信度
  importance: number;           // 0~1，重要度（决定遗忘难度）
  createdAt: number;            // 时间戳
  notes?: string;               // AI备注
}
```

## 记忆与关系

记忆会影响关系。当有人对我执行攻击行为（`hear_accuse`、`vote`），我的友好度对他降低；当有人对我执行袒护行为（`hear_defend`），友好度对他升高；当有人对我闲聊（`hear_chat`），效果取决于对方的判定结果——成功时友好度微升，失败时友好度微降。友好度是纯粹的关系，和推理无关。

**详见 [RELATION.md](RELATION.md)**。

## 记忆来源

| 来源 | 可信度 | 重要度 | 说明 | 遗忘难易 |
|------|--------|--------|------|---------|
| `system` | 1.0 | 0.9 | 系统公布：死亡、投票结果、自己的角色、狼人队友 | 很难忘 |
| `self` | 1.0 | 0.9 | 自己的行动：查验、杀人投票 | 很难忘 |
| `speech` | 0.4 | 0.3 | 他人的发言：声称、指控、辩护。内容可能为假 | 容易忘 |
| `observe` | 0.7 | 0.5 | 自己的观察：行为模式。可能有偏差 | 一般 |

**关键区分**：`system` 和 `self` 是 100% 可信的硬信息。`speech` 是别人说的话，可能为假。同一事件不同 AI 的 `source` 不同——预言家查验是 `self`（仅自己），其他 AI 没有这条记忆；系统公布死亡是 `system`（所有人）。

## 记忆事件类型

| 事件类型 | 触发时机 | 来源 | 说明 |
|---------|---------|------|------|
| `self_role` | init | self | 我知道自己的角色 |
| `teammate_reveal` | init | system | 狼人知道队友（仅狼人） |
| `check_result` | night_action | self | 预言家查验结果（仅预言家） |
| `night_kill_vote` | night_action | self | 狼人投票击杀（各狼人自己） |
| `death` | night_end / vote_result | system | 玩家死亡（所有人） |
| `hear_claim` | speech | speech | 听到某玩家声称身份（所有人） |
| `hear_accuse` | speech | speech | 听到某玩家指控他人（所有人） |
| `hear_defend` | speech | speech | 听到某玩家为他人辩护（所有人） |
| `hear_chat` | speech | speech | 听到某玩家闲聊（所有人） |
| `vote` | vote | system | 投票行为（系统记录） |
| `vote_result` | vote_result | system | 投票结果（系统公布） |
| `observe_pattern` | day_start | observe | 观察到的短期意图（攻击/保护/隐藏/收集信息） |

## 遗忘机制

> 记忆不是无限容量的。记忆越多，越容易遗忘。但记忆**不删除**，只标记 `isForgotten = true`。

- **遗忘度** = 基础遗忘度 + 记忆库压力 + 时间衰减（遗忘曲线）
- **标记条件**：遗忘度 > 重要度时，记忆变为「已遗忘」状态
- 已遗忘的记忆仍保留在系统中，但查询时默认不参与推理
- 每回合调用 `memStore.applyForgetting(currentRound)` 触发

`system/self` 记忆重要度 0.9，很难忘；`speech` 重要度 0.3，容易被遗忘。这模拟了：随口说的容易忘，硬信息难忘。

**具体实现见 `src/memory/mem-store.ts`**。

## 观察与短期意图

> 观察的结果不是硬事实，而是**对目标短期意图的推断**。

当执行 `observe target` 时，系统从目标的行为中推断其**短期意图**：

| 观察到的行为 | 推断的意图 | 置信度 |
|------------|-----------|--------|
| 频繁 `suspect` 某人 | `attack` 该目标 | 高（0.7） |
| 频繁 `defend` 某人 | `protect` 该目标 | 高（0.7） |
| 总是 `silence` | `hide` | 中（0.5） |
| 频繁 `observe` 多人 | `gather_info` | 中（0.5） |
| 被攻击后 `claim_identity` | `self_defense` | 高（0.7） |

**观察是概率性的**：
- 观察者的 `insight`（洞察）属性提高推断准确度
- 目标的 `cunning`（诡诈）属性降低推断准确度
- 观察结果不是100%准确，可能误判（如把 `gather_info` 误判为 `hide`）

**产生的记忆**：
```typescript
createObservePattern({
  observerId: 'A',
  targetId: 'B',
  content: {
    inferredIntention: 'attack',  // 推断的意图
    intentionTarget: 'C',          // 意图指向的目标（如有）
    confidence: 0.65,              // 推断置信度
  },
  source: 'observe',
});
```

## 记忆的不可变性

记忆一旦录入，**不可修改内容**。如果新信息推翻了旧信息，不是修改，而是**新增一条记忆**。旧记忆会被自然遗忘，但不会被篡改。

## 设计原则

1. **触发即记忆**：只有在触发点，信息才会进入记忆。
2. **来源决定可信度**：`system`/`self` = 1.0，`speech` = 0.4，不可伪造。
3. **内容可能为假，事件本身为真**："B 说了" 是事实，但"B 说的是真话" 可能为假。
4. **不可变，只追加**：记忆是历史记录，不能修改。
5. **会遗忘**：记忆库有容量限制，自然淘汰不重要的信息。

## 文档索引

- [MAIN.md](MAIN.md) — 文档目录
- [RELATION.md](RELATION.md) — 关系系统
- [INFERENCE.md](INFERENCE.md) — 推理系统（记忆的动态计算）
- [INTENTION.md](INTENTION.md) — 意图系统（最终决策系统）
- [ROLE.md](ROLE.md) — 职业文档（定义角色能力）
- [PERSONALITY.md](PERSONALITY.md) — 性格系统（影响行动选择）
- [PRESSURE.md](PRESSURE.md) — 压力系统（记忆的产物）
- [STATE.md](STATE.md) — 状态系统（美德/崩溃）
- [TRAIT.md](TRAIT.md) — 特质系统（只影响机制）
