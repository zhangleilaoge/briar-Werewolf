# ai-werewolf-demo2 架构改进计划

> 生成时间：2026-06-23
> 背景：基于 MEMORY-TO-INFERENCE.md 设计文档的完整实现后，全面扫描架构问题。

---

## 评分概览

| 维度 | 评分 | 说明 |
|------|------|------|
| 文档完整性 | ⭐⭐⭐⭐☆ | 文档详尽，但存在"已标记已实现但代码未实现"的问题 |
| 代码与文档一致性 | ⭐⭐☆☆☆ | 大量系统（压力、状态、特质、物品、关系 bonus）文档已定义但代码未实现 |
| 架构分层 | ⭐⭐⭐☆☆ | 记忆→推理→意图的分层清晰，但关系层未接入决策，意图层穿透记忆层 |
| 类型安全 | ⭐⭐☆☆☆ | 大量 `as` 断言，循环依赖，接口定义不严格 |
| 测试覆盖 | ⭐⭐☆☆☆ | 核心路径有测试，但 trace、加权、GameEngine 集成无测试 |
| 扩展性 | ⭐⭐☆☆☆ | 角色/物品/特质硬编码，无法插件化扩展 |
| 性能 | ⭐⭐☆☆☆ | 每轮 O(P×M) 的 store 复制，夜间行动完全随机 |

---

## 一、Critical 问题（阻塞扩展）

### 1.1 记忆影响规则分散在三处，无统一引擎

**问题**：同一种 `eventType` 对推理、关系、意图的影响规则分别写在三个引擎文件中，修改一个记忆类型的影响需要同时改 3 个文件，极易遗漏。当前大量 `eventType`（如 `hear_silence`, `death`, `vote_result`）未被任何模块消费。

**涉及文件**：
- `src/inference/inference-engine.ts`（`_inferPlayer` / `_inferCrisis` switch-case）
- `src/relation/relation.ts`（`_handleDirectImpact` / `_handleBystanderImpact` switch-case）
- `src/intention/intention-engine.ts`（间接通过推理层消费，但 `report_check` 直接穿透 `store`）

**影响**：新增一个记忆类型（如 `hear_betray`）需要同时改 3 处，遗漏会导致数据不一致。当前 16 种记忆类型中约 50% 未产生任何影响。

**修复方向**：
建立声明式 `MemoryImpactRegistry`，每个 `eventType` 注册一组影响规则：
```typescript
interface MemoryImpactRule {
  eventType: MemoryEventType;
  onInference?: (mem, target, self) => InferenceDelta;
  onRelation?: (mem, perspective) => RelationDelta;
  onIntention?: (mem, perspective) => IntentionDelta;
}
```
三处引擎统一从注册表读取，实现"一处定义，全局生效"。

---

### 1.2 trait / item / role 系统完全未实现（文档有接口，代码无实现）

**问题**：`doc/TRAIT.md` / `ITEM.md` / `ROLE.md` 详细定义了 `TraitPlugin` / `ItemPlugin` / `RoleInfo` 接口，但代码中零实现。所有角色逻辑硬编码在 `GameEngine` 和 `IntentionEngine` 中。

**具体表现**：
- `types/index.ts` 中 `Role = 'prophet' | 'werewolf' | 'villager'` 为硬编码联合类型，无扩展性
- `GameEngine._executeProphetCheck()` 中预言家查验逻辑直接写死
- `GameEngine._executeWerewolfKill()` 中狼人击杀逻辑直接写死
- `IntentionEngine.evaluateLongTermIntentions()` 中 `if (role === 'prophet')` 硬编码
- `Player.defaultItems` 字段不存在，`ItemPlugin` 零实现
- `TraitPlugin` 零实现，孤狼特质仅存在于文档中

**影响**：无法添加新角色（女巫、猎人等），无法添加新物品，无法添加新特质。任何角色扩展都需要修改 `GameEngine` 和 `IntentionEngine` 核心文件。

**修复方向**：
1. 建立 `src/plugins/` 目录，包含 `PluginRegistry` + `RolePlugin` / `ItemPlugin` / `TraitPlugin` 接口
2. 将 `Role` 从联合类型改为 `string`，通过注册表校验合法性
3. 将 `GameEngine._executeProphetCheck` / `_executeWerewolfKill` 中硬编码逻辑迁移到 `ItemPlugin.execute` 中
4. `IntentionEngine` 中的角色义务通过 `RolePlugin.getLongTermIntentions` 获取，而非硬编码 `if` 分支

