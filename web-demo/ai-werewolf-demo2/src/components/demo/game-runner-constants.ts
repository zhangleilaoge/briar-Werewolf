import { PERSONALITIES } from '@/intention/personalities';

export const ROLE_EMOJIS: Record<string, string> = { werewolf: '🐺', prophet: '🔮', villager: '👤' };
export const ROLE_NAMES: Record<string, string> = { werewolf: '狼人', prophet: '预言家', villager: '村民' };
export const TEAM_BADGE: Record<string, { label: string; color: string }> = {
  werewolf: { label: '狼人', color: 'text-red-400' },
  villager: { label: '好', color: 'text-green-400' },
};
export const ROLE_SKILLS: Record<string, string> = { werewolf: '尖牙利爪', prophet: '水晶球', villager: '平民' };
export const PERSONALITY_IDS = Object.keys(PERSONALITIES);
export const ATTRIBUTE_NAMES: Record<string, string> = { leadership: '领导力', eloquence: '口才', observation: '观察力', cunning: '狡诈', affinity: '亲和力', logic: '逻辑' };
export const ACTION_NAMES: Record<string, string> = { claim_identity: '公布身份', suspect: '号召投票', defend: '辩护', observe: '暗中观察', silence: '保持沉默', chat: '闲聊', kill: '攻击', check: '查验', vote: '投票', accuse: '指控', reveal: '揭示', expose: '揭露', attack: '攻击', protect: '保护', coordinate: '协调', eliminate: '消灭', hunt: '猎杀', guard: '守护', deceive: '欺骗' };
export const LONG_TERM_NAMES: Record<string, string> = { eliminate_enemies: '消灭敌人', survive: '生存', find_werewolf: '找出狼人', protect_villager: '保护村民', win_game: '赢得游戏', hide_identity: '隐藏身份', expose_werewolf: '揭露狼人', lead_village: '领导村庄', protect_self: '自我保护', find_allies: '寻找盟友', deceive_others: '欺骗他人', coordinate_team: '协调团队', eliminate_werewolf: '消灭狼人', protect_team: '保护团队' };
export const SHORT_TERM_NAMES: Record<string, string> = { vote_werewolf: '投狼人', defend_self: '自我保护', gather_info: '收集信息', suspect_player: '怀疑玩家', protect_player: '保护玩家', attack_player: '攻击玩家', check_player: '查验玩家', silence: '保持沉默', chat: '闲聊', observe: '观察', claim_identity: '公布身份', accuse_player: '指控玩家', defend_player: '辩护玩家', coordinate_kill: '协调击杀', deceive_player: '欺骗玩家', vote_player: '投票玩家', gather_evidence: '收集证据', push_vote: '推动投票', stay_low: '保持低调', build_trust: '建立信任', spread_doubt: '散布怀疑' };
export const MEMORY_EVENT_NAMES: Record<string, string> = { self_role: '获知身份', teammate_reveal: '队友揭露', check_result: '查验结果', night_kill_vote: '狼人击杀投票', death: '玩家死亡', hear_claim: '听到声称', hear_accuse: '听到指控', hear_defend: '听到辩护', hear_chat: '听到闲聊', vote: '投票行为', vote_result: '投票结果', observe_pattern: '观察行为模式' };
export const MEMORY_SOURCE_NAMES: Record<string, string> = { system: '系统', self: '自己', speech: '发言', observe: '观察' };
export const MEMORY_TRIGGER_NAMES: Record<string, string> = { init: '初始化', night_start: '夜间开始', night_action: '夜间行动', night_end: '夜间结束', day_start: '白天开始', speech: '发言', vote: '投票', vote_result: '投票结果' };
