# 策略面具系统 (Mask System)

> 本文档描述 AI 决策的**策略层**——局势如何映射到离散策略标签，以及策略标签如何影响候选生成。
>
> 层顺序中的位置：**Layer 2**，位于局势感知层（Layer 1）之后，候选生成层（Layer 3）之前。

---

## 1. 设计哲学

面具系统解决的核心问题：**同一身份在不同局势下应采取不同策略**。

- 狼人顺风时应该**进攻**（attack），逆风时应该**潜伏**（conceal），绝境时应该**不惜暴露淘汰人**（desperate）。
- 预言家被怀疑时应该**防御**（defensive），队友被攻击时应该**保护**（protective）。
- 这些策略不是人格特质（人格是长期的、稳定的），而是**局势的实时映射**。

**关键设计决策**：
- **面具单选**：每回合只能戴一个面具，避免策略混乱。
- **身份通用**：适配度表不区分身份，差异由基础分和目标选择体现。
- **粗粒度输入**：面具选择器只看离散化局势特征（`myCrisis > 0.6`），不看具体目标或信任值。

---

## 2. 七副策略面具

| 面具 | 英文名 | 核心行为 | 典型场景 |
|------|--------|----------|----------|
| **conceal** | 潜伏 | 沉默、观察、不引起注意 | 默认状态，无特殊事件 |
| **manipulative** | 操纵 | 间接引导、分散怀疑、搅浑水 | 场面混乱，可趁机引导舆论 |
| **attack** | 进攻 | 直接攻击、怀疑、指认、号召投票 | 狼人优势，或有高可疑目标 |
| **desperate** | 绝境 | 不惜暴露也要淘汰人 | 狼人极度劣势（<40%），或最后机会 |
| **cut_loss** | 切割 | 牺牲队友保全自己 | 队友极度身份危机（>0.8），自身安全 |
| **protective** | 保护 | 保护信任目标、挡刀、辩护 | 信任目标被攻击 |
| **defensive** | 防御 | 自保、沉默、不表态 | 自身身份危机高（>0.6） |

---

## 3. 层顺序

```
Layer 1: 局势感知层（Situation Perception）
  输入: belief, socialContext, publicActions
  输出: identityCrisis, wolfRatio, tensionLevel, trustedBeingAttacked...
       ↓
Layer 2: 策略层（Strategy / Mask Selection）← 本文档
  输入: 粗粒度局势特征（离散化标签）
  输出: StrategyMask（7个面具之一）
       ↓
Layer 3: 候选生成层（Candidate Generation）
  输入: StrategyMask + 细粒度局势
  输出: 所有可用行动的候选集（score = baseScore × maskCompatibility）
       ↓
Layer 4: 人格层（Personality Alignment）
  输入: 长期性格（ValueSystem）+ 当前策略
  输出: 性格一致性分数
       ↓
Layer 5: 局势评估层（Situational Evaluation）
  输入: 细粒度局势特征（具体时机、目标信任度、社交位置）
  输出: timingScore, crisisFactor, relationFactor, socialContextBonus
       ↓
Layer 6: 模拟层（Simulation）
  输入: 预测他人反应
  输出: simulationScore
       ↓
Action: 最终行动选择
```

**核心原则**：面具只在**候选生成**阶段使用，心智 enrich（Layer 4-6）不感知面具。这样可以：
- 面具改变"什么行动值得考虑"
- 心智因子改变"在值得考虑的行动中，哪个最合适"
- 两者独立，可分别调试

---

## 4. 面具选择逻辑

### 4.1 选择器输入

```typescript
interface MaskSelectionInput {
  myCrisis: number;           // 自身身份危机（0-1）
  wolfRatio: number;          // 狼人占比（0-1）
  tensionLevel: number;       // 场面紧张度（0-1）
  teammateCrisis: number;     // 最高队友危机（0-1）
  trustedBeingAttacked: boolean; // 是否有信任目标被攻击
}
```

