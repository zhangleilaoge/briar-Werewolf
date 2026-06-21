# 特质系统（Trait System）

> **特质只影响机制。** 特质修改游戏规则，不修改属性、不修改行为权重。特质与状态完全不同。

## 核心原则

- 特质**只影响机制**（游戏规则），不修改行为权重或属性
- 特质**不是状态**（状态影响行为，特质影响机制）
- 特质可以是**职业默认**的（如孤狼职业天生带孤狼特质）
- 特质可以是**机制触发**的（如特定条件满足时获得）
- 特质与职业是**正交的**：同一职业可以有不同特质，不同职业可以有相同特质

## 状态 vs 特质

| | 状态（State） | 特质（Trait） |
|---|---|---|
| 来源 | 压力满（美德/崩溃） | 职业默认或机制触发 |
| 作用 | 影响行为/属性（如攻击欲、推理准确度） | 影响游戏规则机制 |
| 例子 | 偏执（suspect×1.5） | 孤狼（独立击杀协调） |
| 修改什么 | 行动权重、属性、推理 | 游戏规则（如击杀规则） |

## 特质接口

```typescript
interface Trait {
  id: string;
  name: string;
  description: string;
  // 特质没有 effects，因为特质只影响机制
  // 机制修改在 TraitPlugin 中实现
}

interface TraitPlugin {
  id: string;
  type: 'trait';
  
  // 判断玩家是否有此特质
  hasTrait(player: Player): boolean;
  
  // 修改游戏机制（如击杀协调）
  modifyMechanism(context: GameContext, ...args: unknown[]): unknown;
  
  // 获取特质提供的行动（如有）
  getTraitActions(player: Player, context: ActionContext): ActionDefinition[];
}
```

## 孤狼特质（Lone Wolf）—— 完整示例

### 定义

```typescript
const loneWolfTrait: Trait = {
  id: 'lone_wolf_trait',
  name: '孤狼',
  description: '狼人阵营角色拥有此特质时，夜间不能与其他狼人沟通，杀戮阶段独立选择目标；若目标与普通狼人相同，本次杀戮无效。',
};
```

### 机制修改

```typescript
class LoneWolfTraitPlugin implements TraitPlugin {
  id = 'lone_wolf_trait';
  type = 'trait' as const;
  
  hasTrait(player: Player): boolean {
    return player.role === 'lone_wolf' && player.team === 'werewolf';
  }
  
  // 修改夜间击杀协调机制
  modifyNightKillCoordination(
    context: GameContext,
    werewolfDecisions: { playerId: string; targetId: string | null }[],
    loneWolfDecision: { playerId: string; targetId: string | null }
  ): { valid: boolean; reason?: string; finalTarget?: string | null; finalKiller?: string | null } {
    const loneWolf = context.players.find(p => p.id === loneWolfDecision.playerId);
    if (!loneWolf || !this.hasTrait(loneWolf)) {
      return { valid: true }; // 不是孤狼，正常处理
    }
    
    const aliveWerewolves = context.players.filter(p => p.team === 'werewolf' && p.alive);
    const isLoneWolfOnly = aliveWerewolves.length === 1 && aliveWerewolves[0].role === 'lone_wolf';
    
    // 如果只剩孤狼，孤狼成为主杀手
    if (isLoneWolfOnly) {
      return { valid: true, finalTarget: loneWolfDecision.targetId, finalKiller: loneWolfDecision.playerId };
    }
    
    // 如果孤狼目标与普通狼人相同，杀戮无效
    const regularWolfDecisions = werewolfDecisions.filter(d => d.playerId !== loneWolfDecision.playerId);
    if (regularWolfDecisions.length > 0 && loneWolfDecision.targetId) {
      const regularWolfTarget = regularWolfDecisions[0].targetId;
      if (loneWolfDecision.targetId === regularWolfTarget) {
        return { valid: false, reason: '孤狼与普通狼人目标相同，本次杀戮无效！' };
      }
    }
    
    // 孤狼独立行动，使用普通狼人的目标
    return { valid: true, finalTarget: regularWolfDecisions[0]?.targetId, finalKiller: regularWolfDecisions[0]?.playerId };
  }
}
```

### 关键特性

- **不修改行动权重**：孤狼不会让他的 `suspect` 或 `kill` 权重变化
- **修改游戏规则**：孤狼改变了"狼人如何协商击杀目标"的机制
- **与状态无关**：孤狼可以有美德或崩溃状态，但孤狼特质本身不受影响

## 特质与职业的关系

```
职业（Role）
  ├─ 可能分配默认特质（如孤狼职业 → 孤狼特质）
  └─ 特质插件（TraitPlugin）
       └─ 修改游戏机制
```

**注意**：职业只是"触发特质分配"的标签。特质可以独立于职业存在（如任何狼人都可以有孤狼特质，不只是孤狼职业）。

## 设计原则

1. **特质只影响机制**：不修改属性、不修改行动权重、不修改推理
2. **特质是游戏规则的例外**：如孤狼改变了狼人协商击杀的规则
3. **特质与状态正交**：同一玩家可以同时有多个特质和多个状态
4. **特质是永久的**：一旦获得，不会消失

## 暂不实现

- 动态特质获取（如游戏中满足条件后获得新特质）
- 特质冲突处理（如两个互斥特质同时存在）
- 特质叠加效果（如多个特质修改同一机制）

## 文档索引

- [MAIN.md](MAIN.md) — 文档目录
- [ROLE.md](ROLE.md) — 职业文档（特质分配来源）
- [STATE.md](STATE.md) — 状态系统（与特质区分）
- [ITEM.md](ITEM.md) — 物品系统（与特质正交）
- [MEMORY-SYSTEM.md](MEMORY-SYSTEM.md) — 记忆系统
- [INFERENCE.md](INFERENCE.md) — 推理系统
- [PERSONALITY.md](PERSONALITY.md) — 性格系统
- [PRESSURE.md](PRESSURE.md) — 压力系统
- [INTENTION.md](INTENTION.md) — 意图系统
