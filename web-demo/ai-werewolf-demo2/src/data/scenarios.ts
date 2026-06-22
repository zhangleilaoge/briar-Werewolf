// ============================================================
// 演示场景数据（Scenario Data）
// 5 个预设场景，用于独立展示各模块
// ============================================================

import type { Player } from '@/types';
import type { MemoryEntry } from '@/types';
import { MemStore } from '@/memory';

export const DEMO_PLAYERS: Player[] = [
  { id: 'A', name: 'Alice', role: 'villager', team: 'villager', alive: true, personality: 'aggressive', pressure: 0, burstCount: 0, traits: [], attributes: { leadership: 6, eloquence: 7, observation: 5, cunning: 4, affinity: 6, logic: 7 } },
  { id: 'B', name: 'Bob', role: 'werewolf', team: 'werewolf', alive: true, personality: 'manipulative', pressure: 0, burstCount: 0, traits: [], attributes: { leadership: 5, eloquence: 8, observation: 6, cunning: 9, affinity: 5, logic: 6 } },
  { id: 'C', name: 'Carol', role: 'villager', team: 'villager', alive: true, personality: 'cautious', pressure: 0, burstCount: 0, traits: [], attributes: { leadership: 4, eloquence: 5, observation: 8, cunning: 3, affinity: 7, logic: 8 } },
  { id: 'D', name: 'Dave', role: 'werewolf', team: 'werewolf', alive: true, personality: 'suspicious', pressure: 0, burstCount: 0, traits: [], attributes: { leadership: 7, eloquence: 6, observation: 5, cunning: 8, affinity: 4, logic: 5 } },
  { id: 'E', name: 'Eve', role: 'prophet', team: 'villager', alive: true, personality: 'loyal', pressure: 0, burstCount: 0, traits: [], attributes: { leadership: 5, eloquence: 6, observation: 9, cunning: 3, affinity: 6, logic: 7 } },
];

export interface Scenario {
  id: string;
  name: string;
  desc: string;
  build: (store: MemStore) => void;
}

