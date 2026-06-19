/**
 * Plugin System
 *
 * Main entry point for the plugin system.
 * Exports all types, registry, and plugin implementations.
 */

// Types
export type {
  ActionProvider,
  TraitProvider,
  FullActionProvider,
  FullTraitProvider,
  ActionDefinition,
  ActionContext,
  DecisionContext,
  ActionExecutionParams,
  ActionResult,
  StateChange,
  PluginEvent,
  GameContext,
  PluginLifecycle,
} from './types';

// Registry
export { PluginRegistry, getGlobalRegistry, resetGlobalRegistry } from './registry';

// Item Plugins (装备道具)
export { ClawsPlugin } from './items/claws';
export { CrystalBallPlugin } from './items/crystal-ball';
export { ThiefGlovesPlugin } from './items/thief-gloves';
export { CoronerToolsPlugin } from './items/coroner-tools';
export { AmuletPlugin } from './items/amulet';
export { DoubleSwordPlugin } from './items/double-sword';

// Day Action Plugins (行为动作)
export { SuspectPlugin } from './actions/suspect';
export { DefendPlugin } from './actions/defend';
export { AccusePlugin } from './actions/accuse';
export { CallVotePlugin } from './actions/call-vote';
export { BlockVotePlugin } from './actions/block-vote';
export { GuaranteePlugin } from './actions/guarantee';

// Trait Plugins
export { LoneWolfTraitPlugin } from './traits/lone-wolf';

import { ClawsPlugin } from './items/claws';
import { CrystalBallPlugin } from './items/crystal-ball';
import { ThiefGlovesPlugin } from './items/thief-gloves';
import { CoronerToolsPlugin } from './items/coroner-tools';
import { AmuletPlugin } from './items/amulet';
import { DoubleSwordPlugin } from './items/double-sword';
import { SuspectPlugin } from './actions/suspect';
import { DefendPlugin } from './actions/defend';
import { AccusePlugin } from './actions/accuse';
import { CallVotePlugin } from './actions/call-vote';
import { BlockVotePlugin } from './actions/block-vote';
import { GuaranteePlugin } from './actions/guarantee';
import { LoneWolfTraitPlugin } from './traits/lone-wolf';

/**
 * Register all default plugins to a registry
 */
export function registerDefaultPlugins(registry: import('./registry').PluginRegistry): void {
  // Register item plugins (装备道具)
  registry.register(new ClawsPlugin());
  registry.register(new CrystalBallPlugin());
  registry.register(new ThiefGlovesPlugin());
  registry.register(new CoronerToolsPlugin());
  registry.register(new AmuletPlugin());
  registry.register(new DoubleSwordPlugin());

  // Register day action plugins (行为动作)
  registry.register(new SuspectPlugin());
  registry.register(new DefendPlugin());
  registry.register(new AccusePlugin());
  registry.register(new CallVotePlugin());
  registry.register(new BlockVotePlugin());
  registry.register(new GuaranteePlugin());

  // Register trait plugins
  registry.registerTrait(new LoneWolfTraitPlugin());
}
