# AI 系统架构设计

## 核心问题：为什么 AI 会做出愚蠢决定？

> 预言家查到狼，但因为和狼关系好去投其他人。

这个问题的根源是：**把"社交关系"和"信息知识"放在同一个权重池里混着算**，导致关系好的狼可以"贿赂"掉关键信息。

## 解决方案：分层信念 + 硬约束决策

### 1. 四层信念系统（Belief System）

| 层级 | 名称 | 说明 | 特征 |
|------|------|------|------|
| **L0** | 原始事实层 | 自己直接观察/获得的信息 | **不可变、不可被关系覆盖** |
| **L1** | 逻辑推导层 | 基于事实的推理 | 有概率置信度 |
| **L2** | 元认知层（ToM） | 对其他玩家信念的建模 | "他认为我是谁"、"他认为谁是狼" |
| **L3** | 社交情感层 | 关系、压力、偏好 | 只影响表达方式，不决定核心目标 |

#### L0 - 原始事实层（不可变区）

这是 AI 的**绝对知识区**，其他一切因素不能覆盖这里的事实：

- 我自己的身份和职业（我知道自己是预言家）
- 我查验到的结果（我查验 B 是狼人）
- 我自己的道具状态（我有水晶球）
- 我亲眼看到的死亡信息（昨晚 A 死了）
- 其他玩家公开宣布的信息（C 声称自己是预言家）

> 关键：L0 是**事实记录**，不是**决策权重**。预言家查到 B 是狼，这件事在 L0 中是 100% 的事实。不会因为和 B 关系好就变成"B 可能不是狼"。

#### L1 - 逻辑推导层（推理区）

基于 L0 事实进行推理，产生置信度：

```
输入：
  - L0: 我查验 B 是狼（100%）
  - L0: C 声称自己是预言家，查验 D 是金水
  - L0: 我查验 D 是狼（100%）

推理：
  - C 的查验与我的事实矛盾 → C 有 (1 - α) 概率是假预言家（狼）
  - D 被我查杀但被 C 发金水 → D 被 C 保护 → D 和 C 可能是狼队友
```

L1 输出的是**概率分布**，可以被新证据更新。

#### L2 - 元认知层（ToM 区）

对其他玩家心智状态的建模：

```
模型内容：
  - 玩家 A 认为我是狼的概率：0.2
  - 玩家 B 认为玩家 C 是狼的概率：0.7
  - 玩家 C 认为"我"信任他的概率：0.5
  - 玩家 D 认为我查验过谁的概率：0.3（不完全公开信息）
```

L2 用于**策略制定**：如果 A 认为我是狼的概率高，我需要降低他的怀疑。

#### L3 - 社交情感层（偏好区）

数值、关系、压力：

```
  - 对 B 的友好值：+0.8（很高）
  - 对 C 的信任值：-0.3（很低）
  - 当前压力值：0.5（中等）
```

L3 的**设计约束**：
1. **不能改变 L0 事实**（关系好≠他不是狼）
2. **不能改变 L1 推理结论**（关系好≠降低狼嫌疑）
3. **只能影响：表达方式、执行顺序、平局打破**

### 2. 决策引擎（Decision Engine）

核心原则：**硬约束（Hard Constraints）> 软偏好（Soft Preferences）**

决策流程采用**优先级覆盖制**：

```
阶段 1: 职业义务检查（不可覆盖）
  → 如果是预言家且查到狼 → 投票目标必须包含该狼
  → 如果是狼人且队友暴露 → 必须考虑是否保护/切割
  → 如果有道具和能力可直接使用 → 评估是否使用
  如果产生唯一决策 → 直接输出，L3 不介入

阶段 2: 生存策略检查（不可被关系覆盖）
  → 如果我是狼且被怀疑度高 → 优先做低怀疑行动
  → 如果我是村民且被狼盯上 → 优先保命行动
  → 如果我是关键神职且 alive → 不能冒暴露风险
  如果产生唯一决策 → 直接输出，L3 不介入

阶段 3: 信息最大化策略
  → 当前行动哪个能获取最多信息？
  → 投票投谁最有助于缩小狼坑？
  → 发言说什么最能测试别人反应？
  产生多个候选时 → 进入阶段 4

阶段 4: 社交情感润滑（L3 唯一介入点）
  → 多个候选同样好时，用关系值做排序
  → 表达方式（发言语气）由关系值决定
  → 投票时：两个同样可疑的人，优先投关系差的
```

#### 关键设计：职业义务硬约束

```javascript
// 伪代码示例
function getVoteTarget(ai) {
  // 阶段 1: 职业义务
  const dutyTargets = DutyModule.getObligatedTargets(ai);
  if (dutyTargets.length === 1) return dutyTargets[0];
  // 如果唯一，直接返回，关系值无权干涉
  
  // 阶段 2: 生存策略
  const survivalTargets = SurvivalModule.getPriorityTargets(ai);
  if (survivalTargets.length === 1) return survivalTargets[0];
  
  // 阶段 3: 信息最大化
  const infoCandidates = InfoModule.getCandidates(ai);
  
  // 阶段 4: 社交润滑（仅在此处 L3 介入）
  return SocialTiebreaker.select(infoCandidates, ai.relations);
}
```

### 3. 扩展性设计

#### 策略模式（Strategy Pattern）

每个决策模块都是一个独立的 Strategy，通过注册表管理：

```javascript
const DecisionStrategies = {
  'duty': [ProphetDuty, WerewolfDuty, VillagerDuty, ...],
  'survival': [HidingStrategy, RevealingStrategy, ...],
  'information': [MaxInfoVote, ProvokeSpeech, ...],
  'social': [TieBreakerByTrust, TieBreakerByPressure, ...]
};
```

