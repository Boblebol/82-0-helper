import { ACTIVE_DECADES, POSITIONS, type Decade, type Player, type Position, type RawPlayer } from "../domain/types";

export interface PlayerIndex {
  players: Player[];
  byRoll: Map<string, Player[]>;
  byName: Map<string, Player>;
}

const PLAYERS_URL = "https://www.82-0.com/players_flat.json";

export async function loadPlayers(fetchImpl: typeof fetch = fetch): Promise<PlayerIndex> {
  const response = await fetchImpl(PLAYERS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch players: ${response.status}`);
  }
  const raw = (await response.json()) as RawPlayer[];
  return normalizePlayers(raw);
}

export function normalizePlayers(rawPlayers: unknown[]): PlayerIndex {
  const players = rawPlayers.flatMap((raw) => normalizePlayer(raw));
  const byRoll = new Map<string, Player[]>();
  const byName = new Map<string, Player>();

  for (const player of players) {
    const rollKey = toRollKey(player.team, player.decade);
    byRoll.set(rollKey, [...(byRoll.get(rollKey) ?? []), player]);
    byName.set(normalizeName(player.name), player);
  }

  for (const [key, rollPlayers] of byRoll.entries()) {
    byRoll.set(
      key,
      [...rollPlayers].sort((left, right) => right.ppg + right.rpg + right.apg - (left.ppg + left.rpg + left.apg))
    );
  }

  return { players, byRoll, byName };
}

export function getPlayersForRoll(index: PlayerIndex, team: string, decade: Decade): Player[] {
  return index.byRoll.get(toRollKey(team, decade)) ?? [];
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizePlayer(raw: unknown): Player[] {
  if (!isRawPlayer(raw)) {
    return [];
  }

  if (!isDecade(raw.era) || !isFiniteNumber(raw.ppg) || !isFiniteNumber(raw.rpg) || !isFiniteNumber(raw.apg)) {
    return [];
  }

  const positions = normalizePositions(raw.positions, raw.pos);
  if (positions.length === 0) {
    return [];
  }

  return [
    {
      id: raw.id,
      baseSlug: raw.baseSlug,
      name: raw.player,
      team: raw.team,
      decade: raw.era,
      primaryPosition: positions[0],
      positions,
      ppg: raw.ppg,
      rpg: raw.rpg,
      apg: raw.apg,
      spg: isFiniteNumber(raw.spg) ? raw.spg : null,
      bpg: isFiniteNumber(raw.bpg) ? raw.bpg : null
    }
  ];
}

function normalizePositions(rawPositions: Array<string | null> | undefined, fallback: string): Position[] {
  const values = rawPositions?.length ? rawPositions : [fallback];
  const positions = values.filter((value): value is Position => POSITIONS.includes(value as Position));
  return [...new Set(positions)];
}

function isDecade(value: string): value is Decade {
  return ACTIVE_DECADES.includes(value as Decade);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRawPlayer(value: unknown): value is RawPlayer {
  if (!value || typeof value !== "object") {
    return false;
  }
  const player = value as RawPlayer;
  return (
    typeof player.team === "string" &&
    typeof player.player === "string" &&
    typeof player.pos === "string" &&
    typeof player.id === "string" &&
    typeof player.baseSlug === "string" &&
    typeof player.era === "string"
  );
}

function toRollKey(team: string, decade: Decade): string {
  return `${team.toUpperCase()}::${decade}`;
}
