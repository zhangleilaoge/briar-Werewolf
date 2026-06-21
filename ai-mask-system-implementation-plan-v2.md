# AI 狼人杀决策系统重构实施计划
## 通用化面具系统 + 阻止投票 + 身份限制

> 确认项：面具单选、调试可见、阻止投票仅限有号召投票时、心智解耦延后
>
> 补充项：预言家没查到狼人也可以发金水（查验为村民的结果公开）
>
> **核心修正**：面具选择不是独立的状态，而是**局势的实时映射**。`selectMask` 的输入是 `belief` + `socialContext`，输出是局势的粗粒度抽象。它不是"抛开局势定策略"，而是"局势决定策略"。
>
> **游戏日志展示**：所有改动完成后，需要在游戏日志/调试面板中展示面具相关信息。

---

## 一、核心设计：通用化面具框架

### 1.0 面具与局势的关系

**正确的层顺序：局势 → 策略 → 人格 → 评估 → 行动**

```
Layer 1: 局势感知层（Situation Perception）
  输入: belief, socialContext, publicActions
  输出: identityCrisis, wolfRatio, tensionLevel, trustedBeingAttacked...
       ↓
Layer 2: 策略层（Strategy / Mask Selection）
  输入: 粗粒度局势特征
  输出: StrategyMask（7个面具之一）
       ↓
Layer 3: 人格层（Personality Alignment）
  输入: 长期性格（ValueSystem）+ 当前策略
  输出: 性格一致性分数
       ↓
Layer 4: 局势评估层（Situational Evaluation）
  输入: 细粒度局势特征（具体时机、目标信任度、社交位置）
  输出: timingScore, crisisFactor, relationFactor, socialContextBonus
       ↓
Layer 5: 模拟层（Simulation）
  输入: 预测他人反应
  输出: simulationScore
       ↓
Action: 最终行动选择
```

**为什么策略在人格之前？**

策略（面具）是"**当前局势下我决定扮演什么**"，人格是"**我的性格是否支持这种扮演**"。

举例：一个 `chaotic-evil` 村民（人格：欺骗高）在当前局势下选择 `conceal`（策略：低调潜伏）。
- Layer 2 决定：今天我要低调（`conceal`）
- Layer 3 评估：但我的性格是混乱邪恶，伪装行为的人格一致性分数低
- 结果：这个村民虽然选了 `conceal`，但因为人格不匹配，分数会被适当压低

**关键区分**：
- **Layer 1 局势感知**：收集所有客观事实
- **Layer 2 策略选择**：基于粗粒度局势特征决定策略方向（分类器）
- **Layer 3 人格对齐**：评估策略与长期性格的匹配度
- **Layer 4 局势评估**：评估具体行动在当前细粒度局势中的适配度
- **Layer 5 模拟**：预测他人反应

**不是重叠**，而是**逐层递进**。

---

## 一、核心设计：通用化面具框架

### 1.1 面具选择（回合初，所有身份通用）

```typescript
type StrategyMask = 'conceal' | 'manipulative' | 'attack' | 'desperate' | 'cut_loss' | 'protective' | 'defensive';

function selectMask(self, belief, allPlayers, socialContext): StrategyMask {
  const aliveWolves = ...;
  const aliveVillagers = ...;
  const myCrisis = belief.getIdentityCrisis();
  const teammateCrisis = ...;
  const wolfRatio = aliveWolves / (aliveWolves + aliveVillagers);
  const trustedBeingAttacked = allPlayers.filter(p => 
    p.id !== self.id && p.alive && isBeingAttacked(p.id, publicActions) && belief.getRelation(p.id).trust > 3
  );

  // 优先级判断（从高到低，所有身份通用）
  if (trustedBeingAttacked.length > 0 && myCrisis < 0.5) return 'protective'; // 信任目标被攻击 → 保护
  if (wolfRatio < 0.4 && myCrisis < 0.5) return 'desperate';   // 大劣势+自身安全 → 拼命
  if (teammateCrisis > 0.8 && myCrisis < 0.5) return 'cut_loss'; // 队友快暴露 → 切割
  if (myCrisis > 0.6) return 'defensive';                       // 自身被怀疑 → 防御
  if (socialContext.situation.tensionLevel > 0.7 && myCrisis < 0.4) return 'manipulative'; // 场面混乱，可搅局
  if (wolfRatio > 0.5) return 'attack';                         // 优势 → 进攻
  return 'conceal';                                              // 默认潜伏
}
```

