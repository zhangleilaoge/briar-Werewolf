import { ROLE_INFO, ITEM_DEFINITIONS } from '../ai/types';
import type { Role, Team, ItemInstance } from '../ai/types';

export function generateGameConfig(
  totalPlayers: number,
  werewolfConfig: { role: string; count: number }[],
  villagerConfig: { role: string; count: number }[]
): {
  id: string;
  name: string;
  role: Role;
  team: Team;
  items?: ItemInstance[];
}[] {
  const configs: { id: string; name: string; role: Role; team: Team; items?: ItemInstance[] }[] = [];

  let id = 1;
  werewolfConfig.forEach((wc) => {
    for (let i = 0; i < wc.count; i++) {
      const role = wc.role as Role;
      const roleInfo = ROLE_INFO[role];
      configs.push({
        id: `p${id++}`,
        name: `${roleInfo.label}${i + 1}`,
        role,
        team: 'werewolf',
        items: roleInfo.defaultItems.map((itemId) => ({
          definitionId: itemId,
          durability: ITEM_DEFINITIONS[itemId]?.maxDurability ?? 1,
        })),
      });
    }
  });

  villagerConfig.forEach((vc) => {
    for (let i = 0; i < vc.count; i++) {
      const role = vc.role as Role;
      const roleInfo = ROLE_INFO[role];
      configs.push({
        id: `p${id++}`,
        name: `${roleInfo.label}${i + 1}`,
        role,
        team: 'villager',
        items: roleInfo.defaultItems.map((itemId) => ({
          definitionId: itemId,
          durability: ITEM_DEFINITIONS[itemId]?.maxDurability ?? 1,
        })),
      });
    }
  });

  return configs;
}
