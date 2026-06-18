# 并发节拍器模型设计（Concurrent Tick Engine）

> 现状：串行队列 —— 玩家按 alivePlayerIds 排队，每 2 秒走一个。A 行动 → 触发附录 → BCDEF 排队插入 → 6 个 tick 之后才轮到 B 的主行动。  
> 目标：并发节拍器 —— 每个玩家是独立的 Actor，所有人按统一 tick 节拍思考/行动，事件广播后所有收到通知的人同时开始思考，互不阻塞。

---

## 1. 核心概念

| 概念 | 说明 |
|------|------|
| **Tick** | 最小时间单位（如 2 秒 / 1 秒）。所有同步都发生在 tick 边界。 |
| **Phase** | 游戏阶段（Day / Night / Vote / Morning）。每个阶段有自己的 tick 速率和结束条件。 |
| **Actor** | 每个玩家是一个独立的 Actor，有自己的状态机（Idle → Thinking → Acting → Idle）。 |
| **Event** | 动作产生的事件，如 `suspect`, `defend`, `kill`。事件进入中央事件总线。 |
| **Action Window** | 每个 tick 内允许行动的玩家集合。不是"轮到谁"，而是"谁在这个 tick 准备好了"。 |

---

## 2. 状态机（每个玩家）

```
Idle（空闲）
  ↓ 被通知 / 轮到行动
Thinking（思考中）—— 倒计时 N tick（模拟 AI 决策时间）
  ↓ 倒计时归零
Acting（行动中）—— 本 tick 执行动作，产生事件，然后回到 Idle
  ↓ 动作完成
Idle
```

- **Thinking 倒计时**：由当前 AI 的"复杂度"决定（可固定 1 tick，也可随机 1-3 tick）。
- **所有玩家可以同时处于 Thinking**：互不阻塞。
- **Action 在同一 tick 内并行执行**：但日志需要定义优先级顺序以便阅读。

---

## 3. 全局 Tick 循环（Tick Engine）

每 tick 执行一次：

```
1. Tick Start
   └── 检查当前 Phase 的结束条件（如白天所有活人已过行动窗口、或全员沉默）
       └── 若结束 → 推进到下一个 Phase

2. 事件处理（EventBus.flush）
   └── 处理上一 tick 积累的事件：
       └── 对每个事件，决定哪些玩家被通知
       └── 被通知的玩家进入 Thinking（如果他们在 Idle）

3. 思考倒计时推进
   └── 所有处于 Thinking 的玩家：countdown--
       └── countdown 归零 → 状态变为 Acting

4. 行动执行（并行）
   └── 收集所有状态为 Acting 的玩家
   └── 并行调用他们的 action 函数（但实际顺序按优先级排序用于日志）
   └── 每个 action 产生新 Event → 加入 EventBus（下 tick 处理）
   └── 执行后玩家状态回到 Idle

5. 渲染 / 日志输出
   └── 将本 tick 所有行动统一输出

6. 调度下一 tick
   └── setTimeout(nextTick, 2000 / speed)
```

---

## 4. Phase 设计（每个阶段定义自己的行为规则）

```typescript
interface Phase {
  name: string;                    // 'day' | 'night' | 'vote' | 'morning'
  tickRate: number;                // 毫秒 / tick（Day 2000ms，Night 可能更快或更慢）
  
  // 阶段初始化：进入该阶段时调用
  onEnter(engine: TickEngine): void;
  
  // 每 tick 调用：决定谁可以被激活（获得行动机会）
  // 返回本轮应该被通知行动的玩家列表（他们会进入 Thinking）
  getActivatablePlayers(engine: TickEngine): string[];
  
  // 检查是否该结束本阶段了
  checkEndCondition(engine: TickEngine): boolean;
  
  // 阶段退出时清理
  onExit(engine: TickEngine): void;
}
```

### 4.1 Day Phase（白天）示例

