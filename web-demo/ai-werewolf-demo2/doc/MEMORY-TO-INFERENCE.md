# 记忆对推理系统的影响矩阵（Memory-to-Inference Impact Matrix）

> 本文档回答四个问题：
> 1. 现在有哪些记忆类型？
> 2. 这些记忆对四个推理模块产生了哪些影响（已实现 vs 完全空）？
> 3. 每种记忆对各模块**应该**产生什么影响？
> 4. 如何在 hover 时展示具体的影响链路？

---

## 一、记忆类型全景（16 种）

根据 `src/types/index.ts` 中的 `MemoryEventType` 定义，当前系统支持 16 种记忆事件：

| # | 记忆类型 | 触发时机 | 来源 | 可信度 | 当前使用频率 | 说明 |
|---|---------|---------|------|--------|------------|------|
| 1 | `self_role` | `init` | `self` | 1.0 | ★☆☆ | 我知道自己的角色 |
| 2 | `teammate_reveal` | `init` | `system` | 1.0 | ★☆☆ | 狼人知道队友（仅狼人） |
| 3 | `check_result` | `night_action` | `self` | 1.0 | ★★★ | 预言家查验结果 |
| 4 | `night_kill_vote` | `night_action` | `self` | 1.0 | ☆☆☆ | 狼人投票击杀（未被使用） |
| 5 | `death` | `night_end` / `vote_result` | `system` | 1.0 | ★☆☆ | 玩家死亡 |
| 6 | `hear_claim` | `speech` | `speech` | 0.4 | ★★★ | 听到别人声称身份/查验结果 |
| 7 | `hear_accuse` | `speech` | `speech` | 0.4 | ★★★ | 听到别人指控他人 |
| 8 | `hear_defend` | `speech` | `speech` | 0.4 | ★★☆ | 听到别人辩护他人 |
| 9 | `hear_silence` | `speech` | `speech` | 0.4 | ☆☆☆ | 别人保持沉默（未被使用） |
| 10 | `hear_chat` | `speech` | `speech` | 0.4 | ★☆☆ | 听到别人闲聊 |
| 11 | `morning` | `morning` | `system` | 1.0 | ☆☆☆ | 天亮了（未被使用） |
| 12 | `peaceful_night` | `morning` | `system` | 1.0 | ☆☆☆ | 平安夜（未被使用） |
| 13 | `vote` | `vote` | `system` | 1.0 | ★★☆ | 投票行为 |
| 14 | `vote_result` | `vote_result` | `system` | 1.0 | ☆☆☆ | 投票结果（未被使用） |
| 15 | `observe_pattern` | `day_start` | `observe` | 0.7 | ★★☆ | 观察到的行为模式 |
| 16 | — | — | — | — | — | 间接来源：记忆的 `importance` / `isForgotten` 影响遗忘机制 |

> **使用频率说明**：★★★ = 核心逻辑已使用；★★☆ = 部分使用；★☆☆ = 仅基础记录；☆☆☆ = 完全未使用

---

## 二、四大推理模块与记忆的交互现状

```
┌─────────────────────────────────────────────────────────────┐
│                        记忆输入层                            │
│  16 种 MemoryEventType → 按 source 分层可信度               │
│  system(1.0) / self(1.0) / speech(0.4) / observe(0.7)      │
└─────────────────────────────────────────────────────────────┘
                              ↓
    ┌──────────────────────────────────────────────────┐
    │              推理引擎 InferenceEngine               │
    ├──────────────────┬─────────────────────────────────┤
    │  角色推理         │  局势推理 (Crisis)              │
    │  RoleInference   │  PlayerCrisis                   │
    │  回答：谁是狼？   │  回答：谁在被攻击？              │
    ├──────────────────┴─────────────────────────────────┤
    │              关系系统 RelationTracker               │
    │  回答：我对谁好/坏？（friendly -10~10）              │
    ├──────────────────────────────────────────────────┤
    │              意图系统 IntentionEngine               │
    │  LongTerm → ShortTerm → Candidate → Select         │
    │  回答：我要做什么？                                  │
    └──────────────────────────────────────────────────┘
```

