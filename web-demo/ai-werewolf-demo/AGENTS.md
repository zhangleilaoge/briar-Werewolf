# AGENTS.md - 狼人杀 AI 对战项目

## 项目概述

本项目是一个基于 Astro + React + TypeScript 的狼人杀 AI 对战演示。所有玩家（包括人类和 AI）在一个复杂的推理系统中行动，包含六维属性、九宫格阵营、压力系统和社交关系网络。

**项目路径**: `/web-demo/ai-werewolf-demo/`
**构建输出**: 静态 HTML (`dist/`)
**启动方式**: `bun run build` (静态输出) / `bun run dev` (开发模式)

---

## 核心架构

### 1. 技术栈

- **前端框架**: Astro + React + Tailwind CSS
- **构建工具**: Vite (via Astro)
- **语言**: TypeScript
- **无服务端**: 纯静态输出，所有逻辑在客户端运行

### 2. 目录结构

```
src/
  types.ts             # 统一类型/常量/工具定义（唯一导入源，使用 @/types）
  components/          # React UI 组件
    GameApp.tsx        # 主游戏界面
    SetupPanel.tsx     # 开局配置面板
    useGameRunner.ts   # 游戏状态管理 Hook
    ui-utils.ts        # UI 工具函数（角色名映射、颜色、标签）
  pages/
    index.astro        # 入口页面
  lib/
    ai/                # AI 系统
      ai-agent.ts       # AI 智能体封装
      belief-system.ts  # 四层信念系统（L0/L1/L2/L3）
      behavior-modifiers.ts # 行为修正计算
      strategies/       # 策略体系
        engine.ts       # 决策引擎
        index.ts        # 策略注册（白天/投票/追加行动）
        day.ts          # 白天策略
        vote.ts         # 投票策略
        appendix.ts     # 追加行动策略
    game/               # 游戏模拟器
      simulator.ts      # 入口，导出 GameSimulator
      simulator-core.ts # 核心类（状态管理、Tick 引擎、Actor 状态机）
      simulator-phases.ts # PhaseController 子类（Day/Night/Vote/Morning/CheckWin）
      simulator-night.ts   # 夜间行动处理（使用插件系统）
      simulator-morning.ts # 早晨事件处理
      simulator-day.ts     # 白天行动处理
      simulator-vote.ts    # 投票处理
      simulator-utils.ts   # 通用工具函数（日志、关系、状态获取）
      simulator-config.ts  # 开局配置生成
    plugins/            # 插件系统
      types.ts          # 插件接口定义（ActionProvider, TraitProvider）
      registry.ts       # 插件注册表（PluginRegistry）
      base.ts           # 基础工具函数
      index.ts          # 入口文件，注册所有插件
      items/            # 道具插件（提供能力）
        claws.ts        # 尖牙利爪（杀戮/反击）
        crystal-ball.ts # 水晶球（查验）
        thief-gloves.ts # 小偷手套（偷窃）
        coroner-tools.ts# 验尸工具（验尸）
        amulet.ts       # 护身符（被动防护）
        double-sword.ts # 双刃剑（同归于尽）
      traits/           # 特质插件（修改规则）
        lone-wolf.ts    # 孤狼特质（独立行动）
```

> 设计文档位于 `web-demo/doc/`，详见 `../doc/README.md`。

---

## 关键设计模式

### 1. 插件化架构 (Plugin System)

**三层架构：**
- **职业（配置层）**：预言家 = 村民 + 水晶球，窃贼 = 村民 + 小偷手套
- **道具插件（能力层）**：水晶球 → 查验能力，小偷手套 → 偷窃能力
- **特质插件（规则层）**：孤狼特质 → 修改狼人协调逻辑

**核心接口：**
- `ActionProvider`：道具插件接口，提供行动能力
- `TraitProvider`：特质插件接口，修改游戏规则
- `PluginRegistry`：插件注册表，管理所有插件

**设计原则：**
- 道具是通用的，任何人都可以使用（不绑定职业）
- 职业只是初始道具配置
- 特质修改规则，不可转移
- 新增道具/特质只需新增 1 个文件

### 2. 四层信念系统 (BeliefSystem)

每个 AI 拥有四层认知层次：
- **L0**: 原始事实（查验结果、死亡记录、公开宣称）
- **L1**: 概率推理（基于事实推断狼人概率）
- **L2**: 心智理论（推断其他玩家对自己的看法）
- **L3**: 社交情感（关系网络、压力状态、情绪）

### 3. 策略引擎 (DecisionEngine)

