# AI Werewolf System - Agent Guide

## Project Overview

这是一个基于记忆系统的狼人杀 AI 模拟系统（AI Werewolf Game）。核心理念：**每个 AI 玩家都是独立的决策个体，拥有自己的记忆、关系、推理和意图系统**。

系统模拟完整狼人杀游戏流程：初始化 → 夜间行动 → 白天发言 → 投票 → 循环，直到一方胜利。

### 核心子系统

| 子系统 | 模块路径 | 功能 |
|--------|----------|------|
| **记忆系统 (Memory)** | `src/memory/` | 存储 AI 的原始记忆，支持遗忘机制（不删除，只标记） |
| **关系系统 (Relation)** | `src/relation/` | 跟踪玩家之间的友好度（-10 ~ 10） |
| **推理系统 (Inference)** | `src/inference/` | 角色概率推理 + 局势危机度计算，动态计算不缓存 |
| **意图系统 (Intention)** | `src/intention/` | 长期意图 → 短期意图 → 候选行动 → 加权选择 |
| **演示系统 (Demo)** | `src/components/demo/` | 可视化游戏运行器，展示所有 AI 的决策过程 |

### 当前实现的角色

- **预言家 (Prophet)**：夜间查验玩家身份
- **狼人 (Werewolf)**：夜间投票击杀玩家
- **村民 (Villager)**：白天通过发言和投票找出狼人

### 当前实现的白天行动

| 行动 | 说明 |
|------|------|
| `silence` | 沉默：跳过本回合发言 |
| `claim_identity` | 公布身份：声明自己的身份（可能为假） |
| `observe` | 观察：暗中观察目标玩家的行为 |
| `suspect` | 怀疑：公开表达对某玩家的怀疑 |
| `defend` | 袒护：公开为某玩家辩护 |
| `chat` | 闲聊：与目标玩家闲聊（不影响关系） |

### 决策流程

```
长期意图评估 → 短期意图生成 → 行动候选集 → 加权随机选择 → 执行
```

---

## Tech Stack

| 技术 | 版本 | 用途 |
|------|------|------|
| **Astro** | ^5.16.11 | 静态站点生成框架 |
| **React** | ^19.0.0 | UI 组件 |
| **TypeScript** | ^5.9.3 | 类型安全 |
| **Tailwind CSS** | ^3.4.17 | 样式系统 |
| **Biome** | ^2.5.0 | Lint + Formatter |
| **Vitest** | ^4.1.9 | 单元测试 |
| **Vite** | (Astro 内置) | 构建工具 |

---

## Build & Dev Commands

```bash
# 开发服务器
npm run dev

# 生产构建
npm run build

# 预览构建产物
npm run preview

# 运行测试
npm run test

# Lint 检查
npm run lint

# Lint 自动修复
npm run lint:fix
```

或使用 Makefile：

```bash
make dev
```

---

## Project Structure