### 2.1 角色推理（Role Inference）— 已实现核心

**文件**：`src/inference/role-inference.ts` `inferPlayer()`（原 `_inferPlayer()` 已提取至此，硬信息覆盖抽为 `applyHardInfo()`）

**当前逻辑**：
1. **硬信息直接覆盖**：`check_result` / `teammate_reveal` → 直接返回概率 1.0 或 0（通过 `applyHardInfo()` 统一处理）
2. **声称加权**：`hear_claim` → 按 `credibility × CLAIM_WEIGHT_FACTOR(0.5)` 加权
3. **观察意图**：`observe_pattern` → 攻击意图加狼人权重，保护意图加村民权重，隐藏意图加狼人权重
4. **搅屎棍检测**：`hear_accuse` → 频繁指控不同人的玩家自身狼人概率上升（`ACCUSER_SPAM_WEIGHT`）
5. **投票角色推理**：`vote` → 投票给某人增加其狼人权重（`VOTE_ROLE_WEIGHT.ANTI_PUSH_WOLF`）

**当前已使用的记忆**：`check_result`, `teammate_reveal`, `hear_claim`, `observe_pattern`, `hear_accuse`（指控者统计）, `vote`（投票抗推）

**完全未使用的记忆**：`self_role`, `night_kill_vote`, `death`, `hear_silence`, `morning`, `peaceful_night`, `vote_result`

**`vote` 的间接使用**：`vote` 已直接参与角色推理（`VOTE_ROLE_WEIGHT.ANTI_PUSH_WOLF`），投票给某人增加其狼人权重。同时 `vote` 仍用于局势推理（危机度 +3）。

**现状评分**：⭐⭐⭐ 核心路径已通，但存在明显遗漏（见下方设计部分）。

---

### 2.2 局势推理（Situation / Crisis Inference）— 已实现核心

**文件**：`src/inference/crisis-inference.ts` `inferCrisis()`（原 `_inferCrisis()` 已提取至此）

**当前逻辑**：统计以某玩家为 `targetId` 的记忆：
- `hear_accuse` → +2（同一人反复指控递减）
- `vote` → +3
- `hear_defend` → -2
- `observe_pattern` → +1（攻击型）/ +0（隐藏型）
- `hear_claim`（claimedResult=werewolf）→ +4，计入 `claimWolfCount`

**完全未使用的记忆**：`check_result`, `death`, `morning`, `peaceful_night`, `vote_result`

> 注：`claimWolfCount` 与 `CRISIS_WEIGHT.CLAIM_WOLF` 已在代码中实现，与文档一致。

**现状评分**：⭐⭐⭐ 核心计数器已通，权重表与代码一致。

---

### 2.3 关系系统（Relation）— 已实现基础

**文件**：`src/relation/relation.ts` `onMemoryAdded()`

**当前逻辑**：只处理目标为"我"（`selfId`）的记忆，且只处理三种事件：
- `hear_accuse` → 友好度 -3
- `vote` → 友好度 -2
- `hear_defend` → 友好度 +2

**完全未使用的记忆**：`hear_chat`（`content.success` 被忽略），`hear_claim`（声称查杀/金水对关系的影响），`observe_pattern`（观察到某人攻击我，友好度应降低），`death`（队友死亡影响关系网络），`check_result`（查验结果对声称者的关系影响）。

**现状评分**：⭐⭐ 基础路径已通，但只覆盖了 3/16 种记忆，且 `hear_chat` 的 `content.success` 完全没被读取。

---

### 2.4 意图系统（Intention）— 已实现核心

**文件**：`src/intention/intention-engine.ts`

**当前逻辑**：意图系统不直接读取记忆，而是读取**推理引擎的输出**（`RoleInference`, `PlayerCrisis`）和**关系系统输出**（`friendly`）。记忆通过"经过推理层过滤后的数据"间接影响意图。

