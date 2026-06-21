# 意图系统（Intention System）

> **意图是目标，不是行动。** 意图系统负责根据推理结果、职业、性格、关系，产生一组可选行动候选，然后加权选择最终行动。

## 核心原则

- **意图 = 目标**，行动 = 手段。先定目标，再选手段。
- 长期意图覆盖多回合（战略），短期意图聚焦当前回合（战术）。
- 短期意图可能是**带指向的**（攻击谁/保护谁），也可能是**无指向的**（沉默/自证）。
- 最终行动不是意图直接决定的，而是意图生成的**候选集**经过加权选择后决定的。
- 四种行动类型共享同一套意图系统，但入口不同（主动/反应/夜间/投票）。

## 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                        意图系统架构                              │
├─────────────────────────────────────────────────────────────────┤
│  角色 + 职业 + 性格 + 推理 → 长期意图（LongTermIntention）      │
│  长期意图 + 当前局势 + 压力 → 短期意图（ShortTermIntention）     │
│  短期意图 → 生成行动候选集（ActionCandidate[]）                │
│  候选集 × 加权选择 → 最终行动（Action）                         │
└─────────────────────────────────────────────────────────────────┘
```

## 意图层次

### 长期意图（LongTermIntention）

> 覆盖多回合的战略目标。每回合根据局势重新评估，不是固定不变的。

```typescript
interface LongTermIntention {
  id: string;
  priority: number;        // 优先级，0~1
  targetPlayer?: string;   // 指向性目标（如有）
  description: string;     // 意图描述
}
```

#### 村民阵营长期意图

| 意图 | 优先级 | 说明 |
|------|--------|------|
| `survive` | 0.9 | 生存：自己活下去是第一目标 |
| `find_werewolf` | 0.8 | 找出狼人：基于角色推理推动抗推 |
| `protect_villager` | 0.6 | 保护同伴：为好人辩护，避免抗推 |
| `lead` | 0.4 | 主导局势：带节奏，成为领袖 |

#### 狼人阵营长期意图

| 意图 | 优先级 | 说明 |
|------|--------|------|
| `survive` | 0.9 | 生存：自己活下去 |
| `hide_identity` | 0.8 | 隐藏身份：不被发现是狼人 |
| `mislead` | 0.7 | 误导村民：推动抗推好人 |
| `protect_teammate` | 0.6 | 保护队友：为狼队友辩护 |
| `eliminate_threat` | 0.5 | 消除威胁：击杀预言家/高领导力好人 |

#### 长期意图如何影响短期意图

```typescript
// 长期意图 "find_werewolf" → 短期意图权重：
//   attack_suspected_werewolf × 1.5
//   observe_suspected_werewolf × 1.2
//   silence × 0.5

// 长期意图 "hide_identity" → 短期意图权重：
//   silence × 1.5
//   defend_suspected_teammate × 1.3
//   claim_identity × 0.3
//   attack_high_crisis_villager × 1.2（推动抗推好人）
```

### 短期意图（ShortTermIntention）

> 当前回合的目标。有指向的意图会明确目标玩家，无指向的意图不指定目标。

```typescript
interface ShortTermIntention {
  id: string;
  type: 'pointed' | 'unpointed';  // 有指向 / 无指向
  targetId?: string;              // 指向的目标（有指向时）
  weight: number;                  // 该意图的当前权重
  description: string;
}
```

#### 有指向的短期意图

| 意图 | 目标 | 说明 | 产生的行动候选 |
|------|------|------|---------------|
| `attack` | 某玩家 | 攻击某人，推动抗推 | `suspect target`, `claim_identity + 指控target`, `observe target` |
| `protect` | 某玩家 | 保护某人，避免被抗推 | `defend target`, `claim_identity + 担保target` |
| `observe` | 某玩家 | 观察某人，收集信息 | `observe target`, `silence`（暗中观察） |
| `eliminate` | 某玩家 | 击杀某人（狼人夜间） | `kill target`（夜间） |
| `verify` | 某玩家 | 验证某人（预言家夜间） | `check target`（夜间） |

#### 无指向的短期意图

| 意图 | 说明 | 产生的行动候选 |
|------|------|---------------|
| `survive` | 自保，避免被攻击 | `silence`, `claim_identity`（自证）, `observe` |
| `hide` | 隐藏身份，不引起注意 | `silence`, `observe` |
| `self_defense` | 被攻击时自我防御 | `claim_identity`（自证）, `defend self`（为自己辩护） |
| `counter_attack` | 被攻击时反击 | `suspect attacker`, `claim_identity + 反击` |
| `gather_info` | 收集全局信息 | `observe`, `silence`（暗中观察） |
| `maintain_pressure` | 维持压力，继续攻击方向 | `suspect`（继续攻击之前的方向） |

## 意图生成流程

```
Step 1: 长期意图评估
  根据角色推理 + 局势推理 + 职业 + 性格，选择/更新长期意图
  （TODO: 具体计算逻辑）

Step 2: 短期意图生成
  根据长期意图 + 当前危机度 + 友好度 + 压力，生成一组短期意图
  （TODO: 具体计算逻辑）

