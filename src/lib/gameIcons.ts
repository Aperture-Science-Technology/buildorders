import type { Action } from '@/lib/types';

import buildingsArcheryRange2 from '@/assets/game/buildings_archery-range-2.png';
import buildingsBarracks1 from '@/assets/game/buildings_barracks-1.png';
import buildingsBlacksmith2 from '@/assets/game/buildings_blacksmith-2.png';
import buildingsCapitalTownCenter from '@/assets/game/buildings_capital-town-center.png';
import buildingsDock1 from '@/assets/game/buildings_dock-1.png';
import buildingsFarm1 from '@/assets/game/buildings_farm-1.png';
import buildingsFarmhouse1 from '@/assets/game/buildings_farmhouse-1.png';
import buildingsHouse1 from '@/assets/game/buildings_house-1.png';
import buildingsKeep3 from '@/assets/game/buildings_keep-3.png';
import buildingsLumberCamp1 from '@/assets/game/buildings_lumber-camp-1.png';
import buildingsMarket2 from '@/assets/game/buildings_market-2.png';
import buildingsMill1 from '@/assets/game/buildings_mill-1.png';
import buildingsMiningCamp1 from '@/assets/game/buildings_mining-camp-1.png';
import buildingsOutpost1 from '@/assets/game/buildings_outpost-1.png';
import buildingsSiegeWorkshop3 from '@/assets/game/buildings_siege-workshop-3.png';
import buildingsStable1 from '@/assets/game/buildings_stable-1.png';
import buildingsStoneMiningCamp from '@/assets/game/buildings_stone-mining-camp.png';
import buildingsTower1 from '@/assets/game/buildings_tower-1.png';
import buildingsTownCenter1 from '@/assets/game/buildings_town-center-1.png';

import technologiesAgriculture3 from '@/assets/game/technologies_agriculture-3.png';
import technologiesBodkinPoint from '@/assets/game/technologies_bodkin-point.png';
import technologiesCollectiveHunting1 from '@/assets/game/technologies_collective-hunting-1.png';
import technologiesForging from '@/assets/game/technologies_forging.png';
import technologiesHuntingTradition2 from '@/assets/game/technologies_hunting-tradition-2.png';
import technologiesIronUndermesh2 from '@/assets/game/technologies_iron-undermesh-2.png';
import technologiesPlatecutterPoint from '@/assets/game/technologies_platecutter-point.png';
import technologiesProfessionalScouts2 from '@/assets/game/technologies_professional-scouts-2.png';
import technologiesSteeledArrow2 from '@/assets/game/technologies_steeled-arrow-2.png';
import technologiesSurvivalTechniques1 from '@/assets/game/technologies_survival-techniques-1.png';
import technologiesWheelbarrow1 from '@/assets/game/technologies_wheelbarrow-1.png';

import unitsArcher2 from '@/assets/game/units_archer-2.png';
import unitsBatteringRam1 from '@/assets/game/units_battering-ram-1.png';
import unitsCamelRider3 from '@/assets/game/units_camel-rider-3.png';
import unitsCrossbowman1 from '@/assets/game/units_crossbowman-1.png';
import unitsGrenadier1 from '@/assets/game/units_grenadier-1.png';
import unitsHandcannoneer1 from '@/assets/game/units_handcannoneer-1.png';
import unitsHorseman1 from '@/assets/game/units_horseman-1.png';
import unitsKnight1 from '@/assets/game/units_knight-1.png';
import unitsLancer1 from '@/assets/game/units_lancer-1.png';
import unitsLandsknecht3 from '@/assets/game/units_landsknecht-3.png';
import unitsLongbowman2 from '@/assets/game/units_longbowman-2.png';
import unitsManAtArms1 from '@/assets/game/units_man-at-arms-1.png';
import unitsMangonel1 from '@/assets/game/units_mangonel-1.png';
import unitsMilitia1 from '@/assets/game/units_militia-1.png';
import unitsScout1 from '@/assets/game/units_scout-1.png';
import unitsSpearman1 from '@/assets/game/units_spearman-1.png';
import unitsSpringald1 from '@/assets/game/units_springald-1.png';
import unitsTrebuchet3 from '@/assets/game/units_trebuchet-3.png';
import unitsVillager1 from '@/assets/game/units_villager-1.png';

export type GameIconCategory = 'building' | 'unit' | 'tech' | 'resource' | 'other';

export interface GameIconDef {
  id: string;
  category: GameIconCategory;
  label: string;
  src: string;
}

