import { POSITIONS, type Player, type Position, type Roster } from "../domain/types";

const WEIGHTS = {
  ppg: 0.46,
  rpg: 0.25,
  apg: 0.18,
  spg: 0.07,
  bpg: 0.04
} as const;

const BASELINES = {
  ppg: 133.4,
  rpg: 39.7,
  apg: 29.3,
  spg: 6.1,
  bpg: 3.2
} as const;

export interface TeamResult {
  teamRating: number;
  wins: number;
  losses: number;
}

export function canPlayerPlayPosition(player: Player, position: Position): boolean {
  return player.positions.includes(position);
}

export function openPositions(roster: Roster): Position[] {
  return POSITIONS.filter((position) => !roster[position]);
}

export function rosterPlayers(roster: Roster): Player[] {
  return POSITIONS.flatMap((position) => {
    const player = roster[position];
    return player ? [player] : [];
  });
}

export function placePlayer(roster: Roster, position: Position, player: Player): Roster {
  return { ...roster, [position]: player };
}

export function adjustedDefensiveStats(players: Player[]): { adjustedSpg: number; adjustedBpg: number } {
  const steals = players.map((player) => player.spg).filter((value): value is number => typeof value === "number" && value > 0);
  const blocks = players.map((player) => player.bpg).filter((value): value is number => typeof value === "number" && value > 0);

  return {
    adjustedSpg: sum(steals) * (steals.length > 0 ? 5 / steals.length : 1),
    adjustedBpg: sum(blocks) * (blocks.length > 0 ? 5 / blocks.length : 1)
  };
}

export function calculateTeamResult(roster: Roster): TeamResult {
  const players = rosterPlayers(roster);
  if (players.length === 0) {
    return { teamRating: 0, wins: 0, losses: 82 };
  }

  const totals = {
    ppg: sum(players.map((player) => player.ppg)),
    rpg: sum(players.map((player) => player.rpg)),
    apg: sum(players.map((player) => player.apg)),
    ...adjustedDefensiveStats(players)
  };

  const teamRating = roundToTenth(
    100 *
      (totals.ppg / BASELINES.ppg * WEIGHTS.ppg +
        totals.rpg / BASELINES.rpg * WEIGHTS.rpg +
        totals.apg / BASELINES.apg * WEIGHTS.apg +
        totals.adjustedSpg / BASELINES.spg * WEIGHTS.spg +
        totals.adjustedBpg / BASELINES.bpg * WEIGHTS.bpg)
  );

  const wins = projectedWins(teamRating);
  return { teamRating, wins, losses: 82 - wins };
}

export function projectedWins(teamRating: number): number {
  return Math.round(82 * Math.pow(Math.min(Math.max(teamRating, 0) / 110, 1), 1.15));
}

export function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
