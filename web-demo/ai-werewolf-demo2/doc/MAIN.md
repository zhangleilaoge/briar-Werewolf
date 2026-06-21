# 目录（Document Index）

> 基于记忆的狼人杀 AI 系统。核心：记忆系统 + 关系系统 + 推理系统 + 意图系统 + 状态系统 + 特质系统 + 物品系统。

## 文档

| 文档 | 内容 | 状态 |
|------|------|------|
| [MEMORY-SYSTEM.md](MEMORY-SYSTEM.md) | 记忆系统（触发时机、来源、可信度、遗忘机制） | **核心** |
| [RELATION.md](RELATION.md) | 关系系统（友好度，纯粹的关系） | **核心** |
| [INFERENCE.md](INFERENCE.md) | 推理系统（角色概率 + 局势危机度） | **核心** |
| [INTENTION.md](INTENTION.md) | 意图系统（长期/短期意图 + 行动候选 + 加权选择） | **核心** |
| [ROLE.md](ROLE.md) | 职业文档（村民/狼人/狂狼/预言家） | 定义 |
| [ACTION.md](ACTION.md) | 动作系统（白天5种 + 夜间动作） | 定义 |
| [MODERATOR.md](MODERATOR.md) | 游戏流程（init → night → day → 循环） | 定义 |
| [ROLE-SPECIFIC.md](ROLE-SPECIFIC.md) | 角色逻辑（预言家/狼人/村民 + 5种白日行动） | 定义 |
| [ITEM.md](ITEM.md) | 物品系统（水晶球完整示例） | 定义 |
| [PERSONALITY.md](PERSONALITY.md) | 性格系统（插件，影响行动选择） | 预留 |
| [PRESSURE.md](PRESSURE.md) | 压力系统（记忆的产物，满触发美德/崩溃） | 预留 |
| [STATE.md](STATE.md) | 状态系统（美德/崩溃，影响行为） | 预留 |
| [TRAIT.md](TRAIT.md) | 特质系统（孤狼示例，只影响机制） | 定义 |

## 代码

| 模块 | 路径 | 内容 |
|------|------|------|
| 类型 | `src/types/index.ts` | 核心类型（记忆、关系、玩家、常量） |
| 记忆 | `src/memory/mem-store.ts` | 记忆存储 + 遗忘引擎 |
| 记忆 | `src/memory/mem-entry.ts` | 记忆工厂函数 |
| 关系 | `src/relation/relation.ts` | 友好度跟踪器 |
| 推理 | `src/inference/inference-engine.ts` | 角色概率推理引擎 |

## 当前范围

- ✅ 角色：预言家、狼人、村民
- ✅ 动作：沉默、公布身份、观察、怀疑、袒护
- ✅ 记忆：来源分类、触发时机、遗忘机制（不删除，只标记）
- ✅ 关系：友好度（-10 ~ 10）
- ✅ 推理：角色概率 + 局势危机度，动态计算，不缓存
- ✅ 性格：插件系统，影响行动选择
- ✅ 压力：记忆的产物，满触发美德/崩溃
- ✅ 状态：美德/崩溃，影响行为
- ✅ 特质：只影响机制（孤狼示例）
- ✅ 物品：水晶球、双刃剑
- ✅ 职业：浅层定义（标签+阵营+物品）
- ❌ 决策引擎（暂不实现）
- ❌ 女巫、猎人、窃贼、验尸官（暂不实现）
- ❌ 投票机制（暂不实现）