**直接读取记忆的位置**：
1. `evaluateLongTermIntentions()` 中，`report_check` 意图直接读取 `check_result` 记忆：
   ```typescript
   const checkMemories = this.store.getAll().filter(
     (m) => !m.isForgotten && m.actorId === this.self.id && m.eventType === 'check_result'
   );
   ```
   这是意图系统中**唯一直接读取记忆**的地方。

2. `generateShortTermIntentions()` 中，压力修正基于 `self.pressure`（静态属性，非记忆）。

3. `selectAction()` / `_calcScore()` 中，完全不直接读取记忆。

**现状评分**：⭐⭐⭐ 架构正确（意图层不应直接读记忆），但存在一处硬编码（`report_check` 直接查记忆），且意图的 `basis` 在向前传递时有些断裂。

---

## 三、设计：每种记忆对各模块应该产生的影响

### 3.1 角色推理（Role Inference）影响设计

| 记忆类型 | 当前影响 | 应增加的影响 | 实现建议 |
|---------|---------|------------|---------|
| `self_role` | 无（inferAll skip自己） | 知道自己身份后，**反向推断队友** | 村民知道自己是村民→所有其他村民概率应更高；狼人知道自己是狼→队友已知，其他人都非队友 |
| `teammate_reveal` | ✅ 硬信息覆盖 | 增加"已知队友数"统计，用于推断剩余狼人数量 | 新增：已知队友的 `PlayerInference` 中 `isTeammate` 标记，场上剩余狼人位置推断 |
| `check_result` | ✅ 硬信息覆盖 | 被查验者的**反向推断**（查验我的人是谁？） | 如果A验B是狼，且B确实是狼→A可能是预言家；如果A验B是狼，但B是村民→A可能是假预言家 |
| `night_kill_vote` | ❌ 无 | 狼人知道队友夜间投票目标→用于白天协同攻击方向 | 新增：狼人夜间投票记忆应生成 `attack` 倾向的短期意图 |
| `death` | ❌ 无 | 死亡玩家的角色揭示（系统公布）→修正场上角色分布 | 死亡是 `system` 来源，但不知道具体角色。不过可以根据死者的行为回溯推断 |
| `hear_claim` | ✅ 声称加权（0.5因子） | **矛盾检测**：如果D声称A是狼，但E（预言家）验A是村民→D的声称可信度降低，D的狼人概率上升 | 需要跨玩家引用记忆（当前每个AI只有自己的记忆） |
| `hear_accuse` | ✅ 搅屎棍检测（指控者统计） | 指控者本身的行为模式：频繁指控不同人→狼人概率上升（搅屎棍行为） | 已实现：`_inferCrisis` 统计被指控者危机度，`role-inference.ts` 统计指控者自身狼人概率 |
| `hear_defend` | ❌ 无 | 辩护者+被辩护者的**关系簇分析**：互相辩护的群体可能是狼人互保或好人抱团 | 新增：对互相辩护群体的特殊推理逻辑 |
| `hear_silence` | ❌ 无 | 沉默者→默认概率不变化，但**沉默本身可能是隐藏行为** | 和 `observe_pattern` 的 `hide` 意图结合 |
| `hear_chat` | ❌ 无 | 闲聊成功→可能是在建立关系；闲聊失败→可能是在试探 | 低优先级，暂不实现 |
| `vote` | ✅ 投票抗推权重 | 投票和指控的一致性：如果B指控A但投票给C→行为不一致，B可疑 | 已参与角色推理（`VOTE_ROLE_WEIGHT.ANTI_PUSH_WOLF`）。一致性检测待实现 |
| `vote_result` | ❌ 无 | 被投出者的身份（公布时）→场上角色分布修正 | 同 `death` |
| `observe_pattern` | ✅ 攻击/保护/隐藏意图加权 | 增加 `gather_info`（收集信息）意图的处理 | 当前 `gather_info` 未在 `_inferPlayer` 中处理 |
| `morning` / `peaceful_night` | ❌ 无 | 平安夜→女巫可能使用了药；无死亡→狼人可能未达成一致 | 当前无女巫角色，暂不实现 |

