# 心智驱动决策系统 (Mind-Driven Decision System)

> 本文档是 [DECISION-ARCHITECTURE.md](DECISION-ARCHITECTURE.md) 中**第二步（心智 enrich）**的详细展开。总览看 DECISION-ARCHITECTURE，接口和公式看本文档。

## 设计目标

将 AI 从"规则驱动"升级为"心智驱动"：
- 角色基于**对社交情境的理解**生成行动
- 所有系统间数值**深度关联**（乘法而非加法）
- 决策基于**概率分布**（Softmax 全分布），而非截断 Top 3

---

## 核心架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      心智驱动决策系统                             │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  社交情境层   │    │  价值观系统   │    │  时机评估层   │
│ SocialContext│    │ ValueSystem  │    │TimingEvaluate│
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                           ▼
              ┌──────────────────────┐
              │    心智模拟层         │
              │  MentalSimulation    │
              │  "如果我做X，场面   │
              │   会变成什么样？"   │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │   候选生成器          │
              │  CandidateGenerator  │
              │  基于配置表生成      │
              │  候选行动集          │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │   决策引擎            │
              │  DecisionEngine      │
              │  mind enrich +       │
              │  硬约束过滤 +         │
              │  Softmax 选择        │
              └──────────────────────┘
```

---

## 1. 社交情境 (SocialContext)

### 1.1 局势理解

```typescript
interface SituationAwareness {
  // 主导叙事：当前大家都在讨论什么
  dominantNarrative: {
    topic: string;           // "怀疑A是狼人"
    participants: string[];  // 参与这个话题的人
    intensity: number;       // 0-1，讨论激烈程度
  };

  // 场面紧张度
  tensionLevel: number;  // 0-1，基于攻击行动频率、压力值

  // 我在场面中的位置
  myPosition: 'center' | 'suspect' | 'leader' | 'observer' | 'target';
  // 判断依据：被攻击次数、被保护次数、号召跟票数

  // 信息丰度
  informationRichness: number;  // 0-1，已公开信息 vs 未知信息
}
```

### 1.2 关系网络

```typescript
interface RelationNetwork {
  // 我对其他人的关系判断（融合信任+友好+阵营推断）
  myView: Map<string, {
    trust: number;      // -10~10，对其言论的信任度
    affinity: number;   // -10~10，情感亲近度
    inferredTeam: 'werewolf' | 'villager' | 'unknown'; // 推断阵营
    confidence: number; // 0-1，推断的可信度
  }>;

  // 信任网络（谁信谁）
  trustNetwork: Map<string, Map<string, number>>;
}
```

### 1.3 信息状态

```typescript
interface InformationState {
  // 已知事实（L0）
  knownFacts: {
    type: 'check' | 'death' | 'claim' | 'observation' | 'theft';
    content: unknown;
    certainty: number;  // 0-1
    source: string;      // 信息来源
  }[];

  // 信息缺口
  informationGaps: {
    question: string;    // "谁是预言家？"
    importance: number;  // 0-1
    urgency: number;     // 0-1
  }[];

  // 可疑模式
  suspiciousPatterns: {
    pattern: string;     // "B总是在保护A"
    involvedPlayers: string[];
    confidence: number;    // 0-1
  }[];
}
```

### 1.4 身份危机感知

```typescript
interface IdentityCrisisAwareness {
  // 自我感知
  selfPerceivedExposure: number;  // 0-1，我觉得自己被怀疑的程度

