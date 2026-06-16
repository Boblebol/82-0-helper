export const ACTIVE_DECADES = ["1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"] as const;
export type Decade = (typeof ACTIVE_DECADES)[number];

export const POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;
export type Position = (typeof POSITIONS)[number];

export type TeamAbbreviation = string;

export interface RawPlayer {
  team: string;
  player: string;
  pos: string;
  positions?: Array<string | null>;
  ppg: number | null;
  rpg: number | null;
  apg: number | null;
  spg: number | null;
  bpg: number | null;
  id: string;
  baseSlug: string;
  era: string;
}

export interface Player {
  id: string;
  baseSlug: string;
  name: string;
  team: TeamAbbreviation;
  decade: Decade;
  primaryPosition: Position;
  positions: Position[];
  ppg: number;
  rpg: number;
  apg: number;
  spg: number | null;
  bpg: number | null;
}

export type Roster = Partial<Record<Position, Player>>;

export interface DetectedGameState {
  mode: "classic" | "hoopiq" | "unknown";
  round: number | null;
  team: TeamAbbreviation | null;
  decade: Decade | null;
  visiblePlayers: Player[];
  roster: Roster;
  confidence: "high" | "low";
}

export interface ManualState {
  mode?: "classic" | "hoopiq" | "unknown";
  round?: number | null;
  team?: TeamAbbreviation | null;
  decade?: Decade | null;
  roster?: Roster;
}

export interface GameState extends DetectedGameState {
  manual: ManualState;
}
