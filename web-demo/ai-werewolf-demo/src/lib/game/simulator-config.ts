import { ROLE_INFO, ITEM_DEFINITIONS } from '@/types';
import type { Role, Team, ItemInstance } from '@/types';

export function generateGameConfig(
  _totalPlayers: number,
  werewolfConfig: { role: Role; count: number }[],
  villagerConfig: { role: Role; count: number }[]
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
      const role = wc.role;
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
      const role = vc.role;
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