**核心改进点**：
1. **`hear_accuse` 反向影响指控者**：已实现。如果有人频繁指控不同人（搅屎棍），这个人的狼人概率上升（`ACCUSER_SPAM_WEIGHT`）。
2. **`vote` 参与角色推理**：已实现。投票行为增加被投票者的狼人权重（`VOTE_ROLE_WEIGHT.ANTI_PUSH_WOLF`）。投票与声称/指控的一致性检测待实现。
3. **`hear_claim` 矛盾检测**：当前每条声称独立加权。当两个声称矛盾时（D 说 A 是狼，E 说 A 是村民），应触发**矛盾检测机制**：其中一人必然是假预言家，其狼人概率大幅上升。

---

### 3.2 局势推理（Crisis Inference）影响设计

| 记忆类型 | 当前影响 | 应增加的影响 | 实现建议 |
|---------|---------|------------|---------|
| `hear_accuse` | ✅ +2 | 多个不同来源的指控→叠加，但同一人反复指控→递减（避免单人spam） | 增加去重/衰减机制 |
| `hear_claim` | ✅ +4（被声称查杀） | 被声称查杀（`hear_claim` + `claimedResult=werewolf`）→危机度 +4，计入 `claimWolfCount` | 已实现：`crisis-inference.ts` 中 `hear_claim` 处理 |
| `vote` | ✅ +3 | 投票结果的最终致死性→如果投票导致死亡，被投票者的历史危机度应作为"经验值"影响其他玩家 | 低优先级 |
| `hear_defend` | ✅ -2 | 多个辩护来源→叠加保护效果 | 当前已支持，但无上限 |
| `observe_pattern` | ✅ +1（攻击型）/ +0（隐藏型） | 观察到的隐藏意图→危机度不增加（隐藏不是攻击），但被观察本身增加"被关注度" | 已实现区分：攻击型观察(+1)，隐藏型观察(+0) |
| `death` | ❌ 无 | 死亡后该玩家不再产生记忆→场上局势简化 | 已在 `inferFieldCrisis` 中 `if (!player.alive) continue`，但死亡本身不改变其他活人的危机度 |
| `check_result` | ❌ 无 | 被查验（预言家查验某人）→该人危机度增加（被关注） | 查验是私密行为，只有预言家知道。但如果是公开的声称查验，被查验者危机度增加 |
| `night_kill_vote` | ❌ 无 | 狼人知道队友的夜间击杀目标→该目标白天不应被狼人攻击（避免暴露协同） | 狼人内部逻辑，暂不实现 |

**核心改进点**：
1. **`hear_claim` 的 claimWolfCount**：✅ 已实现。`crisis-inference.ts` 中已处理 `hear_claim`（`claimedResult === 'werewolf'`），`CRISIS_WEIGHT.CLAIM_WOLF` 已定义。
2. **同一人反复指控的衰减**：✅ 已实现。`crisis-inference.ts` 中使用 `ACCUSER_SPAM_WEIGHT.REPEAT_DECAY` 递减重复指控。

---

### 3.3 关系系统（Relation）影响设计

