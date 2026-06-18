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

// Item Plugins
export { ClawsPlugin } from './items/claws';
export { CrystalBallPlugin } from './items/crystal-ball';
export { ThiefGlovesPlugin } from './items/thief-gloves';
export { CoronerToolsPlugin } from './items/coroner-tools';
export { AmuletPlugin } from './items/amulet';
export { DoubleSwordPlugin } from './items/double-sword';

// Trait Plugins
export { LoneWolfTraitPlugin } from './traits/lone-wolf';

import { ClawsPlugin } from './items/claws';
import { CrystalBallPlugin } from './items/crystal-ball';
import { ThiefGlovesPlugin } from './items/thief-gloves';
import { CoronerToolsPlugin } from './items/coroner-tools';
import { AmuletPlugin } from './items/amulet';
import { DoubleSwordPlugin } from './items/double-sword';
import { LoneWolfTraitPlugin } from './traits/lone-wolf';

/**
 * Register all default plugins to a registry
 */
export function registerDefaultPlugins(registry: import('./registry').PluginRegistry): void {
  // Register item plugins
  registry.register(new ClawsPlugin());
  registry.register(new CrystalBallPlugin());
  registry.register(new ThiefGlovesPlugin());
  registry.register(new CoronerToolsPlugin());
  registry.register(new AmuletPlugin());
  registry.register(new DoubleSwordPlugin());
  
  // Register trait plugins
  registry.registerTrait(new LoneWolfTraitPlugin());
}
