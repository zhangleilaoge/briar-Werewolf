# AI 狼人杀决策系统重构设计报告
## 面具系统、行动空间扩展与心智因子解耦

> 基于当前 `briar-werewolf` 代码（`web-demo/ai-werewolf-demo`），分析现有决策流程的僵硬性问题，提出以"面具（Strategy Mask）"为核心的重构方案。
> 
> **明确要做的（本次范围）**：1. 引入面具系统 ｜ 2. 增加阻止投票生成逻辑 ｜ 5. 公布身份只允许一次  
> **待讨论（后续迭代）**：3. 跳身份时机逻辑 ｜ 4. 伪装一致性 ｜ 6. 重叠问题全面解耦

---

## 一、执行摘要

当前决策系统的核心问题是**"条件生成 + 硬约束拦截"**的组合：
- **生成端**：大量行动因 if-else 条件未满足而直接消失（如阻止投票、担保清白）
- **拦截端**：硬约束以布尔开关删除候选，无法表达"可以做但代价大"的权衡

**面具系统的核心思想**：Agent 的认知空间是"无限的"（能想到所有事），但行动选择是"有限的"（由策略、代价、局势共同决定）。面具回答的是"**我今天打算扮演什么样的人**"，而不是"**我今天只能做什么**"。

---

## 二、当前系统诊断

### 2.1 现有决策流程

```
可用行动列表（ai-agent.ts:314）
    ↓
CandidateGenerator（candidate-generator.ts）
    ├─ _generateSelfPreservation（if-else条件链）
    ├─ _generateInformationGathering（if-else条件链）
    ├─ _generateSocialManipulation（if-else条件链）
    ├─ _generateAttack（if-else条件链）
    ├─ _generateProtection（if-else条件链）
    └─ _generateDefault（兜底）
    ↓
IntentionManager.generateCandidates（intention-manager.ts:68）
    ↓
Mind Enrich（engine.ts:173）
    ├─ valueAlignment（价值观对齐）
    ├─ timingScore（时机评估）
    ├─ simulationScore（心智模拟）
    ├─ crisisFactor（危机因子）
    ├─ relationFactor（关系因子）
    ├─ socialContextBonus（社交情境加成）
    └─ capabilityFactor（能力匹配）
    ↓
Hard Constraints（hard-constraints.ts:34）
    └─ WolfNoAttackTeammateConstraint（布尔拦截）
    ↓
softmax 选择
```

### 2.2 关键问题

| 问题 | 表现 | 根因 |
|------|------|------|
| **行动消失** | 阻止投票、担保清白、袒护、号召投票、全员排除在候选中不出现 | CandidateGenerator 的 if-else 条件链未命中 |
| **硬约束僵硬** | 狼人攻击队友的候选被直接删除，无法做高身份切割 | 布尔拦截，无成本权衡 |
| **数值敏感** | "被攻击≥3次"改成2或4，游戏性完全不同 | 阈值是开关，不是渐变 |
| **策略单一** | 狼人行为模式固定，由身份危机阈值决定 | 无"主动选择策略"层 |

---

## 三、面具系统设计（核心，必须做）

### 3.1 设计理念

面具（Mask）是 Agent 在**当前回合**选择的**策略姿态**。它类似于人类玩家说的"今天我要演一个谨慎的好人"或"今天我要积极带节奏"。

面具不改变 Agent 的**能力**（什么都能做），而是改变 Agent 的**倾向**（什么更想做、什么更不想做）。

### 3.2 面具类型

```typescript
export type StrategyMask = 
  | 'conceal'      // 伪装：低调行事，像村民一样
  | 'attack'       // 进攻：积极找目标打
  | 'desperate'    // 绝境：不惜暴露也要淘汰人
  | 'cut_loss'     // 切割：牺牲队友保全自己
  | 'defensive';   // 防御：自保优先，少惹事
```

### 3.3 面具选择逻辑（Mask Selector）

每回合开始时，基于当前局势评估选择面具。

