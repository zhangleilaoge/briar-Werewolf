export type Role = 'prophet' | 'thief' | 'coroner' | 'werewolf' | 'lone_wolf' | 'berserker' | 'villager';
export type Team = 'werewolf' | 'villager';
export type Phase = 'night' | 'day' | 'vote' | 'init';
export type ActionType = 'check' | 'kill' | 'steal' | 'inspect' | 'vote' | 'berserker_kill' | 'speak';

export interface Player {
  id: string;
  name: string;
  role: Role;
  team: Team;
  alive: boolean;
  items: string[];
}

export interface CheckResult {
  targetId: string;
  result: 'werewolf' | 'villager';
}

export interface PublicClaim {
  playerId: string;
  claim: string;
  content: Record<string, unknown>;
  round: number;
}

export interface Relation {
  friendly: number;
  trust: number;
}

export interface RoleBeliefs {
  werewolf: number;
  villager: number;
}

export interface OthersBeliefs {
  [playerId: string]: {
    [targetId: string]: number;
  };
}

export interface L2TheoryOfMind {
  othersBeliefs: OthersBeliefs;
  othersTrustMe: Record<string, number>;
  othersKnowMyRole: Record<string, number>;
}

export interface L3Social {
  relations: Record<string, Relation>;
  pressure: number;
  emotionalState: 'neutral' | 'anxious' | 'confident' | 'angry';
}

export interface DecisionCandidate {
  action: string;
  target: string | null;
  score: number;
  confidence: number;
  reason: string;
  stageWeight?: number;
  stage?: string;
}

export interface DecisionResult {
  action: string;
  target: string | null;
  reason: string;
  stage: string;
  confidence: number;
  emotionalTone: string;
}

export interface LogEntry {
  round: number;
  phase: Phase;
  message: string;
  timestamp: number;
}

export interface GameLogItem {
  round: number;
  message: string;
  type: 'phase' | 'action' | 'death' | 'victory' | 'info';
}

export interface GameConfig {
  totalPlayers: number;
  werewolfRoles: { role: Role; count: number }[];
  villagerRoles: { role: Role; count: number }[];
}

export const WEREWOLF_ROLES: { role: Role; label: string; description: string }[] = [
  { role: 'werewolf', label: '普通狼人', description: '参与夜晚讨论，可执行杀戮' },
  { role: 'lone_wolf', label: '孤狼', description: '独立选择杀戮目标，不与其他狼人沟通' },
  { role: 'berserker', label: '狂狼', description: '白天可同归于尽，触发平安夜' },
];

export const VILLAGER_ROLES: { role: Role; label: string; description: string }[] = [
  { role: 'villager', label: '普通村民', description: '无特殊能力，通过投票放逐狼人' },
  { role: 'prophet', label: '预言家', description: '每晚查验一名玩家身份' },
  { role: 'thief', label: '窃贼', description: '整场游戏限一次偷取一名玩家的道具' },
  { role: 'coroner', label: '验尸官', description: '整场游戏限一次查看死亡角色的道具' },
];

export const ROLE_ITEMS: Record<string, string[]> = {
  prophet: ['crystal_ball'],
  werewolf: ['claws'],
  lone_wolf: ['claws'],
  berserker: ['claws', 'double_sword'],
  thief: ['thief_gloves'],
  coroner: ['coroner_tools'],
  villager: [],
};