---

## 二、Major 问题（严重影响系统可信度）

### 2.1 类型循环依赖：`types/trace.ts` ↔ `types/index.ts`

**文件**：`src/types/trace.ts` 第 6 行，`src/types/index.ts` 第 90 行。

**问题**：`trace.ts` 从 `index.ts` 导入 `MemoryEventType` / `MemoryEntry`，而 `index.ts` 又从 `trace.ts` 导出。虽然 `import type` 编译后擦除，但违反"类型层不应循环依赖"原则，部分打包工具可能报错。

**修复方向**：抽取 `MemoryEventType` 和 `MemoryEntry` 到 `types/base.ts`，两边都从基础文件导入。

---

### 2.2 关系系统被创建但完全不影响决策（死系统）

**文件**：`src/intention/intention-engine.ts`（`_calcScoreWithTrace`）

**问题**：`RelationTracker` 在 `SystemPreview` 和 `GameEngine` 中被实例化并喂入所有记忆，但 `IntentionEngine._calcScoreWithTrace` 的加权公式**完全缺失 `relationBonus`**。`INTENTION.md` 文档中定义了 `relationBonus`，但代码中无实现。

**影响**：用户从 UI 上看到"友好度 -5（敌对）"，但 AI 决策完全不考虑这一信息。严重的系统不一致感。

**修复方向**：在 `_calcScoreWithTrace` 中补全 `relationBonus`（通过 `RelationTracker` 查询 `candidate.targetId` 的友好度），在 personalityBonus 之后、pressureBonus 之前乘入。

---

### 2.3 压力/状态/特质系统完全未实现（文档标记为 ✅，代码为 ❌）

**文件**：`doc/MAIN.md` 中标记为 ✅，但代码中：
- `Player.pressure` 初始为 0，无代码修改
- `Player.burstCount` 初始为 0，无代码修改
- `Player.traits` 初始为 `[]`，无代码添加
- `IntentionEngine` 读取 `this.self.pressure` 但永远不会变化

**影响**：文档与代码严重脱节，误导后续开发者。UI 中"压力：0"永远不会变化。

**修复方向**：
1. 在 `MemoryEntry` 录入时增加 `PressureTracker.onMemoryAdded` 调用
2. 在 `IntentionEngine` 的 `evaluateLongTermIntentions` 之前检查 `burstCount >= 2`，禁用推理
3. 或者：从 `doc/MAIN.md` 中移除这些系统的 ✅ 标记，改为 ❌，直到实现

---

### 2.4 `IntentionEngine` 直接穿透到 `MemStore`

**文件**：`src/intention/intention-engine.ts`（构造函数持有 `store`，第 146 行）

**问题**：虽然 `report_check` 已改为 `this.inference.getMyCheckResults()`，但 `IntentionEngine` 构造函数仍持有 `MemStore`。意图层理论上不应知道 `MemStore` 的存在，所有数据应通过 `InferenceEngine` 和 `RelationTracker` 接口获取。

**影响**：破坏分层架构，如果 `MemoryEntry` 结构变化，意图层需要同步修改。

**修复方向**：移除 `IntentionEngine` 的 `store` 依赖，仅保留 `inference` 和 `relation` 依赖。如果 `getMyCheckResults` 已覆盖所有数据需求，直接移除 `store` 参数。

---

### 2.5 `GameEngine` 核心逻辑严重依赖 React（违反架构分层）

**文件**：`src/components/demo/game-runner-types.ts`（`GameLog.content: React.ReactNode`），`game-runner-engine.tsx`（大量 JSX 内联）

**问题**：核心引擎与 UI 框架耦合。`GameEngine` 内部直接构造 JSX 元素（如 `<span className="text-amber-400">`），无法独立运行（如单元测试、服务端模拟、AI 训练环境）。

**影响**：React 变更会污染游戏逻辑，无法在其他环境（如纯 Node.js 环境）运行游戏引擎。

**修复方向**：核心引擎只输出结构化数据（`{ type: 'vote', voter: 'A', target: 'B' }`），UI 层负责渲染为 JSX。`GameLog` 的 `content` 改为 `GameLogContent` 对象（联合类型），UI 层有 `renderGameLog(content)` 函数转换。

---

### 2.6 `GameEngine` 中 AI 夜间行动完全随机（未使用推理系统）

**文件**：`src/components/demo/game-runner-engine.tsx`（第 311 行 `_executeProphetCheck`，第 328 行 `_executeWerewolfKill`）