```typescript
function selectMask(
  self: Player,
  belief: BeliefSystem,
  allPlayers: Player[],
  socialContext: SocialContext
): StrategyMask {
  const aliveWolves = allPlayers.filter(p => p.team === 'werewolf' && p.alive).length;
  const aliveVillagers = allPlayers.filter(p => p.team !== 'werewolf' && p.alive).length;
  const myCrisis = belief.getIdentityCrisis();
  const teammateCrisis = Math.max(
    ...allPlayers
      .filter(p => p.id !== self.id && p.team === self.team && p.alive)
      .map(p => belief.getPlayerIdentityCrisis(p.id))
      .concat([0])
  );
  const wolfRatio = aliveWolves / (aliveWolves + aliveVillagers);

  // 优先级判断（从高到低）
  if (wolfRatio < 0.4 && myCrisis < 0.5) return 'desperate';      // 狼人大劣势，自身安全→拼命
  if (teammateCrisis > 0.8 && myCrisis < 0.5) return 'cut_loss';    // 队友快暴露了，切割
  if (myCrisis > 0.6) return 'defensive';                           // 自身被怀疑，先自保
  if (wolfRatio > 0.5) return 'attack';                             // 狼人优势，积极进攻
  return 'conceal';                                                  // 默认：潜伏伪装
}
```

### 3.4 面具-行动适配度表（MASK_COMPATIBILITY）

| 行动 | conceal | attack | desperate | cut_loss | defensive |
|------|---------|--------|-----------|----------|-----------|
| **SILENCE** | 0.90 | 0.30 | 0.10 | 0.20 | 0.80 |
| **OBSERVE** | 0.80 | 0.50 | 0.20 | 0.40 | 0.60 |
| **SUSPECT** | 0.40 | 0.90 | 0.80 | 0.70 | 0.30 |
| **ACCUSE** | 0.10 | 0.80 | 0.90 | 0.80 | 0.20 |
| **DEFEND** | 0.70 | 0.20 | 0.30 | 0.40 | 0.60 |
| **GUARANTEE** | 0.60 | 0.20 | 0.30 | 0.20 | 0.50 |
| **CALL_VOTE** | 0.20 | 0.90 | 0.90 | 0.80 | 0.30 |
| **BLOCK_VOTE** | 0.60 | 0.40 | 0.20 | 0.50 | 0.50 |
| **EXCLUDE_ALL** | 0.30 | 0.40 | 0.60 | 0.50 | 0.30 |
| **CLAIM_IDENTITY** | 0.30 | 0.60 | 0.70 | 0.40 | 0.20 |

**设计说明**：
- `conceal` 面具下：沉默(0.9)、观察(0.8)、辩护(0.7)、担保(0.6)、阻止投票(0.6) 分数高；指认(0.1)、号召投票(0.2) 分数低
- `attack` 面具下：怀疑(0.9)、指认(0.8)、号召投票(0.9) 分数高；沉默(0.3)、担保(0.2) 分数低
- `desperate` 面具下：指认(0.9)、号召投票(0.9) 分数极高；沉默(0.1) 分数极低

### 3.5 对现有模块的改造

#### CandidateGenerator（核心改造）

从 `if-else 条件链` 改为 `全行动遍历 + 面具适配度`。

```typescript
// 改造前：_generateSocialManipulation
if (self.attributes.leadership > 6 && myPosition === 'leader') {
  // 生成 CALL_VOTE
}
// 不满足条件 → CALL_VOTE 不出现

// 改造后：generate 方法
for (const action of ALL_DAY_ACTIONS) {
  const baseScore = getActionBaseScore(action); // 行动的默认意图分
  const compatibility = MASK_COMPATIBILITY[mask][action]; // 面具适配度
  const target = selectTarget(action, belief, allPlayers, self); // 动态选目标
  
  candidates.push({
    action,
    target: target?.id || null,
    score: baseScore * compatibility, // 关键：所有行动都生成，只是分数不同
    confidence: getActionConfidence(action),
    reason: getActionReason(action, mask, target?.name),
    strategy: 'CandidateGenerator',
    rule: `mask_${mask}_${action}`,
  });
}
```

