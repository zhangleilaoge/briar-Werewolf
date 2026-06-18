# AGENTS.md - 狼人杀 AI 对战项目

## 项目概述

本项目是一个基于 Astro + React + TypeScript 的狼人杀 AI 对战演示。所有玩家（包括人类和 AI）在一个复杂的推理系统中行动，包含六维属性、九宫格阵营、压力系统和社交关系网络。

**项目路径**: `/web-demo/ai-werewolf-demo/`
**构建输出**: 静态 HTML (`dist/`)
**启动方式**: `npm run build` (静态输出) / `npm run dev` (开发模式)

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
  components/          # React UI 组件
    GameApp.tsx        # 主游戏界面
    SetupPanel.tsx     # 开局配置面板
    useGameRunner.ts   # 游戏状态管理 Hook
    ui-utils.ts        # UI 工具函数（角色名映射、颜色、标签）
  pages/
    index.astro        # 入口页面
  lib/
    ai/                # AI 系统和数据模型
      types.ts          # 核心类型定义（角色、属性、道具、检定等）
      constants.ts      # 游戏常量（魔法值全部提取到这里）
      game-utils.ts     # 游戏工具函数（检定、道具操作、属性生成）
      data-definitions.ts # 数据定义常量（阵营名、道具定义、职业信息、特质）
      ai-agent.ts       # AI 智能体封装
      belief-system.ts  # 四层信念系统（L0/L1/L2/L3）
      strategies/       # 策略体系
        engine.ts       # 决策引擎
        index.ts        # 策略注册
        night.ts        # 夜间策略（查验、杀戮、偷窃、验尸）
        day.ts          # 白天策略（发言、怀疑、袒护、公布身份）
        vote.ts         # 投票策略（跟随号召、社交关系、生存）
        appendix.ts     # 追加行动策略（一同怀疑、反驳、一同袒护）
    game/               # 游戏模拟器
      simulator.ts      # 入口，导出 GameSimulator
      simulator-core.ts # 核心类（状态管理、回合生成、步骤队列）
      simulator-night.ts   # 夜间行动处理（已抽为独立函数）
      simulator-morning.ts # 早晨事件处理（已抽为独立函数）
      simulator-day.ts     # 白天行动处理（已抽为独立函数）
      simulator-vote.ts    # 投票处理（已抽为独立函数）
      simulator-utils.ts   # 通用工具函数（日志、关系、状态获取）
      simulator-config.ts  # 开局配置生成

doc/                    # 设计文档
  core/                 # 核心机制文档
    flow.md             # 对局流程
    numeric.md          # 数值设计（属性、关系、压力、检定）
    alignment.md        # 阵营九宫格
    stress-overload.md  # 压力过载系统（美德/affliction）
  content/              # 内容文档
    professions.md      # 职业设计
    items.md            # 道具设计
    traits.md           # 特质设计
    characters.md         # 角色设计
    preset-characters.md  # 预设角色
  actions/              # 行动文档
    actions.md          # 白天行动规则
    extra-actions.md    # 追加行动规则
  refer/                # 参考文档
    werewolf.md         # 传统狼人杀对比
    gnosia.md           # Gnosia 参考