**注意**：面具选择基于**局势**（人数比、危机值、信任目标被攻击等），**不是独立的状态**。它是对 `belief` + `socialContext` 的**粗粒度抽象**，把高维连续局势压缩成一个离散策略标签。预言家也可以选 `protective`（信任目标被攻击），狼人也可以选 `conceal`（默认潜伏）。

### 1.2 面具-行动适配度（通用，不区分身份）

| 行动 | conceal | **manipulative** | attack | desperate | cut_loss | **protective** | defensive |
|------|---------|-----------------|--------|-----------|----------|---------------|-----------|
| **SILENCE** | 0.90 | 0.40 | 0.30 | 0.10 | 0.20 | 0.30 | 0.80 |
| **OBSERVE** | 0.80 | 0.70 | 0.50 | 0.20 | 0.40 | 0.50 | 0.60 |
| **SUSPECT** | 0.40 | 0.80 | 0.90 | 0.80 | 0.70 | 0.40 | 0.30 |
| **ACCUSE** | 0.10 | 0.60 | 0.80 | 0.90 | 0.80 | 0.20 | 0.20 |
| **DEFEND** | 0.70 | 0.50 | 0.20 | 0.30 | 0.40 | **0.90** | 0.60 |
| **GUARANTEE** | 0.60 | 0.40 | 0.20 | 0.30 | 0.20 | **0.85** | 0.50 |
| **CALL_VOTE** | 0.20 | 0.80 | 0.90 | 0.90 | 0.80 | 0.50 | 0.30 |
| **BLOCK_VOTE** | 0.60 | 0.50 | 0.40 | 0.20 | 0.50 | **0.80** | 0.50 |
| **EXCLUDE_ALL** | 0.30 | **0.70** | 0.40 | 0.60 | 0.50 | 0.30 | 0.30 |
| **CLAIM_IDENTITY** | 0.30 | 0.50 | 0.60 | 0.70 | 0.40 | 0.40 | 0.20 |

**不区分身份**：所有身份的面具适配度相同。预言家选 `conceal` 时沉默分高，狼人选 `conceal` 时沉默分也高。差异由**身份特定的目标选择**和**身份特定的基础分**体现。

### 1.3 身份分类：按信息能力分层

```typescript
type IdentityCategory = 'strong_info' | 'weak_info' | 'no_info';

const ROLE_CATEGORIES: Record<Role, IdentityCategory> = {
  prophet: 'strong_info',    // 查验：每晚查一人身份
  coroner: 'strong_info',    // 验尸：知道死亡玩家信息
  hunter: 'weak_info',       // 被动：死亡时带走一人
  thief: 'weak_info',        // 偷取：获得额外信息/道具
  villager: 'no_info',       // 无特殊信息
  werewolf: 'no_info',       // 知道队友，但信息对外不可说
  lone_wolf: 'no_info',      // 独狼，无队友信息
  berserker: 'no_info',      // 狂战士，双刃剑
};
```

**身份分类只影响两件事**：
1. `CLAIM_IDENTITY` 的基础分（强信息角色更有动力跳）
2. `CLAIM_IDENTITY` 后的行为一致性（强信息角色需要持续提供信息）

### 1.4 跳身份逻辑的通用化

**所有身份共用同一个触发条件表**，只是权重不同：