**问题**：预言家查验和狼人击杀这两个核心夜间行动，在 `GameEngine` 中完全随机选择目标，没有使用已实现的 `InferenceEngine`。

**具体表现**：
- `_executeProphetCheck`：`const target = others[randInt(0, others.length - 1)]` —— 完全随机
- `_executeWerewolfKill`：`const target = nonWolves[randInt(0, nonWolves.length - 1)]` —— 完全随机
- 投票逻辑：虽然使用了 `werewolfProb`，但没有考虑关系、阵营义务等

**影响**：演示的"AI 智能"只是白天发言的幻觉，夜间行动完全是随机，严重削弱系统说服力。

**修复方向**：
- 预言家：使用 `InferenceEngine` 查找未查验且 `werewolfProb` 最高的目标
- 狼人：使用 `IntentionEngine.generateNightAction()`（需要补充夜间行动候选生成）
- 投票：接入 `IntentionEngine` 的投票候选生成（当前 `INTENTION.md` 有定义但代码未实现）

---

### 2.7 `GameEngine` 中 `_getVisibleStore` 严重性能浪费

**文件**：`src/components/demo/game-runner-engine.tsx`（第 393 行 `_calcAllPlayerResults`）

**问题**：每轮计算每个存活玩家的结果时，都创建全新的 `MemStore` 副本并逐条导入记忆。对一个 7 人、50 条记忆的游戏，每轮需要创建 7 个 `MemStore` 副本，复制 350 条记忆。随着游戏轮次增加，复杂度为 O(P × M)。

**修复方向**：
- `MemStore` 增加 `cloneFiltered(viewerId)` 方法，或使用单一全局 store + 查询时过滤
- 在 `_calcAllPlayerResults` 中复用 `store2` 和 `inference`，不要重复创建（当前已创建 2 次）

---

### 2.8 `_makeTrace` 中 `eventType` 硬编码为 `'hear_accuse'`

**文件**：`src/intention/intention-engine.ts` 第 416 行（所有意图轨迹的 `MemoryImpact` 都显示 `eventType: hear_accuse`）

**影响**：HoverCard 展示时所有记忆的影响类型都显示为 "hear_accuse"，信息错误。

**修复方向**：通过 `store.get(memoryId)` 查询真实 `eventType`，或从调用方传入。或者先解决 2.4（移除 `store` 依赖），改从 `inference` 接口获取。

---

### 2.9 运行时类型安全漏洞：大量 `as` 断言

**文件**：
- `inference-engine.ts`：`content.result as string`, `content.claimedResult as string`, `content.inferredIntention as string`
- `relation.ts`：`content.success as boolean`
- `mem-store.ts`：`CREDIBILITY as Record<string, number>`

**问题**：`memory.content` 类型为 `Record<string, unknown>`，读取时无运行时验证。如果数据结构异常（如 `content.result` 不存在），会返回 `undefined`，导致计算错误（如 `undefined === 'werewolf'` 为 `false`，概率被错误设为 0）。

**修复方向**：使用运行时类型验证（如 Zod 或手动 guard）：
```typescript
function isCheckResult(content: unknown): content is { result: 'werewolf' | 'villager' } {
  return typeof content === 'object' && content !== null && 'result' in content;
}
```

---

### 2.10 测试覆盖严重不足

**当前**：5 个测试文件共 25 个测试，但：
- 未覆盖 `inferCrisisWithTrace` / `inferPlayerWithTrace`
- 未覆盖 `_calcScoreWithTrace` 的复杂加权逻辑（roleBonus × situationBonus × personalityBonus × pressureBonus × proficiencyBonus）
- 未覆盖 `pressure` 修正（因为 `Player.pressure` 始终为 0）
- 未覆盖 `relation.ts` 的 `bystanderImpacts`
- 未覆盖 `GameEngine` 的任何逻辑
- 未覆盖 `IntentionEngine` 的夜间行动（未实现）

**修复方向**：
- 为 `InferenceEngine` 的 trace 功能编写测试
- 为 `IntentionEngine._calcScoreWithTrace` 编写参数化测试，覆盖每个 bonus 的乘数效果
- 为 `GameEngine` 编写集成测试（至少测试一回合的完整流程）
- 为 `RelationTracker` 的旁观者视角编写测试

---

## 三、Minor 问题（影响代码质量）

### 3.1 `inference-engine.ts` 超出 600 行限制

`AGENTS.md` 规定"单文件 ≤ 600 行"，但当前 652 行。