新增策略 = 新增一个类/函数，不需要修改核心引擎。

#### 配置化权重

```javascript
const AIConfig = {
  priorityOrder: ['duty', 'survival', 'information', 'social'],
  overrides: {
    'prophet': { dutyWeight: 1000, survivalWeight: 100 },
    'werewolf': { dutyWeight: 500, survivalWeight: 800 }
  }
};
```

#### 行为标签系统（扩展性核心）

每个行动和每个 NPC 可以被打上行为标签，决策引擎根据标签匹配：

```javascript
// 行动标签
action.tags = ['vote', 'daytime', 'public', 'targeted'];

// 策略标签匹配
strategy.requiredTags = ['daytime'];
strategy.forbiddenTags = ['night'];
```

这允许未来新增任意行动（如"查验尸体"、"交换道具"）时，现有策略自动判断是否适用。

## 4. AI 决策示例

### 示例 1：预言家查到狼但关系好

```
AI 状态：
  - 职业：预言家
  - L0: 查验 B 是狼（100%）
  - L3: 对 B 友好值 +0.8（关系很好）
  - L3: 对 C 友好值 +0.2

决策流程：
  阶段 1（职业义务）: 
    → 预言家义务：优先淘汰查杀目标
    → 义务目标: [B]
    → 唯一目标，直接输出 B
    → L3 关系值不被调用

输出：投票给 B
行为表现：因为关系好，发言时可能表达遗憾（"我不想投 B，但查验结果显示..."）
```

> 关系值影响**表达方式**，但不影响**投票目标**。

### 示例 2：村民无法确定谁是狼

```
AI 状态：
  - 职业：村民
  - L0: 无查验能力
  - L1: A 狼概率 0.4, B 狼概率 0.4, C 狼概率 0.2
  - L3: 对 A 友好值 +0.1, 对 B 友好值 -0.3

决策流程：
  阶段 1（职业义务）: 
    → 村民无硬义务，候选为空
  阶段 2（生存策略）: 
    → 无明确威胁，候选为空
  阶段 3（信息最大化）: 
    → 在 A 和 B 之间投票最能测试（两者嫌疑最高）
    → 候选: [A, B]
  阶段 4（社交润滑）: 
    → 两者嫌疑相同（0.4），用关系值打破平局
    → B 关系差（-0.3）< A 关系差（+0.1）
    → 选 B（更容易下得了手）

输出：投票给 B
```

### 示例 3：狼人被队友牵连

```
AI 状态：
  - 职业：狼人
  - L0: A 是我狼队友，A 被预言家查杀了
  - L2（ToM）: 全场认为 A 是狼的概率 0.9
  - L2（ToM）: 如果我不投 A，我被怀疑的概率从 0.2 → 0.7

决策流程：
  阶段 1（职业义务）: 
    → 狼人义务：保护队友（但保护方式不是唯一）
    → 义务候选: [救A, 切割A, 模糊处理]
    → 多个候选，进入阶段 2
  阶段 2（生存策略）: 
    → 保护 A 会导致自己暴露（ToM 预测风险高）
    → 切割 A 可以隐藏身份，利于后续
    → 生存优先候选: [切割A]
    → 唯一候选，输出切割

输出：投票给 A（倒钩），发言时踩 A
```

## 5. 扩展性路线图

| 阶段 | 内容 | 扩展点 |
|------|------|--------|
| 当前 | 硬约束 + 关系润滑 | 新增职业策略即可 |
| 后续 | 加入 L2 ToM（模拟别人怎么想） | 新增 ToM 模块 |
| 后续 | 加入 MCTS 策略搜索（MultiMind Planner） | 替换 Planner 组件 |
| 后续 | 加入语言生成（LLM Actor） | 新增 Actor 层 |
| 后续 | 加入多模态（表情、语音） | 扩展 Perceiver |

---

## 6. 文件结构（实际代码路径）

```
web-demo/ai-werewolf-demo/src/
  lib/ai/
    types.ts                # 核心类型定义（角色、属性、道具、检定等）
    constants.ts            # 游戏常量（魔法值全部提取到这里）
    ai-agent.ts             # 单个 AI 玩家封装
    belief-system.ts        # L0-L3 信念建模
    behavior-modifiers.ts   # 行为修正器
    strategies/
      engine.ts             # 决策引擎（核心优先级 + 策略调度）
      index.ts              # 策略注册与入口
      day.ts                # 白天策略（发言、怀疑、袒护、公布身份等）
      night.ts              # 夜间策略（查验、杀戮、偷窃、验尸）
      vote.ts               # 投票策略（跟随号召、社交关系、生存）
      appendix.ts           # 追加行动策略（一同怀疑、反驳、一同袒护）
  lib/game/
    simulator.ts            # 模拟器入口，导出 GameSimulator
    simulator-core.ts       # 核心类（状态管理、回合生成、步骤队列）
    simulator-night.ts      # 夜间行动处理
    simulator-morning.ts    # 早晨事件处理
    simulator-day.ts        # 白天行动处理
    simulator-vote.ts       # 投票处理
    simulator-utils.ts      # 通用工具函数（日志、关系、状态获取）
    simulator-config.ts     # 开局配置生成
  components/
    GameApp.tsx             # 主游戏界面
    SetupPanel.tsx          # 开局配置面板
    useGameRunner.ts        # 游戏状态管理 Hook
  pages/
    index.astro             # 入口页面
```

> 文档：`doc/ai/ARCHITECTURE.md`（本文件）为 AI 系统架构设计；游戏机制文档位于 `web-demo/doc/`。
