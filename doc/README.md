# Briar-Werewolf 文档中心

本目录存放项目级全局文档，包括 AI 系统架构、工程索引等。游戏机制设计文档位于 `web-demo/doc/`。

---

## 文档索引

### 架构与 AI

| 文档 | 路径 | 说明 |
|------|------|------|
| [AI 系统架构](ai/ARCHITECTURE.md) | `doc/ai/ARCHITECTURE.md` | 四层信念系统 + 硬约束决策引擎设计 |

### 工程与开发

| 文档 | 路径 | 说明 |
|------|------|------|
| AI 对战项目说明 | `web-demo/ai-werewolf-demo/AGENTS.md` | 技术栈、目录结构、数据模型、开发规范、TODO |
| 重构计划 | `web-demo/ai-werewolf-demo/plan.md` | Demo 重构阶段、文件修改清单、时间估算 |

### 游戏机制设计

| 文档 | 路径 | 说明 |
|------|------|------|
| 游戏设计文档索引 | `web-demo/doc/README.md` | 机制总览、沟通规范、完整索引 |
| 机制总览 | `web-demo/doc/overview/main.md` | 核心设计原则与总览 |
| 对局流程 | `web-demo/doc/core/flow.md` | 完整回合结构 |
| 数值设计 | `web-demo/doc/core/numeric.md` | 属性、关系、压力、检定规则 |
| 阵营九宫格 | `web-demo/doc/core/alignment.md` | 守序/混乱 × 善良/邪恶对检定的修正 |
| 压力过载 | `web-demo/doc/core/stress-overload.md` | 美德 / affliction 系统设计 |
| 白天行动 | `web-demo/doc/actions/actions.md` | 普通行动规则 |
| 追加行动 | `web-demo/doc/actions/extra-actions.md` | 追加行动触发与效果 |
| 职业 | `web-demo/doc/content/professions.md` | 7 种职业的能力与限制 |
| 道具 | `web-demo/doc/content/items.md` | 6 种道具的双阵营效果 |
| 角色 | `web-demo/doc/content/characters.md` | 角色设计 |
| 预设角色 | `web-demo/doc/content/preset-characters.md` | 预设角色 |
| 特质 | `web-demo/doc/content/traits.md` | 特质设计 |
| 参考：传统狼人杀 | `web-demo/doc/refer/werewolf.md` | 对比参考 |
| 参考：Gnosia | `web-demo/doc/refer/gnosia.md` | 对比参考 |

---

## 项目结构速查

```
briar-Werewolf/
  doc/                          # ← 本文档中心（全局文档）
    ai/
      ARCHITECTURE.md           # AI 系统架构设计
  web-demo/
    ai-werewolf-demo/           # Astro + React 演示端
      src/lib/ai/               # AI 系统实现（TS）
      src/lib/game/             # 游戏模拟器
      src/components/           # UI 组件
      AGENTS.md                 # 项目说明与开发规范
      plan.md                   # 重构计划
    doc/                        # 游戏机制设计文档
      core/
      content/
      actions/
      refer/
      overview/
      drafts/
  project.godot                 # Godot 引擎项目（未来主游戏）
```
