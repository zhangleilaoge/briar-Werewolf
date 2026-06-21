# 角色特定逻辑（Role-Specific Logic）

> 先只设计三个角色：预言家、普通狼人、普通村民。先只设计五种白日行动：沉默、公布身份、观察、怀疑、袒护。

## 角色与行动

| 角色 | 阵营 | 夜间能力 | 白天常用行动 |
|------|------|---------|------------|
| 预言家 | 村民 | 查验 | claim_identity（跳身份）、suspect（公布查杀）、observe（观察可疑目标）、defend（自证）、silence（隐藏） |
| 狼人 | 狼人 | 杀人 | silence（默认）、defend（保队友）、suspect（推波）、claim_identity（假跳）、observe（收集信息） |
| 村民 | 村民 | 无 | suspect（表达怀疑）、defend（为好人说话）、observe（收集信息）、silence（默认） |

## 核心逻辑

> 以下逻辑为**角色义务**（硬约束）+ **推荐倾向**（软建议）。实际决策还会受性格影响（详见 [PERSONALITY.md](PERSONALITY.md)）。

### 预言家
- 夜间：`check` 查验目标（优先选未查验的、高领导力目标）
- 白天：有查杀 → 优先 `suspect`；有人对跳 → 考虑 `claim_identity`；被攻击 → `defend`；局势不明 → `observe` 或 `silence`
- **性格影响**：好斗型更倾向强势查杀；谨慎型可能隐藏身份

### 狼人
- 夜间：`kill` 不能杀队友，优先杀高领导力、能带节奏的
- 白天：默认 `silence`（最安全）；队友被攻击 → `defend`（不要太明显）；需要搅局 → `suspect` 或 `claim_identity`；需要信息 → `observe`
- **性格影响**：操控型更倾向搅局和引导；忠诚型更保护队友

### 村民
- 夜间：无行动
- 白天：有高怀疑目标 → `suspect`；好人被攻击 → `defend`；无明确信息 → `observe` 或 `silence`；不 `claim_identity`（村民跳身份价值低）
- **性格影响**：多疑型总是怀疑；忠诚型更倾向辩护

## 性格与职业的典型组合

| 职业 | 推荐性格 | 表现 |
|------|---------|------|
| 预言家 | 好斗型 | 激进查杀、强势带队 |
| 预言家 | 谨慎型 | 隐藏信息、不轻易跳身份 |
| 狼人 | 操控型 | 善于搅局、引导风向 |
| 狼人 | 忠诚型 | 保护队友、不太会卖队友 |
| 村民 | 多疑型 | 铁头好人、总是质疑别人 |
| 村民 | 忠诚型 | 保护好人、容易被信任 |

## 暂不实现

| 角色 | 状态 |
|------|------|
| 女巫 | 暂不实现（有解药/毒药） |
| 猎人 | 暂不实现（死亡时开枪） |
| 白痴 | 暂不实现（翻牌免死） |

| 动作 | 状态 |
|------|------|
| `call_vote` | 暂不设计（号召投票） |
| `block_vote` | 暂不设计（阻止投票） |
| `guarantee` | 暂不设计（担保清白） |
| `strong_accuse` | 暂不设计（强烈指认） |
| `exclude_all` | 暂不设计（全员排除） |
| `vote` | 暂不设计（投票机制） |

## 文档索引

- [MAIN.md](MAIN.md) — 文档目录
- [MEMORY-SYSTEM.md](MEMORY-SYSTEM.md) — 记忆系统
- [RELATION.md](RELATION.md) — 关系系统
- [INFERENCE.md](INFERENCE.md) — 推理系统
- [PERSONALITY.md](PERSONALITY.md) — 性格系统（影响行动选择）
- [PRESSURE.md](PRESSURE.md) — 压力系统
- [STATE.md](STATE.md) — 状态系统
- [TRAIT.md](TRAIT.md) — 特质系统（只影响机制）
- [ACTION.md](ACTION.md) — 动作系统定义
- [INTENTION.md](INTENTION.md) — 意图系统（最终决策系统）
- [ROLE.md](ROLE.md) — 职业文档（职业定义）
- [MODERATOR.md](MODERATOR.md) — 游戏流程
- [ITEM.md](ITEM.md) — 物品系统