**关键变化**：
1. 不再有任何行动因"条件不满足"而消失
2. 阻止投票、担保清白、袒护、号召投票、全员排除 都会出现在候选中
3. 分数差异由面具适配度决定——不是"能不能做"，而是"想不想做"

#### IntentionManager（适配改造）

意图系统不再"决定生成什么候选"，而是"**在已生成的全行动空间中，给符合意图的行动加分**"。

```typescript
// 改造前：generateCandidates 从意图生成新候选
// 改造后：intentionBonus 在已有候选中匹配并加分
function applyIntentionBonus(candidates: DecisionCandidate[], intentions: Intention[]): void {
  for (const candidate of candidates) {
    for (const intention of intentions) {
      const step = PlanLibrary.getStepForPhase(intention.plan, phase);
      if (step?.action === candidate.action) {
        candidate.score += intention.isTop ? 200 : 50;
      }
    }
  }
}
```

#### DesireEngine（适配改造）

欲望生成受面具影响，但不是"面具决定欲望"，而是"面具增强/抑制特定欲望的强度"。

```typescript
// 面具对欲望强度的影响
const MASK_DESIRE_MULTIPLIERS: Record<StrategyMask, Partial<Record<IntentionType, number>>> = {
  conceal: { CONCEAL: 1.5, ATTACK: 0.6, SURVIVE: 1.2 },
  attack: { ATTACK: 1.5, CONCEAL: 0.5, RECRUIT: 1.2 },
  desperate: { ATTACK: 1.8, SURVIVE: 0.6, CONCEAL: 0.3 },
  cut_loss: { CUT_LOSS: 2.0, ATTACK: 1.2, CONCEAL: 0.8 },
  defensive: { SURVIVE: 1.5, CONCEAL: 1.3, DEFEND: 1.2, ATTACK: 0.4 },
};
```

---

## 四、阻止投票生成逻辑（必须做）

### 4.1 当前问题

`BLOCK_VOTE` 在 `action-constants.ts` 中被定义为可用行动，但 `CandidateGenerator` 中**没有任何规则生成它**。

### 4.2 设计：阻止投票的面具适配场景

| 面具 | 场景 | 阻止投票的动机 | 适配度 |
|------|------|---------------|--------|
| **conceal** | 某村民被多人怀疑，但狼概率低 | 保护好人建立信任，伪装村民 | 0.60 |
| **conceal** | 某人被号召投票但证据不足 | 表现得理性谨慎，不随波逐流 | 0.55 |
| **attack** | 目标指向村民（狼人想保护） | 阻止好人被投出 | 0.40 |
| **cut_loss** | 队友被号召投票 | 保护队友，但风险高 | 0.50 |
| **defensive** | 自身被怀疑，阻止投票到别人身上 | 转移注意力，拖延时间 | 0.45 |

### 4.3 目标选择逻辑

阻止投票需要选择"阻止谁被投出"：

```typescript
function selectBlockVoteTarget(
  self: Player,
  belief: BeliefSystem,
  allPlayers: Player[],
  publicActions: PublicAction[],
  mask: StrategyMask
): Player | null {
  // 1. 找出被号召投票的目标
  const calledVoteTargets = publicActions
    .filter(a => a.type === ACTION.CALL_VOTE && a.targetId)
    .map(a => a.targetId);
  
  if (calledVoteTargets.length === 0) return null;
  
  // 2. 面具决定选择优先级
  const candidates = calledVoteTargets.map(targetId => {
    const target = allPlayers.find(p => p.id === targetId);
    if (!target || !target.alive) return null;
    
    const wolfProb = belief.getWerewolfProbability(targetId);
    const isTeammate = self.team === 'werewolf' && target.team === 'werewolf';
    
    let priority = 0;
    
    if (mask === 'conceal') {
      // 伪装模式下：优先保护"看起来像好人的目标"
      priority = (1 - wolfProb) * 100; // 狼概率越低越保护
    } else if (mask === 'attack') {
      // 进攻模式下：优先保护村民（阻止好人被投出）
      priority = (1 - wolfProb) * 80 + (isTeammate ? 20 : 0);
    } else if (mask === 'cut_loss') {
      // 切割模式下：优先保护队友
      priority = isTeammate ? 100 : 0;
    } else if (mask === 'defensive') {
      // 防御模式下：保护自己或高信任目标
      priority = targetId === self.id ? 100 : belief.getRelation(targetId).trust * 10;
    }
    
    return { targetId, priority };
  }).filter(Boolean);
  
  candidates.sort((a, b) => b!.priority - a!.priority);
  const top = candidates[0];
  return top ? allPlayers.find(p => p.id === top.targetId) || null : null;
}
```

