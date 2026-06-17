import { GameSimulator } from './simulator-core';

// Import phase handlers to register prototype methods
import './simulator-night';
import './simulator-morning';
import './simulator-day';
import './simulator-vote';
import './simulator-utils';

export { GameSimulator };
export { generateGameConfig } from './simulator-config';

// Re-export types
export type { PublicActionRecord, NightDecision, GameStep, GameSimulatorOptions } from './simulator-core';
