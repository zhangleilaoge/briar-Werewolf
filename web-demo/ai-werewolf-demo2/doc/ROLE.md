# 职业文档（Role Document）

> **职业是很浅的一层。** 职业只有标签、阵营和物品列表。实际效果全部在物品和特质中实现。

## 核心原则

- 职业 = 标签 + 阵营 + 默认物品列表
- 职业**本身没有任何效果**
- 效果全部在**物品**（水晶球、双刃剑）和**特质**（孤狼）中实现
- 职业不是推理对象，而是推理的输入（我知道自己是预言家，所以我能查验）

## 职业定义

```typescript
interface RoleInfo {
  role: Role;          // 职业ID
  label: string;       // 显示名称
  team: Team;          // 阵营
  description: string; // 描述（仅供参考，无实际效果）
  defaultItems: string[]; // 默认物品列表
  nightAction?: boolean;  // 是否有夜间行动（仅供参考）
}
```

## 四个职业

### 村民（Villager）

```typescript
{
  role: 'villager',
  label: '普通村民',
  team: 'villager',
  description: '无特殊能力，通过投票放逐狼人',
  defaultItems: [],
}
```

- **无物品**，无夜间行动
- 能力：通过推理和发言参与游戏
- 效果来源：无（村民没有特殊物品或特质）

---

### 狼人（Werewolf）

```typescript
{
  role: 'werewolf',
  label: '普通狼人',
  team: 'werewolf',
  description: '参与夜晚讨论，可执行杀戮',
  defaultItems: ['claws'],
  nightAction: true,
}
```

- **物品**：`claws`（尖牙利爪）—— 实现夜间杀戮
- 效果来源：`ClawsPlugin`（物品插件实现杀戮逻辑）

---

### 狂狼（Berserker）

```typescript
{
  role: 'berserker',
  label: '狂狼',
  team: 'werewolf',
  description: '白天可同归于尽，触发平安夜',
  defaultItems: ['claws', 'double_sword'],
  nightAction: true,
}
```

- **物品**：`claws`（尖牙利爪）+ `double_sword`（双刃剑）
- 效果来源：
  - `ClawsPlugin`：实现夜间杀戮（与普通狼人相同）
  - `DoubleSwordPlugin`：实现白天同归于尽 + 触发平安夜
- **注意**：狂狼本身没有特殊代码逻辑，效果全部在 `double_sword` 物品中

**狂狼 vs 普通狼人**：

| | 普通狼人 | 狂狼 |
|---|---|---|
| 职业标签 | `werewolf` | `berserker` |
| 物品 | `claws` | `claws` + `double_sword` |
| 夜间能力 | 杀戮 | 杀戮（相同） |
| 白天能力 | 无 | 同归于尽（`double_sword` 提供） |
| 代码差异 | 无 | 仅多一个物品 |

---

### 预言家（Prophet）

```typescript
{
  role: 'prophet',
  label: '预言家',
  team: 'villager',
  description: '每晚查验一名玩家身份',
  defaultItems: ['crystal_ball'],
  nightAction: true,
}
```

- **物品**：`crystal_ball`（水晶球）—— 实现夜间查验
- 效果来源：`CrystalBallPlugin`（物品插件实现查验逻辑）
- 职业义务：有查杀必须报告（硬约束，在意图系统中实现）

## 职业与物品的关系

```
职业（Role）
  └─ 物品列表（defaultItems）
       └─ 物品插件（ItemPlugin）
            └─ 实际效果（execute / evaluate）
```

**关键**：职业只是"我有这些物品"的标签。物品被删除（如死亡）后，职业还在，但能力消失了。

## 职业与特质的关系

```
职业（Role）
  └─ 可能触发特质分配（如孤狼职业自动获得孤狼特质）
       └─ 特质插件（TraitPlugin）
            └─ 机制修改（如修改夜间击杀协调）
```

**注意**：特质只影响**机制**（如击杀协调规则），不影响属性和判定。

## 职业与状态的关系

```
职业（Role）
  └─ 压力系统（与职业无关，所有职业共享）
       └─ 状态（State：美德/崩溃）
            └─ 行为/属性影响
```

**注意**：压力爆满产生状态，与职业无关。但某些状态可能对某些职业影响更大。

## 设计原则

1. **职业是标签**：只标识"我是谁"，不定义"我能做什么"
2. **物品是能力**：实际效果在物品插件中实现
3. **特质是机制**：只修改游戏规则，不修改属性
4. **状态是行为**：美德/崩溃影响行为倾向，不是机制

## 文档索引

- [MAIN.md](MAIN.md) — 文档目录
- [ITEM.md](ITEM.md) — 物品系统（职业能力的实际实现）
- [TRAIT.md](TRAIT.md) — 特质系统（机制修改）
- [STATE.md](STATE.md) — 状态系统（美德/崩溃）
- [ACTION.md](ACTION.md) — 动作系统（物品的可用行动）
- [INTENTION.md](INTENTION.md) — 意图系统（职业义务）
- [MEMORY-SYSTEM.md](MEMORY-SYSTEM.md) — 记忆系统
- [INFERENCE.md](INFERENCE.md) — 推理系统
- [PERSONALITY.md](PERSONALITY.md) — 性格系统
- [PRESSURE.md](PRESSURE.md) — 压力系统