### 4.4 生成后的分数示例

狼人1，面具 = `conceal`，`identityCrisis = 0.3`

```
阻止投票→村民2（被多人怀疑但狼概率0.2）
  基础分: 200
  面具适配度: 0.60
  候选分: 120
  心智加权后: 120 × 0.55 = 66
  
阻止投票→狼队友（被号召投票）
  基础分: 200
  面具适配度: 0.60
  候选分: 120
  叙事一致性: 之前没保护过队友 → 0.0
  社会风险: 保护队友 → 0.8
  心智加权后: 120 × 0.55 × (1 - 0.8 × 0.3) = 120 × 0.55 × 0.76 = 50
```

**结果**：阻止投票会出现在候选列表中，但分数通常低于沉默和观察，只有在特定局势下才会被选中。

---

## 五、公布身份限制（只允许一次）（必须做）

### 5.1 当前问题

- `CLAIM_IDENTITY` 可以多次调用
- 狼人可以先跳预言家，再改跳其他身份，导致逻辑混乱
- `BeliefSystem.l0Facts.publicClaims` 记录所有声称，但无"已声称"状态追踪

### 5.2 设计：一次性声称 + 身份锁定

#### 状态追踪

在 `AIAgent` 或 `Player` 上增加状态：

```typescript
interface IdentityClaimState {
  hasClaimed: boolean;           // 是否已经公布过身份
  claimedRole: Role | null;      // 公布的身份（如果已公布）
  claimRound: number;            // 公布回合
  isFake: boolean;               // 是否伪装（狼人跳神职为true）
}

// 在 AIAgent 中
class AIAgent {
  identityClaim: IdentityClaimState = {
    hasClaimed: false,
    claimedRole: null,
    claimRound: -1,
    isFake: false,
  };
}
```

#### 生成限制

在 `CandidateGenerator` 中：

```typescript
function generateCandidates(...): DecisionCandidate[] {
  // ... 其他行动生成
  
  // CLAIM_IDENTITY 生成逻辑
  if (!self.identityClaim?.hasClaimed) {
    // 可以生成 CLAIM_IDENTITY
    candidates.push({
      action: ACTION.CLAIM_IDENTITY,
      target: null,
      score: calculateClaimIdentityScore(self, belief, mask),
      ...
    });
  }
  // 已声称 → 不生成 CLAIM_IDENTITY
  
  return candidates;
}
```

#### 执行时锁定

在 `AIAgent.dayAction` 或 `appendixAction` 中，执行 `CLAIM_IDENTITY` 后：

```typescript
if (decision.action === ACTION.CLAIM_IDENTITY) {
  this.identityClaim.hasClaimed = true;
  this.identityClaim.claimedRole = decision.details?.claimedRole || self.role;
  this.identityClaim.claimRound = this.currentRound;
  this.identityClaim.isFake = self.team === 'werewolf' && this.identityClaim.claimedRole !== self.role;
  
  // 记录到 belief system
  this.belief.recordPublicClaim(self.id, 'identity_claim', {
    claimedRole: this.identityClaim.claimedRole,
    isFake: this.identityClaim.isFake,
  }, this.currentRound);
}
```

### 5.3 对真预言家的影响

真预言家一旦跳了身份，后续行为需要**符合预言家身份**：
- 应该提供查验结果
- 应该号召投票投查到的狼人
- 不应该沉默太多（预言家沉默很可疑）

