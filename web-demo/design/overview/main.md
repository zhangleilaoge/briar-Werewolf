# 游戏机制主文档

## 核心定位

- 本游戏不是单纯的狼人杀，也不是纯约束满足问题（CSP）设计。
- 游戏存在大量变量和数值，许多行动效果由数值与骰子共同决定。

## 文档结构

| 文件 | 内容 |
|------|------|
| [main.md](main.md) | 机制总览与核心设计原则 |
| [flow.md](../core/flow.md) | 对局流程：回合结构、夜晚、白天、投票、胜利条件 |
| [actions.md](../actions/actions.md) | 白天普通行动的详细规则 |
| [extra-actions.md](../actions/extra-actions.md) | 追加行动的详细规则 |
| [numeric.md](../core/numeric.md) | 属性、关系、压力值、检定等全部数值细节 |
| [alignment.md](../core/alignment.md) | 阵营九宫格对行动、关系与压力的影响 |
| [characters.md](../content/characters.md) | 角色：名字、背景、性格等叙事设计 |
| [preset-characters.md](../content/preset-characters.md) | 预设角色的概念与设计目的 |
| [traits.md](../content/traits.md) | 特质：非基础属性的人物效果修正 |
| [professions.md](../content/professions.md) | 职业：阵营与特殊能力 |
| [items.md](../content/items.md) | 道具系统与道具对行动的影响 |
| [refer/](../refer/) | 外部参考 |

## 核心数值分层

1. **属性**：六维基础能力，决定检定加值。详见 [numeric.md](../core/numeric.md)。
2. **关系**：有向的信任值与友好值，影响互动与投票。详见 [numeric.md](../core/numeric.md)。
3. **状态**：独立的压力值，影响伪装、观察与情绪行为。详见 [numeric.md](../core/numeric.md)。
4. **阵营**：九宫格行为倾向，修正行动效果与关系/压力变化。详见 [alignment.md](../core/alignment.md)。

## 核心限制

- 所有属性、关系、阵营、压力值**只影响白天阶段**，不影响夜晚杀戮阶段。
- 夜晚杀戮由身份阵营与职业能力决定。

## 对局流程（概述）

对局由白天与夜晚交替组成：

- **夜晚阶段**：狼人选择袭击目标，结算死亡。
- **白天阶段**：公布死亡、轮流行动、投票放逐。

详见 [flow.md](../core/flow.md)。可用行动详见 [actions.md](../actions/actions.md)。
