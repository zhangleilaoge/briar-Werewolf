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
- **测试**: Vitest (90 个测试)
- **Lint**: Biome (noMagicNumbers + noUnusedImports)

### 目录结构

```
src/
├── types.ts              # 类型定义 + 常量（唯一导入源 @/types）
├── utils/                # 通用工具函数
│   ├── dice.ts          # 骰子和检定系统
│   └── math.ts          # 数学工具
├── components/           # React UI 组件
├── lib/
│   ├── ai/              # AI 系统（信念、意图、策略）
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
- 所有数字常量必须定义在 `src/types.ts` 中
- 使用 TypeScript 联合类型约束字符串（如 `type Phase = 'night' | 'day'`）
- Biome 会自动检查 `noMagicNumbers`，构建时会报错

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
bun run build    # 构建验证（含 lint 检查）
bun run test     # 运行测试（90 个）
bun run lint     # 代码检查
bun run lint:fix # 自动修复
```

### 新增功能流程

1. 修改 `../doc/` 中的设计文档
2. 更新 `src/types.ts` 中的类型和常量
3. 实现代码逻辑
4. 运行 `bun run build && bun run test`

---

## 参考文档

| 文档 | 路径 | 说明 |
|------|------|------|
| TODO | `TODO.md` | 功能清单和待办事项 |
| 数值设计 | `../doc/core/numeric.md` | 属性、检定、修正规则 |
| 道具设计 | `../doc/content/items.md` | 道具能力和设计原则 |
| AI 架构 | `../doc/ai/ARCHITECTURE.md` | 信念系统和决策引擎 |
| 插件架构 | `PLUGIN-REFACTOR-COMPLETE.md` | 插件化重构详解 |