这可以通过**面具适配度**控制：
- 已跳预言家后，`conceal` 面具的适配度降低（因为预言家已经暴露了，不需要再伪装）
- 已跳预言家后，`CLAIM_IDENTITY` 不再生成（因为已经锁了）

### 5.4 对狼人伪装的影响

狼人跳身份后，**必须维持这个身份的一致性**：
- 如果跳了预言家，需要提供"查验结果"（伪造）
- 如果跳了预言家，不能表现得像普通村民（如沉默太多）
- 这个一致性由**叙事一致性成本**控制（见第七章重叠问题分析）

---

## 六、跳身份时机与伪装一致性（设计思路，待讨论）

> **说明**：以下内容为本方案的自然延伸，但用户明确要求"先讨论"，故作为设计思路列出，不纳入本次实施范围。

### 6.1 真预言家跳身份时机

真预言家跳身份的动机随回合变化：

| 回合 | 查到了狼人 | 被对跳 | 被怀疑 | 权重 |
|------|-----------|--------|--------|------|
| 第1轮 | 否 | 否 | 否 | 0.15（极低，几乎不跳） |
| 第1轮 | **是** | 否 | 否 | 0.65（查到狼人必须跳） |
| 第2轮 | 是 | 否 | 否 | 0.55（查到狼人越早跳越好） |
| 任意 | 是 | **是** | 否 | 0.85（被对跳必须反跳） |
| 任意 | 否 | 否 | **是** | 0.35（被怀疑时跳可自证，但风险高） |
| 任意 | 否 | 否 | 否 | 0.10（没查到狼人跳什么） |

**实现方式**：这个权重不是硬编码，而是通过面具系统的**时机评估**（TimingEvaluator）和**危机因子**（CrisisFactor）自然体现。例如：
- 查到狼人 → `informationState` 中增加高 urgency 的 gap → `timingScore` 上升
- 被对跳 → `identityCrisis` 上升 → `crisisFactor` 影响

### 6.2 狼人伪装跳身份时机

狼人伪装预言家的动机：

| 局势 | 权重 | 说明 |
|------|------|------|
| 真预言家已跳，且可信 | 0.50 | 考虑对跳，但风险高 |
| 真预言家已跳，但可疑 | 0.75 | 对跳成功率更高 |
| 无预言家跳，想带节奏 | 0.40 | 主动跳可控制局势 |
| 攻击面具下 | 0.60 | 进攻时需要身份支撑 |
| 队友被集火，需要转移 | 0.55 | 跳身份转移焦点 |

### 6.3 伪装一致性

狼人跳预言家后，需要维持"预言家"的行为模式：

```typescript
// 已跳预言家的行为约束（软性）
function calculateFakeConsistencyCost(
  action: string,
  claimedRole: Role,
  publicActions: PublicAction[]
): number {
  if (claimedRole !== 'prophet') return 0;
  
  const consistencyRules: Record<string, number> = {
    [ACTION.SILENCE]: 0.4,       // 预言家沉默太多 → 可疑
    [ACTION.ACCUSE]: 0.1,       // 预言家指认 → 合理（提供了查验结果）
    [ACTION.SUSPECT]: 0.2,      // 预言家怀疑 → 合理
    [ACTION.CALL_VOTE]: 0.0,    // 预言家号召投票 → 合理
    [ACTION.DEFEND]: 0.3,       // 预言家辩护 → 需要解释为什么
    [ACTION.OBSERVE]: 0.5,      // 预言家观察 → 可疑（预言家应该查人不是观察）
  };
  
  return consistencyRules[action] || 0;
}
```

这个一致性成本作为**心智因子**的一部分，降低不符合伪装身份的行为分数。

---

## 七、重叠问题：面具选择 vs 心智加权（分析与解决）

### 7.1 问题描述

用户提出的重叠问题：

> "我感觉现在的新流程系统，有些判定之类的是重叠的，比如面具选择和心智加权"

**确实存在重叠，但重叠的维度不同。** 让我逐一分析：

### 7.2 重叠点分析