```
ai-werewolf-demo2/
├── src/
│   ├── types/              # 核心类型定义
│   │   ├── index.ts        # 记忆、关系、玩家、角色类型
│   │   └── decision.ts     # 决策系统类型（意图、候选行动）
│   ├── memory/             # 记忆系统
│   │   ├── mem-store.ts    # 记忆存储中心 + 遗忘引擎
│   │   └── mem-entry.ts    # 记忆工厂函数
│   ├── relation/           # 关系系统
│   │   └── relation.ts     # 友好度跟踪器
│   ├── inference/          # 推理系统
│   │   └── inference-engine.ts  # 角色概率 + 危机度推理
│   ├── intention/          # 意图系统
│   │   ├── intention-engine.ts  # 意图引擎（4步决策流程）
│   │   ├── personalities.ts     # 性格定义（5种性格）
│   │   └── constants.ts         # 意图系统常量
│   ├── data/               # 演示数据
│   │   └── scenarios.ts    # 预设演示场景
│   ├── components/         # React 组件
│   │   └── demo/
│   │       ├── GameRunner.tsx      # 游戏运行器主组件
│   │       ├── SystemPreview.tsx   # 系统预览
│   │       ├── IntentionDemo.tsx   # 意图演示
│   │       └── InferenceDemo.tsx   # 推理演示
│   ├── pages/              # Astro 页面
│   │   ├── index.astro     # 首页（重定向到 /demo）
│   │   └── demo/
│   │       └── index.astro # 游戏演示页面
│   ├── layouts/            # 布局组件
│   │   └── Layout.astro    # 全局布局
│   └── styles/             # 全局样式
│       └── global.css      # Tailwind 入口
├── doc/                    # 设计文档（核心参考）
│   ├── MAIN.md             # 文档索引（必读）
│   ├── MEMORY-SYSTEM.md    # 记忆系统设计
│   ├── RELATION.md         # 关系系统设计
│   ├── INFERENCE.md        # 推理系统设计
│   ├── INTENTION.md        # 意图系统设计
│   ├── ACTION.md           # 动作系统定义
│   ├── MODERATOR.md        # 游戏流程定义
│   ├── ROLE.md             # 角色定义
│   ├── ROLE-SPECIFIC.md    # 角色逻辑
│   ├── PERSONALITY.md      # 性格系统定义
│   ├── PRESSURE.md         # 压力系统定义
│   ├── STATE.md            # 状态系统定义
│   ├── TRAIT.md            # 特质系统定义
│   └── ITEM.md             # 物品系统定义
├── package.json
├── astro.config.mjs
├── biome.json              # Lint/Format 配置
├── tailwind.config.ts
├── tsconfig.json
└── Makefile
```

---

## Key Types

### Player

```typescript
interface Player {
  id: string;
  name: string;
  role: Role;           // 'prophet' | 'werewolf' | 'villager'
  team: Team;           // 'werewolf' | 'villager'
  alive: boolean;
  personality: string;  // 性格ID
  pressure: number;     // 0~20，压力值
  burstCount: number;   // 已爆满次数
  traits: string[];     // 特质ID列表
  attributes: {         // 0~10 的属性值
    leadership, eloquence, observation,
    cunning, affinity, logic
  };
}
```

### MemoryEntry

```typescript
interface MemoryEntry {
  id: string;
  triggerAt: MemoryTrigger;  // 触发时机
  round: number;
  eventType: MemoryEventType;
  actorId: string;
  targetId?: string;
  content: Record<string, unknown>;
  source: MemorySource;      // 'system' | 'self' | 'speech' | 'observe'
  credibility: number;       // 0~1 可信度
  importance: number;        // 0~1 重要度（决定遗忘难度）
  isForgotten: boolean;      // 遗忘标记
  createdAt: number;
}
```

### 可信度常量

```typescript
CREDIBILITY = {
  SYSTEM: 1.0,   // 系统事件
  SELF: 1.0,     // 自己的行动
  SPEECH: 0.4,   // 他人发言（默认不可信）
  OBSERVE: 0.7,  // 自己的观察
}
```

---

## Code Style

项目使用 **Biome** 进行代码格式化和 Lint，配置在 `biome.json`：

### 格式化规则

- **缩进**：Tab 缩进
- **行宽**：100 字符
- **引号**：单引号
- **尾逗号**：全部添加
- **分号**：仅在必要时添加

### Lint 规则（放宽项）

以下规则被禁用，这是有意为之：

- `noConsoleLog`: 允许 `console.log`（调试用途）
- `noExplicitAny`: 允许 `any` 类型
- `noNonNullAssertion`: 允许 `!` 非空断言
- `useExhaustiveDependencies`: 不强制 React hooks 依赖完整性
- `noForEach`: 允许 `forEach`

### 逻辑拆分

- **单文件不允许大于 600 行**，超过时应拆分为多个模块
- 一个函数/方法应只做一件事
- 相关逻辑按职责拆分到独立文件，通过 index 统一导出

