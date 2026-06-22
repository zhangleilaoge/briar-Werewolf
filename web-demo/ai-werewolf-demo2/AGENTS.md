# AI Werewolf System - Agent Guide

## Overview

狼人杀 AI 模拟系统。每个 AI 玩家是独立决策个体，拥有记忆、关系、推理、意图系统。

流程：初始化 → 夜间行动 → 白天发言 → 投票 → 循环至一方胜利。

## Tech Stack

Astro + React + TypeScript + Tailwind CSS + Biome (lint/format) + Vitest (test)

## Build Commands

```bash
npm run dev          # 开发服务器
npm run build        # 生产构建
npm run test         # 运行测试
npm run lint         # Lint 检查
npm run lint:fix     # Lint 自动修复
```

## Project Structure

```
src/
├── constants/        # 所有魔法数字/字符串在此维护
│   ├── roles.ts      # 角色/阵营/阶段
│   ├── credibility.ts # 可信度、硬信息阈值
│   ├── memory.ts     # 重要度、遗忘参数
│   ├── inference.ts  # 默认概率、权重、危机度权重
│   ├── relation.ts   # 友好度变化量、范围
│   ├── intention.ts  # 优先级、候选分数、压力修正
│   └── game.ts       # 回合限制、属性范围、初始值
├── types/            # 纯类型定义（Player, MemoryEntry, Relation, decision types）
├── memory/           # 记忆存储 + 遗忘引擎 + 工厂函数
├── relation/         # 友好度跟踪器（-10 ~ 10）
├── inference/        # 角色概率推理 + 危机度计算（动态，不缓存）
├── intention/        # 意图引擎（4步决策）+ 性格定义
├── data/             # 演示场景数据
├── components/demo/  # 可视化游戏运行器
├── pages/            # Astro 页面（/demo）
└── doc/              # 设计文档（必读 doc/MAIN.md）
```

路径别名：`@/` → `src/`（配置在 tsconfig.json + astro.config.mjs）

## Core Subsystems

| 子系统 | 模块 | 职责 |
|--------|------|------|
| 记忆 Memory | `src/memory/` | 不可变存储，遗忘机制（isForgotten 标记，不删除） |
| 关系 Relation | `src/relation/` | 友好度跟踪，与推理无关 |
| 推理 Inference | `src/inference/` | 角色概率（硬信息覆盖软信息）+ 危机度 |
| 意图 Intention | `src/intention/` | 长期意图 → 短期意图 → 候选 → 加权选择 |

### 决策流程

```
长期意图评估 → 短期意图生成 → 行动候选集 → 加权随机选择 → 执行
```

### 性格系统

5 种：`aggressive`(好斗)、`cautious`(谨慎)、`manipulative`(操控)、`loyal`(忠诚)、`suspicious`(多疑)

## Code Conventions

### 常量管理

**禁止硬编码**。所有魔法值在 `src/constants/` 维护，直接导入：

```typescript
import { CREDIBILITY, BELIEF_DEFAULT, FORGETTING } from '@/constants';
```

### 逻辑拆分

- **单文件 ≤ 600 行**，超过必须拆分
- 一个函数只做一件事
- 按职责拆分到独立文件，通过 index 统一导出

### 命名

- 文件名 `kebab-case`，类/接口 `PascalCase`
- 常量 `UPPER_SNAKE_CASE`，函数 `camelCase`
- 私有方法 `_camelCase` 前缀

### 格式化（Biome）

Tab 缩进 · 100 字符行宽 · 单引号 · 尾逗号 · 分号仅必要时

放宽规则：`noConsoleLog`、`noExplicitAny`、`noNonNullAssertion`、`useExhaustiveDependencies`、`noForEach`

## Testing

Vitest，测试文件 `xxx.test.ts` 与源文件同目录。最小闭环，不追求覆盖率。

```bash
npm run test
```

## Documentation

`doc/MAIN.md` 为文档索引。核心：`MEMORY-SYSTEM.md`、`RELATION.md`、`INFERENCE.md`、`INTENTION.md`

预留：`PERSONALITY.md`、`PRESSURE.md`、`STATE.md`、`TRAIT.md`、`ITEM.md`

## Not Implemented Yet

- ❌ 女巫、猎人、窃贼、验尸官角色
- ❌ 投票机制（目前简化实现）
- ❌ 压力系统 / 状态系统（美德/崩溃）/ 物品系统
