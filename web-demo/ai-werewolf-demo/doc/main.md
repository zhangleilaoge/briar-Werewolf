# 文档总览

本文档梳理 `ai-werewolf-demo` 下所有文档的层次关系，以及它们与 `web-demo/design`（游戏机制设计）之间的边界。

---

## 文档分层

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: 游戏机制设计（web-demo/design）                    │
│  → 实现无关的游戏规则、数值、角色、道具等设计                  │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: AI 架构设计（doc/ai/*.md）                          │
│  → 决策系统、心智模型、评分机制等 AI 专项设计                  │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: 工程文档（根目录 AGENTS.md / TODO.md）             │
│  → 技术栈、目录结构、开发规范、待办清单                      │
└─────────────────────────────────────────────────────────────┘
```

**规则**：上层发生变更时，下层必须同步更新；下层的技术实现细节不得反向污染上层的机制设计。

---

## 文档索引

### 游戏机制设计（web-demo/design）

| 文件 | 说明 | 边界 |
|------|------|------|
| [design/overview/main.md](../design/overview/main.md) | 机制总览与核心设计原则 | 纯设计，无代码路径 |
| [design/core/flow.md](../design/core/flow.md) | 对局流程 | 纯设计，无代码路径 |
| [design/core/numeric.md](../design/core/numeric.md) | 数值设计（属性、检定、修正） | 纯设计，无代码路径 |
| [design/core/alignment.md](../design/core/alignment.md) | 阵营九宫格 | 纯设计，无代码路径 |
| [design/actions/actions.md](../design/actions/actions.md) | 白天普通行动 | 纯设计，无代码路径 |
| [design/actions/extra-actions.md](../design/actions/extra-actions.md) | 追加行动 | 纯设计，无代码路径 |
| [design/content/characters.md](../design/content/characters.md) | 角色 | 纯设计，无代码路径 |
| [design/content/preset-characters.md](../design/content/preset-characters.md) | 预设角色 | 纯设计，无代码路径 |
| [design/content/traits.md](../design/content/traits.md) | 特质 | 纯设计，无代码路径 |
| [design/content/professions.md](../design/content/professions.md) | 职业 | 纯设计，无代码路径 |
| [design/content/items.md](../design/content/items.md) | 道具 | 纯设计，无代码路径 |
| [design/refer/](../design/refer/) | 外部参考 | 纯设计 |

### AI 架构设计（doc/ai/）

| 文件 | 说明 | 依赖的设计文档 |
|------|------|--------------|
| [doc/ai/DECISION-ARCHITECTURE.md](ai/DECISION-ARCHITECTURE.md) | 决策流程总览：候选生成 → mind enrich → 硬约束 → Softmax | design/core/flow, design/actions/actions |
| [doc/ai/MIND-SYSTEM.md](ai/MIND-SYSTEM.md) | 心智驱动系统详细设计：SocialContext、ValueSystem、Timing、MentalSimulation、Softmax | design/core/numeric, design/content/characters |

### 工程文档（根目录）

| 文件 | 说明 | 定位 |
|------|------|------|
| [AGENTS.md](../AGENTS.md) | 技术栈、目录结构、数据模型、开发规范 | 工程入口 |
| [TODO.md](../TODO.md) | 功能清单和待办事项 | 任务跟踪 |

---

## 文档职责边界

### 什么属于 design（游戏机制设计）？
- 角色能力、道具效果、行动规则
- 数值公式（如 `检定 = 属性 + 1d20 + 阵营修正 + 压力修正`）
- 对局流程（白天 → 投票 → 夜晚 → 早晨）
- 阵营九宫格的语义定义

### 什么属于 doc/ai（AI 架构设计）？
- AI 如何根据游戏机制做出决策
- mind enrich 的六个乘法因子及其权重
- Softmax 温度参数的调整规则
- 候选生成的配置表结构

### 什么属于工程文档（AGENTS.md）？
- 技术栈、构建命令、测试策略
- 代码目录结构、文件体积约束
- 类型系统、导入规范、lint 规则
- 与具体实现相关的开发纪律

---

## 更新时序

当新增或修改功能时，按以下顺序更新文档：

1. **先改 design** — 如果涉及游戏机制变更（新角色、新道具、新行动）
2. **再改 doc/ai** — 如果影响 AI 决策逻辑（新 action 需要新的价值观签名、新的时机评估逻辑）
3. **最后改 AGENTS.md** — 如果涉及技术栈、目录结构或开发规范变更
4. **同步 TODO.md** — 标记已完成或新增待办