### 命名规范

- 文件名：`kebab-case`（如 `inference-engine.ts`）
- 类名：`PascalCase`（如 `InferenceEngine`）
- 接口名：`PascalCase`（如 `RoleInference`）
- 常量：`UPPER_SNAKE_CASE`（如 `CREDIBILITY`）
- 函数名：`camelCase`（如 `inferPlayer`）
- 私有方法：`_camelCase` 前缀（如 `_inferPlayer`）

---

## Architecture Notes

### 记忆系统

- 所有记忆不可变，只添加不删除
- 遗忘机制：通过 `isForgotten` 标记，基于记忆的重要度和时间衰减
- 遗忘公式：`forgettingRate = base + memoryPressure + timeDecay * (1 - base - memoryPressure)`
- 查询方法丰富：`aboutPlayer`, `byActor`, `byTarget`, `byType`, `hardInfo` 等

### 推理系统

- **角色概率推理**：基于记忆证据，计算每个玩家是狼人/村民的概率
- **硬信息优先**：查验结果（credibility=1.0）直接覆盖软信息
- **软信息加权**：基于 credibility 和 confidence 加权计算
- **危机度计算**：统计其他所有玩家对该玩家的行为（被指控、被投票等）
- **完全动态**：每次调用都重新从记忆计算，不缓存

### 意图系统

4 步决策流程：

1. **长期意图评估**：根据阵营和角色生成优先级意图
2. **短期意图生成**：将长期意图转化为具体行动方向
3. **候选行动生成**：为每个短期意图生成候选行动
4. **加权随机选择**：综合角色推理、局势、性格、压力等因素加权选择

### 性格系统

5 种预设性格，影响行动选择：

| 性格 | 特点 |
|------|------|
| `aggressive` | 好斗型：高频怀疑，禁用沉默 |
| `cautious` | 谨慎型：多观察，禁用公布身份 |
| `manipulative` | 操控型：善于引导，无禁用行动 |
| `loyal` | 忠诚型：重视保护，高频辩护 |
| `suspicious` | 多疑型：总是怀疑，禁用辩护 |

### 关系系统

- 纯粹的好友度系统，与推理无关
- 友好度范围：-10 ~ 10，初始 0
- 被攻击（怀疑、投票）→ 友好度降低
- 被袒护（辩护）→ 友好度升高

---

## Testing

```bash
npm run test        # 运行所有测试
```

项目使用 **Vitest** 作为测试框架。目前核心逻辑模块（`src/memory/`, `src/inference/`, `src/intention/`, `src/relation/`）没有单元测试文件，主要通过演示系统进行集成验证。

---

## Documentation

详细设计文档在 `doc/` 目录：

- **必读**：`doc/MAIN.md`（文档索引 + 当前实现范围）
- **核心系统**：`MEMORY-SYSTEM.md`, `RELATION.md`, `INFERENCE.md`, `INTENTION.md`
- **定义文档**：`ACTION.md`, `ROLE.md`, `ROLE-SPECIFIC.md`, `MODERATOR.md`
- **预留系统**：`PERSONALITY.md`, `PRESSURE.md`, `STATE.md`, `TRAIT.md`, `ITEM.md`

---

## What's NOT Implemented Yet

- ❌ 决策引擎（intention engine 已部分实现）
- ❌ 女巫、猎人、窃贼、验尸官角色
- ❌ 投票机制（目前简化实现）
- ❌ 压力系统（PRESSURE.md 预留）
- ❌ 状态系统（美德/崩溃，STATE.md 预留）
- ❌ 物品系统（水晶球、双刃剑，ITEM.md 预留）

---

## Path Aliases

项目使用 `@/` 别名指向 `src/` 目录：

```typescript
import { MemStore } from '@/memory';
import { InferenceEngine } from '@/inference/inference-engine';
import type { Player } from '@/types';
```

在 `tsconfig.json` 和 `astro.config.mjs` 中配置。
