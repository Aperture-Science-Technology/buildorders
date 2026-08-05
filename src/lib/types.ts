export type GameMode = '1v1' | '2v2' | '3v3' | '4v4' | 'ffa';

export type Visibility = 'public' | 'private' | 'shared';

export interface MatchupNote {
  civ: string;
  note: string;
}

export interface BuildOwner {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface BuildOrder {
  id: string;
  civ: string;
  type: 'rush' | 'boom' | 'turtle' | 'fast-castle' | 'defensive' | 'other';
  sourceUrl: string;
  sourceType: 'aoe4world' | 'youtube' | 'ageofempires' | 'aoeivbuilds' | 'manual';
  phases: Phase[];
  notes?: string;
  scenarios?: Scenario[];
  ownerId?: string;
  owner?: BuildOwner;
  createdAt?: string;
  gameModes?: GameMode[];
  strengths?: string[];
  weaknesses?: string[];
  matchupNotes?: MatchupNote[];
  difficulty?: number;
  layout?: Record<string, { x: number; y: number }>;
  visibility?: Visibility;
  viewCount?: number;
  likeCount?: number;
  liked?: boolean;
}

export interface Phase {
  title?: string;
  age: 'dark' | 'feudal' | 'castle' | 'imperial';
  timeStart: number;
  actions: Action[];
  targetResources?: {
    food: number;
    wood: number;
    gold: number;
    stone: number;
  };
  targetVillagers?: number;
}

export interface Action {
  id?: string;
  at: number;
  description: string;
  kind?: 'build' | 'research' | 'train' | 'gather' | 'tech' | 'age-up';
  dependsOn?: string[];
  iconId?: string;
  /** Condition simple affichée en badge : « Si contre cavaliers précoces » */
  condition?: string;
  /** Si présent, cette action est une DÉCISION : les branches sont des chemins alternatifs */
  branches?: ActionBranch[];
}

export interface ActionBranch {
  id?: string;
  /** Condition de la branche : « Si cavaliers précoces », « Sinon », « Par défaut » */
  condition: string;
  /** Actions de cette branche (même structure que Action) */
  actions: Action[];
}

export interface Scenario {
  id: string;
  label: string;
  branchAt: number;
  variant: Partial<BuildOrder>;
}

export interface GuildMember {
  user_id: string;
  display_name: string;
  role: string;
}

export interface Guild {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_id: string;
  role: string;
  members: GuildMember[];
  created_at: string;
}

export interface BuildShare {
  build_id: string;
  user_id: string | null;
  guild_id: string | null;
  guild_name?: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  preferences: Record<string, unknown> | null;
}