| 系统 | 评估维度 | 当前问题 | 是否重叠 |
|------|---------|---------|---------|
| **面具选择** | "我今天的策略是什么？" | 决定基础行为倾向 | 基准层 |
| **价值观对齐** | "我的性格是否支持这个行动？" | 从性格角度评估同一行为 | ⚠️ 与面具部分重叠 |
| **时机评估** | "现在做这件事合适吗？" | 从局势时机评估 | ✅ 不重叠 |
| **危机因子** | "我有多紧急？" | 从紧急程度评估 | ⚠️ 与面具选择部分重叠（面具选择已考虑危机） |
| **关系因子** | "我和目标的关系如何？" | 从人际关系评估 | ✅ 不重叠 |
| **心智模拟** | "别人会怎么反应？" | 从他人反应评估 | ✅ 不重叠 |
| **能力匹配** | "我擅长做这个吗？" | 从属性能力评估 | ✅ 不重叠 |

### 7.3 核心重叠：面具选择 vs 价值观对齐 vs 危机因子

这三个系统都在回答"**这个行动是否合适我**"：
- 面具选择：从**当前策略**角度回答
- 价值观对齐：从**长期性格**角度回答
- 危机因子：从**紧急程度**角度回答

当 Agent 选择 `conceal` 面具时，面具系统已经推高了"沉默"的分数。同时：
- 价值观对齐中，`SILENCE` 的 `selfPreservation` 签名也高 → 再次推高沉默
- 危机因子中，如果 `identityCrisis` 高，`CRISIS_FACTOR_SILENCE_CRITICAL = 1.5` → 再次推高沉默

**三个系统同时推高同一个行动，这就是重叠。**

### 7.4 解决方案：分层解耦

将心智因子重新分层，每个层回答不同的问题：

```
Layer 1: 策略层（面具）        → "我今天的策略是什么？"
Layer 2: 人格层（价值观对齐）   → "我的性格是什么样的？"
Layer 3: 局势层（时机/危机/关系）→ "当前局势如何？"
Layer 4: 模拟层（心智模拟）     → "别人会怎么反应？"
Layer 5: 能力层（能力匹配）     → "我做得到吗？"
```

#### 改造 1：面具适配度作为基础分乘数（替代部分价值观对齐）

```typescript
// 改造前：
const baseScore = (c.score || 0) + (c.intentionDrivenBonus || 0) + (c.stageWeight || 0) + mods.total;
const mindMultiplier = 
  (MIND_MULTIPLIER_BASE + MIND_MULTIPLIER_SCALE * valueAlignment) *  // 价值观对齐
  (0.5 + 0.5 * timingScore) *                                          // 时机
  (0.5 + 0.5 * simulationScore) *                                     // 模拟
  crisisFactor *                                                       // 危机
  relationFactor *                                                     // 关系
  (0.8 + 0.2 * socialContextBonus) *                                  // 社交
  capabilityFactor;                                                    // 能力

// 改造后：
const maskCompatibility = MASK_COMPATIBILITY[mask][c.action]; // 0.0-1.0
const personalityAlignment = calculatePersonalityAlignment(c.action, valueSystem); // 人格一致性（替代价值观对齐）
const situationalFactor = 
  (0.5 + 0.5 * timingScore) *
  crisisFactor *
  relationFactor *
  (0.8 + 0.2 * socialContextBonus) *
  capabilityFactor;

const mindMultiplier = 
  (0.3 + 0.7 * maskCompatibility) *      // 策略层权重最高（0.7）
  (0.7 + 0.3 * personalityAlignment) *   // 人格层权重降低（0.3）
  situationalFactor *                    // 局势层
  (0.5 + 0.5 * simulationScore);        // 模拟层
```

**关键变化**：
- `maskCompatibility` 权重最高（0.7），因为面具直接反映当前策略
- `personalityAlignment` 权重降低（0.3），它只负责"性格一致性"，不重复策略评估
- `valueAlignment` 被替换为 `personalityAlignment`，只评估"这个行动是否符合我的长期性格"

#### 改造 2：危机因子与面具选择的解耦

当前面具选择已经考虑了 `identityCrisis`（`myCrisis > 0.6 → defensive`）。危机因子也根据 `identityCrisis` 调整分数。