Step 3: 行动候选生成
  每个短期意图 → 一组行动候选（带目标/不带目标）
  （TODO: 候选集生成规则）

Step 4: 加权选择
  综合所有因素，对每个候选打分，选择得分最高的
  （TODO: 加权公式）
```

## 四种行动类型

### 1. 主动行动（Day Action）

> 正常白天的主动行动。生成完整候选集，自由选择。

入口：`generateDayActions()` → 返回所有候选 → 加权选择 → 最终行动

**流程**：
```
长期意图评估 → 短期意图生成 → 行动候选集 → 加权选择 → 执行
```

### 2. 反应行动（Reaction Action）

> 当别人对我做出行动时的回应。候选集被限制在反应相关行动上。

触发条件：有人对我 `hear_accuse` / `vote` / `hear_claim`（指向我）

**入口**：`generateReactionActions(trigger)` → 返回反应候选 → 加权选择 → 最终行动

**反应候选集**（比主动行动窄）：
| 触发 | 反应候选 |
|------|---------|
| 被指控 | `claim_identity`（自证）, `defend self`, `suspect attacker`（反击） |
| 被投票 | `claim_identity`（紧急自证）, `defend self` |
| 被声称查杀 | `claim_identity`（强烈自证）, `suspect claimer`（反击声称者） |
| 被观察 | `silence`（保持低调）, `claim_identity`（主动暴露转移注意力） |

**反应行动的特殊处理**：
- 反应行动有时间压力（必须在回应窗口内做出）
- 反应行动的权重受压力值影响更大（高压力时更激进）
- 某些性格（如多疑型）在反应时权重不同

### 3. 夜间行动（Night Action）

> 夜间专属行动。入口窄，只有特定职业有特定行动。

**入口**：`generateNightActions()` → 返回夜间候选 → 加权选择 → 最终行动

**夜间候选集**（按职业）：
| 职业 | 候选 |
|------|------|
| 预言家 | `check target`（选一个未查验的/高嫌疑的） |
| 狼人 | `kill target`（选一个非队友的/高威胁的） |
| 村民 | 无（`sleep`） |

**夜间行动的特殊处理**：
- 夜间行动是私密的，不产生 `speech` 记忆（产生 `self` 记忆）
- 狼人夜间需要协商（多个狼人投票），但有主导者（优先级最高的狼人）
- 预言家查验目标基于角色推理 + 场上未查验列表

### 4. 投票行动（Vote Action）

> 投票阶段的行动。选择投给谁。

**入口**：`generateVoteActions()` → 返回投票候选 → 加权选择 → 最终投票

**投票候选集**：
| 候选 | 说明 |
|------|------|
| `vote target`（投给某人） | 基于角色推理和局势推理选择目标 |
| `abstain`（弃权） | 极端情况（如无明确目标） |

**投票行动的特殊处理**：
- 投票是强制性的（必须投给某人，或弃权）
- 投票权重 = 角色推理概率 × 友好度修正 × 危机度修正 × 职业义务
- 狼人投票时考虑：保护队友、抗推好人、隐藏身份

## 加权选择（核心）

每个行动候选的得分由以下因素加权：

```
score = baseScore × roleBonus × situationBonus × relationBonus × personalityBonus × traitBonus × pressureBonus × proficiencyBonus
```

| 因素 | 来源 | 说明 | 权重范围 |
|------|------|------|---------|
| `baseScore` | 职业义务 | 硬约束（如预言家必须报查验） | 0~10 |
| `roleBonus` | 角色推理 | 基于角色概率的目标选择（杀高狼人概率的） | 0.5~2.0 |
| `situationBonus` | 局势推理 | 基于危机度的目标选择（保低危机度的） | 0.5~2.0 |
| `relationBonus` | 关系系统 | 基于友好度的目标选择（杀友好度低的） | 0.5~2.0 |
| `personalityBonus` | 性格系统 | 性格的行动权重修正（如好斗型 suspect×2） | 0~2.0 |
| `traitBonus` | 特质系统 | 特质的行动权重修正（如偏执 suspect×1.5） | 0.5~2.0 |
| `pressureBonus` | 压力系统 | 高压力时更激进或更保守 | 0.5~2.0 |
| `proficiencyBonus` | 擅长度（属性） | 角色属性对行动的适配度（如 eloquence 高则 chat 权重高） | 0.5~2.0 |

> **注意**：推理能力被禁用（burstCount ≥ 2）时，`roleBonus` 和 `situationBonus` 无效（=1.0），只能依赖硬信息（职业义务、关系、性格、特质）。

## 擅长度映射（Proficiency Mapping）

> **擅长度 = 角色属性与行动的匹配度。** 每个行动对应一个或多个属性，属性值越高，执行该行动的权重越高。

### 行动-属性映射表

| 行动 | 主属性 | 辅属性 | 说明 |
|------|--------|--------|------|
| `silence` | `cunning` | — | 诡诈高更善于隐藏（沉默也是伪装） |
| `claim_identity` | `eloquence` | `leadership` | 口才+领导力决定自证说服力 |
| `observe` | `observation` | `cunning` | 观察力决定发现率，诡诈决定隐蔽性 |
| `suspect` | `logic` | `eloquence` | 逻辑决定指控质量，口才决定煽动效果 |
| `defend` | `eloquence` | `affinity` | 口才+亲和决定辩护说服力 |
| `chat` | `eloquence` | `affinity` | 口才+亲和决定闲聊成功率 |
| `check`（夜间） | `observation` | — | 预言家查验依赖观察力 |
| `kill`（夜间） | `cunning` | `leadership` | 狼人击杀需要诡诈+领导力带节奏 |

### 擅长度计算

```typescript
// 单属性行动
proficiencyBonus = 0.5 + (attributeValue / 10) * 1.5
// 结果范围：0.5（属性=0）~ 2.0（属性=10）