export const GAME_ICONS: GameIconDef[] = [
  // buildings
  { id: 'buildings_archery-range-2', category: 'building', label: 'Archery Range', src: buildingsArcheryRange2.src },
  { id: 'buildings_barracks-1', category: 'building', label: 'Barracks', src: buildingsBarracks1.src },
  { id: 'buildings_blacksmith-2', category: 'building', label: 'Blacksmith', src: buildingsBlacksmith2.src },
  { id: 'buildings_capital-town-center', category: 'building', label: 'Capital Town Center', src: buildingsCapitalTownCenter.src },
  { id: 'buildings_dock-1', category: 'building', label: 'Dock', src: buildingsDock1.src },
  { id: 'buildings_farm-1', category: 'building', label: 'Farm', src: buildingsFarm1.src },
  { id: 'buildings_farmhouse-1', category: 'building', label: 'Farmhouse', src: buildingsFarmhouse1.src },
  { id: 'buildings_house-1', category: 'building', label: 'House', src: buildingsHouse1.src },
  { id: 'buildings_keep-3', category: 'building', label: 'Keep', src: buildingsKeep3.src },
  { id: 'buildings_lumber-camp-1', category: 'building', label: 'Lumber Camp', src: buildingsLumberCamp1.src },
  { id: 'buildings_market-2', category: 'building', label: 'Market', src: buildingsMarket2.src },
  { id: 'buildings_mill-1', category: 'building', label: 'Mill', src: buildingsMill1.src },
  { id: 'buildings_mining-camp-1', category: 'building', label: 'Mining Camp', src: buildingsMiningCamp1.src },
  { id: 'buildings_outpost-1', category: 'building', label: 'Outpost', src: buildingsOutpost1.src },
  { id: 'buildings_siege-workshop-3', category: 'building', label: 'Siege Workshop', src: buildingsSiegeWorkshop3.src },
  { id: 'buildings_stable-1', category: 'building', label: 'Stable', src: buildingsStable1.src },
  { id: 'buildings_stone-mining-camp', category: 'building', label: 'Stone Mining Camp', src: buildingsStoneMiningCamp.src },
  { id: 'buildings_tower-1', category: 'building', label: 'Tower', src: buildingsTower1.src },
  { id: 'buildings_town-center-1', category: 'building', label: 'Town Center', src: buildingsTownCenter1.src },
  // technologies
  { id: 'technologies_agriculture-3', category: 'tech', label: 'Agriculture', src: technologiesAgriculture3.src },
  { id: 'technologies_bodkin-point', category: 'tech', label: 'Bodkin Point', src: technologiesBodkinPoint.src },
  { id: 'technologies_collective-hunting-1', category: 'tech', label: 'Collective Hunting', src: technologiesCollectiveHunting1.src },
  { id: 'technologies_forging', category: 'tech', label: 'Forging', src: technologiesForging.src },
  { id: 'technologies_hunting-tradition-2', category: 'tech', label: 'Hunting Tradition', src: technologiesHuntingTradition2.src },
  { id: 'technologies_iron-undermesh-2', category: 'tech', label: 'Iron Undermesh', src: technologiesIronUndermesh2.src },
  { id: 'technologies_platecutter-point', category: 'tech', label: 'Platecutter Point', src: technologiesPlatecutterPoint.src },
  { id: 'technologies_professional-scouts-2', category: 'tech', label: 'Professional Scouts', src: technologiesProfessionalScouts2.src },
  { id: 'technologies_steeled-arrow-2', category: 'tech', label: 'Steeled Arrow', src: technologiesSteeledArrow2.src },
  { id: 'technologies_survival-techniques-1', category: 'tech', label: 'Survival Techniques', src: technologiesSurvivalTechniques1.src },
  { id: 'technologies_wheelbarrow-1', category: 'tech', label: 'Wheelbarrow', src: technologiesWheelbarrow1.src },
  // units
  { id: 'units_archer-2', category: 'unit', label: 'Archer', src: unitsArcher2.src },
  { id: 'units_battering-ram-1', category: 'unit', label: 'Battering Ram', src: unitsBatteringRam1.src },
  { id: 'units_camel-rider-3', category: 'unit', label: 'Camel Rider', src: unitsCamelRider3.src },
  { id: 'units_crossbowman-1', category: 'unit', label: 'Crossbowman', src: unitsCrossbowman1.src },
  { id: 'units_grenadier-1', category: 'unit', label: 'Grenadier', src: unitsGrenadier1.src },
  { id: 'units_handcannoneer-1', category: 'unit', label: 'Handcannoneer', src: unitsHandcannoneer1.src },
  { id: 'units_horseman-1', category: 'unit', label: 'Horseman', src: unitsHorseman1.src },
  { id: 'units_knight-1', category: 'unit', label: 'Knight', src: unitsKnight1.src },
  { id: 'units_lancer-1', category: 'unit', label: 'Lancer', src: unitsLancer1.src },
  { id: 'units_landsknecht-3', category: 'unit', label: 'Landsknecht', src: unitsLandsknecht3.src },
  { id: 'units_longbowman-2', category: 'unit', label: 'Longbowman', src: unitsLongbowman2.src },
  { id: 'units_man-at-arms-1', category: 'unit', label: 'Man-at-Arms', src: unitsManAtArms1.src },
  { id: 'units_mangonel-1', category: 'unit', label: 'Mangonel', src: unitsMangonel1.src },
  { id: 'units_militia-1', category: 'unit', label: 'Militia', src: unitsMilitia1.src },
  { id: 'units_scout-1', category: 'unit', label: 'Scout', src: unitsScout1.src },
  { id: 'units_spearman-1', category: 'unit', label: 'Spearman', src: unitsSpearman1.src },
  { id: 'units_springald-1', category: 'unit', label: 'Springald', src: unitsSpringald1.src },
  { id: 'units_trebuchet-3', category: 'unit', label: 'Trebuchet', src: unitsTrebuchet3.src },
  { id: 'units_villager-1', category: 'unit', label: 'Villager', src: unitsVillager1.src },
];

export const ACTION_KIND_DEFAULT_ICON: Record<NonNullable<Action['kind']>, string> = {
  build: 'buildings_town-center-1',
  research: 'technologies_forging',
  train: 'units_man-at-arms-1',
  gather: 'units_villager-1',
  tech: 'technologies_wheelbarrow-1',
  'age-up': 'buildings_capital-town-center',
};

export function iconDef(id: string): GameIconDef | undefined {
  return GAME_ICONS.find((icon) => icon.id === id);
}

export function iconForAction(action: Action): string {
  if (action.iconId) {
    const def = iconDef(action.iconId);
    if (def) return def.src;
  }
  if (action.kind) {
    const def = iconDef(ACTION_KIND_DEFAULT_ICON[action.kind]);
    if (def) return def.src;
  }
  return '';
}