| 记忆类型 | 当前影响 | 应增加的影响 | 实现建议 |
|---------|---------|------------|---------|
| `hear_accuse` | ✅ -3（目标=我时） | 我观察到**别人指控别人**→我对指控者的友好度微降（"这人好斗"） | 新增：旁观者视角的关系修正 |
| `vote` | ✅ -2（目标=我时） | 投票给我→-2；我观察到**别人投票给别人**→我对投票者的友好度微降（"这人狠"） | 新增 |
| `hear_defend` | ✅ +2（目标=我时） | 我观察到**别人辩护别人**→我对辩护者的友好度微升（"这人善良"） | 新增 |
| `hear_chat` | ❌ 无（`content.success` 被忽略） | `content.success=true` → 发起者对我友好度+1；`false` → -1 | 当前 `onMemoryAdded` 中没有读取 `content` 字段！需要修复 |
| `hear_claim` | ❌ 无 | 声称保护我（金水）→+2；声称查杀我→-5（极度敌对） | 新增。注意：只有目标=我时生效 |
| `observe_pattern` | ❌ 无 | 观察到某人攻击我→友好度-2；观察到某人保护我→+2 | 新增。`observe_pattern` 中的 `intentionTarget` 可指向自己 |
| `death` | ❌ 无 | 队友死亡→对其他玩家的友好度全面降低（警惕性上升） | 全局关系修正，需要谨慎设计 |
| `check_result` | ❌ 无 | 查验我是狼人（我确实是狼人）→队友对我的友好度+1（确认身份）；查验我是村民→无变化 | 仅限狼人队友视角 |

**核心改进点**：
1. **`hear_chat` 的 `content.success` 完全未读取**：当前 `onMemoryAdded()` 中只检查 `eventType`，不读取 `content`。而 `hear_chat` 的 `content.success` 正是用于判定闲聊是否成功。应修改为：
   ```typescript
   case 'hear_chat':
     if (memory.targetId === this.selfId) {
       const success = memory.content.success as boolean;
       this.adjustFriendly(memory.actorId, success ? 1 : -1, memory.id);
     }
     break;
   ```
2. **旁观者视角缺失**：当前关系系统只处理"别人对我做了什么"（targetId === selfId）。但社交推理中，**我观察到别人怎么对别人**也会影响我对他们的关系判断。例如：我看到 B 攻击 C，我会觉得 B 是个好斗的人，即使 B 没有攻击我。这不需要复杂实现，只需要增加一个"旁观衰减系数"（如 0.3x）即可。

---

### 3.4 意图系统（Intention）影响设计

意图系统**不应该直接读取记忆**，而是通过推理层和关系层的输出来间接获取。当前设计是正确的。

| 当前行为 | 状态 | 说明 |
|---------|------|------|
| `report_check` 直接查 `store.getAll()` 找 `check_result` | ✅ 已修复 | [2.4] 移除了 IntentionEngine 的 store 依赖，`report_check` 改为通过 `inference.getMyCheckResults()` 接口获取 |
| 长期意图的 `basis` 传递不完整 | 🟡 部分实现 | `IntentionTrace` 已添加，但 `find_werewolf` 的 `basis` 仍来自 `RoleInference.basis` |
| 短期意图的 `weight` 没有显示计算过程 | 🟡 部分实现 | `IntentionTrace` 已记录压力修正等过程，但公式展示待完善 |
| 候选集的 `supportingMemories` 是字符串数组 | 🟡 部分实现 | `traces` 已包含 `MemoryImpact`-like 结构，但 `supportingMemories` 仍为字符串数组 |

**核心改进点**：
1. **`IntentionTrace` 追踪结构**：✅ 已实现。每个意图/候选/选择记录完整计算轨迹（`stage`, `factor`, `baseValue`, `delta`, `result`, `basis`）。
2. **意图层完全依赖推理层接口**：✅ 已实现。`IntentionEngine` 构造函数不再接收 `store`，所有数据通过 `inference` 和 `relation` 接口获取。

---

## 四、Hover 影响展示设计

### 4.1 当前实现

当前 `MemoryTooltip`（`src/components/demo/MemoryTooltip.tsx`）只展示记忆的原始内容（`content` 字符串），格式为：
```
hear_accuse | B → C | R1 | speech | 可信度 0.4
```

**问题**：
- 只展示"是什么记忆"，不展示"这条记忆对当前结果产生了什么影响"
- 用户 hover 在推理结果上时，无法直观理解"为什么这个人狼人概率是 80%"

