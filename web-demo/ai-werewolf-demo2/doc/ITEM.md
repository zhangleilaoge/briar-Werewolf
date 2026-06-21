# 物品系统（Item System）

> **物品是能力的载体。** 物品本身不推理，只提供特殊能力。使用物品会产生记忆，但物品效果不是记忆的产物。

## 核心原则

- 物品是**能力的载体**，不是记忆的产物
- 物品有**拥有者**、**使用时机**、**效果**、**产生的记忆**
- 物品可以被**禁用**（如被狼人击杀后预言家失去水晶球）
- 物品效果是**确定的**（水晶球查验一定准确），不像 `speech` 可能为假

## 物品接口（插件标准）

```typescript
interface ItemPlugin {
  id: string;              // 物品ID
  name: string;            // 物品名称
  description: string;   // 物品描述
  
  // 拥有条件
  ownerRole: Role;        // 哪个角色拥有
  ownerTeam?: Team;        // 哪个阵营拥有（可选）
  
  // 使用时机
  usePhase: 'night' | 'day' | 'any';  // 夜间/白天/任意
  useTrigger: MemoryTrigger;         // 在哪个阶段触发使用
  
  // 使用限制
  maxUses: number;         // 最大使用次数（-1表示无限）
  cooldown: number;        // 冷却回合数
  disabled: boolean;       // 是否被禁用
  
  // 效果
  effect: ItemEffect;
  
  // 产生的记忆
  memoryOnUse: {
    eventType: MemoryEventType;
    source: MemorySource;
  };
}

interface ItemEffect {
  type: 'reveal_role' | 'kill' | 'save' | 'poison' | 'passive';
  target: 'self' | 'other' | 'any';  // 目标类型
  result?: Record<string, unknown>;  // 效果参数
}
```

## 水晶球（Crystal Ball）—— 完整示例

### 基本定义

```typescript
const crystalBall: ItemPlugin = {
  id: 'crystal_ball',
  name: '水晶球',
  description: '预言家的查验工具，夜间可以查验一名玩家身份',
  ownerRole: 'prophet',
  usePhase: 'night',
  useTrigger: 'night_action',
  maxUses: -1,           // 每夜一次，无限使用
  cooldown: 0,           // 无冷却
  disabled: false,
  effect: {
    type: 'reveal_role',
    target: 'other',
    result: { accuracy: 1.0 },  // 100%准确
  },
  memoryOnUse: {
    eventType: 'check_result',
    source: 'self',
  },
};
```

### 使用流程

```
night_action 阶段
  ↓
预言家选择目标（基于角色推理：优先选未查验的、高狼人概率的）
  ↓
使用水晶球查验
  ↓
系统返回结果：werewolf / villager
  ↓
产生记忆：check_result（self，仅预言家自己）
  ↓
预言家获得硬信息
```

### 使用限制

- **只能夜间使用**：白天无法查验
- **只能查验存活玩家**：不能查验已死亡玩家
- **不能查验自己**：预言家不能查验自己
- **每夜一次**：每晚只能查验一名玩家
- **结果仅自己知道**：其他玩家不知道查验结果

### 记忆产生

```typescript
// 使用水晶球后产生的记忆
createCheckResult({
  round: 1,
  actorId: 'prophet_1',    // 预言家自己
  targetId: 'player_3',   // 被查验的玩家
  result: 'werewolf',      // 系统返回的结果
  source: 'self',          // 仅预言家自己知道
});
```

### 与其他系统的关系

| 系统 | 关系 |
|------|------|
| 记忆系统 | 使用水晶球产生 `check_result`（self）记忆 |
| 推理系统 | 水晶球提供硬信息，直接覆盖角色概率 |
| 意图系统 | 预言家夜间意图 `verify target` → 使用水晶球执行 |
| 压力系统 | 被查验为狼人不会增加预言家压力（预言家知道的是真相） |

### 被禁用的情况

- 预言家被狼人击杀 → 水晶球失效（随预言家死亡）
- 预言家被投票出局 → 水晶球失效

## 物品与行动的区别

| | 物品 | 行动 |
|---|---|---|
| 本质 | 能力的载体 | 行为的表达 |
| 产生记忆 | 使用物品产生记忆 | 执行行动产生记忆 |
| 来源 | 系统分配 | 玩家选择 |
| 效果 | 确定的（如查验准确） | 不确定的（如claim可能为假） |
| 是否可禁用 | 是（死亡后禁用） | 否（但性格/特质可能禁用） |

## 暂不实现（后续扩展）

| 物品 | 角色 | 效果 | 产生的记忆 |
|------|------|------|----------|
| 狼人爪 | 狼人 | 夜间标记击杀目标 | `night_kill_vote`（self） |
| 解药 | 女巫 | 救活被狼人杀的人 | `save`（self） |
| 毒药 | 女巫 | 毒死一名玩家 | `poison`（self） |
| 猎枪 | 猎人 | 死亡时开枪带走一人 | `revenge`（self） |
| 角色卡 | 白痴 | 翻牌表明身份 | `reveal`（self） |

## 文档索引

- [MAIN.md](MAIN.md) — 文档目录
- [ROLE.md](ROLE.md) — 职业文档（物品拥有者）
- [MEMORY-SYSTEM.md](MEMORY-SYSTEM.md) — 记忆系统（物品产生记忆）
- [INFERENCE.md](INFERENCE.md) — 推理系统（水晶球提供硬信息）
- [INTENTION.md](INTENTION.md) — 意图系统（物品的使用入口）
- [ACTION.md](ACTION.md) — 动作系统（物品与行动的区别）
- [ROLE-SPECIFIC.md](ROLE-SPECIFIC.md) — 角色逻辑（预言家使用水晶球）
- [MODERATOR.md](MODERATOR.md) — 游戏流程（night_action 阶段）
- [PERSONALITY.md](PERSONALITY.md) — 性格系统
- [PRESSURE.md](PRESSURE.md) — 压力系统
- [STATE.md](STATE.md) — 状态系统
- [TRAIT.md](TRAIT.md) — 特质系统（只影响机制）