```

---

## 关键设计模式

### 1. 四层信念系统 (BeliefSystem)

每个 AI 拥有四层认知层次：
- **L0**: 原始事实（查验结果、死亡记录、公开宣称）
- **L1**: 概率推理（基于事实推断狼人概率）
- **L2**: 心智理论（推断其他玩家对自己的看法）
- **L3**: 社交情感（关系网络、压力状态、情绪）

### 2. 策略引擎 (DecisionEngine)

策略按优先级执行：Duty > Survival > Information > Social
每个策略返回候选行动列表，引擎综合评分选出最终行动。

### 3. Tick-Based 并发 Actor 模型 (替代旧版步骤队列)

游戏使用 Tick 引擎 + Actor 状态机 + EventBus：
- `GameSimulator.tick()` 每次调用推进一个 tick
- 每个玩家是一个 Actor，状态：`idle → thinking → acting → idle`
- PhaseController 子类管理各阶段逻辑（Day/Night/Vote/Morning/CheckWin）
- EventBus 解耦事件发送和接收，支持追加行动反应

### 4. PhaseController 模式

各阶段由 PhaseController 子类管理：
- `DayPhaseController`: 顺序发言，追加行动反应
- `NightPhaseController`: 分组行动（狼人→预言家→窃贼→验尸官）
- `VotePhaseController`: 两轮投票
- `MorningPhaseController`: 早晨事件（单 tick 同步）
- `CheckWinPhaseController`: 胜利检查

`simulator-*.ts` 导出纯函数，由 PhaseController 调用。

---

## 数据模型

### 核心实体

| 实体 | 文件 | 说明 |
|------|------|------|
| Player | `ai/types.ts` | 玩家（属性、阵营、道具、关系、压力） |
| Attributes | `ai/types.ts` | 六维属性（亲和、逻辑、领导、诡诈、隐蔽、洞察） |
| Alignment | `ai/types.ts` | 九宫格阵营（守序/混乱 × 善良/邪恶） |
| Item | `ai/types.ts` | 道具（尖牙利爪、水晶球、小偷手套、验尸工具、护身符、双刃剑） |
| Relation | `ai/types.ts` | 关系（信任值、友好值，-10 ~ +10） |
| Role | `ai/types.ts` | 职业（狼人、孤狼、狂狼、村民、预言家、窃贼、验尸官） |

### 检定系统

```
检定结果 = 基础属性 + 阵营修正 + 压力修正 + d20
对抗检定 = 双方分别计算后比较
```

阵营修正和压力修正已完整实现，见 `game-utils.ts` 中的 `calculateFinalModifier()` 和 `performOpposedCheck()`。

---

## 魔法值管理

**所有魔法值已提取到 `src/lib/ai/constants.ts`**：

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

所有文件应尽量保持在 **600 行以内**，超过时应拆分为子模块。

### 新增功能的流程

1. 先修改 `doc/` 中的对应设计文档
2. 再更新 `src/lib/ai/types.ts` 中的类型定义
3. 再更新 `src/lib/ai/constants.ts` 中的常量
4. 最后实现代码逻辑
5. 运行 `npm run build` 验证

### 构建验证

```bash
cd /web-demo/ai-werewolf-demo
npm run build
```

构建成功输出：
```
[build] 1 page(s) built in X.XXs
[build] Complete!
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
- [x] types.ts 拆分（game-utils + data-definitions）
- [x] tick 循环 try-catch 安全保护
- [x] stuck-actor 超时安全阀
- [x] console.log DEBUG 开关
- [x] 死代码清理（GameStore.tsx、未使用接口、useGameRunner 无用变量）

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

1. **simulator 文件仍有部分魔法值**: 策略文件和 day.ts 的评分已提取到 constants.ts，但 simulator 文件（simulator-night.ts 等）中仍有少量硬编码数字。这些也应逐步替换为 constants.ts 中的常量。
2. **追加行动窗口的日志不够详细**: 当前反驳、一同怀疑的日志较简略，应增加检定结果的具体数值展示。
3. **性能优化**: 当玩家数量 > 10 时，AI 推理（特别是 L2 Theory of Mind）的计算量可能较大。未来可考虑 Web Worker 或推理缓存。
4. **类型安全**: 部分 `details` 对象使用 `Record<string, unknown>`，可进一步收紧为联合类型。

---

## 贡献指南

### 修改 doc 设计

如果你认为某个设计不合理，可以直接修改 `doc/` 中的对应文件，然后在代码中同步实现。保持 doc 和代码的一致性。

### 新增职业/道具

1. 在 `doc/content/professions.md` 或 `items.md` 中设计
2. 在 `ai/data-definitions.ts` 中更新 ROLE_INFO/ITEM_DEFINITIONS 数据定义，在 `ai/types.ts` 中更新类型
3. 在 `ai/constants.ts` 中新增相关常量
4. 在 `ai/strategies/` 中新增对应的策略
5. 在 `simulator-*.ts` 中新增对应的结算逻辑

### 修改核心机制

修改核心机制（如检定公式、压力计算、投票规则）时：
1. 先修改 `doc/core/numeric.md` 或 `flow.md`
2. 再修改 `ai/constants.ts` 中的常量
3. 最后修改 `simulator-*.ts` 中的实现
4. 确保构建通过

---

## 参考文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 对局流程 | `doc/core/flow.md` | 完整回合结构 |
| 数值设计 | `doc/core/numeric.md` | 属性、关系、压力、检定规则 |
| 阵营设计 | `doc/core/alignment.md` | 九宫格阵营对检定的修正 |
| 压力过载 | `doc/core/stress-overload.md` | 美德/affliction 系统设计 |
| 职业设计 | `doc/content/professions.md` | 7种职业的能力和限制 |
| 道具设计 | `doc/content/items.md` | 6种道具的双阵营效果 |
| 行动规则 | `doc/actions/actions.md` | 白天普通行动的详细规则 |
| 追加行动 | `doc/actions/extra-actions.md` | 追加行动的触发和效果 |
