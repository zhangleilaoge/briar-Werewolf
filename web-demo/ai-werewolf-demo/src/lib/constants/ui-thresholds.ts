// ---------- UI 阈值常量 ----------

// 百分比显示
export const PERCENT_MULTIPLIER = 100;                    // 百分比乘数（0-1 → 0%-100%）

// 怀疑度颜色阈值
export const SUSPICION_COLOR_HIGH = 0.6;                  // 怀疑度颜色：高（红色）
export const SUSPICION_COLOR_MEDIUM = 0.3;                // 怀疑度颜色：中（黄色）

// 属性颜色阈值
export const ATTR_COLOR_HIGH = 8;                     // 属性颜色：高值阈值（绿色）
export const ATTR_COLOR_MEDIUM = 6;                   // 属性颜色：中值阈值（浅绿色）
export const ATTR_COLOR_LOW = 4;                      // 属性颜色：低值阈值（黄色）

// 压力颜色阈值
export const STRESS_COLOR_CALM = -5;                  // 压力颜色：冷静阈值（蓝色）
export const STRESS_COLOR_NORMAL = 2;                 // 压力颜色：正常阈值（绿色）
export const STRESS_COLOR_TENSE = 5;                  // 压力颜色：紧张阈值（黄色）
export const STRESS_COLOR_ANXIOUS = 8;                // 压力颜色：焦虑阈值（橙色）

// 压力标签阈值
export const STRESS_LABEL_EXTREMELY_CALM = -7;        // 压力标签：极度冷静阈值
export const STRESS_LABEL_CALM = -3;                  // 压力标签：冷静阈值
export const STRESS_LABEL_NORMAL = 2;                 // 压力标签：正常阈值
export const STRESS_LABEL_TENSE = 5;                  // 压力标签：轻微紧张阈值
export const STRESS_LABEL_ANXIOUS = 8;                // 压力标签：明显焦虑阈值

// 游戏速度
export const GAME_SPEED_SLOW = 0.5;                   // 慢速
export const GAME_SPEED_NORMAL = 1;                   // 正常速度
export const GAME_SPEED_FAST = 2;                     // 快速

// UI 过滤阈值
export const RELATION_DISPLAY_THRESHOLD = 0.5;        // 关系显示阈值（低于此值不显示）

// 候选展示数量
export const TOP_CANDIDATES_COUNT = 3;                 // 展示前N个候选

// 弹窗定位偏移
export const POPUP_OFFSET_PX = 5;                      // 弹窗垂直偏移（像素）
