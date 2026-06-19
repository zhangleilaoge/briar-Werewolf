# 架构修复计划 — briar-Werewolf

## 目标
根据架构审查报告，系统性地修复 9 大类问题，按 P0 → P1 → P2 优先级执行。

## 当前仓库状态
- 分支: `agent/architecture-refactor`
- 基线: `5391bef`
- 技术栈: TypeScript + React + Astro, Vitest 测试

## 阶段 1: P0 修复（必须修复）

### Worker-A: 类型系统紧急修复
**范围:** `src/types.ts`, `src/lib/game/simulator-utils.ts`, `src/lib/game/simulator-day.ts`, `src/lib/ai/ai-agent.ts`, `src/lib/ai/belief-system.ts`

1. **Relation 接口修复**: 当前 `Relation = { favor: number }`，但代码实际使用 `trustDelta`/`friendlyDelta`。需要扩展 Relation 为 `{ favor: number; trust?: number; friendly?: number }` 或统一为单一 `favor` 字段。经审查，updateRelation 调用点混用了 `favorDelta` 和 `{ trustDelta, friendlyDelta }`。决策：**统一 Relation 接口为 `{ favor: number; trust: number; friendly: number }`，并修正所有调用点**。
2. **simulator-day.ts:107 变量名错误**: `claimedRole` → `details.claimedRole`。
3. **belief-system.ts:402 updateRelation 签名修正**: 当前只接受 `favorDelta`，但 ai-agent.ts:170 传了 3 个参数。修正签名并处理 `trustDelta`/`friendlyDelta`。
4. **ai-agent.ts:170 调用修正**: 适配新的 updateRelation 签名。
5. **simulator-day.ts 中 updateRelation 调用统一**: 统一为 `{ favorDelta }` 或 `{ trustDelta, friendlyDelta }` 的规范形式。

### Worker-B: 游戏模拟器继承修复
**范围:** `src/lib/game/simulator-phases.ts`, `src/lib/game/simulator-day.ts`, `src/lib/game/simulator-night.ts`, `src/lib/game/simulator-vote.ts`, `src/lib/game/simulator-morning.ts`, `src/lib/game/simulator-core.ts`

1. **DayPhaseController.onTick 修复**: 当前复制了 TickPhase.onTick 逻辑而未调用 super.onTick()。改为调用 `super.onTick()`，或确认是否需要额外逻辑，遵循 Liskov 替换原则。
2. **_checkWinCondition 统一调用**: 当前散落在 simulator-day.ts:356、simulator-night.ts:199/211、simulator-vote.ts:57、simulator-morning.ts。统一改为阶段转换时检查。
3. **simulator-core.ts:413-417 executeNextStep/hasMoreSteps**: 保留但标记更清晰，或确认 useGameRunner 是否必须依赖。
4. **simulator-core.ts:425-431 runRound()**: 确认未使用则删除。
5. **simulator-core.ts:462-465 getPlayerStates()**: @deprecated 方法，替换调用点并删除。

## 阶段 2: P1 重构（应该重构）

### Worker-C: 拆分 types.ts 为 types/ 目录
**范围:** `src/types.ts` → `src/types/*.ts`

1. `src/types/index.ts` — barrel export
2. `src/types/core.ts` — Player, GamePhase, Relation, Action, LogEntry 等核心类型
3. `src/types/role.ts` — Role, RoleInfo, ROLE_INFO
4. `src/types/item.ts` — Item, ItemDefinition, ITEM_DEFINITIONS
5. `src/types/constants.ts` — 游戏常量（回合数、阶段配置等）
6. `src/types/display.ts` — ACTION_NAMES, ATTRIBUTE_NAMES, 显示映射
7. 更新所有 import 路径

### Worker-D: 拆分 intention-system.ts
**范围:** `src/lib/ai/intention-system.ts` → `src/lib/ai/intention/*.ts`

