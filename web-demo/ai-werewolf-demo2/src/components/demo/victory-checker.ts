// ============================================================
// VictoryChecker — 胜利条件检查
// ============================================================

import type { Player } from '@/types';
import { PHASE_HEADERS } from '@/constants';
import type { GameLog } from './game-runner-types';

export class VictoryChecker {
  private players: Player[];
  private deadPlayerIds: Set<string>;

  constructor(players: Player[], deadPlayerIds: Set<string>) {
    this.players = players;
    this.deadPlayerIds = deadPlayerIds;
  }

  /**
   * 检查胜利条件，返回是否有人胜利
   */
  check(): { winner: 'werewolf' | 'villager' | null; log: GameLog | null } {
    const aW = this.players.filter((p) => p.team === 'werewolf' && !this.deadPlayerIds.has(p.id)).length;
    const aV = this.players.filter((p) => p.team !== 'werewolf' && !this.deadPlayerIds.has(p.id)).length;
    
    let winner: 'werewolf' | 'villager' | null = null;
    if (aW === 0 && aV > 0) {
      winner = 'villager';
    } else if (aW >= aV) {
      winner = 'werewolf';
    }

    if (winner) {
      return { 
        winner, 
        log: { 
          time: '', // 由调用方设置
          isSystem: true, 
          round: 0, // 由调用方设置
          subPhase: 'victory' as GameLog['subPhase'], 
          content: PHASE_HEADERS.VICTORY(winner) 
        } 
      };
    }
    return { 
      winner: null, 
      log: { 
        time: '', 
        isSystem: true, 
        round: 0, 
        subPhase: 'victory' as GameLog['subPhase'], 
        content: PHASE_HEADERS.GAME_CONTINUE 
      } 
    };
  }
}