  // 关键阈值判断
  isCritical: boolean;  // 是否处于临界状态（>0.7）
  isHigh: boolean;       // 是否高暴露（>0.5）
  isSafe: boolean;       // 是否安全（<0.3）
}
```

---

## 2. 价值观系统 (ValueSystem)

### 2.1 核心维度

```typescript
interface ValueSystem {
  // 六大价值观（0-1，角色不同分布不同）
  truthSeeking: number;      // 追求真相（预言家0.9，狼人0.2）
  selfPreservation: number;  // 自我保护（通用0.7）
  socialHarmony: number;     // 社交和谐（亲和型0.8，混乱型0.2）
  dominance: number;         // 控制欲（领导型0.8）
  deception: number;         // 欺骗意愿（狼人0.8，村民0.1）
  loyalty: number;          // 忠诚度（影响是否保队友/保谁）
}
```

### 2.2 行动-价值观匹配度

每个行动都有价值观签名，匹配度通过余弦相似度计算：

```typescript
const ACTION_VALUE_SIGNATURES: Record<string, Partial<ValueSystem>> = {
  [ACTION.SUSPECT]:      { truthSeeking: 0.6, deception: 0.3, dominance: 0.4 },
  [ACTION.ACCUSE]:       { truthSeeking: 0.8, deception: 0.4, dominance: 0.7 },
  [ACTION.DEFEND]:       { truthSeeking: 0.4, socialHarmony: 0.8, loyalty: 0.7 },
  [ACTION.GUARANTEE]:    { truthSeeking: 0.9, socialHarmony: 0.6, loyalty: 0.8 },
  [ACTION.CALL_VOTE]:    { truthSeeking: 0.7, dominance: 0.8, deception: 0.3 },
  [ACTION.BLOCK_VOTE]:   { truthSeeking: 0.3, socialHarmony: 0.6, deception: 0.5 },
  [ACTION.EXCLUDE_ALL]:  { truthSeeking: 0.8, dominance: 0.6, deception: 0.2 },
  [ACTION.SILENCE]:      { selfPreservation: 0.7, deception: 0.4 },
  [ACTION.OBSERVE]:      { truthSeeking: 0.7, selfPreservation: 0.5 },
  [ACTION.CLAIM_IDENTITY]: { truthSeeking: 0.8, dominance: 0.5, selfPreservation: 0.3 },
};

function calculateValueAlignment(action: string, valueSystem: ValueSystem): number {
  const signature = ACTION_VALUE_SIGNATURES[action];
  if (!signature) return 0.5;

  let dot = 0, normSig = 0, normVal = 0;
  for (const [key, sigVal] of Object.entries(signature)) {
    const val = valueSystem[key as keyof ValueSystem];
    dot += sigVal * val;
    normSig += sigVal * sigVal;
    normVal += val * val;
  }
  return dot / (Math.sqrt(normSig) * Math.sqrt(normVal) + 0.001);
}
```

---

## 3. 时机评估 (TimingEvaluation)

### 3.1 时机维度

```typescript
interface TimingEvaluation {
  urgency: number;           // 紧迫性：现在不做，以后还有机会吗？
  credibility: number;       // 可信度：现在说，有人信吗？
  risk: number;              // 风险：做了之后我会暴露吗？
  expectedImpact: number;    // 预期影响力：能改变多少人的想法？
  opportunityCost: number;   // 机会成本：不做这个，我还能做什么？
}
```

### 3.2 评分转换

```typescript
function calculateTimingScore(timing: TimingEvaluation): number {
  return (
    timing.urgency * TIMING_WEIGHT_URGENCY +
    timing.credibility * TIMING_WEIGHT_CREDIBILITY +
    (1 - timing.risk) * TIMING_WEIGHT_RISK +
    timing.expectedImpact * TIMING_WEIGHT_IMPACT +
    (1 - timing.opportunityCost) * TIMING_WEIGHT_OPPORTUNITY_COST
  );
}
```

---

## 4. 心智模拟 (MentalSimulation)

### 4.1 模拟结构

```typescript
interface MentalSimulation {
  action: string;
  target: string | null;

  // 预期他人反应
  expectedReactions: Map<string, {
    reaction: string;      // "会支持我" / "会反对我" / "会怀疑我"
    confidence: number;    // 0-1
  }>;

  // 与长期目标的匹配度
  goalAlignment: number;  // 0-1