### 4.2 设计目标

> 当用户 hover 在任何一个推理结果（概率、危机度、友好度、意图权重、候选分数）上时，展示：**哪条记忆** → **通过什么机制** → **产生了什么影响**。

### 4.3 数据结构设计

新增类型定义（建议放在 `src/types/decision.ts` 或新建 `src/types/trace.ts`）：

```typescript
// 单条记忆对某个推理结果的具体影响
export interface MemoryImpact {
  memoryId: string;
  eventType: MemoryEventType;    // 如 'hear_accuse'
  actorId: string;               // 谁做的
  targetId?: string;              // 对谁做的
  impactType: 'direct' | 'indirect' | 'cascade';
  // direct: 直接支撑（如 check_result 直接决定概率）
  // indirect: 间接加权（如 hear_claim 通过可信度加权）
  // cascade: 级联影响（如 hear_accuse → 危机度上升 → 保护意图权重上升）
  description: string;           // 人类可读描述
  deltaScore: number;             // 分数变化量（如 +0.3 概率，或 +2 危机度）
  beforeScore: number;            // 变化前
  afterScore: number;             // 变化后
}

// 推理结果的影响溯源
export interface InferenceTrace {
  resultType: 'role' | 'crisis' | 'relation' | 'intention' | 'candidate';
  targetId: string;              // 对谁的结果
  finalValue: number;            // 最终值
  impacts: MemoryImpact[];       // 所有影响，按重要性排序
  calculationSteps: {             // 计算步骤（用于公式展示）
    step: string;                 // 如 "硬信息检查"
    formula: string;              // 如 "check_result: werewolf → 直接覆盖"
    result: number;
    basis: string[];              // 相关记忆ID
  }[];
}
```

### 4.4 各模块的 Hover 展示内容

#### 4.4.1 角色推理 Hover（Infer Player）

**触发**：hover 在某玩家的狼人概率条上

**展示内容**：

```
┌────────────────────────────────────────┐
│  🐺 角色推理：玩家 C 的狼人概率 73%     │
├────────────────────────────────────────┤
│  计算步骤：                             │
│  1. 硬信息检查：无硬信息                 │
│  2. 声称加权：                          │
│     • D 声称 C 是狼 (hear_claim)        │
│       → 可信度 0.4 × 0.5 = +0.2 狼人权重│
│     • B 声称 C 是狼 (hear_claim)        │
│       → 可信度 0.4 × 0.5 = +0.2 狼人权重│
│  3. 观察意图：                          │
│     • E 观察到 C 攻击 D (observe_pattern) │
│       → 可信度 0.7 × 0.7 × 0.8 = +0.392 │
│  4. 默认概率：+0.3                     │
│  5. 归一化：狼人权重 / 总权重 = 73%      │
├────────────────────────────────────────┤
│  支撑记忆 (3条)：                        │
│  [mem_3] D→C hear_claim  |  +0.2      │
│  [mem_4] B→C hear_claim  |  +0.2      │
│  [mem_12] E→C observe    |  +0.392    │
└────────────────────────────────────────┘
```

**实现方式**：
- 需要修改 `_inferPlayer()` 使其返回 `InferenceTrace` 而非仅 `RoleInference`
- 或者新增 `inferPlayerWithTrace()` 方法，保持原方法性能不变

#### 4.4.2 局势推理 Hover（Crisis Score）

**触发**：hover 在某玩家的危机度数字上

**展示内容**：

```
┌────────────────────────────────────────┐
│  ⚠️ 危机度：玩家 C 的 score = 7        │
├────────────────────────────────────────┤
│  因素明细：                             │
│  • B 指控 C (hear_accuse)     │ +2     │
│  • D 指控 C (hear_accuse)     │ +2     │
│  • B 投票给 C (vote)          │ +3     │
│  • D 声称查杀 C (hear_claim)  │ +4     │  ← 文档写了，代码未实现
│  • A 为 C 辩护 (hear_defend)  │ -2     │
│  ─────────────────────────────┼──────  │
│  合计                         │  7     │
├────────────────────────────────────────┤
│  被攻击来源：B, D（2个不同来源）        │
│  被保护来源：A（1个来源）               │
└────────────────────────────────────────┘
```