```typescript
interface IdentityClaimTriggers {
  hasHardInfo: number;       // 有硬信息要公开（预言家查到狼/金水、验尸官验出结果）
  beingCounterClaimed: number; // 有人对跳你的身份
  beingSuspected: number;    // 被严重怀疑，需要自证
  baseWeight: number;        // 无特殊原因时的基础权重
}

const IDENTITY_CLAIM_TRIGGERS: Record<IdentityCategory, IdentityClaimTriggers> = {
  strong_info: { hasHardInfo: 0.65, beingCounterClaimed: 0.85, beingSuspected: 0.35, baseWeight: 0.10 },
  weak_info:   { hasHardInfo: 0.25, beingCounterClaimed: 0.60, beingSuspected: 0.40, baseWeight: 0.05 },
  no_info:     { hasHardInfo: 0.00, beingCounterClaimed: 0.00, beingSuspected: 0.15, baseWeight: 0.02 },
};

// 狼人伪装跳身份（任何身份都可伪装）
const FAKE_IDENTITY_CLAIM_TRIGGERS: Record<IdentityCategory, IdentityClaimTriggers> = {
  strong_info: { hasHardInfo: 0.50, beingCounterClaimed: 0.70, beingSuspected: 0.00, baseWeight: 0.30 },
  weak_info:   { hasHardInfo: 0.30, beingCounterClaimed: 0.50, beingSuspected: 0.00, baseWeight: 0.20 },
  no_info:     { hasHardInfo: 0.00, beingCounterClaimed: 0.00, beingSuspected: 0.00, baseWeight: 0.00 },
};
```

**预言家"没查到狼人也可以发金水"**：
- `hasHardInfo` 不只是"查到狼人"，而是"有查验结果"
- 查验结果为 `villager`（金水）也是硬信息，可以发
- 权重略低于查杀（`0.65` vs `0.45`），但仍然值得跳

```typescript
function hasHardInfo(self: Player, belief: BeliefSystem): { value: boolean; result?: 'werewolf' | 'villager' } {
  if (self.role === 'prophet') {
    const checks = Object.entries(belief.l0Facts.checks);
    const unrevealedCheck = checks.find(([targetId, result]) => {
      // 还没公开过的查验结果
      const alreadyClaimed = belief.l0Facts.publicClaims.some(
        c => c.playerId === self.id && c.claim === 'prophet_check' && (c.content as any).targetId === targetId
      );
      return !alreadyClaimed;
    });
    if (unrevealedCheck) {
      return { value: true, result: unrevealedCheck[1] };
    }
  }
  // 验尸官逻辑类似...
  return { value: false };
}
```

---

## 二、本次实施范围（3项）

### 项1：引入面具系统

#### 2.1.1 新建文件：`src/lib/ai/mask/types.ts`

```typescript
export type StrategyMask = 'conceal' | 'manipulative' | 'attack' | 'desperate' | 'cut_loss' | 'protective' | 'defensive';

export interface MaskState {
  currentMask: StrategyMask;
  selectedRound: number;
  selectionReason: string;
}

export interface MaskCompatibilityEntry {
  action: string;
  compatibility: Record<StrategyMask, number>; // 0.0-1.0
}
```

#### 2.1.2 新建文件：`src/lib/ai/mask/mask-selector.ts`

```typescript
export function selectMask(
  self: Player,
  belief: BeliefSystem,
  allPlayers: Player[],
  socialContext: SocialContext,
  round: number
): { mask: StrategyMask; reason: string };

export const MASK_COMPATIBILITY: Record<string, Record<StrategyMask, number>>;
// 所有行动的适配度表
```

#### 2.1.3 修改：`src/lib/ai/mind/candidate-generator.ts`