export const SCENARIOS: Record<string, Scenario> = {
  basic: {
    id: 'basic', name: '基础指控',
    desc: 'C（村民）被B（狼人）和D（狼人）指控。B还攻击了A。观察E发现C在攻击D。预期：C狼人概率上升；B、D也有一定狼人概率。',
    build: (store) => {
      store.add({ round: 1, triggerAt: 'speech', eventType: 'hear_accuse', actorId: 'B', targetId: 'C', content: {}, source: 'speech', credibility: 0.4 });
      store.add({ round: 1, triggerAt: 'speech', eventType: 'hear_accuse', actorId: 'D', targetId: 'C', content: {}, source: 'speech', credibility: 0.4 });
      store.add({ round: 1, triggerAt: 'speech', eventType: 'hear_accuse', actorId: 'B', targetId: 'A', content: {}, source: 'speech', credibility: 0.4 });
      store.add({ round: 1, triggerAt: 'day_start', eventType: 'observe_pattern', actorId: 'E', targetId: 'C', content: { inferredIntention: 'attack', intentionTarget: 'D', confidence: 0.7 }, source: 'observe', credibility: 0.7 });
    },
  },
  protect: {
    id: 'protect', name: '保护关系',
    desc: 'B（狼人）被D（狼人）保护。A（村民）被C（村民）保护。B和D互相保护。预期：B、D相似度高（互保），A被保护。',
    build: (store) => {
      store.add({ round: 1, triggerAt: 'speech', eventType: 'hear_defend', actorId: 'D', targetId: 'B', content: {}, source: 'speech', credibility: 0.4 });
      store.add({ round: 1, triggerAt: 'speech', eventType: 'hear_defend', actorId: 'B', targetId: 'D', content: {}, source: 'speech', credibility: 0.4 });
      store.add({ round: 1, triggerAt: 'speech', eventType: 'hear_defend', actorId: 'C', targetId: 'A', content: {}, source: 'speech', credibility: 0.4 });
      store.add({ round: 1, triggerAt: 'speech', eventType: 'hear_defend', actorId: 'D', targetId: 'B', content: {}, source: 'speech', credibility: 0.4 });
      store.add({ round: 1, triggerAt: 'speech', eventType: 'hear_accuse', actorId: 'A', targetId: 'B', content: {}, source: 'speech', credibility: 0.4 });
    },
  },
  falseProphet: {
    id: 'falseProphet', name: '假预言家',
    desc: 'E（真预言家）查验A是村民（硬信息）。D（狼人）声称查验A是狼人。预期：D被标记为假预言家。',
    build: (store) => {
      store.add({ round: 1, triggerAt: 'night_action', eventType: 'check_result', actorId: 'E', targetId: 'A', content: { result: 'villager' }, source: 'self', credibility: 1.0 });
      store.add({ round: 1, triggerAt: 'speech', eventType: 'hear_claim', actorId: 'D', targetId: 'A', content: { claimedResult: 'werewolf', targetId: 'A' }, source: 'speech', credibility: 0.4 });
      store.add({ round: 1, triggerAt: 'speech', eventType: 'hear_accuse', actorId: 'D', targetId: 'A', content: {}, source: 'speech', credibility: 0.4 });
    },
  },
  social: {
    id: 'social', name: '社交关系网',
    desc: 'B攻击A、C；D攻击A、C；B和D互相保护。C保护A。预期：B、D高度相似（协同攻击+互保）。',
    build: (store) => {
      store.add({ round: 1, triggerAt: 'speech', eventType: 'hear_accuse', actorId: 'B', targetId: 'A', content: {}, source: 'speech', credibility: 0.4 });
      store.add({ round: 1, triggerAt: 'speech', eventType: 'hear_accuse', actorId: 'D', targetId: 'A', content: {}, source: 'speech', credibility: 0.4 });
      store.add({ round: 1, triggerAt: 'speech', eventType: 'hear_accuse', actorId: 'B', targetId: 'C', content: {}, source: 'speech', credibility: 0.4 });
      store.add({ round: 1, triggerAt: 'speech', eventType: 'hear_accuse', actorId: 'D', targetId: 'C', content: {}, source: 'speech', credibility: 0.4 });
      store.add({ round: 1, triggerAt: 'speech', eventType: 'hear_defend', actorId: 'B', targetId: 'D', content: {}, source: 'speech', credibility: 0.4 });
      store.add({ round: 1, triggerAt: 'speech', eventType: 'hear_defend', actorId: 'D', targetId: 'B', content: {}, source: 'speech', credibility: 0.4 });
      store.add({ round: 1, triggerAt: 'speech', eventType: 'hear_defend', actorId: 'C', targetId: 'A', content: {}, source: 'speech', credibility: 0.4 });
      store.add({ round: 1, triggerAt: 'vote', eventType: 'vote', actorId: 'B', targetId: 'A', content: {}, source: 'system', credibility: 1.0 });
      store.add({ round: 1, triggerAt: 'vote', eventType: 'vote', actorId: 'D', targetId: 'A', content: {}, source: 'system', credibility: 1.0 });
    },
  },
  mixed: {
    id: 'mixed', name: '综合场景',
    desc: '硬信息+指控+辩护+观察+投票+假预言家+社交关系。',
    build: (store) => {
      store.add({ round: 1, triggerAt: 'night_action', eventType: 'check_result', actorId: 'E', targetId: 'A', content: { result: 'villager' }, source: 'self', credibility: 1.0 });
      store.add({ round: 1, triggerAt: 'speech', eventType: 'hear_accuse', actorId: 'B', targetId: 'A', content: {}, source: 'speech', credibility: 0.4 });
      store.add({ round: 1, triggerAt: 'speech', eventType: 'hear_accuse', actorId: 'B', targetId: 'C', content: {}, source: 'speech', credibility: 0.4 });
      store.add({ round: 1, triggerAt: 'speech', eventType: 'hear_accuse', actorId: 'D', targetId: 'C', content: {}, source: 'speech', credibility: 0.4 });
      store.add({ round: 1, triggerAt: 'speech', eventType: 'hear_accuse', actorId: 'A', targetId: 'B', content: {}, source: 'speech', credibility: 0.4 });
      store.add({ round: 1, triggerAt: 'speech', eventType: 'hear_defend', actorId: 'D', targetId: 'B', content: {}, source: 'speech', credibility: 0.4 });
      store.add({ round: 1, triggerAt: 'speech', eventType: 'hear_defend', actorId: 'C', targetId: 'A', content: {}, source: 'speech', credibility: 0.4 });
      store.add({ round: 1, triggerAt: 'vote', eventType: 'vote', actorId: 'B', targetId: 'C', content: {}, source: 'system', credibility: 1.0 });
      store.add({ round: 1, triggerAt: 'vote', eventType: 'vote', actorId: 'D', targetId: 'C', content: {}, source: 'system', credibility: 1.0 });
      store.add({ round: 1, triggerAt: 'speech', eventType: 'hear_claim', actorId: 'D', targetId: 'A', content: { claimedResult: 'werewolf', targetId: 'A' }, source: 'speech', credibility: 0.4 });
      store.add({ round: 1, triggerAt: 'day_start', eventType: 'observe_pattern', actorId: 'E', targetId: 'B', content: { inferredIntention: 'hide', confidence: 0.6 }, source: 'observe', credibility: 0.7 });
      store.add({ round: 1, triggerAt: 'day_start', eventType: 'observe_pattern', actorId: 'C', targetId: 'D', content: { inferredIntention: 'attack', intentionTarget: 'A', confidence: 0.7 }, source: 'observe', credibility: 0.7 });
      store.add({ round: 1, triggerAt: 'speech', eventType: 'hear_chat', actorId: 'B', targetId: 'A', content: { success: true }, source: 'speech', credibility: 0.4 });
      store.add({ round: 1, triggerAt: 'speech', eventType: 'hear_chat', actorId: 'D', targetId: 'B', content: { success: true }, source: 'speech', credibility: 0.4 });
    },
  },
};
