export type GameMode = '1v1' | '2v2' | '3v3' | '4v4' | 'ffa';

export type Visibility = 'public' | 'private' | 'shared';

export interface MatchupNote {
  civ: string;
  note: string;
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
  createdAt?: string;
  gameModes?: GameMode[];
  strengths?: string[];
  weaknesses?: string[];
  matchupNotes?: MatchupNote[];
  difficulty?: number;
  layout?: Record<string, { x: number; y: number }>;
  visibility?: Visibility;
}

export interface Phase {
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
  at: number;
  description: string;
  kind?: 'build' | 'research' | 'train' | 'gather' | 'tech' | 'age-up';
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