```typescript
export class CandidateGenerator {
  generate(
    socialContext: SocialContext,
    valueSystem: ValueSystem,
    self: Player,
    allPlayers: Player[],
    belief: BeliefSystem,
    mask: StrategyMask,           // 新增参数
    isWerewolf?: boolean
  ): DecisionCandidate[] {
    const candidates: DecisionCandidate[] = [];

    // 遍历所有可用行动，不是 if-else 条件链
    for (const actionType of ALL_DAY_ACTIONS) {
      const baseScore = this._getActionBaseScore(actionType, self, belief);
      const compatibility = MASK_COMPATIBILITY[actionType][mask];
      const target = this._selectTarget(actionType, self, belief, allPlayers, mask, socialContext);
      
      // 某些行动需要特定条件才生成（如 BLOCK_VOTE 需要有人号召投票）
      if (this._isActionAvailable(actionType, self, belief, allPlayers, socialContext, mask)) {
        candidates.push({
          action: actionType,
          target: target?.id || null,
          score: baseScore * compatibility,  // 关键：所有行动都生成
          confidence: this._getActionConfidence(actionType),
          reason: this._getActionReason(actionType, mask, target),
          strategy: 'CandidateGenerator',
          rule: `mask_${mask}_${actionType}`,
          maskCompatibility: compatibility,   // 新增字段，供调试
        });
      }
    }
    
    return candidates;
  }
  
  // BLOCK_VOTE 可用条件：有人号召投票
  private _isActionAvailable(actionType: string, ..., socialContext: SocialContext, mask: StrategyMask): boolean {
    if (actionType === ACTION.BLOCK_VOTE) {
      const hasCallVote = socialContext.informationState.knownFacts.some(
        f => f.type === 'action' && (f.content as any).type === ACTION.CALL_VOTE
      );
      return hasCallVote;
    }
    // CLAIM_IDENTITY 可用条件：还没声称过
    if (actionType === ACTION.CLAIM_IDENTITY) {
      return !self.identityClaim?.hasClaimed;
    }
    // 其他行动默认可用
    return true;
  }
}
```

#### 2.1.4 修改：`src/lib/ai/intention/intention-manager.ts`

```typescript
export class IntentionManager {
  // generateCandidates 改为：在已有候选中匹配意图并加分
  generateCandidates(
    phase: string,
    allPlayers: Player[],
    self: Player,
    existingCandidates: DecisionCandidate[]  // 新增参数：全行动空间
  ): DecisionCandidate[] {
    const activeIntentions = this.getActiveIntentions().filter(
      (i) => i.plan.some((s) => s.phase === phase)
    );

    for (const intention of activeIntentions) {
      const step = PlanLibrary.getStepForPhase(intention.plan, phase);
      if (!step?.action) continue;
      
      // 在已有候选中查找匹配的行动
      const matchingCandidate = existingCandidates.find(
        c => c.action === step.action
      );
      
      if (matchingCandidate) {
        // 加分，而不是生成新候选
        matchingCandidate.score += intention.isTop ? 200 : 50;
        matchingCandidate.intentionDrivenBonus = intention.isTop ? 200 : 50;
      } else {
        // 如果全行动空间中没有这个行动（极少数情况），再生成
        // ... 原生成逻辑作为兜底
      }
    }
    
    return existingCandidates;
  }
}
```

#### 2.1.5 修改：`src/lib/ai/strategies/engine.ts`

```typescript
export class DecisionEngine {
  decide(...) {
    // ... 原有逻辑
    
    // === 阶段0：面具选择（新增）===
    const maskState = this._selectMask(self, belief, allPlayers, socialContext, this.currentRound);
    
    // === 阶段1：全行动空间生成（改造）===
    const candidateGenerator = new CandidateGenerator();
    const universalCandidates = candidateGenerator.generate(
      socialContext, valueSystem, self, allPlayers, belief, maskState.currentMask
    );
    
    // === 阶段2：意图驱动加权（改造）===
    if (intentionManager) {
      intentionManager.generateCandidates(phase, allPlayers, self, universalCandidates);
    }
    
    candidates.push(...universalCandidates);
    
    // ... 后续心智加权、选择逻辑不变
  }
  
  private _selectMask(...) {
    const { mask, reason } = selectMask(self, belief, allPlayers, socialContext, round);
    return { currentMask: mask, selectedRound: round, selectionReason: reason };
  }
}
```