### 4.2 选择器优先级（从高到低）

```
IF trustedBeingAttacked && myCrisis < 0.5      → protective
IF wolfRatio < 0.4 && myCrisis < 0.5           → desperate
IF teammateCrisis > 0.8 && myCrisis < 0.5     → cut_loss
IF myCrisis > 0.6                              → defensive
IF tensionLevel > 0.7 && myCrisis < 0.4       → manipulative
IF wolfRatio > 0.5                             → attack
ELSE                                           → conceal
```

**设计意图**：
- `protective` 优先级最高：保护信任目标是强信息驱动的行为，不应被局势压制。
- `desperate` 在狼人劣势时触发：狼人占比 < 40% 时，潜伏已经没有意义。
- `defensive` 在个人危机高时触发：自身难保时不应冒险。
- `conceal` 是默认：没有特殊事件时保持低调。

---

## 5. 面具-行动适配度表

所有身份共用同一套适配度表。差异由**基础分**和**目标选择**体现，不由适配度表体现。

```typescript
export const MASK_COMPATIBILITY: Record<string, Record<string, number>> = {
  [ACTION.SILENCE]:       { conceal: 0.90, manipulative: 0.40, attack: 0.30, desperate: 0.10, cut_loss: 0.20, protective: 0.30, defensive: 0.80 },
  [ACTION.OBSERVE]:       { conceal: 0.80, manipulative: 0.70, attack: 0.50, desperate: 0.20, cut_loss: 0.40, protective: 0.50, defensive: 0.60 },
  [ACTION.SUSPECT]:       { conceal: 0.40, manipulative: 0.80, attack: 0.90, desperate: 0.80, cut_loss: 0.70, protective: 0.40, defensive: 0.30 },
  [ACTION.ACCUSE]:        { conceal: 0.10, manipulative: 0.60, attack: 0.80, desperate: 0.90, cut_loss: 0.80, protective: 0.20, defensive: 0.20 },
  [ACTION.DEFEND]:        { conceal: 0.70, manipulative: 0.50, attack: 0.20, desperate: 0.30, cut_loss: 0.40, protective: 0.90, defensive: 0.60 },
  [ACTION.GUARANTEE]:     { conceal: 0.60, manipulative: 0.40, attack: 0.20, desperate: 0.30, cut_loss: 0.20, protective: 0.85, defensive: 0.50 },
  [ACTION.CALL_VOTE]:     { conceal: 0.20, manipulative: 0.80, attack: 0.90, desperate: 0.90, cut_loss: 0.80, protective: 0.50, defensive: 0.30 },
  [ACTION.BLOCK_VOTE]:    { conceal: 0.60, manipulative: 0.50, attack: 0.40, desperate: 0.20, cut_loss: 0.50, protective: 0.80, defensive: 0.50 },
  [ACTION.EXCLUDE_ALL]:   { conceal: 0.30, manipulative: 0.70, attack: 0.40, desperate: 0.60, cut_loss: 0.50, protective: 0.30, defensive: 0.30 },
  [ACTION.CLAIM_IDENTITY]:{ conceal: 0.30, manipulative: 0.50, attack: 0.60, desperate: 0.70, cut_loss: 0.40, protective: 0.40, defensive: 0.20 },
};
```

### 适配度设计原则

- **高适配度（0.8-1.0）**：面具的"核心行动"。如 `attack` 的 SUSPECT/ACCUSE/CALL_VOTE，`protective` 的 DEFEND/GUARANTEE/BLOCK_VOTE。
- **中适配度（0.4-0.7）**：面具的"辅助行动"。如 `manipulative` 的 SUSPECT（间接引导）。
- **低适配度（0.1-0.3）**：面具的"冲突行动"。如 `attack` 的 SILENCE（进攻时沉默不合理）。
- **0.5 为默认值**：未定义的行动默认中性。

---

## 6. 候选生成中的面具应用

### 6.1 全行动遍历

