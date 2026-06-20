# AGENTS.md - 狼人杀 AI 对战项目

## 项目概述

基于 Astro + React + TypeScript 的狼人杀 AI 对战演示。所有玩家在复杂推理系统中行动，包含六维属性、九宫格阵营、压力系统和社交关系网络。

**启动方式**: `bun run build` / `bun run dev` / `bun run test`

---

## 核心架构

### 技术栈
- **前端**: Astro + React + Tailwind CSS
- **语言**: TypeScript
- **构建**: Vite
- **测试**: Vitest (145 个测试)
- **Lint**: Biome (noMagicNumbers + noUnusedImports)

### 目录结构

```
src/
├── types/                # 类型定义（按域拆分）
│   ├── index.ts         # Barrel export
│   ├── core.ts          # Player, GamePhase, Relation 等核心类型
│   ├── role.ts          # ROLE_INFO, TRAITS
│   ├── item.ts          # ITEM_DEFINITIONS
│   ├── constants.ts      # 游戏常量（回合数、难度等）
│   └── display.ts        # ACTION_NAMES, ATTRIBUTE_NAMES
├── utils/                # 通用工具函数
│   ├── dice.ts          # 骰子和检定系统
│   └── math.ts          # 数学工具
├── components/           # React UI 组件
├── lib/
│   ├── ai/              # AI 系统
│   │   ├── intention/    # 意图系统（BDI 栈）
│   │   ├── strategies/   # 策略引擎（DecisionEngine）
│   │   ├── mind/         # 心智驱动系统（SocialContext / ValueSystem / Timing）
│   │   └── belief-system.ts
│   ├── constants/        # 策略阈值等常量
│   ├── game/            # 游戏逻辑（模拟器、修正、道具）
│   └── plugins/         # 插件系统（道具 + 特质）
└── pages/
```

---

## 关键设计模式

### 1. 插件化架构

**三层架构：**
- **职业（配置层）**：预言家 = 村民 + 水晶球
- **道具插件（能力层）**：水晶球 → 查验能力
- **特质插件（规则层）**：孤狼特质 → 修改狼人协调逻辑

**核心接口：**
- `ActionProvider`：道具插件接口
- `TraitProvider`：特质插件接口
- `PluginRegistry`：插件注册表

### 2. 四层信念系统 (BeliefSystem)

- **L0**: 原始事实（查验结果、死亡记录）
- **L1**: 概率推理（狼人概率）
- **L2**: 心智理论（他人对自己的看法）
- **L3**: 社交情感（关系、压力、情绪）

### 3. 策略引擎 (DecisionEngine)

策略优先级：Duty > Survival > Information > Social
插件策略使用 'plugin' 阶段。

### 4. Tick-Based Actor 模型

- `GameSimulator.tick()` 推进一个 tick
- 玩家状态：`idle → thinking → acting → idle`
- PhaseController 管理各阶段逻辑

---

## 数据模型

### 核心实体

| 实体 | 说明 |
|------|------|
| Player | 玩家（属性、阵营、道具、关系、压力） |
| Attributes | 六维属性（1-20，共 72 点） |
| Alignment | 九宫格阵营 |
| Item | 6 种道具（通用，不绑定职业） |
| Relation | 关系（信任、友好，-10 ~ +10） |
| Role | 7 种职业 |

### 检定系统

```
检定 = 属性 + 1d20 + 阵营修正 + 压力修正
大成功：骰子 20（必定成功）
大失败：骰子 1（必定失败）
```

---

## 开发规范

### 代码规范

**禁止魔法数字和字符串：**
- 所有数字常量必须定义在 `src/types.ts` 或 `src/lib/constants/` 中
- 策略相关阈值（如 `0.5`、`0.7`）必须放在 `src/lib/constants/strategy-thresholds.ts`
- 使用 TypeScript 联合类型约束字符串（如 `type Phase = 'night' | 'day'`）
- Biome 会自动检查 `noMagicNumbers`，构建时会报错
- 添加新阈值时，先在 `strategy-thresholds.ts` 定义，再在代码中引用，禁止硬编码后直接补常量

**导入规范：**
```typescript
// ✅ 正确
import type { Player, Role } from '@/types';
import { SCORE_PROPHET_VOTE_DUTY, BELIEF_DEFAULT_PROBABILITY } from '@/types';
import { hasItem } from '@/lib/game/items';

// ❌ 错误
if (wolfProb > 0.5) { ... }  // 应使用 BELIEF_HIGH_SUSPICION_THRESHOLD
if (phase === 'night') { ... }  // 可以，因为 Phase 类型已约束
```

### 构建与测试

```bash
bun run build    # 构建验证（含 lint + 类型检查）
bun run test     # 运行测试（145 个）
bun run lint     # 代码检查
bun run lint:fix # 自动修复
```

### 架构纪律

**文件体积约束**
- 单文件不超过 600 行（意图系统、策略文件等易膨胀模块优先）
- 超过 400 行时必须评估拆分：按类型 / 按职责 / 按子域拆分子目录
- `index.ts` 只做 barrel export，不承载逻辑

**接口一致性**
- 修改 `interface` 后必须 `grep` 所有引用点，确保调用签名匹配
- 禁止用 `as any` 绕过类型错误。临时方案用 `unknown + 类型守卫`，长期方案修正类型定义
- 关联字段（如 `trust`/`friendly` 和 `favor`）必须定义在同一个文件中，修改时同步更新

**继承规范**
- 覆盖父类方法时必须调用 `super.xxx()`，除非有明确的架构理由
- 子类需要"插入额外逻辑"时用钩子（`beforeXxx` / `afterXxx`），不要复制整个父方法

**状态写入路径**
- 同一类状态只允许一条写入路径（如 `tickLogBuffer → logs`）
- 禁止绕过主缓冲直接写最终状态（如 `_addThinkingLogs` 必须写 `tickLogBuffer`）
- 阶段检查逻辑（如 `_checkWinCondition`）只在统一入口调用，禁止散落在各分支中

**模块职责**
- 一个文件只承载一个独立概念（`DesireEngine` / `PlanLibrary` / `IntentionManager` 各自独立）
- 公共字段不超过 10 个，内部状态用 `private` / `protected`，下划线前缀不意味着 public

**React Hook 安全**
- 递归 `setTimeout` 回调必须用 `useRef` 存储最新引用，避免闭包陷阱
- `useCallback` 的依赖数组必须完整，禁止用空数组 `[]` 规避依赖问题
- 高频状态更新（如每 tick 的 `setPlayers`）添加浅比较，避免无意义重渲染

**死代码管理**
- 未使用的导出、方法、变量立即删除，不要标记为 "@deprecated" 长期保留
- 重构前用 `grep` 确认调用点，确认无调用再删除

**新增功能流程**

1. 修改 `../design/` 中的游戏机制设计文档
2. 更新 `src/types/` 中的类型和常量
3. 实现代码逻辑
4. 运行 `bun run build && bun run test`

---

## 参考文档

| 文档 | 路径 | 说明 |
|------|------|------|
| TODO | `TODO.md` | 功能清单和待办事项 |
| 数值设计 | `../design/core/numeric.md` | 属性、检定、修正规则 |
| 道具设计 | `../design/content/items.md` | 道具能力和设计原则 |
| AI 决策架构 | `doc/ai/DECISION-ARCHITECTURE.md` | 候选生成 → mind enrich → 硬约束 → Softmax |
| 心智系统 | `doc/ai/MIND-SYSTEM.md` | SocialContext / ValueSystem / Timing / MentalSimulation |
