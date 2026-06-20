import { useState } from 'react';

interface RulesModalProps {
  open: boolean;
  onClose: () => void;
}

type TabId = 'overview' | 'roles' | 'items' | 'actions' | 'attributes' | 'ai';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: '游戏概述' },
  { id: 'roles', label: '角色' },
  { id: 'items', label: '道具' },
  { id: 'actions', label: '行动' },
  { id: 'attributes', label: '属性与检定' },
  { id: 'ai', label: 'AI 系统' },
];

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
        active
          ? 'bg-[#1a1b2e] text-white border-b-2 border-blue-400'
          : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1b2e]/50'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
        {title}
      </h3>
      <div className="text-sm text-gray-300 leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${color}`}>
      {children}
    </span>
  );
}

// ========== Tab Contents ==========

function OverviewTab() {
  return (
    <div className="space-y-6">
      <Section title="游戏目标">
        <p>
          AI 狼人杀是一个 AI 自动对战的社交推理游戏。狼人阵营与村民阵营通过发言、投票、特殊能力进行博弈，
          直到一方达成胜利条件。
        </p>
        <div className="grid grid-cols-2 gap-4 mt-3">
          <div className="bg-green-900/30 border border-green-700/50 rounded-lg p-3">
            <div className="font-bold text-green-400 mb-1">🏆 村民胜利</div>
            <div className="text-xs">所有狼人被消灭</div>
          </div>
          <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3">
            <div className="font-bold text-red-400 mb-1">🏆 狼人胜利</div>
            <div className="text-xs">狼人数量 ≥ 村民数量</div>
          </div>
        </div>
      </Section>

      <Section title="游戏流程">
        <div className="space-y-3">
          {[
            { phase: '白天', icon: '☀️', desc: '玩家轮流发言，可以怀疑、袒护、号召投票等。触发追加反应（一同怀疑、一同袒护、反驳）。' },
            { phase: '投票', icon: '🗳️', desc: '所有存活玩家投票放逐一人。平票则进入第二轮投票，第二轮平票无人放逐。' },
            { phase: '夜晚', icon: '🌙', desc: '狼人讨论并选择杀戮目标；预言家查验；窃贼偷取；验尸官尸检。' },
            { phase: '早晨', icon: '🌅', desc: '公布昨夜死亡，压力和关系自然恢复。' },
          ].map(({ phase, icon, desc }) => (
            <div key={phase} className="flex gap-3 items-start">
              <span className="text-lg mt-0.5">{icon}</span>
              <div>
                <span className="font-bold text-white">{phase}</span>
                <span className="text-gray-400 ml-2">{desc}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="特殊机制">
        <ul className="list-disc list-inside space-y-1 text-gray-400">
          <li><span className="text-white font-medium">连续沉默跳转</span>：当连续沉默人数达到存活人数时，直接进入投票阶段。</li>
          <li><span className="text-white font-medium">平安夜</span>：狂狼同归于尽后，当晚跳过狼人杀戮。</li>
          <li><span className="text-white font-medium">同一目标限制</span>：同一天对同一玩家只能执行一次动作。</li>
        </ul>
      </Section>
    </div>
  );
}

function RolesTab() {
  const roles = [
    { name: '普通狼人', team: 'werewolf', icon: '🐺', desc: '夜晚与狼队友讨论并选择杀戮目标。白天伪装好人，通过发言误导村民。', ability: '夜晚协同杀戮', items: '尖牙利爪' },
    { name: '孤狼', team: 'werewolf', icon: ' lone', desc: '独立行动的狼人，夜间不能与其他狼人沟通。若杀戮目标与普通狼人相同，本次杀戮无效。', ability: '独立夜间杀戮', items: '尖牙利爪' },
    { name: '狂狼', team: 'werewolf', icon: '🔥', desc: '白天可发动同归于尽，与一名玩家双双死亡，并触发平安夜。适合劣势时搏命。', ability: '白天同归于尽', items: '尖牙利爪、双刃剑' },
    { name: '普通村民', team: 'villager', icon: '👤', desc: '无特殊能力，通过发言分析和投票放逐狼人。是人数最多的阵营。', ability: '无', items: '无' },
    { name: '预言家', team: 'villager', icon: '🔮', desc: '每晚可查验一名玩家的真实身份（狼人或村民）。是村民阵营的核心信息来源。', ability: '夜间查验身份', items: '水晶球' },
    { name: '窃贼', team: 'villager', icon: '🧤', desc: '整场游戏限一次偷取一名玩家的道具。可窃取关键道具改变局势。', ability: '偷取道具（限一次）', items: '小偷手套' },
    { name: '验尸官', team: 'villager', icon: '🔍', desc: '整场游戏限一次查看一名死亡角色的所有道具信息。', ability: '尸检（限一次）', items: '验尸工具' },
  ];

  return (
    <div className="space-y-4">
      {roles.map((r) => (
        <div
          key={r.name}
          className={`border rounded-lg p-4 ${
            r.team === 'werewolf'
              ? 'bg-red-900/20 border-red-700/40'
              : 'bg-green-900/20 border-green-700/40'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{r.icon === ' lone' ? '🐺' : r.icon}</span>
            <span className="font-bold text-white">{r.name}</span>
            <Badge color={r.team === 'werewolf' ? 'bg-red-600/60 text-red-200' : 'bg-green-600/60 text-green-200'}>
              {r.team === 'werewolf' ? '狼人阵营' : '村民阵营'}
            </Badge>
          </div>
          <p className="text-sm text-gray-300 mb-2">{r.desc}</p>
          <div className="flex gap-4 text-xs text-gray-400">
            <span>能力：<span className="text-gray-200">{r.ability}</span></span>
            <span>道具：<span className="text-gray-200">{r.items}</span></span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ItemsTab() {
  const items = [
    { name: '尖牙利爪', icon: '🦷', type: '前提道具', desc: '狼人的天然武器。拥有时可在夜晚执行杀戮。被持有此道具的非狼人玩家攻击时，可选择同归于尽。', durability: 1 },
    { name: '水晶球', icon: '🔮', type: '前提道具', desc: '查验身份的神秘道具。持有时可执行夜间查验。若查验到狼人，水晶球碎裂损坏。', durability: 1 },
    { name: '小偷手套', icon: '🧤', type: '前提道具', desc: '偷取他人道具的手套。持有时可执行一次偷取，使用后损坏。', durability: 1 },
    { name: '验尸工具', icon: '🔬', type: '消耗品', desc: '检验尸体的工具。持有时可执行一次尸检，查看一名死亡角色的所有道具。使用后损坏。', durability: 1 },
    { name: '护身符', icon: '🛡️', type: '消耗品', desc: '可抵挡一次致命攻击。被夜晚杀戮时自动消耗，抵挡后损坏。', durability: 1 },
    { name: '双刃剑', icon: '⚔️', type: '消耗品', desc: '狂狼的毁灭性武器。狂狼持有时可发动同归于尽，与一名玩家双双死亡并触发平安夜。使用后消耗。', durability: 1 },
  ];

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.name} className="bg-[#1a1b2e] border border-gray-700/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{item.icon}</span>
            <span className="font-bold text-white">{item.name}</span>
            <Badge color="bg-gray-600/60 text-gray-200">{item.type}</Badge>
            <span className="text-xs text-gray-500">耐久 {item.durability}</span>
          </div>
          <p className="text-sm text-gray-300">{item.desc}</p>
        </div>
      ))}
    </div>
  );
}

function ActionsTab() {
  return (
    <div className="space-y-6">
      <Section title="白天行动">
        <div className="grid grid-cols-1 gap-2">
          {[
            { name: '沉默', desc: '不发表任何言论，保持沉默。连续沉默可能导致直接进入投票。' },
            { name: '怀疑', desc: '对一名玩家表示怀疑。检定：洞察/逻辑 vs 目标隐蔽。成功后目标压力上升。' },
            { name: '袒护', desc: '为一名玩家辩护，表示信任。检定：亲和 + 阵营修正。成功后目标压力下降。' },
            { name: '强烈指认', desc: '强烈指控一名玩家是狼人。检定：洞察/逻辑 vs 目标隐蔽。对目标压力和关系影响更大。' },
            { name: '号召投票', desc: '号召大家投票放逐一名玩家。检定：领导/逻辑。成功后影响其他人的投票倾向。' },
            { name: '阻止投票', desc: '阻止大家投票放逐一名玩家。检定：领导/亲和。可保护被怀疑的玩家。' },
            { name: '担保清白', desc: '以自身信誉担保一名玩家是好人。检定：亲和/洞察。成功后大幅提升目标好感度。' },
            { name: '公布身份', desc: '公开声称自己是某职业。预言家公布身份后会自动公开所有查验结果。' },
            { name: '观察', desc: '暗中观察一名玩家。检定：洞察 vs 目标隐蔽（是否观察到）+ 目标洞察 vs 你隐蔽（是否被发现）。' },
            { name: '全员排除', desc: '提议排除所有自称某身份的玩家。检定：逻辑/领导。难度较高。' },
          ].map((a) => (
            <div key={a.name} className="flex gap-3 items-start">
              <Badge color="bg-yellow-600/40 text-yellow-200 shrink-0">{a.name}</Badge>
              <span className="text-xs text-gray-400">{a.desc}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="追加反应">
        <p className="text-gray-400 mb-2">当玩家执行怀疑或袒护后，其他玩家可立即做出反应：</p>
        <div className="grid grid-cols-1 gap-2">
          {[
            { name: '一同怀疑', desc: '跟随怀疑者，对同一目标表示怀疑。检定：洞察/逻辑。' },
            { name: '一同袒护', desc: '跟随袒护者，对同一目标表示支持。检定：亲和。' },
            { name: '反驳', desc: '当你是被怀疑的目标时，可以反驳怀疑者。检定：反驳者逻辑 vs 怀疑者洞察。' },
          ].map((a) => (
            <div key={a.name} className="flex gap-3 items-start">
              <Badge color="bg-blue-600/40 text-blue-200 shrink-0">{a.name}</Badge>
              <span className="text-xs text-gray-400">{a.desc}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="夜间行动">
        <div className="grid grid-cols-1 gap-2">
          {[
            { name: '杀戮', desc: '狼人在夜晚选择一名玩家杀戮。需要持有尖牙利爪。狼人会先讨论再统一行动。' },
            { name: '查验', desc: '预言家查验一名玩家的真实身份（狼人/村民）。需要持有水晶球，查验到狼人后水晶球损坏。' },
            { name: '偷取', desc: '窃贼偷取一名玩家的道具。需要持有小偷手套，全场限一次。' },
            { name: '尸检', desc: '验尸官检查一名死亡角色的道具。需要持有验尸工具，全场限一次。' },
          ].map((a) => (
            <div key={a.name} className="flex gap-3 items-start">
              <Badge color="bg-purple-600/40 text-purple-200 shrink-0">{a.name}</Badge>
              <span className="text-xs text-gray-400">{a.desc}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="投票">
        <p className="text-gray-400">
          所有存活玩家各投一票，得票最多者被放逐。平票时进入第二轮，仅平票候选人参与；第二轮仍平票则无人放逐。
        </p>
      </Section>

      <Section title="狂狼特殊行动">
        <p className="text-gray-400">
          狂狼在白天可发动「同归于尽」，与一名玩家双双死亡，并触发平安夜（当晚狼人杀戮无效）。需要持有双刃剑，适合狼队劣势时搏命。
        </p>
      </Section>
    </div>
  );
}

function AttributesTab() {
  const attrs = [
    { name: '亲和', key: 'affinity', color: 'text-pink-400', desc: '说服力、建立信任、降低压力。影响袒护、担保等社交行动的检定。' },
    { name: '逻辑', key: 'logic', color: 'text-blue-400', desc: '推理能力、识破谎言、构建证据链。影响怀疑、号召投票等分析行动。' },
    { name: '领导', key: 'leadership', color: 'text-yellow-400', desc: '主导议程、影响跟票。影响号召投票、阻止投票等领导力行动。' },
    { name: '诡诈', key: 'deception', color: 'text-purple-400', desc: '撒谎、伪装、误导。影响伪装身份的成功率。守序阵营有惩罚，混乱/邪恶阵营有加成。' },
    { name: '隐蔽', key: 'stealth', color: 'text-gray-400', desc: '隐藏立场、降低被怀疑概率。影响被观察、被怀疑时的对抗检定。' },
    { name: '洞察', key: 'insight', color: 'text-green-400', desc: '感知情绪动机、看穿伪装。影响观察、怀疑等侦查行动的检定。' },
  ];

  return (
    <div className="space-y-6">
      <Section title="六维属性">
        <p className="text-gray-400 mb-3">
          每个玩家拥有六维属性（1-20），共 72 点。属性影响各类行动的检定结果。
        </p>
        <div className="grid grid-cols-2 gap-3">
          {attrs.map((a) => (
            <div key={a.key} className="bg-[#1a1b2e] border border-gray-700/40 rounded-lg p-3">
              <div className={`font-bold ${a.color} mb-1`}>{a.name}</div>
              <div className="text-xs text-gray-400">{a.desc}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="检定系统">
        <div className="bg-[#1a1b2e] border border-gray-700/40 rounded-lg p-4 space-y-3">
          <div>
            <span className="font-bold text-white">基础检定</span>
            <span className="text-gray-400 ml-2">= 属性值 + 1d20 + 阵营修正 + 压力修正</span>
          </div>
          <div>
            <span className="font-bold text-white">对抗检定</span>
            <span className="text-gray-400 ml-2">= 攻击方总值 vs 防御方总值，差值决定胜负</span>
          </div>
          <div className="text-xs text-gray-500 space-y-1">
            <div>• 大成功：骰子掷出 20 → 必定成功</div>
            <div>• 大失败：骰子掷出 1 → 必定失败</div>
            <div>• 阵营修正：守序+领导/-诡诈，混乱+诡诈，善良+亲和，邪恶+诡诈</div>
            <div>• 压力修正：压力越高，检定越不稳定</div>
          </div>
        </div>
      </Section>

      <Section title="检定难度">
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            { diff: '简单 (10)', acts: '袒护、一同怀疑、一同袒护' },
            { diff: '中等 (12)', acts: '号召投票、阻止投票、担保清白' },
            { diff: '困难 (15)', acts: '全员排除' },
            { diff: '极难 (18)', acts: '（预留）' },
          ].map((d) => (
            <div key={d.diff} className="bg-[#1a1b2e] border border-gray-700/40 rounded p-2">
              <div className="font-bold text-white">{d.diff}</div>
              <div className="text-gray-400">{d.acts}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="压力系统">
        <p className="text-gray-400">
          压力范围 -10（极度冷静）到 +10（过载）。被怀疑、被攻击时压力上升；被袒护、夜间恢复时下降。
          高压力使检定更不稳定，可能导致冲动行为。压力每夜自然恢复。
        </p>
      </Section>

      <Section title="关系系统">
        <p className="text-gray-400">
          好感度范围 -10（极度敌对）到 +10（极度友好）。被袒护/担保时好感上升，被怀疑/攻击时下降。
          好感度影响 AI 对目标的行动倾向（更可能保护高好感目标，更可能攻击低好感目标）。关系每夜自然向 0 回归。
        </p>
      </Section>
    </div>
  );
}

function AITab() {
  return (
    <div className="space-y-6">
      <Section title="AI 信念系统">
        <p className="text-gray-400 mb-3">
          每个 AI 玩家维护一套四层信念系统，模拟真实玩家的推理过程：
        </p>
        <div className="space-y-3">
          {[
            { layer: 'L0 事实层', color: 'text-blue-400', desc: '已知的确定事实：查验结果、死亡记录、公开声明。不可更改。' },
            { layer: 'L1 推理层', color: 'text-green-400', desc: '概率推理：每个玩家是狼人的概率。基于公共行为（怀疑、袒护、投票）动态更新。' },
            { layer: 'L2 心智层', color: 'text-yellow-400', desc: '心智理论：其他人对我的看法，其他人对其他玩家的怀疑度。' },
            { layer: 'L3 社交层', color: 'text-pink-400', desc: '社交情感：与其他玩家的关系、自身压力、情绪状态。' },
          ].map((l) => (
            <div key={l.layer} className="bg-[#1a1b2e] border border-gray-700/40 rounded-lg p-3">
              <div className={`font-bold ${l.color} mb-1`}>{l.layer}</div>
              <div className="text-xs text-gray-400">{l.desc}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="AI 决策引擎">
        <p className="text-gray-400">
          AI 通过策略评分系统选择行动。每个候选行动获得基础分数，再叠加阶段权重、阵营修正、压力修正、关系修正。
          最终从评分最高的 3 个候选中加权随机选择，模拟人类的不确定性。
        </p>
        <div className="mt-3 bg-[#1a1b2e] border border-gray-700/40 rounded-lg p-3 text-xs text-gray-400 space-y-1">
          <div>• <span className="text-white">职业义务 (1000)</span>：最高优先级，如预言家公布查验</div>
          <div>• <span className="text-white">生存 (800)</span>：自保行为，如高身份危机时隐藏身份</div>
          <div>• <span className="text-white">信息 (500)</span>：获取/传播信息，如怀疑、观察</div>
          <div>• <span className="text-white">社交 (100)</span>：社交互动，如跟随号召、反驳</div>
        </div>
      </Section>

      <Section title="意图系统">
        <p className="text-gray-400">
          AI 维护一个意图栈，记录当前的战略目标（如"攻击目标 A"、"隐藏身份"）。意图具有持久性，
          使 AI 的行为前后一致——一旦决定攻击某人，会持续执行相关计划步骤（怀疑→号召投票→投票），
          而不是每回合随机选择。
        </p>
      </Section>

      <Section title="伪装身份系统">
        <p className="text-gray-400">
          狼人 AI 会评估伪装成预言家或猎人的收益。考虑因素包括：被怀疑程度、己方劣势程度、
          真预言家是否已跳身份、时机成熟度。伪装后还会检查行为一致性，避免露出破绽。
        </p>
      </Section>

      <Section title="阵营九宫格">
        <p className="text-gray-400 mb-2">
          每个玩家拥有守序/中立/混乱 × 善良/中立/邪恶的九宫格阵营，影响行为倾向：
        </p>
        <div className="grid grid-cols-3 gap-1 text-xs text-center">
          {[
            ['守序善良', '守序中立', '守序邪恶'],
            ['中立善良', '绝对中立', '中立邪恶'],
            ['混乱善良', '混乱中立', '混乱邪恶'],
          ].flat().map((name) => (
            <div key={name} className="bg-[#1a1b2e] border border-gray-700/40 rounded p-2 text-gray-300">
              {name}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          守序→稳健保守，混乱→激进冒险，善良→保护倾向，邪恶→攻击倾向。
        </p>
      </Section>
    </div>
  );
}

const TAB_CONTENT: Record<TabId, () => JSX.Element> = {
  overview: OverviewTab,
  roles: RolesTab,
  items: ItemsTab,
  actions: ActionsTab,
  attributes: AttributesTab,
  ai: AITab,
};

export default function RulesModal({ open, onClose }: RulesModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  if (!open) return null;

  const Content = TAB_CONTENT[activeTab];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
        aria-label="关闭规则弹窗"
      />
      <div className="relative bg-[#0f1019] border border-gray-700/60 rounded-2xl shadow-2xl w-[900px] max-w-[95vw] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/50">
          <h2 className="text-xl font-bold text-white">📖 游戏规则</h2>
          <button
            className="text-gray-400 hover:text-white text-2xl leading-none transition-colors"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700/50 px-4 overflow-x-auto shrink-0">
          {TABS.map((tab) => (
            <TabButton
              key={tab.id}
              label={tab.label}
              active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <Content />
        </div>
      </div>
    </div>
  );
}