**实现方式**：
- 当前 `_inferCrisis()` 已经遍历了所有记忆并 push 到 `basis` 中
- 只需增加 `factors` 的详细拆分展示，把 `basis` 映射为 `MemoryImpact[]`

#### 4.4.3 关系系统 Hover（Friendly）

**触发**：hover 在某玩家的友好度数字上

**展示内容**：

```
┌────────────────────────────────────────┐
│  💕 友好度：我对 B 的友好度 = -5        │
├────────────────────────────────────────┤
│  变化记录：                             │
│  • B 指控我 (hear_accuse)     │ -3     │  [mem_1]
│  • B 投票给我 (vote)            │ -2     │  [mem_8]
│  ─────────────────────────────┼──────  │
│  合计                         │ -5     │
├────────────────────────────────────────┤
│  我观察到 B 的行为（旁观视角）：         │
│  • B 指控 A                     │ -0.3   │  [mem_2]（旁观衰减系数 0.1）
│  • B 指控 C                     │ -0.3   │  [mem_3]（旁观衰减系数 0.1）
│  • B 保护 D (hear_defend)       │ +0.2   │  [mem_6]（旁观衰减系数 0.1）
│  旁观修正合计                    │ -0.4   │
├────────────────────────────────────────┤
│  最终友好度：-5.4 ≈ -5（取整）          │
│  关系标签：敌对（<-5）                  │
└────────────────────────────────────────┘
```

**实现方式**：
- 当前 `Relation` 接口只有 `memoryIds: string[]`，需要改为 `MemoryImpact[]` 或至少按事件类型分组
- 新增"旁观者视角"需要 `RelationTracker` 在 `onMemoryAdded` 中处理 `targetId !== selfId` 的情况

#### 4.4.4 意图系统 Hover（Intention Weight）

**触发**：hover 在长期意图的优先级或短期意图的权重上

**展示内容**：

```
┌────────────────────────────────────────┐
│  ⚡ 短期意图：attack_C 权重 = 1.35      │
├────────────────────────────────────────┤
│  来源：长期意图 find_werewolf × 因子     │
│  计算：                                │
│  1. 基础权重 = 长期意图优先级           │
│     find_werewolf 优先级 = 0.9         │
│  2. 短期意图因子 = 1.0                 │
│  3. 中期意图 = 0.9 × 1.0 = 0.9        │
│  4. 压力修正（pressure=0, <8）→ ×1.0  │
│  5. 合并同ID意图 = 0.9                │
│  6. 候选生成时：攻击 C 的 baseScore=50 │
│  7. 角色加成：C 的狼人概率=73%         │
│     roleBonus = 0.5 + 0.73 × 1.5 = 1.595│
│  8. 危机加成：C 的危机度=7             │
│     situationBonus = 0.5 + min(7/10,1)×1.5 = 1.55 │
│  9. 性格加成（aggressive）：suspect ×2.0 │
│  10. 擅长度加成：logic=7, eloquence=7   │
│      = 0.5 + ((7+7)/2 / 10) × 1.5 = 1.55│
│  11. 最终 score = 50 × 1.595 × 1.55 × 2.0 × 1.55 │
│              = 383.6                   │
├────────────────────────────────────────┤
│  支撑这条推理的记忆：                    │
│  [mem_3] D 声称 C 是狼 → 角色概率上升  │
│  [mem_12] E 观察 C 攻击 → 角色概率上升  │
│  [mem_8] B 投票给 C → 危机度上升       │
│  [mem_9] D 投票给 C → 危机度上升       │
└────────────────────────────────────────┘
```