**解决方案**：面具选择决定"策略方向"，危机因子只调整"策略执行强度"。

```typescript
// 面具选择时：identityCrisis 决定面具类型
if (myCrisis > 0.6) mask = 'defensive';

// 心智因子中：危机因子只影响当前面具下的行动强度
// 例如 defensive 面具下，危机因子进一步推高防御行动
// 但不再改变面具本身（面具已经由选择阶段决定）
```

#### 改造 3：价值观对齐改为"人格一致性"

将 `calculateValueAlignment` 从"评估行动是否好"改为"评估行动是否符合性格"：

```typescript
// 改造前：价值观对齐（评估行动好坏）
function calculateValueAlignment(action: string, valueSystem: ValueSystem): number {
  // 点积计算：价值观与行动签名的匹配度
}

// 改造后：人格一致性（评估行动是否符合性格）
function calculatePersonalityAlignment(action: string, valueSystem: ValueSystem): number {
  // 只评估"性格特质"的匹配度，不评估策略优劣
  // 例如：一个 deception 高的狼人，即使选择 conceal 面具，
  // 他的欺骗行为仍然符合人格，所以人格一致性高
  // 但这不影响 conceal 面具对欺骗行为的低适配度
}
```

### 7.5 解耦后的新心智因子公式

```typescript
const mindMultiplier = 
  // 策略层（权重最高）
  (0.2 + 0.8 * maskCompatibility) *                    
  // 人格层（权重中等）
  (0.6 + 0.4 * personalityAlignment) *                 
  // 局势层（时机 + 危机 + 关系 + 社交）
  (0.5 + 0.5 * timingScore) *                          
  (0.5 + 0.5 * crisisFactor) *                         // 危机因子改为0.5+0.5*，避免极端
  relationFactor *                                     
  (0.8 + 0.2 * socialContextBonus) *                  
  // 能力层
  capabilityFactor *                                   
  // 模拟层
  (0.5 + 0.5 * simulationScore);                       
```

**设计说明**：
- `maskCompatibility` 是 0-1 的值，0.2 + 0.8 * 确保即使适配度为0，也有0.2的基础（不会完全删除）
- `personalityAlignment` 权重降到0.4，避免与面具重叠
- `crisisFactor` 从直接乘数改为 `0.5 + 0.5 *`，避免极端值（如 1.5 或 0.5）过度影响

---

## 八、实施路线图

### 阶段一：引入面具系统（本次核心）

| 文件 | 改动 | 工作量 |
|------|------|--------|
| `src/lib/ai/mask/`（新建目录） | 面具类型定义、选择逻辑、适配度表 | 中 |
| `src/lib/ai/mind/candidate-generator.ts` | 从 if-else 条件链改为全行动遍历 + 面具适配度 | **大** |
| `src/lib/ai/intention/intention-manager.ts` | `generateCandidates` 改为在全行动空间中加分 | 中 |
| `src/lib/ai/intention/desire-engine.ts` | 欲望强度受面具影响 | 小 |
| `src/lib/ai/strategies/engine.ts` | 每回合开始时调用面具选择 | 小 |

### 阶段二：增加阻止投票（本次）

| 文件 | 改动 | 工作量 |
|------|------|--------|
| `src/lib/ai/mind/candidate-generator.ts` | 增加 `BLOCK_VOTE` 的目标选择和分数计算 | 小 |
| `src/lib/ai/mind/social-context.ts` | `InformationState` 中增加被号召投票的目标追踪 | 小 |

### 阶段三：公布身份限制（本次）

| 文件 | 改动 | 工作量 |
|------|------|--------|
| `src/types/core.ts` | `Player` 或 `AIAgent` 增加 `IdentityClaimState` | 小 |
| `src/lib/ai/ai-agent.ts` | 执行 `CLAIM_IDENTITY` 时锁定状态 | 小 |
| `src/lib/ai/mind/candidate-generator.ts` | 已声称时不再生成 `CLAIM_IDENTITY` | 小 |
| `src/lib/game/simulator-core.ts` | 游戏层验证：已声称的玩家不能再声称 | 小 |