**修复方向**：拆分为 `role-inference.ts` 和 `crisis-inference.ts` 两个文件，由 `inference-engine.ts` 统一导出。

---

### 3.2 硬信息覆盖逻辑完全重复（代码复制）

`_inferPlayer` 中 `check_result`（第 122-169 行）和 `teammate_reveal`（第 170-215 行）的硬信息覆盖逻辑几乎完全复制，仅 `eventType` 和 `result` 字段不同。

**修复方向**：抽取为 `_applyHardInfoOverride(memory, withTrace)` 通用函数。

---

### 3.3 常量命名风格不一致，重复定义

- `ATTRIBUTE_MAX`（`intention.ts`）和 `ATTRIBUTE_RANGE.MAX`（`game.ts`）都表示属性最大值，重复定义
- `CLAIM_WEIGHT_FACTOR`（单数标量） vs `ACCUSER_SPAM_WEIGHT`（对象） vs `BELIEF_DEFAULT`（对象）—— 命名风格不统一
- `HARD_INFO_THRESHOLD`（`credibility.ts`）与推理权重（`inference.ts`）跨文件散落

**修复方向**：合并重复定义，统一命名风格（对象用 `Xxx_WEIGHTS`，标量用 `Xxx_FACTOR`）。

---

### 3.4 文档与代码不一致：`claimWolfCount` 已添加但文档未更新

`doc/MEMORY-TO-INFERENCE.md` 第 94 行指出 `CRISIS_WEIGHT` 没有 `CLAIM_WOLF` 且 `_inferCrisis` 没有处理 `hear_claim`，但代码已添加。

**修复方向**：更新文档，或建立从 JSDoc 生成文档的机制。

---

### 3.5 关系系统中 `hear_chat` 的旁观者视角未处理

`relation.ts` 中 `_handleDirectImpact` 处理了 `hear_chat` 的直接影响（成功 +0.5 / 失败 -0.3），但 `_handleBystanderImpact` 中没有 `hear_chat` 的 case。

**修复方向**：在 `_handleBystanderImpact` 的 `switch` 中补全 `hear_chat` 分支。

---

### 3.6 意图引擎中 `traitBonus` 完全缺失

`INTENTION.md` 中加权公式定义了 `traitBonus`，但代码中未实现。

**修复方向**：与 1.2（trait 系统）一起实现。

---

### 3.7 夜间行动候选生成未实现

`IntentionEngine.generateCandidates` 的 `phase` 参数只区分 `silence` vs `sleep`，没有处理 `check`（预言家查验）和 `kill`（狼人击杀）。

**修复方向**：在 `generateCandidates` 中补全 `phase === 'night'` 时的 `check` 和 `kill` 候选生成逻辑。

---

### 3.8 记忆可见性设计导致数据膨胀

`GameEngine._broadcastMemory` 为每个存活玩家创建独立的 `MemoryEntry`（ID 不同，内容相同）。同一事件在全局 store 中有多条记录。

**修复方向**：将 `MemoryEntry.viewerId` 改为 `viewerIds?: string[]`，或使用"公共记忆" + "私有记忆"两层结构。

---

### 3.9 遗忘机制已实现但从未被调用

`MemStore.applyForgetting` 已完整实现，但 `GameEngine` 中没有任何地方调用。

**修复方向**：在 `GameEngine` 的每轮结束（或早晨阶段）调用 `store.applyForgetting(round)`。

---

### 3.10 `PersonalityPlugin` 和 `PROFICIENCY_MAP` 的 action 类型为 `string` 而非 `ActionType`

`types/decision.ts` 中 `PersonalityPlugin.actionWeightMods` 是 `Record<string, number>`，`constants/intention.ts` 中 `ProficiencyMapEntry.action: string`。

**修复方向**：改为 `Partial<Record<ActionType, number>>` 或 `Record<ActionType, number>`。

---

### 3.11 `IntentionEngine` 中 `st.id` 的字符串前缀匹配脆弱

`generateCandidates` 中使用 `st.id.startsWith('attack_')` 和 `st.id.startsWith('protect_')` 来匹配意图类型。如果命名规则变化（如改为 `attack-target-C`），所有匹配失效。

**修复方向**：使用 `type` 字段（`pointed`/`unpointed`）结合 `targetId` 判断，而非解析字符串前缀。

---

### 3.12 `voteTargets` 在轮次之间未正确清空

`GameEngine._fillRoundQueue` 中 `this.voteTargets` 未在每轮开始时清空，仅在 `step` 的 `if (log.subPhase === 'victory')` 中清空。