```typescript
class DayPhase implements Phase {
  name = 'day';
  tickRate = 2000;
  
  // 当前"主动发言轮"已过的玩家
  private hasActedThisRound = new Set<string>();
  private currentSpeakerIndex = 0;
  private silenceCount = 0;
  private alivePlayerIds: string[] = [];
  
  onEnter(engine) {
    this.hasActedThisRound.clear();
    this.silenceCount = 0;
    this.alivePlayerIds = engine.getAlivePlayerIds();
    this.currentSpeakerIndex = 0;
    
    // 第一阶段：按某种顺序给所有人一次"主动行动"机会
    // 通知第一个人开始思考
    this._notifyNextSpeaker(engine);
  }
  
  // 通知下一个该主动发言的人
  _notifyNextSpeaker(engine) {
    while (this.currentSpeakerIndex < this.alivePlayerIds.length) {
      const pid = this.alivePlayerIds[this.currentSpeakerIndex++];
      if (!this.hasActedThisRound.has(pid)) {
        engine.notifyPlayer(pid, { type: 'day_turn', canAct: true });
        return; // 只通知一个人，等他行动完再通知下一个
      }
    }
  }
  
  getActivatablePlayers(engine) {
    // 被通知的玩家在思考完成后自动变成 Acting
    // 这里不需要额外处理，因为 EventBus 已经通知过了
    return [];
  }
  
  // 当一个玩家完成 day_turn 行动后调用
  onPlayerAction(engine, playerId, action) {
    this.hasActedThisRound.add(playerId);
    
    if (action === 'silence') {
      this.silenceCount++;
    } else {
      this.silenceCount = 0;
    }
    
    // 如果是 suspect/defend，广播事件给所有人（除了行动者）
    if (action === 'suspect' || action === 'defend') {
      engine.broadcastEvent({
        type: 'appendix_trigger',
        source: playerId,
        action: action,
        target: action.targetId,
      });
    }
    
    // 通知下一个主动发言的人
    this._notifyNextSpeaker(engine);
  }
  
  checkEndCondition(engine) {
    // 所有活人都主动行动过
    const allActed = this.alivePlayerIds.every(id => this.hasActedThisRound.has(id));
    if (allActed) return true;
    
    // 连续沉默达到阈值
    if (this.silenceCount >= engine.getAliveCount()) return true;
    
    return false;
  }
  
  onExit(engine) {
    // 清理任何还在 Thinking 的状态（强制结束）
  }
}
```

### 4.2 附录反应（Appendix）的并发处理

```typescript
// 当 EventBus 处理 'appendix_trigger' 事件时：
function handleAppendixTrigger(engine, event) {
  const aliveOthers = engine.getAlivePlayers()
    .filter(p => p.id !== event.source);
  
  // 同时通知所有人：你们有 1 个 tick 的时间决定是否反应
  aliveOthers.forEach(p => {
    engine.notifyPlayer(p.id, {
      type: 'appendix_reaction',
      triggerAction: event,
      responseWindow: 1, // 必须在 1 tick 内做出反应
    });
  });
}

// 在 Tick 的"思考倒计时"阶段：
// 所有被通知的 Appendix 反应者同时倒计时
// 如果倒计时结束他们还在 Thinking，自动视为"选择沉默"（不行动）
```

**关键区别**：
- **旧模型**：B 反应 → C 反应 → D 反应 → E 反应 → F 反应（排队 5 个 tick）。
- **新模型**：BCDEF 同时收到通知，同时开始思考（1 tick），同时做出决定（如果决定反应就在同一个 tick 执行）。

---

## 5. EventBus 设计

```typescript
interface GameEvent {
  id: string;
  type: string;
  source: string;        // 产生事件的玩家 ID
  tick: number;          // 产生的 tick 编号
  payload: Record<string, unknown>;
}

class EventBus {
  private queue: GameEvent[] = [];
  private subscribers: Map<string, ((event: GameEvent) => string[])[]> = new Map();
  
  // 订阅某类事件：返回应该被通知的玩家 ID 列表
  subscribe(eventType: string, resolver: (event: GameEvent) => string[]) {
    if (!this.subscribers.has(eventType)) this.subscribers.set(eventType, []);
    this.subscribers.get(eventType)!.push(resolver);
  }
  
  emit(event: GameEvent) {
    this.queue.push(event);
  }
  
  // 在 Tick 的"事件处理"阶段调用
  flush(engine: TickEngine, currentTick: number): GameEvent[] {
    const processed = [...this.queue];
    this.queue = [];
    
    processed.forEach(event => {
      const resolvers = this.subscribers.get(event.type) || [];
      resolvers.forEach(resolve => {
        const targetPlayerIds = resolve(event);
        targetPlayerIds.forEach(pid => {
          engine.notifyPlayer(pid, event);
        });
      });
    });
    
    return processed;
  }
}
```

---

## 6. 行动日志顺序（阅读体验）

虽然行动是**逻辑并行**的，但日志需要**串行可读**。建议定义优先级：

```typescript
const LOG_PRIORITY = {
  'phase': 0,           // 阶段切换最先显示
  'death': 1,           // 死亡事件
  'vote_result': 2,     // 投票结果
  'action': 3,          // 主动行动
  'reaction': 4,        // 反应行动（appendix）
  'check': 5,           // 检定结果
  'relation': 6,        // 关系变化
  'item': 7,            // 道具变化
  'system': 8,          // 系统消息
};

// 在同一个 tick 内，所有行动按优先级排序后输出
```

---

## 7. 与现有代码的映射关系

| 旧代码 | 新模型 |
|--------|--------|
| `stepQueue` + `currentStep` | `TickEngine` + `Phase` 状态机 |
| `executeNextStep()` | `tick()`（每 tick 推进所有 Actor） |
| `runDayAction()` | Actor 在 `Acting` 状态执行的动作 |
| `openAppendixWindow()` + `respondents.forEach` | `EventBus.emit('appendix_trigger')` + 所有目标同时进入 `Thinking` |
| `setTimeout(runNextStep, 2000)` | `setTimeout(tick, phase.tickRate)` |
| `alivePlayerIds` 顺序 | Phase 管理的主动发言顺序（`getActivatablePlayers`） |

