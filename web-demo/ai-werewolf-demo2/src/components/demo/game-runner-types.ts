import type { IntentionState } from '@/types/decision';
import type { Player, MemoryEntry } from '@/types';

export interface GameConfig {
  werewolfCount: number;
  prophetCount: number;
  villagerCount: number;
}

export interface GameLog {
  time: string;
  playerId?: string;
  isSystem?: boolean;
  round: number;
  subPhase: 'init' | 'morning' | 'day' | 'vote' | 'result' | 'night' | 'victory';
  content: React.ReactNode;
  deathEvent?: { playerId: string; cause: 'vote' | 'werewolf' };
}

export interface RoundResult {
  round: number;
  playerResults: Map<string, PlayerResult>;
}

export interface PlayerResult {
  intentionState: IntentionState;
  selfCrisis: { score: number; factors: Record<string, number>; basis: string[] };
  relations: { playerId: string; friendly: number; memoryIds: string[] }[];
  inferences: Map<string, { werewolfProb: number; villagerProb: number; basis: string[] }>;
  memories: MemoryEntry[];
}