#### 2.1.6 修改：`src/lib/ai/intention/desire-engine.ts`

```typescript
export class DesireEngine {
  generateDesires(..., mask: StrategyMask = 'conceal'): Desire[] {  // 新增 mask 参数
    const desires: Desire[] = [];
    
    // 面具影响欲望强度
    const maskMultipliers = MASK_DESIRE_MULTIPLIERS[mask];
    
    // === ROLE_DUTY ===
    if (self.role === 'prophet') {
      // ... 原有逻辑
      // 欲望强度乘以面具倍率
      strength *= (maskMultipliers[REVEAL] || 1.0);
    }
    
    // === TEAM_DUTY ===
    if (self.team === 'werewolf') {
      const modeAttackBase = mask === 'desperate' ? INTENTION_MODE_ATTACK_DESPERATE
        : mask === 'attack' ? INTENTION_MODE_ATTACK_DOMINANT
        : INTENTION_MODE_ATTACK_NORMAL;
      // ...
    }
    
    // ... 其他欲望
    
    return desires;
  }
}
```

### 项2：增加阻止投票生成逻辑

已在 2.1.3 的 `_isActionAvailable` 中实现。补充目标选择逻辑：

#### 2.2.1 新建/修改：`src/lib/ai/mind/target-selectors.ts`（或放在 candidate-generator.ts 中）

```typescript
function selectBlockVoteTarget(
  self: Player,
  belief: BeliefSystem,
  allPlayers: Player[],
  socialContext: SocialContext,
  mask: StrategyMask
): Player | null {
  // 1. 找出被号召投票的目标
  const calledVoteTargets = socialContext.informationState.knownFacts
    .filter(f => f.type === 'action' && (f.content as any).type === ACTION.CALL_VOTE)
    .map(f => (f.content as any).targetId)
    .filter(Boolean);
  
  if (calledVoteTargets.length === 0) return null;
  
  // 2. 按面具优先级排序
  const candidates = calledVoteTargets.map(targetId => {
    const target = allPlayers.find(p => p.id === targetId);
    if (!target || !target.alive) return null;
    
    const wolfProb = belief.getWerewolfProbability(targetId);
    const isTeammate = self.team === 'werewolf' && target.team === 'werewolf';
    
    let priority = 0;
    switch (mask) {
      case 'conceal':
        // 伪装：保护"看起来像好人"的目标（建立信任）
        priority = (1 - wolfProb) * 100;
        break;
      case 'manipulative':
        // 操纵：保护高价值目标以建立信任网络
        priority = (1 - wolfProb) * 60 + belief.getRelation(targetId).trust * 5;
        break;
      case 'attack':
        // 进攻：保护村民（狼人想保好人以做高身份）
        priority = (1 - wolfProb) * 80 + (isTeammate ? 20 : 0);
        break;
      case 'cut_loss':
        // 切割：优先保护队友
        priority = isTeammate ? 100 : 0;
        break;
      case 'protective':
        // 保护：优先保护被攻击的信任目标，其次保护队友
        priority = belief.getRelation(targetId).trust * 15 + (isTeammate ? 30 : 0);
        break;
      case 'defensive':
        // 防御：保护自己或高信任目标
        priority = targetId === self.id ? 100 : belief.getRelation(targetId).trust * 10;
        break;
      case 'desperate':
        // 绝境：不在乎了，不阻止
        priority = 0;
        break;
    }
    
    return { targetId, priority };
  }).filter(Boolean) as { targetId: string; priority: number }[];
  
  candidates.sort((a, b) => b.priority - a.priority);
  const top = candidates[0];
  return top ? allPlayers.find(p => p.id === top.targetId) || null : null;
}
```