**修复方向**：在 `_fillRoundQueue` 或 `_fillVoteQueue` 开头添加 `this.voteTargets = {}`。

---

### 3.13 `GameEngine._checkVictory` 平局逻辑错误

第 357 行：`if (aW === 0)` 时村民胜利，但如果 `aW === 0 && aV === 0`（所有玩家都死亡），村民胜利不合理。

**修复方向**：增加 `if (aW === 0 && aV > 0)` 或按通用规则重排。

---

### 3.14 `IntentionEngine._makeTrace` 的 `delta` 计算无意义

`evaluateLongTermIntentions` 中调用 `_makeTrace` 时 `delta = survivePriority - LONG_TERM_PRIORITY.SURVIVE`，由于 `survivePriority = Math.min(1.0, 0.9)`，恒为 0。

**修复方向**：简化 `_makeTrace` 的 `delta` 计算，或从真实变化值（如经过性格修正后的值）计算。

---

## 四、整体改进路线图

### 阶段 1：修复核心不一致（优先级最高）

| 任务 | 文件 | 工作量 | 说明 |
|------|------|--------|------|
| 消除类型循环依赖 | `types/trace.ts`, `types/index.ts` | 小 | 抽取 `types/base.ts` |
| 修复 `voteTargets` 未清空 | `game-runner-engine.tsx` | 小 | 每轮开始时清空 |
| 修复 `_makeTrace` 硬编码 `eventType` | `intention-engine.ts` | 小 | 从真实记忆获取 |
| 补全 `relationBonus` | `intention-engine.ts` | 中 | 将关系接入决策权重 |
| 建立 `MemoryImpactRegistry` | 新建 `memory-effects/` | 大 | 声明式规则表，统一三处引擎 |
| 建立 `PluginRegistry` + 迁移角色/物品/特质 | 新建 `plugins/` | 大 | 将硬编码逻辑从 `GameEngine` / `IntentionEngine` 中抽离 |
| 消除 `GameEngine` 对 React 的依赖 | `game-runner-types.ts` / `game-runner-engine.tsx` | 中 | 引擎只输出结构化数据 |

### 阶段 2：补全缺失系统

| 任务 | 说明 |
|------|------|
| 补全夜间行动候选生成 | 预言家 `check` + 狼人 `kill` + 投票 `vote` |
| 实现压力系统 | 按 `PRESSURE.md` 实现，在记忆录入时触发 |
| 实现状态系统 | 压力满时触发美德/崩溃状态 |
| 实现物品系统 | 至少实现水晶球（预言家）和狼人爪（狼人） |
| 实现特质系统 | 至少实现孤狼特质（机制修改） |
| 调用遗忘机制 | 每轮结束调用 `applyForgetting` |

### 阶段 3：提升代码质量

| 任务 | 说明 |
|------|------|
| 拆分 `inference-engine.ts` | 拆为 `role-inference.ts` + `crisis-inference.ts` |
| 补全测试覆盖 | trace 测试、加权测试、GameEngine 集成测试、关系旁观测试 |
| 统一类型安全 | 运行时 guard 替代 `as` 断言，收紧 `PersonalityPlugin` 和 `PROFICIENCY_MAP` 的 action 类型 |
| 性能优化 | 消除 `_getVisibleStore` 的重复创建，优化记忆遍历 |

### 阶段 4：文档同步

| 任务 | 说明 |
|------|------|
| 同步 `doc/MAIN.md` 状态标记 | 将未实现系统标记为 ❌ |
| 从 JSDoc 生成 `MEMORY-TO-INFERENCE.md` | 避免文档滞后 |
| 补充架构决策记录（ADR） | 记录"为什么意图层不直接读记忆"等关键决策 |

---

## 五、最关键的三件事

如果只能做三件事，按优先级排序：

1. **建立统一的记忆规则引擎**（`MemoryImpactRegistry`）—— 消除分散的 `eventType` 处理逻辑，是后续一切重构的基础
2. **实现插件化的角色/物品/特质系统**（`PluginRegistry`）—— 将硬编码逻辑从 `GameEngine` / `IntentionEngine` 中迁移出去，解决扩展性
3. **将关系系统接入意图决策**（`relationBonus`）—— 修复"友好度不影响决策"的断裂，否则关系系统完全无用

这三件事相互依赖：1 是基础设施，2 解决角色扩展，3 解决数据流向。完成这三件事后，整个系统的可信度和可扩展性会有质的飞跃。
