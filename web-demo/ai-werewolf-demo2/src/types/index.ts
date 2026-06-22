// ============================================================
// 核心类型定义 —— 记忆、信念、玩家、角色
// 先只定义类型，不写实现
// ============================================================

// ---------- 基础实体 ----------
export type Role = 'prophet' | 'werewolf' | 'villager';
export type Team = 'werewolf' | 'villager';
export type Phase = 'day' | 'night';

export interface Player {
  id: string;
  name: string;
  role: Role;
  team: Team;
  alive: boolean;
  personality: string;    // 性格ID，如 'aggressive' / 'cautious' / 'manipulative' 等
  pressure: number;        // 当前压力值，0~20，初始0
  burstCount: number;      // 已爆满次数，初始0
  traits: string[];        // 已获得的特质ID列表
  attributes: {
    leadership: number;   // 领导力，0~10
    eloquence: number;      // 口才，0~10
    observation: number;    // 观察力，0~10
    cunning: number;      // 诡诈，0~10 — 伪装、欺骗、说谎的能力
    affinity: number;      // 亲和，0~10 — 建立信任、团结他人的能力
    logic: number;        // 逻辑，0~10 — 分析推理、识别矛盾的能力
  };
}

// ---------- 关系系统 ----------
export interface Relation {
  friendly: number; // 友好度，-10 ~ 10，初始 0。纯粹的关系，和推理无关。
  memoryIds: string[]; // 支撑记忆ID
}

// ---------- 记忆系统 ----------
export type MemoryTrigger =
  | 'init'          // 游戏初始化
  | 'night_start'   // 夜间开始
  | 'night_action'  // 夜间行动（查验/杀人）
  | 'night_end'     // 夜间结束（公布死亡）
  | 'day_start'     // 白天开始
  | 'speech'        // 白天发言
  | 'vote'          // 投票阶段
  | 'vote_result';  // 投票结果

export type MemorySource =
  | 'system'        // 系统事件或系统告知（100%可信）：死亡、投票结果、自己角色、狼人队友
  | 'self'          // 自己的行动（100%可信）：查验、杀人投票、救/毒
  | 'speech'        // 白天发言（0.4）：他人声称、指控、辩护，内容可能为假
  | 'observe';       // 自己的观察（0.7）：行为模式，可能有偏差

export type MemoryEventType =
  | 'self_role'         // 我知道自己的角色（init触发）
  | 'teammate_reveal'   // 狼人知道队友（init触发，仅狼人）
  | 'check_result'      // 预言家查验结果（night_action触发）
  | 'night_kill_vote'   // 狼人投票击杀（night_action触发）
  | 'death'             // 玩家死亡（night_end/vote_result触发）
  | 'hear_claim'        // 听到别人声称（speech触发）
  | 'hear_accuse'       // 听到别人指控（speech触发）
  | 'hear_defend'       // 听到别人辩护（speech触发）
  | 'hear_chat'       // 听到别人闲聊（speech触发）
  | 'vote'              // 投票行为（vote触发）
  | 'vote_result'       // 投票结果（vote_result触发）
  | 'observe_pattern'   // 观察到的行为模式（day_start触发）

export interface MemoryEntry {
  id: string;
  triggerAt: MemoryTrigger;  // 触发时机
  round: number;             // 第几回合
  eventType: MemoryEventType;
  actorId: string;           // 行为者（谁做的/谁说的）
  targetId?: string;         // 目标（对谁做的）
  content: Record<string, unknown>;
  source: MemorySource;      // 来源（决定可信度）
  credibility: number;       // 0~1，这条记忆的可信度
  importance: number;       // 0~1，这条记忆的重要度（决定遗忘难度）
  isForgotten: boolean;     // 是否已遗忘（不删除，只标记）
  createdAt: number;        // 时间戳
  notes?: string;           // AI备注
}

// ---------- 决策系统类型 ----------
export * from './decision';
