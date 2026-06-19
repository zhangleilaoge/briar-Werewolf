// =====================================================================
// 统一中文显示名称映射（用于日志、UI展示、决策过程）
// =====================================================================

// 意图类型
export const INTENTION_TYPE_NAMES: Record<string, string> = {
  attack: '攻击', recruit: '潜伏', protect: '保护', reveal: '揭示',
  investigate: '调查', coordinate: '协同', survive: '生存',
};

// 意图来源
export const INTENTION_SOURCE_NAMES: Record<string, string> = {
  team_duty: '阵营职责', personal_goal: '个人目标', crisis: '危机',
  strategic: '战略', external: '外部压力', role_duty: '职业职责', bus: '背锅',
};

// 计划阶段
export const PLAN_PHASE_NAMES: Record<string, string> = {
  day: '白天', night: '夜间', vote: '投票', morning: '早晨',
  init: '初始', event: '事件', ended: '结束',
};

// 行动名称
export const ACTION_NAMES: Record<string, string> = {
  silence: '沉默', speak: '发言', claim_identity: '公布身份', reveal_info: '公开信息',
  observe: '暗中观察', suspect: '怀疑', defend: '袒护',
  call_vote: '号召投票', block_vote: '阻止投票', guarantee: '担保', accuse: '强烈指认',
  exclude_all: '全员排除', berserker_kill: '狂狼同归于尽', kill: '袭击', check: '查验',
  steal: '偷取', inspect: '验尸', vote: '投票', join_suspect: '一同怀疑', join_defend: '一同袒护', rebut: '反驳',
};

// 承诺/意愿强度等级
export const COMMITMENT_NAMES: Record<string, string> = {
  weak: '弱', medium: '中', strong: '强',
};

// 模式
export const MODE_NAMES: Record<string, string> = {
  normal: '常规', bus: '推车', desperate: '绝境', dominant: '优势',
};

// 阵营目标
export const TEAM_OBJECTIVE_NAMES: Record<string, string> = {
  eliminate_opposition: '消灭对手', find_wolves: '找出狼人',
};

// 个人目标
export const PERSONAL_OBJECTIVE_NAMES: Record<string, string> = {
  maintain_cover: '潜伏', survive: '生存', gain_trust: '获得信任', reveal_truth: '揭示真相',
};

// 策略阶段（用于决策引擎展示）
export const STAGE_NAMES: Record<string, string> = {
  duty: '职业义务', survival: '生存', information: '信息', social: '社交', intention: '意图',
};

// 阵营名称（日志展示）
export const TEAM_NAMES: Record<string, string> = {
  werewolf: '狼人', villager: '村民',
};