### 项3：公布身份只允许一次

#### 2.3.1 修改：`src/types/core.ts`

```typescript
export interface Player {
  id: string;
  name: string;
  role: Role;
  team: Team;
  alive: boolean;
  items: ItemInstance[];
  attributes: Attributes;
  alignment: Alignment;
  traits: string[];
  stress: number;
  relations: Record<string, Relation>;
  identityCrisis?: number;
  suspicionByOthers?: Record<string, number>;
  identityCrisisLog?: { reason: string; delta: number; before: number; after: number; timestamp: number }[];
  
  // 新增：身份声称状态
  identityClaim?: {
    hasClaimed: boolean;
    claimedRole: Role | null;
    claimRound: number;
    isFake: boolean;  // 是否伪装（狼人跳神职为true）
  };
}
```

#### 2.3.2 修改：`src/lib/ai/ai-agent.ts`

```typescript
export class AIAgent {
  // ... 原有字段
  
  // 新增：面具状态
  maskState: MaskState = {
    currentMask: 'conceal',
    selectedRound: -1,
    selectionReason: 'initial',
  };
  
  constructor(...) {
    // ... 原有初始化
    
    // 初始化身份声称状态
    if (this.player) {
      this.player.identityClaim = {
        hasClaimed: false,
        claimedRole: null,
        claimRound: -1,
        isFake: false,
      };
    }
  }
  
  dayAction(...) {
    // ... 原有逻辑
    
    // 面具选择（每回合初）
    const { mask, reason } = selectMask(this.player!, this.belief, allPlayers, socialContext, this.currentRound);
    this.maskState = { currentMask: mask, selectedRound: this.currentRound, selectionReason: reason };
    
    // 决策时传入 mask
    const decision = this.engine.decide(
      this.belief, this.player!, 'day', availableActions, allPlayers, 
      [], publicActions, consecutiveSilence, aliveCount, 1, undefined, undefined, 
      this.intentionManager, this.maskState.currentMask  // 新增 mask 参数
    );
    
    // 执行 CLAIM_IDENTITY 后锁定
    if (decision.action === ACTION.CLAIM_IDENTITY) {
      this.player!.identityClaim = {
        hasClaimed: true,
        claimedRole: decision.details?.claimedRole || this.player!.role,
        claimRound: this.currentRound,
        isFake: this.player!.team === 'werewolf' && (decision.details?.claimedRole !== this.player!.role),
      };
      
      this.belief.recordPublicClaim(this.player!.id, 'identity_claim', {
        claimedRole: this.player!.identityClaim.claimedRole,
        isFake: this.player!.identityClaim.isFake,
      }, this.currentRound);
    }
    
    this._advanceIntentionIfMatch(decision, 'day');
    return decision;
  }
}
```

#### 2.3.3 修改：`src/lib/game/simulator-core.ts`（或行动执行层）

```typescript
// 在执行 CLAIM_IDENTITY 前验证
function validateClaimIdentity(player: Player, claimedRole: Role): boolean {
  if (player.identityClaim?.hasClaimed) {
    // 已声称过，不能再声称
    return false;
  }
  return true;
}
```

#### 2.3.4 修改：`src/components/game/DecisionProcessView.tsx`（调试面板）

参考现有"意图状态"格式，增加"策略状态"展示：

```typescript
// 在【意图状态】同级增加【策略状态】
{decision.process?.mask && (
  <div className="mask-state">
    <div><strong>【策略状态】</strong></div>
    <div>当前面具: {decision.process.mask.currentMask}（{decision.process.mask.selectionReason}）</div>
    <div>选择回合: 第{decision.process.mask.selectedRound}轮</div>
  </div>
)}

// 在可选行动展示中增加面具适配度
{decision.process?.candidates?.map((c) => (
  <div key={`${c.action}:${c.target}`}>
    <span>{c.action} → {c.targetName}</span>
    <span>基础分: {c.baseScore} × 面具适配度({c.maskCompatibility}) = {c.adjustedScore}</span>
  </div>
))}
```