// 双属性行动（取平均）
proficiencyBonus = 0.5 + ((attr1 + attr2) / 2 / 10) * 1.5
// 结果范围：0.5（双属性=0）~ 2.0（双属性=10）
```

**示例**：
- 口才 8、亲和 6 的角色执行 `chat`：`0.5 + ((8+6)/2 / 10) * 1.5 = 0.5 + 1.05 = 1.55`
- 观察力 3 的角色执行 `observe`：`0.5 + (3/10) * 1.5 = 0.95`
- 诡诈 9 的角色执行 `silence`：`0.5 + (9/10) * 1.5 = 1.85`

### 擅长度与判定的关系

擅长度不仅影响行动选择的权重，还直接影响**执行判定**（如 `chat` 的随机判定）：

```typescript
// chat 判定公式（含擅长度修正）
const proficiency = (eloquence + affinity) / 2; // 擅长度
const success = rand(0, proficiency * 1.5) > rand(0, pressure);
// 擅长度越高，随机范围越大，越容易超过压力基数
```

**擅长度是「能力-行动」的桥梁**：
- 选择阶段：擅高度高 → 该行动候选权重更高 → 更倾向选择
- 执行阶段：擅高度高 → 判定成功率更高 → 效果更好

## 意图与决策系统的完整数据流

```
┌────────────────────────────────────────────────────────────┐
│  输入层                                                      │
│  ├─ 角色推理 (RoleInference) → 谁是狼人/村民               │
│  ├─ 局势推理 (PlayerCrisis) → 谁最危险/最主导             │
│  ├─ 关系系统 (Relation) → 我和谁好/坏                      │
│  ├─ 性格系统 (Personality) → 我倾向做什么                  │
│  ├─ 特质系统 (Trait) → 我有什么特殊能力/限制              │
│  └─ 压力系统 (Pressure) → 我当前有多紧张                  │
├────────────────────────────────────────────────────────────┤
│  意图层                                                      │
│  ├─ 长期意图评估 → 确定当前战略目标                         │
│  └─ 短期意图生成 → 确定当前回合目标（带指向/无指向）       │
├────────────────────────────────────────────────────────────┤
│  候选层                                                      │
│  └─ 短期意图 → 生成行动候选集（ActionCandidate[]）         │
├────────────────────────────────────────────────────────────┤
│  选择层                                                      │
│  └─ 加权选择 → 综合所有因素，选出最终行动                   │
├────────────────────────────────────────────────────────────┤
│  输出层                                                      │
│  └─ 最终行动 (Action) → 执行并产生记忆                      │
└────────────────────────────────────────────────────────────┘
```

## 设计原则

1. **意图不是硬编码**：意图是基于当前推理动态生成的，不是固定规则
2. **候选集不是单一行动**：一个短期意图可以产生多个候选（如攻击A → 可以suspect A，也可以claim_identity后suspect A）
3. **加权选择是柔性的**：不是最高得分就一定选，可以引入随机因子（让AI更自然）
4. **反应行动是被动的**：不是每个回合都有，只在被触发时产生
5. **推理能力禁用时退化**：burstCount ≥ 2 时，意图系统退化为基于硬信息 + 本能（性格/特质）的决策

## 暂不实现

- 意图之间的冲突解决（如「保护队友」和「隐藏身份」冲突时）
- 意图的历史追踪（意图是否在多回合保持一致）
- 意图的欺骗性（故意产生虚假意图来误导）
- 多目标意图（同时攻击A和保护B）

## 文档索引

- [MAIN.md](MAIN.md) — 文档目录
- [MEMORY-SYSTEM.md](MEMORY-SYSTEM.md) — 记忆系统（意图的输入来源）
- [RELATION.md](RELATION.md) — 关系系统（意图的目标选择）
- [INFERENCE.md](INFERENCE.md) — 推理系统（意图的推理输入）
- [PERSONALITY.md](PERSONALITY.md) — 性格系统（意图的倾向修正）
- [PRESSURE.md](PRESSURE.md) — 压力系统（意图的紧张度修正）
- [STATE.md](STATE.md) — 状态系统（意图的能力修正）
- [TRAIT.md](TRAIT.md) — 特质系统（只影响机制）
- [ACTION.md](ACTION.md) — 动作系统（意图的最终输出）
- [ROLE-SPECIFIC.md](ROLE-SPECIFIC.md) — 角色逻辑（职业义务修正）