策略按优先级执行：Duty > Survival > Information > Social
每个策略返回候选行动列表，引擎综合评分选出最终行动。
插件策略使用 'plugin' 阶段，权重与 'information' 相同。

### 4. Tick-Based 并发 Actor 模型 (替代旧版步骤队列)

游戏使用 Tick 引擎 + Actor 状态机 + EventBus：
- `GameSimulator.tick()` 每次调用推进一个 tick
- 每个玩家是一个 Actor，状态：`idle → thinking → acting → idle`
- PhaseController 子类管理各阶段逻辑（Day/Night/Vote/Morning/CheckWin）
- EventBus 解耦事件发送和接收，支持追加行动反应

### 5. PhaseController 模式

各阶段由 PhaseController 子类管理：
- `DayPhaseController`: 顺序发言，追加行动反应
- `NightPhaseController`: 分组行动（使用插件系统执行）
- `VotePhaseController`: 两轮投票
- `MorningPhaseController`: 早晨事件（单 tick 同步）
- `CheckWinPhaseController`: 胜利检查

`simulator-*.ts` 导出纯函数，由 PhaseController 调用。

---

## 数据模型

### 核心实体

| 实体 | 文件 | 说明 |
|------|------|------|
| Player | `src/types.ts` | 玩家（属性、阵营、道具、关系、压力） |
| Attributes | `src/types.ts` | 六维属性（亲和、逻辑、领导、诡诈、隐蔽、洞察） |
| Alignment | `src/types.ts` | 九宫格阵营（守序/混乱 × 善良/邪恶） |
| Item | `src/types.ts` | 道具（尖牙利爪、水晶球、小偷手套、验尸工具、护身符、双刃剑） |
| Relation | `src/types.ts` | 关系（信任值、友好值，-10 ~ +10） |
| Role | `src/types.ts` | 职业（狼人、孤狼、狂狼、村民、预言家、窃贼、验尸官） |

### 检定系统

```
检定结果 = 基础属性 + 阵营修正 + 压力修正 + d20
对抗检定 = 双方分别计算后比较
```

阵营修正和压力修正已完整实现，见 `src/types.ts` 中的 `calculateFinalModifier()` 和 `performOpposedCheck()`。

---

## 魔法值管理

**所有魔法值已统一在 `src/types.ts` SECTION 3 中**：

- 属性范围（1-10）
- 压力范围（-10 ~ +10）
- 关系范围（-10 ~ +10）
- 检定难度（简单10、中等12、困难15、极难18）
- 策略分数（预言家投票200、狼人投票80、最大信息100等）
- 阈值（高怀疑0.6、临界暴露0.7、狼人概率0.4/0.5/0.6）
- 阶段权重（义务1000、生存800、信息500、社交100）
- 空刀概率（10%）

---

## 开发规范

### 文件大小限制

所有文件应尽量保持在 **600 行以内**。`src/types.ts` 作为基础定义文件例外（~460 行，包含类型+常量+工具函数）。

### 导入规范

统一使用 `@/types` 路径别名导入所有类型、常量和工具函数：
```ts
import type { Player, Role, Alignment } from '@/types';
import { rollD20, SCORE_PROPHET_VOTE_DUTY, ITEM_DEFINITIONS } from '@/types';
```

### 新增功能的流程

1. 先修改 `../doc/` 中的对应设计文档
2. 再更新 `src/types.ts` 中的类型定义和常量
3. 最后实现代码逻辑
4. 运行 `bun run build && bun run test` 验证

### 构建与测试

```bash
cd /web-demo/ai-werewolf-demo
bun run build    # 构建验证
bun run test     # 运行测试（vitest）
bun run lint     # 代码检查（biome：未使用变量/导入检查）
```

---

## 当前已知 TODO

