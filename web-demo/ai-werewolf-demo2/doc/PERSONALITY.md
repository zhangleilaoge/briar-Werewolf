# 性格系统（Personality System）

> 性格是角色的行为倾向，用插件实现。它**不直接修改记忆**，而是**限制行动范围**和**改变行动加权选择**。

## 核心原则

- 性格和职业、特质、物品一样，都是**插件**
- 每个玩家有且仅有**一个性格**
- 性格**不修改推理**（不告诉 AI 谁是狼人），只**影响行为倾向**
- 性格通过**禁用行动**和**修改权重**来影响决策

## 性格接口（插件标准）

```typescript
interface PersonalityPlugin {
  id: string;              // 性格ID
  name: string;            // 性格名称
  description: string;   // 性格描述
  
  // 禁用的行动：该性格不能执行这些行动
  disabledActions: ActionType[];
  
  // 行动权重修正器：在最终加权选择阶段修改各行动的得分
  // 1.0 = 不变，>1.0 = 更倾向，<1.0 = 更回避，0 = 不会选
  actionWeightMods: Record<ActionType, number>;
}
```

## 设计中的性格示例

### 好斗型（Aggressive）
```typescript
{
  id: 'aggressive',
  name: '好斗型',
  description: '喜欢攻击和质疑，容易与人发生冲突',
  disabledActions: ['silence'],        // 不会沉默
  actionWeightMods: {
    suspect: 2.0,      // 非常倾向怀疑
    observe: 0.8,      // 不太倾向观察（更直接）
    defend: 0.3,       // 很少辩护（太软弱）
    claim_identity: 1.5, // 较倾向跳身份（激进自证）
    silence: 0,        // 绝对不会沉默
    chat: 0.5,         // 不太闲聊（喜欢直接冲突）
  }
}
```

### 谨慎型（Cautious）
```typescript
{
  id: 'cautious',
  name: '谨慎型',
  description: '避免冲突，谨慎发言，不轻易站队',
  disabledActions: ['claim_identity'], // 不跳身份（太暴露）
  actionWeightMods: {
    suspect: 0.5,      // 很少怀疑（避免树敌）
    observe: 1.5,      // 倾向观察（收集信息）
    defend: 1.2,       // 适度辩护（保护盟友）
    claim_identity: 0,   // 绝对不跳身份
    silence: 1.5,      // 倾向沉默（最安全）
    chat: 1.2,         // 适度闲聊（低风险社交）
  }
}
```

### 操控型（Manipulative）
```typescript
{
  id: 'manipulative',
  name: '操控型',
  description: '喜欢操控局势，善于引导他人',
  disabledActions: [],
  actionWeightMods: {
    suspect: 1.5,      // 倾向怀疑（引导方向）
    observe: 1.5,      // 倾向观察（收集筹码）
    defend: 1.8,       // 非常倾向辩护（建立信任）
    claim_identity: 1.2, // 适度跳身份（制造混乱）
    silence: 0.5,      // 不太沉默（要操控就要说话）
    chat: 2.0,         // 非常倾向闲聊（建立关系是操控的基础）
  }
}
```

### 忠诚型（Loyal）
```typescript
{
  id: 'loyal',
  name: '忠诚型',
  description: '重视关系和承诺，会保护同伴',
  disabledActions: [],
  actionWeightMods: {
    suspect: 0.8,      // 较少怀疑（信任倾向）
    observe: 1.0,      // 正常观察
    defend: 2.0,       // 非常倾向辩护（保护同伴）
    claim_identity: 1.0, // 正常跳身份
    silence: 1.0,      // 正常沉默
    chat: 1.5,         // 倾向闲聊（维护关系）
  }
}
```

### 多疑型（Suspicious）
```typescript
{
  id: 'suspicious',
  name: '多疑型',
  description: '总是怀疑别人，难以信任任何人',
  disabledActions: ['defend'],         // 不会为他人辩护（不相信任何人）
  actionWeightMods: {
    suspect: 2.0,      // 非常倾向怀疑
    observe: 1.5,      // 倾向观察（找破绽）
    defend: 0,         // 绝对不辩护（可能帮了狼人）
    claim_identity: 0.5, // 不太跳身份（暴露自己）
    silence: 0.8,      // 适度沉默
    chat: 0.3,         // 很少闲聊（不信任社交）
  }
}
```

## 性格与职业的关系

- 性格**独立于职业**：任何职业可以有任意性格
- 但某些组合可能更合理：
  - 预言家 + 好斗型 = 激进查杀、强势带队
  - 预言家 + 谨慎型 = 隐藏信息、不轻易跳身份
  - 狼人 + 操控型 = 善于搅局、引导风向
  - 狼人 + 忠诚型 = 保护队友、不太会卖队友
  - 村民 + 多疑型 = 铁头好人、总是质疑别人

## 性格如何影响决策

```
决策流程（决策引擎阶段，暂不实现）：

1. 职业义务 → 硬约束（如预言家必须报查验）
2. 局势推理 → 当前危机度、最被攻击的人
3. 角色推理 → 谁是狼人、谁是村民
4. 关系系统 → 我和谁关系好/坏
5. 【性格】 → 禁用行动过滤 + 权重修正
6. 加权选择 → 综合所有因素，选出最终行动
```

**第5步是性格介入点**：
- 先过滤掉 `disabledActions`（性格不允许的行动）
- 剩余行动的得分乘以 `actionWeightMods`
- 最终选择得分最高的行动

## 性格与友好度的区别

| | 友好度（Relation） | 性格（Personality） |
|---|---|---|
| 性质 | 动态关系（会变） | 静态属性（固定） |
| 来源 | 别人对我的行为 | 角色创建时分配 |
| 作用 | 影响目标选择（杀谁/怀疑谁） | 影响行动类型（做什么） |
| 是否可学习 | 游戏中根据行为变化 | 固定不变 |

## 暂不实现

- 性格的动态变化（如经历背叛后从"忠诚型"变成"多疑型"）
- 性格对推理的影响（如"多疑型"会降低对 speech 的信任度）
- 性格对记忆权重的影响

## 文档索引

- [MAIN.md](MAIN.md) — 文档目录
- [ACTION.md](ACTION.md) — 动作系统（性格禁用的行动来源）
- [ROLE-SPECIFIC.md](ROLE-SPECIFIC.md) — 角色逻辑（性格与职业的组合）
- [ROLE.md](ROLE.md) — 职业文档（职业定义）
- [PRESSURE.md](PRESSURE.md) — 压力系统（性格加权来源）
- [STATE.md](STATE.md) — 状态系统（与性格叠加）
- [TRAIT.md](TRAIT.md) — 特质系统（与性格正交）
- [INTENTION.md](INTENTION.md) — 意图系统（最终决策系统）
- [MEMORY-SYSTEM.md](MEMORY-SYSTEM.md) — 记忆系统
- [INFERENCE.md](INFERENCE.md) — 推理系统
- [RELATION.md](RELATION.md) — 关系系统