---

## 三、文件改动清单

| 文件 | 操作 | 改动内容 | 工作量 |
|------|------|---------|--------|
| `src/lib/ai/mask/types.ts` | **新建** | StrategyMask 类型、MaskState、适配度表类型 | 小 |
| `src/lib/ai/mask/mask-selector.ts` | **新建** | 面具选择逻辑、MASK_COMPATIBILITY 表 | 中 |
| `src/lib/ai/mask/index.ts` | **新建** | 导出 mask 模块 | 小 |
| `src/lib/ai/mind/candidate-generator.ts` | **修改** | 全行动遍历、面具适配度、BLOCK_VOTE 目标选择 | **大** |
| `src/lib/ai/intention/intention-manager.ts` | **修改** | generateCandidates 在全行动空间中加分 | 中 |
| `src/lib/ai/intention/desire-engine.ts` | **修改** | 欲望强度受面具影响 | 小 |
| `src/lib/ai/strategies/engine.ts` | **修改** | 每回合选择面具、传入候选生成器 | 中 |
| `src/lib/ai/ai-agent.ts` | **修改** | 面具状态管理、CLAIM_IDENTITY 锁定 | 中 |
| `src/types/core.ts` | **修改** | Player 增加 identityClaim 字段 | 小 |
| `src/lib/game/simulator-core.ts` | **修改** | 验证 CLAIM_IDENTITY 执行条件 | 小 |
| `src/components/game/DecisionProcessView.tsx` | **修改** | 调试面板显示面具信息 | 小 |
| `src/lib/ai/strategies/process-builder.ts` | **修改** | 决策过程展示中增加 mask 字段 | 小 |

#### 2.3.5 修改：`src/lib/ai/strategies/process-builder.ts`（决策过程展示）

在 `buildProcess` 函数的 shortlist 中增加面具信息：

```typescript
export function buildProcess(
  candidates: EnrichedCandidate[],
  winner: EnrichedCandidate,
  self: Player,
  allPlayers: Player[],
  blocked?: { candidate: DecisionCandidate; reason: string; constraintId: string; description: string }[],
  intentionExplanation?: string,
  intentionManager?: IntentionManager,
  maskState?: MaskState  // 新增参数
): DecisionProcess {
  // ... 原有逻辑

  // 面具信息
  const maskLines: string[] = [];
  if (maskState) {
    maskLines.push('');
    maskLines.push('【策略状态】');
    maskLines.push(`  当前面具: ${maskState.currentMask}（${maskState.selectionReason}）`);
    maskLines.push(`  选择回合: 第${maskState.selectedRound}轮`);
  }

  const shortlist = [
    intentionExplanation || '',
    ...maskLines,
    '【可选行动】',
    ...lines,
    ...blockedLines,
    ...intentionLines,
    '',
    `【最终选择】${winnerAction}${winnerTarget ? `→${winnerTarget}` : ''}`,
  ].join('\n');

  return { 
    candidates: unique, 
    winner: { action: winner.action, target: winner.target }, 
    shortlist,
    mask: maskState,  // 新增 mask 字段
  };
}
```

| # | 决策 | 结论 | 说明 |
|---|------|------|------|
| 1 | 面具是否单选 | ✅ **单选** | 每回合只选一个面具，简单清晰 |
| 2 | 面具是否调试可见 | ✅ **可见** | 在决策过程面板显示当前面具和选择原因 |
| 3 | 阻止投票生成条件 | ✅ **有号召投票时** | 无号召投票时不生成，语义清晰 |
| 4 | 心智因子解耦 | ⏳ **延后** | 本次不纳入，先验证面具系统效果 |
| 5 | 身份通用性 | ✅ **通用** | 面具适配度不区分身份，身份差异通过基础分和目标选择体现 |
| 6 | 预言家金水 | ✅ **支持** | 查验结果为村民（金水）也触发 `hasHardInfo`，权重略低于查杀 |
| 7 | 身份声称次数 | ✅ **只允许一次** | 已声称后锁定，不再生成 CLAIM_IDENTITY |