CandidateGenerator 不再使用 if-else 条件链，而是遍历所有白天行动：

```typescript
const ALL_DAY_ACTIONS = [
  ACTION.SILENCE, ACTION.CLAIM_IDENTITY, ACTION.REVEAL_INFO,
  ACTION.OBSERVE, ACTION.SUSPECT, ACTION.DEFEND,
  ACTION.CALL_VOTE, ACTION.BLOCK_VOTE, ACTION.GUARANTEE,
  ACTION.ACCUSE, ACTION.EXCLUDE_ALL,
];
```

### 6.2 可用性判断（硬性条件）

某些行动需要特定条件才生成，这些条件**不**受面具影响：

- `BLOCK_VOTE`：需要有人号召投票（`hasCallVote`）
- `CLAIM_IDENTITY`：未声称过，或预言家有未公布查验（`hasUnrevealedChecks`）
- 其他行动：默认可用

### 6.3 分数计算

```typescript
// 基础分（由局势和身份决定）
const baseScore = getActionBaseScore(actionType, self, belief, ...);
if (baseScore === null) continue; // 该行动在此局势下不应生成

// 面具适配度
const compatibility = MASK_COMPATIBILITY[actionType]?.[mask] ?? 0.5;

// 最终候选分数
const score = Math.round(baseScore * compatibility);
```

### 6.4 目标选择（面具影响）

目标选择器按面具优先级排序：

- `_selectProtectTarget`：`protective` 优先保护高信任目标，`conceal` 保护看起来像好人的目标，`cut_loss` 保护队友。
- `_selectBlockVoteTarget`：`conceal` 保护看起来像好人的目标，`cut_loss` 保护队友，`desperate` 不阻止。
- `_selectObserveTarget`：村民观察所有活着的其他人，狼人优先观察非队友。

---

## 7. 与意图系统的整合

意图系统（IntentionManager）也感知面具：

```typescript
// 意图生成的候选分数也乘以面具适配度
const maskCompatibility = MASK_COMPATIBILITY[step.action]?.[mask] ?? 0.5;
const adjustedScore = mask ? Math.round(intention.priority * maskCompatibility) : intention.priority;
```

这样，意图驱动的候选和行动生成的候选在同一"面具空间"中竞争，不会出现意图说要攻击但面具说潜伏的矛盾。

---

## 8. 关键文件

| 文件 | 职责 |
|------|------|
| `src/lib/ai/mask/types.ts` | 面具类型定义（StrategyMask, MaskState） |
| `src/lib/ai/mask/mask-selector.ts` | 面具选择逻辑 + 适配度表 |
| `src/lib/ai/mask/index.ts` | 模块入口导出 |
| `src/lib/ai/mind/candidate-generator.ts` | 全行动遍历 + 面具适配度应用 |
| `src/lib/ai/intention/intention-manager.ts` | 意图候选也乘以面具适配度 |
| `src/lib/ai/ai-agent.ts` | 每回合选择面具 + 日志展示 |

---

## 9. 调试与验证

### 日志输出

AIAgent 的日志中追加当前面具：
```
决策：accuse → 玩家3，原因：玩家3狼概率高，attack模式下强烈指认（面具=attack）
```

### 候选展示

DecisionCandidate 新增 `maskCompatibility` 字段，UI 可展示每个候选的面具适配度。

### 验证 checklist

- [ ] 狼人顺风时戴 `attack` 面具，候选中有高分的 SUSPECT/ACCUSE/CALL_VOTE
- [ ] 狼人逆风时戴 `desperate` 面具，候选中有高分的 ACCUSE（不惜暴露）
- [ ] 信任目标被攻击时戴 `protective` 面具，候选中有高分的 DEFEND/GUARANTEE
- [ ] 自身危机高时戴 `defensive` 面具，候选中有高分的 SILENCE/OBSERVE
- [ ] 预言家有未公布查验时，CLAIM_IDENTITY 继续生成（即使已声称过）