### 已完成功能
- [x] 基础对局流程（夜-晨-白-投票）
- [x] 六维属性系统
- [x] 九宫格阵营系统
- [x] 压力系统（自然恢复、事件影响）
- [x] 关系系统（有向关系、自然恢复）
- [x] 道具系统（6种道具、耐久度、阵营差异效果）
- [x] 职业系统（7种职业）
- [x] 夜间行动（查验、杀戮、偷窃、验尸）
- [x] 白天行动（沉默、公布身份、公开信息、观察、怀疑、袒护、感谢、号召投票、阻止投票、担保清白、强烈指认、全员排除）
- [x] 追加行动（一同怀疑、反驳、一同袒护）
- [x] 投票系统（两轮、平票处理）
- [x] 胜利条件（狼人清零 / 狼人≥村民）
- [x] 孤狼冲突规则
- [x] 狂狼同归于尽 + 平安夜
- [x] 人类尖牙利爪反击
- [x] 狼人夜间协调（跟随队友目标）
- [x] 狼人空刀选项
- [x] 预言家公布义务
- [x] 阵营/压力修正到检定系统
- [x] 完整行动检定（所有白天行动使用 calculateFinalModifier + performOpposedCheck）
- [x] 连续沉默机制（观察未被发现视同沉默）
- [x] 魔法值全部提取到 constants.ts
- [x] 原型方法重构为类委托模式
- [x] 压力过载系统设计文档
- [x] types/constants 统一到 src/types.ts（@/types 导入）
- [x] Biome lint 配置（未使用变量/导入检查）
- [x] vitest 测试框架（68 个核心测试）
- [x] tick 循环 try-catch 安全保护
- [x] stuck-actor 超时安全阀
- [x] console.log DEBUG 开关
- [x] 死代码清理（GameStore.tsx、未使用接口、useGameRunner 无用变量）
- [x] **插件化架构**（道具插件 + 特质插件）
- [x] **职业与道具解耦**（道具通用，职业只是初始配置）
- [x] **特质插件化**（孤狼特质独立封装）

### 待实现功能
- [ ] 压力过载系统代码实现（美德/affliction）
- [ ] 压力过载 UI 特效（压力条闪烁、美德/affliction 颜色区分）
- [ ] AI 行为倾向受阵营/关系/压力影响（当前仅影响检定，未影响行为选择）
- [ ] 更多道具（增益类、减益类）
- [ ] 特质系统完整实现（目前仅孤狼特质）
- [ ] 预设角色系统
- [ ] 人类玩家可操控模式
- [ ] 存档/回放系统
- [ ] 更多 UI 可视化（关系图、压力曲线、怀疑热力图）

### 平衡性调整
- [ ] 美德概率 25% 可能需要调整
- [ ] 各类 affliction 效果强度需测试
- [ ] 传染压力数值需验证
- [ ] 空刀概率 10% 是否合理
- [ ] 狼人协调策略是否过强/过弱

---

## 技术债务

1. **追加行动窗口的日志不够详细**: 当前反驳、一同怀疑的日志较简略，应增加检定结果的具体数值展示。
2. **性能优化**: 当玩家数量 > 10 时，AI 推理（特别是 L2 Theory of Mind）的计算量可能较大。未来可考虑 Web Worker 或推理缓存。
3. **类型安全**: 部分 `details` 对象使用 `Record<string, unknown>`，可进一步收紧为联合类型。

---

## 贡献指南

### 修改 doc 设计

如果你认为某个设计不合理，可以直接修改 `../doc/` 中的对应文件，然后在代码中同步实现。保持 doc 和代码的一致性。

### 新增职业/道具

1. 在 `../doc/content/professions.md` 或 `items.md` 中设计
2. 在 `src/types.ts` 中更新 ROLE_INFO/ITEM_DEFINITIONS 和类型定义
3. 在 `src/types.ts` 中新增相关常量
4. 在 `ai/strategies/` 中新增对应的策略
5. 在 `simulator-*.ts` 中新增对应的结算逻辑

### 修改核心机制

修改核心机制（如检定公式、压力计算、投票规则）时：
1. 先修改 `../doc/core/numeric.md` 或 `flow.md`
2. 再修改 `src/types.ts` 中的常量
3. 最后修改 `simulator-*.ts` 中的实现
4. 确保 `bun run build && bun run test` 通过

---

## 参考文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 对局流程 | `../doc/core/flow.md` | 完整回合结构 |
| 数值设计 | `../doc/core/numeric.md` | 属性、关系、压力、检定规则 |
| 阵营设计 | `../doc/core/alignment.md` | 九宫格阵营对检定的修正 |
| 压力过载 | `../doc/core/stress-overload.md` | 美德/affliction 系统设计 |
| 职业设计 | `../doc/content/professions.md` | 7种职业的初始配置 |
| 道具设计 | `../doc/content/items.md` | 6种道具的通用能力 |
| 行动规则 | `../doc/actions/actions.md` | 白天普通行动的详细规则 |
| 追加行动 | `../doc/actions/extra-actions.md` | 追加行动的触发和效果 |
| AI 架构 | `../doc/ai/ARCHITECTURE.md` | 四层信念系统 + 硬约束决策引擎 |
| 插件架构 | `PLUGIN-REFACTOR-COMPLETE.md` | 插件化架构详解 |