---

## 五、后续迭代（不纳入本次）

| 阶段 | 内容 | 触发条件 |
|------|------|---------|
| 阶段四 | **心智因子解耦** | 面具系统稳定后，调整价值观对齐/危机因子权重 |
| 阶段五 | **跳身份时机细化** | 各身份的 `CLAIM_IDENTITY` 触发权重微调（如猎人、验尸官的特殊逻辑） |
| 阶段六 | **伪装一致性** | 已跳身份后的行为约束（软性，通过心智因子实现） |
| 阶段七 | **面具混合** | 如果需要，从单选扩展为加权混合 |

---

## 六、验收标准

### 6.1 面具系统
- [ ] 每回合 Agent 都有明确的面具选择（调试面板可见）
- [ ] 所有白天行动都出现在候选列表中（包括阻止投票、担保、袒护、号召投票）
- [ ] 分数差异由面具适配度决定，不是有无问题
- [ ] 狼人选择 `conceal` 时，沉默分数最高；选择 `attack` 时，怀疑/指认分数最高
- [ ] 信任目标被攻击时，Agent 可选择 `protective` 面具，DEFEND/GUARANTEE/BLOCK_VOTE 分数显著上升
- [ ] 场面混乱时，Agent 可选择 `manipulative` 面具，EXCLUDE_ALL/SUSPECT 分数上升
- [ ] 面具选择实时基于局势（`identityCrisis`、`wolfRatio`、`tensionLevel`），不是独立状态

### 6.2 阻止投票
- [ ] 有人号召投票时，阻止投票出现在候选中
- [ ] 无人号召投票时，阻止投票不出现在候选中
- [ ] 面具影响阻止投票的目标选择（conceal 保护好人，cut_loss 保护队友）

### 6.3 身份限制
- [ ] Agent 只声称一次身份，后续不再生成 CLAIM_IDENTITY
- [ ] 已声称身份的 Agent 在调试面板显示声称的身份和回合
- [ ] 狼人声称的身份标记为 isFake，供后续一致性约束使用

### 6.4 通用性
- [ ] 预言家、验尸官、猎人、盗贼等身份都能使用面具系统
- [ ] 不同身份 CLAIM_IDENTITY 的基础分不同（强信息角色更高）
- [ ] 预言家没查到狼人（金水）时也有跳身份动机

### 6.5 游戏日志展示（调试面板）

参考现有面板（`DecisionProcessView`）的"意图状态"展示格式，面具相关信息需要展示如下：

```
【策略状态】
  当前面具: protective（信任目标被攻击）
  选择回合: 第3轮
  
【可选行动】
  ✓ 沉默（面具适配度0.30，基础分被压低）
  ○ 辩护→普通村民3（面具适配度0.90，基础分被推高）
  ○ 担保→普通村民3（面具适配度0.85）
  ○ 阻止投票→普通村民3（面具适配度0.80）
  ...
```

**展示字段**：
- `当前面具`：StrategyMask 值
- `选择原因`：selectMask 返回的 reason
- `面具适配度`：每个候选行动的面具适配度（供调试理解为什么某些行动分数高/低）
- `基础分调整`：显示"基础分 × 适配度 = 调整后分"的计算过程

**实现位置**：
- `DecisionProcessView.tsx`：在"意图状态"同级增加"策略状态"
- `process-builder.ts`：shortlist 输出中增加 mask 信息
- `GameLogItem`：日志记录中增加 mask 字段（供后续回放）  
> 确认决策：面具单选、调试可见、阻止投票有号召时生成、心智解耦延后、身份通用化、金水支持