**实现方式**：
- 需要修改 `IntentionEngine` 的每个阶段，在计算时记录 `IntentionTrace`
- 这不会改变最终选择结果，只是增加可追溯性

### 4.5 UI 实现建议

#### 方案 A：扩展现有 MemoryTooltip（轻量）

`MemoryTooltip` 当前接收 `title: string` + `content: string`。可以改为：

```typescript
interface MemoryTooltipProps {
  title: string;
  // 新增：支持结构化展示
  trace?: InferenceTrace;
  // 保留旧接口
  content?: string;
  children: React.ReactNode;
}
```

如果传入 `trace`，则使用新的结构化渲染；如果传入 `content`，则使用旧的字符串渲染。

#### 方案 B：新建 HoverCard 组件（推荐）

新建 `src/components/ui/HoverCard.tsx`：

```typescript
interface HoverCardProps {
  title: string;
  subtitle?: string;           // 如 "73% 狼人概率"
  steps: {                     // 计算步骤
    label: string;
    value: string;
    memoryIds?: string[];
    highlight?: boolean;
  }[];
  memoryDetails?: MemoryImpact[]; // 详细影响
  children: React.ReactNode;
}
```

这个组件可以统一处理所有四种推理模块的 hover 展示，只需要传入不同的 `steps` 和 `memoryDetails`。

#### 方案 C：在现有 SystemPreview 中直接渲染（最快）

在 `SystemPreview.tsx` 的四个 tab 中，为每个可 hover 的元素添加 `onMouseEnter` 状态，在侧边栏或弹层中展示详细计算过程。不需要新增组件，直接在现有页面中增加一个"详情面板"。

### 4.6 性能考虑

- `InferenceTrace` 会增加内存占用和计算开销
- 建议采用**惰性计算**：只在用户 hover 时调用 `inferPlayerWithTrace()`，不 hover 时调用轻量的 `inferPlayer()`
- 在 `SystemPreview` 这种演示环境中，可以全部计算（数据量小）；在真实游戏循环中，只在需要展示时计算

---

## 五、实施优先级建议

| 优先级 | 模块 | 改动 | 工作量 | 影响 |
|-------|------|------|--------|------|
| 🔴 P0 | 危机推理 | 补全 `hear_claim` 的 claimWolfCount（代码与文档不一致） | 小 | 修复 bug |
| 🔴 P0 | 关系系统 | 修复 `hear_chat` 的 `content.success` 读取 | 小 | 修复 bug |
| 🟡 P1 | 角色推理 | `hear_accuse` 反向影响指控者（搅屎棍检测） | 中 | 提升推理质量 |
| 🟡 P1 | 角色推理 | `vote` 参与角色推理（跟票/抗推检测） | 中 | 提升推理质量 |
| 🟡 P1 | 关系系统 | 增加旁观者视角（衰减系数） | 中 | 关系网络更真实 |
| 🟢 P2 | 意图系统 | 增加 `IntentionTrace` 计算轨迹 | 中 | 提升可解释性 |
| 🟢 P2 | 全模块 | 实现 HoverCard 组件，展示 `MemoryImpact` | 中 | 提升用户体验 |
| 🔵 P3 | 角色推理 | `hear_claim` 矛盾检测（跨玩家引用） | 大 | 需要架构改动 |
| 🔵 P3 | 角色推理 | `hear_defend` 关系簇分析 | 大 | 高级推理 |
| 🔵 P3 | 关系系统 | 死亡/队友关系全局修正 | 大 | 复杂连锁反应 |

---

## 六、文档索引

- [MAIN.md](MAIN.md) — 文档目录
- [MEMORY-SYSTEM.md](MEMORY-SYSTEM.md) — 记忆系统（本文档的输入来源）
- [INFERENCE.md](INFERENCE.md) — 推理系统（本文档的核心分析对象）
- [INTENTION.md](INTENTION.md) — 意图系统（本文档的决策输出层）
- [RELATION.md](RELATION.md) — 关系系统（本文档的社交层）