---

## 8. 最小可迁移方案（不推翻重写）

如果你不想完全重写，可以做一个**兼容层**：

```typescript
class TickEngine {
  private tickCount = 0;
  private phase: Phase;
  private actors: Map<string, Actor>;
  private eventBus: EventBus;
  
  tick() {
    this.tickCount++;
    
    // 1. 检查阶段切换
    if (this.phase.checkEndCondition(this)) {
      this.phase.onExit(this);
      this.phase = this.getNextPhase();
      this.phase.onEnter(this);
      return;
    }
    
    // 2. 处理事件（触发新思考）
    this.eventBus.flush(this, this.tickCount);
    
    // 3. 推进思考
    this.actors.forEach(actor => {
      if (actor.state === 'thinking') {
        actor.thinkCountdown--;
        if (actor.thinkCountdown <= 0) {
          actor.state = 'acting';
        }
      }
    });
    
    // 4. 收集并执行行动
    const actingActors = Array.from(this.actors.values())
      .filter(a => a.state === 'acting');
    
    const logs: GameLogItem[] = [];
    
    actingActors.forEach(actor => {
      const action = actor.executeAction(this);
      // action 返回 { type, target, logs, events }
      logs.push(...action.logs);
      action.events.forEach(e => this.eventBus.emit(e));
      actor.state = 'idle';
    });
    
    // 5. Phase 主动推进（如通知下一个发言者）
    const nextActivators = this.phase.getActivatablePlayers(this);
    nextActivators.forEach(pid => {
      this.notifyPlayer(pid, { type: 'turn', tick: this.tickCount });
    });
    
    // 6. 输出日志
    this.outputLogs(logs.sort((a, b) => (LOG_PRIORITY[a.type] ?? 99) - (LOG_PRIORITY[b.type] ?? 99)));
    
    // 7. 调度下一 tick
    setTimeout(() => this.tick(), this.phase.tickRate / this.speed);
  }
  
  notifyPlayer(pid: string, event: GameEvent) {
    const actor = this.actors.get(pid);
    if (actor && actor.state === 'idle') {
      actor.state = 'thinking';
      actor.thinkCountdown = 1; // 默认 1 tick 思考时间
      actor.pendingEvent = event;
    }
  }
}
```

---

## 9. 具体示例：新模型下的白天流程

假设 6 人存活：A(狼人), B(狼人), C(村民), D(村民), E(预言家), F(盗贼)。

| Tick | 事件 | 玩家状态 | 说明 |
|------|------|----------|------|
| 0 | 进入 Day | 全部 Idle | 白天阶段开始 |
| 0 | A 被通知主动发言 | A: Thinking(1), 其余 Idle | Phase 通知第一个发言人 |
| 1 | A 思考完成 | A: Acting | 1 tick 思考后行动 |
| 1 | A 执行 defend B | A 变 Idle, BCDEF: Thinking(1) | A 的 defend 触发 appendix 事件，广播给所有人 |
| 2 | BCDEF 思考完成 | B: Acting, C: Acting, D: Idle, E: Acting, F: Idle | B 选择 rebut, C 选择沉默, E 选择 join_defend |
| 2 | 并行执行 | B 反驳, E 一同袒护 | 所有 Acting 玩家同时执行 |
| 2 | Phase 通知 B 主动发言 | B: Thinking(1) | A 已行动完，通知下一个主动发言者 |
| 3 | B 思考完成 | B: Acting | B 选择 suspect C |
| 3 | B 执行 suspect C | B 变 Idle, ACDEF: Thinking(1) | 再次触发 appendix |
| 4 | ACDEF 思考完成 | A: Acting, C: Acting, D: Idle, E: Idle, F: Acting | A 选择 join_suspect, C 选择 rebut, F 选择沉默 |
| 4 | 并行执行 | A 一同怀疑, C 反驳 | ... |
| ... | ... | ... | 直到所有人主动发言完毕 |

**关键观察**：
- A 在 tick 1 行动，B 在 tick 2 反应，只隔了 1 tick（2 秒）。
- B 在 tick 3 主动发言，A/C/D/E/F 在 tick 4 同时反应，只隔了 1 tick。
- 不会再有 12 秒的间隔。

---

## 10. 总结

- **不要队列**：每个玩家不是队列中的一个节点，而是独立的 Actor。
- **Tick 节拍**：全局 tick 驱动，所有同步在 tick 边界发生。
- **事件广播**：行动产生事件，事件通过 EventBus 广播给相关玩家。
- **并行思考**：所有收到通知的玩家同时进入 Thinking，同时倒计时。
- **并行行动**：一个 tick 内可以有多个玩家同时处于 Acting 状态，他们的行动逻辑并行执行。
- **日志排序**：并行执行的日志按优先级排序输出，保证可读性。