  // 暴露风险
  exposureRisk: number;  // 0-1
}
```

### 4.2 评分转换

```typescript
function calculateSimulationScore(simulation: MentalSimulation): number {
  return (
    simulation.goalAlignment * SIMULATION_GOAL_ALIGNMENT_WEIGHT +
    (1 - simulation.exposureRisk) * SIMULATION_EXPOSURE_WEIGHT +
    averageReactions(simulation.expectedReactions) * SIMULATION_REACTION_WEIGHT
  );
}
```

---

## 5. 候选生成 (CandidateGenerator)

基于配置表生成候选，替代原有的硬编码 if-else：

```typescript
// 示例：攻击规则配置表
const attackRules = [
  {
    threshold: PROB_THRESHOLD_HIGH,  // 0.7
    action: ACTION.ACCUSE,
    score: INTENTION_BASE_SCORE_ATTACK,  // 400
    confidence: CONFIDENCE_MEDIUM_HIGH,
    reason: (name: string) => `${name}狼概率高，强烈指认`,
  },
  {
    threshold: PROB_THRESHOLD_MEDIUM,  // 0.5
    action: ACTION.SUSPECT,
    score: 300,
    confidence: CONFIDENCE_MEDIUM,
    reason: (name: string) => `${name}有点可疑`,
  },
];
```

所有分数为纯基础分，不含价值观加法。价值观的影响完全通过 `mindMultiplier` 乘法实现。

---

## 6. 决策引擎 (DecisionEngine)

> 本节是 [DECISION-ARCHITECTURE.md](DECISION-ARCHITECTURE.md) 中“第 2~4 步”的代码级展开。总览看流程图，实现细节看本节。

### 6.1 完整流程

```typescript
class DecisionEngine {
  decide(...): DecisionResult {
    // 1. 收集候选（策略 + 插件 + 意图）
    const candidates = [...strategyCandidates, ...pluginCandidates, ...intentionCandidates];

    // 2. 构建 SocialContext（缓存）
    const socialContext = buildSocialContext(self, allPlayers, belief, publicActions);
    const valueSystem = createValueSystem(self);

    // 3. 心智 enrich（所有候选）
    const enriched = candidates.map(c => ({
      ...c,
      totalScore: Math.round(baseScore(c) * mindMultiplier(c)),
      mindData: { /* 六个因子原始值 */ }
    }));

    // 4. 硬约束过滤（enrich 之后）
    const { allowed, blocked } = filterByHardConstraints(enriched, context);

    // 5. 去重（先排序，再按 action+target 去重）
    const unique = sortByScore(allowed).filter(deduplicate);

    // 6. Softmax 选择
    const selected = this._softmaxSelect(unique);

    return { action: selected.action, target: selected.target, ... };
  }
}
```

### 6.2 温度参数

温度根据**分数差距**动态调整（而非角色属性）：

| 分数差距 | 温度 | 含义 |
|----------|------|------|
| > 50 | 0.3 | 高度确定性，几乎必选最高分 |
| > 20 | 1.0 | 正常，Softmax 原始分布 |
| > 10 | 2.0 | 较随机，低分候选有机会 |
| ≤ 10 | 3.0 | 高度随机，近似均匀分布 |

---

## 7. 信息关联设计

### 7.1 乘法因子系统

```typescript
// 旧：简单加法
score += 200;

