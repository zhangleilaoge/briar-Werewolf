// ============================================================
// PluginRegistry — 插件注册中心
// 角色/物品/特质插件接口与注册表
// 解决：所有角色逻辑硬编码在 GameEngine/IntentionEngine
// ============================================================

import type { Player, MemoryEntry } from '@/types';
import type { LongTermIntention, ActionCandidate } from '@/types/decision';
import type { RoleInference, PlayerCrisis } from '@/inference';
import type { RelationTracker } from '@/relation';
import { villagerPlugin } from './roles/villager';
import { prophetPlugin } from './roles/prophet';
import { werewolfPlugin } from './roles/werewolf';

// ---------- 角色插件接口 ----------
export interface RolePlugin {
	/** 插件标识 */
	id: string;
	/** 角色名称 */
	roleName: string;
	/** 所属阵营 */
	team: 'werewolf' | 'villager';
	/** 是否有夜间行动 */
	hasNightAction: boolean;

	/**
	 * 生成长期意图
	 * 替代 IntentionEngine.evaluateLongTermIntentions 中的硬编码分支
	 */
	getLongTermIntentions(
		self: Player,
		allPlayers: Player[],
		inferences: Map<string, RoleInference>,
		selfCrisis: PlayerCrisis,
		relations: RelationTracker,
		fieldCrisis?: { mostAtRisk: PlayerCrisis; mostDominant: PlayerCrisis; all: PlayerCrisis[] } | null,
	): LongTermIntention[];

	/**
	 * 生成夜间行动候选
	 * GameEngine 按 hasNightAction 调度夜间角色，具体候选由插件提供
	 */
	getNightActionCandidates(
		self: Player,
		allPlayers: Player[],
		inferences: Map<string, RoleInference>,
		relations: RelationTracker,
		checkResults: MemoryEntry[], // 预言家已查验结果
	): ActionCandidate[];
}

// ---------- 物品插件接口（预留） ----------
export interface ItemPlugin {
	id: string;
	name: string;
	/**
	 * 物品效果触发时机
	 */
	triggerPhase: 'night' | 'day' | 'vote' | 'death';
	/**
	 * 使用物品
	 */
	use(self: Player, target: Player, context: unknown): { success: boolean; effect: string };
}

// ---------- 特质插件接口（预留） ----------
export interface TraitPlugin {
	id: string;
	name: string;
	/**
	 * 对基础属性的修正
	 */
	attributeMods: Partial<Record<keyof Player['attributes'], number>>;
	/**
	 * 对行动分数的修正
	 */
	actionMods: Partial<Record<string, number>>;
}

// ---------- 插件注册表 ----------
export class PluginRegistry {
	private rolePlugins = new Map<string, RolePlugin>();
	private itemPlugins = new Map<string, ItemPlugin>();
	private traitPlugins = new Map<string, TraitPlugin>();

	// ---- 角色插件 ----
	registerRole(plugin: RolePlugin): void {
		this.rolePlugins.set(plugin.id, plugin);
	}
	getRole(roleId: string): RolePlugin | undefined {
		return this.rolePlugins.get(roleId);
	}
	hasRole(roleId: string): boolean {
		return this.rolePlugins.has(roleId);
	}
	getAllRoles(): RolePlugin[] {
		return Array.from(this.rolePlugins.values());
	}

	/**
	 * 注册所有默认角色插件（villager, prophet, werewolf）
	 * 应在应用启动时调用一次
	 */
	registerDefaultRoles(): void {
		this.registerRole(villagerPlugin);
		this.registerRole(prophetPlugin);
		this.registerRole(werewolfPlugin);
	}

	// ---- 物品插件 ----
	registerItem(plugin: ItemPlugin): void {
		this.itemPlugins.set(plugin.id, plugin);
	}
	getItem(itemId: string): ItemPlugin | undefined {
		return this.itemPlugins.get(itemId);
	}

	// ---- 特质插件 ----
	registerTrait(plugin: TraitPlugin): void {
		this.traitPlugins.set(plugin.id, plugin);
	}
	getTrait(traitId: string): TraitPlugin | undefined {
		return this.traitPlugins.get(traitId);
	}
}

/** 全局单例注册表 */
export const pluginRegistry = new PluginRegistry();

// 自动注册默认角色插件
pluginRegistry.registerDefaultRoles();