1. `src/lib/ai/intention/types.ts` — 类型定义 (Intention, Plan, Desire, etc.)
2. `src/lib/ai/intention/desire-engine.ts` — DesireEngine
3. `src/lib/ai/intention/plan-library.ts` — PlanLibrary
4. `src/lib/ai/intention/intention-manager.ts` — IntentionManager
5. `src/lib/ai/intention/hard-constraints.ts` — HardConstraints
6. `src/lib/ai/intention/legacy.ts` — Section 5-6 Legacy Helpers
7. `src/lib/ai/intention/index.ts` — barrel export

### Worker-E: 统一日志路径 + 清理死代码
**范围:** `src/lib/game/simulator-core.ts`, `src/lib/game/simulator-utils.ts`, `src/lib/game/simulator-vote.ts`, `src/lib/ai/ai-agent.ts`, `src/lib/ai/behavior-modifiers.ts`, `src/lib/ai/belief-system.ts`, `src/lib/ai/strategies/day.ts`

1. **统一日志写入**: 消除 `tickLogBuffer` vs `logs` 双路径。方案：所有日志统一写 `tickLogBuffer`，tick 结束时排序合并到 `logs`。
2. **_addThinkingLogs 修复**: 改为写 `tickLogBuffer` 而非直接 `this.logs`。
3. **simulator-vote.ts:86-90 generateVoteRound2()**: 确认已无用，删除。
4. **ai-agent.ts:53 setPlayers()**: 确认未使用，删除。
5. **behavior-modifiers.ts:180-184 RELATION_WEIGHT_HIGH/LOW**: 提到模块级常量。
6. **belief-system.ts:114 recordPublicClaim round**: 修正为实际 round 或移除硬编码。
7. **ProphetClaimStrategy 与 VillagerDayStrategy 重复**: 删除 ProphetClaimStrategy，统一为 VillagerDayStrategy 中的逻辑。
8. **魔法数字提取**: 将 `0.5`, `0.7`, `0.6`, `0.8` 等阈值提取到 `src/lib/constants/strategy-thresholds.ts`。

## 阶段 3: P2 改进（改进项）

### Worker-F: 插件系统与决策路径改进
**范围:** `src/lib/plugins/registry.ts`, `src/lib/game/simulator-day.ts`, `src/lib/ai/strategies/*.ts`, `src/lib/ai/intention-system.ts`

1. **decisionContext.belief: any 修正**: 引入正确的 BeliefSystem 类型，消除 `any`。
2. **SingleUseItemPlugin.reset() 调用机制**: 在 GameSimulator 重置/新游戏开始时调用。
3. **Day actions 插件化启动**: 提取 `resolveDayAction` 中的 switch-case 分支，建立 DayActionPlugin 基类。
4. **统一决策路径**: 消除 IntentionManager 与 DecisionEngine 的并行 bonus 机制，改为 IntentionManager 主导，策略系统提供候选评分。

### Worker-G: 前端 Hook 修复
**范围:** `src/hooks/useGameRunner.ts`, `src/lib/game/simulator-core.ts`

1. **runNextStep 闭包修复**: 将 syncFromSimulator 加入依赖数组，或使用 ref 稳定引用。
2. **减少不必要的 React 重渲染**: 使用对象引用稳定化，避免每次 tick 创建新 players 对象。

## 合并顺序
1. Worker-A (P0 类型) → Worker-B (P0 继承) → 先合并
2. Worker-C (P1 拆分 types) → Worker-D (P1 拆分 intention) → Worker-E (P1 日志+死代码) → 合并
3. Worker-F (P2 插件+决策) → Worker-G (P2 前端) → 合并
4. 最终集成验证

## 验证命令
```bash
cd /Users/zhanglei/Documents/github/briar-Werewolf/web-demo/ai-werewolf-demo
npx tsc --noEmit
npx vitest run
```

## 技能加载
- 阶段 1: `swarm-coding`
- 阶段 2: `swarm-coding`
- 阶段 3: `swarm-coding`
- 格式转换: 不需要，纯代码重构
