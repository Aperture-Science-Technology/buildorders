import type { BuildOrder } from './types';

/**
 * Stub data: HRE (Holy Roman Empire) Fast Castle build order.
 * Used until the Supabase-backed ingestion pipeline is wired up.
 */
export const hreFastCastle: BuildOrder = {
  id: 'hre-fast-castle-01',
  civ: 'Holy Roman Empire',
  type: 'fast-castle',
  sourceUrl: 'https://aoe4world.com/build-orders/hre-fast-castle',
  sourceType: 'aoe4world',
  notes:
    'Standard HRE fast castle into Aachen Cathedral. Prioritize relic gold income and Prelate micro before committing to a Castle-age tech push.',
  phases: [
    {
      age: 'dark',
      timeStart: 0,
      targetResources: { food: 200, wood: 100, gold: 0, stone: 0 },
      targetVillagers: 6,
      actions: [
        { at: 0, description: 'Villagers start gathering sheep', kind: 'gather' },
        { at: 10, description: 'Send starting scout to explore the map', kind: 'gather' },
        { at: 25, description: 'Queue villager from Town Center', kind: 'train' },
        { at: 60, description: 'Queue villager from Town Center', kind: 'train' },
        { at: 90, description: 'Build House to avoid pop block', kind: 'build' },
        { at: 120, description: 'Move 2 villagers onto berries', kind: 'gather' },
        { at: 150, description: 'Build Mill near berry bushes', kind: 'build' },
        { at: 180, description: 'Queue villager from Town Center', kind: 'train' },
        { at: 210, description: 'Move next villagers to wood line', kind: 'gather' },
        { at: 240, description: 'Build second House', kind: 'build' },
      ],
    },
    {
      age: 'feudal',
      timeStart: 270,
      targetResources: { food: 300, wood: 250, gold: 50, stone: 0 },
      targetVillagers: 10,
      actions: [
        { at: 270, description: 'Click Feudal Age', kind: 'age-up' },
        { at: 280, description: 'Continue queuing villagers on Town Center', kind: 'train' },
        { at: 320, description: 'Move 1-2 villagers onto gold', kind: 'gather' },
        { at: 340, description: 'Feudal Age completes', kind: 'age-up' },
        { at: 345, description: 'Build Mining Camp on gold', kind: 'build' },
        { at: 360, description: 'Build Lumber Camp near tree line', kind: 'build' },
        { at: 390, description: 'Build Blacksmith', kind: 'build' },
        { at: 420, description: 'Research Man-at-Arms upgrade at Blacksmith', kind: 'research' },
        { at: 450, description: 'Scout for Relics and enemy Town Center', kind: 'gather' },
        { at: 480, description: 'Send Prelate toward nearest Relic', kind: 'gather' },
      ],
    },
    {
      age: 'castle',
      timeStart: 570,
      targetResources: { food: 400, wood: 350, gold: 200, stone: 100 },
      targetVillagers: 14,
      actions: [
        { at: 570, description: 'Click Castle Age', kind: 'age-up' },
        { at: 580, description: 'Continue villager production, aim for 3 TCs worth of eco', kind: 'train' },
        { at: 620, description: 'Build Aachen Cathedral for relic gold income', kind: 'build' },
        { at: 660, description: 'Castle Age completes', kind: 'age-up' },
        { at: 665, description: 'Deposit Relic in Aachen Cathedral', kind: 'gather' },
        { at: 690, description: 'Build Stable for Knight production', kind: 'build' },
        { at: 720, description: 'Research Bloomery at Blacksmith', kind: 'research' },
        { at: 750, description: 'Train initial Knight squad', kind: 'train' },
        { at: 800, description: 'Build Market for resource trading', kind: 'build' },
        { at: 850, description: 'Scout enemy base with Knights, prepare timing push', kind: 'gather' },
      ],
    },
  ],
};