// 新：信息通过六个乘法因子影响决策
function calculateMindMultiplier(
  action: string,
  target: string | null,
  socialContext: SocialContext,
  valueSystem: ValueSystem,
  self: Player
): number {
  const valueAlignment = calculateValueAlignment(action, valueSystem);
  const timing = timingEvaluator.evaluate(action, target, socialContext, self, belief);
  const timingScore = calculateTimingScore(timing);
  const simulation = mentalSimulator.simulate(action, target, socialContext, self, belief);
  const simulationScore = calculateSimulationScore(simulation);
  const crisisFactor = calculateCrisisFactor(action, socialContext.identityCrisis);
  const relationFactor = calculateRelationFactor(action, target, socialContext.relationNetwork, self);
  const socialContextBonus = calculateSocialContextBonus(action, target, socialContext);
  const capabilityFactor = calculateCapabilityFactor(action, self);

  return (
    (MIND_MULTIPLIER_BASE + MIND_MULTIPLIER_SCALE * valueAlignment) *
    (0.5 + 0.5 * timingScore) *
    (0.5 + 0.5 * simulationScore) *
    crisisFactor *
    relationFactor *
    (0.8 + 0.2 * socialContextBonus) *
    capabilityFactor
  );
}
```

### 7.2 身份危机因子

```typescript
function calculateCrisisFactor(action: string, crisis: IdentityCrisisAwareness): number {
  if (crisis.isCritical) {
    switch (action) {
      case ACTION.SILENCE: return CRISIS_FACTOR_SILENCE_CRITICAL;  // 1.5
      case ACTION.OBSERVE: return CRISIS_FACTOR_OBSERVE_CRITICAL;  // 1.3
      case ACTION.DEFEND:  return CRISIS_FACTOR_DEFEND_CRITICAL;   // 1.4
      case ACTION.REBUT:   return CRISIS_FACTOR_REBUT_CRITICAL;   // 1.6
      case ACTION.ACCUSE:  return CRISIS_FACTOR_ACCUSE_CRITICAL;  // 0.5
      case ACTION.CALL_VOTE: return CRISIS_FACTOR_CALL_VOTE_CRITICAL; // 0.4
      default: return CRISIS_FACTOR_DEFAULT_CRITICAL;  // 1.0
    }
  }
  if (crisis.isHigh) { /* 类似，系数较温和 */ }
  return 1.0;
}
```

### 7.3 关系网络因子

```typescript
function calculateRelationFactor(
  action: string,
  target: string | null,
  relationNetwork: RelationNetwork,
  self: Player
): number {
  if (!target) return RELATION_FACTOR_DEFAULT;  // 1.0

  const view = relationNetwork.myView.get(target);
  if (!view) return RELATION_FACTOR_DEFAULT;

  // 对信任的人：DEFEND 吸引力高，ACCUSE 吸引力低
  if (view.trust > TRUST_THRESHOLD_HIGH) {
    if (action === ACTION.DEFEND)     return RELATION_FACTOR_DEFEND_TRUSTED;     // 1.4
    if (action === ACTION.GUARANTEE)  return RELATION_FACTOR_GUARANTEE_TRUSTED;  // 1.5
    if (action === ACTION.ACCUSE)     return RELATION_FACTOR_ACCUSE_TRUSTED;     // 0.4
  }

  // 对怀疑的人：ACCUSE 吸引力高，DEFEND 吸引力低
  if (view.inferredTeam === 'werewolf' && view.confidence > CONFIDENCE_MEDIUM) {
    if (action === ACTION.ACCUSE)  return RELATION_FACTOR_ACCUSE_SUSPICIOUS;  // 1.5
    if (action === ACTION.SUSPECT)  return RELATION_FACTOR_SUSPECT_SUSPICIOUS; // 1.3
    if (action === ACTION.DEFEND)   return RELATION_FACTOR_DEFEND_SUSPICIOUS;  // 0.3
  }

  return RELATION_FACTOR_DEFAULT;
}
```

---

## 8. 与现有系统的整合

### 8.1 保留的部分
- BeliefSystem 的 L0-L3 层（作为信息输入）
- IntentionManager（作为高层目标输入，输出 intentionDrivenBonus）
- Hard Constraints（作为安全兜底，在 mind enrich 之后执行）
- Plugin System（作为行动执行层）

### 8.2 已替换的部分
- Strategy System 的硬编码 if-else → 配置表驱动的 CandidateGenerator
- Top 3 截断 → Softmax 全分布选择
- 简单加减分 → 乘法因子系统
- 阶段权重 → 并入 baseScore，由 mindMultiplier 统一放大

### 8.3 新增的部分
- SocialContext 构建器（支持缓存）
- ValueSystem 评估器
- TimingEvaluation 评估器
- MentalSimulation 模拟器
- CandidateGenerator 配置表生成器
- Softmax 选择器（温度基于分数差距动态调整）