### 阶段四：心智因子解耦（待讨论）

| 文件 | 改动 | 工作量 |
|------|------|--------|
| `src/lib/ai/mind/value-system.ts` | `calculateValueAlignment` → `calculatePersonalityAlignment` | 中 |
| `src/lib/ai/strategies/engine.ts` | 心智因子公式调整权重 | 小 |
| `src/lib/ai/mind/factor-calculators.ts` | 危机因子计算逻辑调整 | 小 |

### 阶段五：跳身份时机与伪装一致性（待讨论）

| 文件 | 改动 | 工作量 |
|------|------|--------|
| `src/lib/ai/mind/timing-evaluation.ts` | 增加预言家跳身份的时机评估 | 中 |
| `src/lib/ai/belief-system.ts` | 增加"公开叙事"追踪 | 中 |
| `src/lib/ai/mind/candidate-generator.ts` | 增加伪装一致性的成本计算 | 中 |

---

## 九、关键设计决策（需要用户确认）

### 决策 1：面具是否允许混合？

选项 A：**单面具**（当前设计）——每回合只选一个面具，简单清晰  
选项 B：**多面具加权**——例如 70% conceal + 30% attack，行为更连续但计算复杂

**建议**：选 A（单面具），后续如果需要再扩展为 B。

### 决策 2：面具选择是否对玩家可见？

选项 A：**可见**——在调试面板显示当前面具，方便观察 Agent 策略  
选项 B：**不可见**——面具是内部状态，只通过行为体现

**建议**：选 A，因为当前系统已经有调试面板显示意图栈，面具可以作为意图栈的补充信息。

### 决策 3：阻止投票的生成是否仅限于"有号召投票时"？

选项 A：**仅限有号召投票时**——阻止投票只在有人号召投票时生成（更合理）  
选项 B：**始终生成**——阻止投票作为通用行动始终生成，但分数通常很低

**建议**：选 A，因为阻止投票没有目标时语义不清。但生成逻辑中，如果没有号召投票，BLOCK_VOTE 的基础分设为0（即不生成）。

### 决策 4：心智因子解耦是否纳入本次？

选项 A：**纳入**——一次性把权重调整好，避免后续返工  
选项 B：**不纳入**——先上面具，观察效果后再调心智因子权重

**建议**：选 B，心智因子解耦是优化项，不是阻塞项。先验证面具系统是否解决了"行动消失"问题。

---

## 十、总结

### 本次明确要做的（3项）

1. **引入面具系统**：每回合选择 `conceal/attack/desperate/cut_loss/defensive`，所有行动都生成，分数由面具适配度决定
2. **增加阻止投票**：在有人号召投票时生成，面具决定阻止谁的动机和分数
3. **公布身份只允许一次**：增加 `IdentityClaimState` 锁定，已声称后不再生成 `CLAIM_IDENTITY`

### 待讨论（3项）

4. **跳身份时机**：真预言家查到狼人/被对跳时权重上升；狼人想进攻/转移焦点时权重上升
5. **伪装一致性**：已跳身份后，行为需要符合身份（软性约束，通过心智因子实现）
6. **心智因子解耦**：面具适配度替代部分价值观对齐，降低危机因子权重，避免多系统同时推高同一行为

### 预期效果

- **行动不再消失**：阻止投票、担保、袒护、号召投票等都会出现在候选中
- **行为更自然**：不是"满足条件才能做"，而是"代价高所以不做"
- **策略更丰富**：同一狼人在不同回合可以选择不同面具，行为模式变化
- **数值不敏感**：面具适配度是连续值，即使参数偏差也只是"频率变化"而非"行为开关"

---

> 报告生成时间：基于 `briar-werewolf` 当前代码分析（`web-demo/ai-werewolf-demo/src/lib/ai/`）  
> 涉及文件：ai-agent.ts, engine.ts, candidate-generator.ts, intention-manager.ts, desire-engine.ts, plan-library.ts, hard-constraints.ts, social-context.ts, value-system.ts, belief-system.ts, action-constants.ts, mind/constants.ts, strategy-thresholds.ts
