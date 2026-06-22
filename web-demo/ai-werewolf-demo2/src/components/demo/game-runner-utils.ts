import { PERSONALITIES } from '@/intention/personalities';
import type { Player, MemoryEntry } from '@/types';
import { ATTRIBUTE_RANGE, PLAYER_INITIAL, PLAYER_ID_BASE_CHAR_CODE } from '@/constants';
import { ROLE_NAMES } from './game-runner-constants';
import type { GameConfig } from './game-runner-types';

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  return `[${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}]`;
}

export function generatePlayers(config: GameConfig): Player[] {
  const PERSONALITY_IDS = Object.keys(PERSONALITIES);
  let id = 0;
  const temp: Player[] = [];
  const attrs = () => ({
    leadership: randInt(ATTRIBUTE_RANGE.MIN, ATTRIBUTE_RANGE.MAX),
    eloquence: randInt(ATTRIBUTE_RANGE.MIN, ATTRIBUTE_RANGE.MAX),
    observation: randInt(ATTRIBUTE_RANGE.MIN, ATTRIBUTE_RANGE.MAX),
    cunning: randInt(ATTRIBUTE_RANGE.MIN, ATTRIBUTE_RANGE.MAX),
    affinity: randInt(ATTRIBUTE_RANGE.MIN, ATTRIBUTE_RANGE.MAX),
    logic: randInt(ATTRIBUTE_RANGE.MIN, ATTRIBUTE_RANGE.MAX),
  });
  for (let i = 0; i < config.werewolfCount; i++)
    temp.push({ id: String.fromCharCode(PLAYER_ID_BASE_CHAR_CODE + id++), name: `狼人${i + 1}`, role: 'werewolf', team: 'werewolf', alive: true, personality: PERSONALITY_IDS[randInt(0, PERSONALITY_IDS.length - 1)], pressure: PLAYER_INITIAL.PRESSURE, burstCount: PLAYER_INITIAL.BURST_COUNT, traits: [...PLAYER_INITIAL.TRAITS], attributes: attrs() });
  for (let i = 0; i < config.prophetCount; i++)
    temp.push({ id: String.fromCharCode(PLAYER_ID_BASE_CHAR_CODE + id++), name: `预言家${i + 1}`, role: 'prophet', team: 'villager', alive: true, personality: PERSONALITY_IDS[randInt(0, PERSONALITY_IDS.length - 1)], pressure: PLAYER_INITIAL.PRESSURE, burstCount: PLAYER_INITIAL.BURST_COUNT, traits: [...PLAYER_INITIAL.TRAITS], attributes: attrs() });
  for (let i = 0; i < config.villagerCount; i++)
    temp.push({ id: String.fromCharCode(PLAYER_ID_BASE_CHAR_CODE + id++), name: `村民${i + 1}`, role: 'villager', team: 'villager', alive: true, personality: PERSONALITY_IDS[randInt(0, PERSONALITY_IDS.length - 1)], pressure: PLAYER_INITIAL.PRESSURE, burstCount: PLAYER_INITIAL.BURST_COUNT, traits: [...PLAYER_INITIAL.TRAITS], attributes: attrs() });
  return shuffle(temp).map((p, i) => ({ ...p, id: String.fromCharCode(PLAYER_ID_BASE_CHAR_CODE + i) }));
}

export function getPlayerDisplay(playerId: string, players: Player[]): string {
  const ROLE_EMOJIS: Record<string, string> = { werewolf: '🐺', prophet: '🔮', villager: '👤' };
  const p = players.find((x) => x.id === playerId);
  return p ? `${p.name}${ROLE_EMOJIS[p.role]}` : playerId;
}

export function getMemoryDescription(mem: MemoryEntry, selfId: string, players: Player[]): string {
  const isSelf = mem.actorId === selfId;
  const actor = isSelf ? '我' : getPlayerDisplay(mem.actorId, players);
  const target = mem.targetId ? (mem.targetId === selfId ? '我' : getPlayerDisplay(mem.targetId, players)) : '';
  switch (mem.eventType) {
    case 'self_role': {
      const role = (mem.content.role as string) || '未知';
      const roleName = ROLE_NAMES[role] || role;
      return `我知道了自己的身份：${roleName}`;
    }
    case 'teammate_reveal':
      return `我 知道了 ${target} 是狼人队友`;
    case 'check_result': {
      const result = mem.content.result === 'werewolf' ? '狼人' : '村民';
      return `${actor} 查验了 ${target}，结果是 ${result}`;
    }
    case 'death': {
      const cause = mem.content.cause === 'vote' ? '被投票放逐' : '被狼人杀害';
      return `${target} ${cause}`;
    }
    case 'hear_claim':
      return `${actor} 声称自己是 ${(mem.content.claimedRole as string) || '某种身份'}`;
    case 'hear_accuse':
      return `${actor} 指控了 ${target}`;
    case 'hear_defend':
      return `${actor} 为 ${target} 辩护`;
    case 'hear_chat':
      return `${actor} 和 ${target} 闲聊`;
    case 'hear_silence':
      return `${actor} 保持沉默`;
    case 'morning': {
      const cause = mem.content.cause === 'vote' ? '被投票放逐' : '被狼人杀害';
      return `天亮了，${target} ${cause}`;
    }
    case 'peaceful_night':
      return '昨晚是平安夜';
    case 'vote':
      return `${actor} 投票给 ${target}`;
    case 'vote_result':
      return `${target} 被放逐了`;
    case 'observe_pattern':
      return `${actor} 观察到 ${target} 的某种行为`;
    default:
      return `${actor} 发生了 ${mem.eventType}`;
  }
}

export function formatRoundDisplay(round: number, dayRound: unknown): string {
  if (round === 0) return '初始';
  const dr = dayRound as number | undefined;
  return dr ? `第${round}天第${dr}轮` : `第${round}天`;
}


export function getMemoryTooltip(memoryIds: string[], memories: MemoryEntry[], selfId: string, players: Player[]): string {
  if (memoryIds.length === 0) return '无支撑记忆';
  return memoryIds
    .map((id) => {
      const mem = memories.find((m) => m.id === id);
      return mem ? getMemoryDescription(mem, selfId, players) : '未知记忆';
    })
    .join(' | ');
}
