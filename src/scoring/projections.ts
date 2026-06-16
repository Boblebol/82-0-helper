import type { Player, Position, Roster } from "../domain/types";
import { calculateTeamResult, canPlayerPlayPosition, openPositions, placePlayer, projectedWins, rosterPlayers, roundToTenth, type TeamResult } from "./formula";

const CEILING_CANDIDATES_PER_POSITION = 5;
const PROJECTION_WEIGHTS = {
  ppg: 0.46,
  rpg: 0.25,
  apg: 0.18,
  spg: 0.07,
  bpg: 0.04
} as const;
const PROJECTION_BASELINES = {
  ppg: 133.4,
  rpg: 39.7,
  apg: 29.3,
  spg: 6.1,
  bpg: 3.2
} as const;

type PlayerPoolsByPosition = Map<Position, Player[]>;
type CandidateResult = { player: Player; result: TeamResult };
interface RosterStatTotals {
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  spgCount: number;
  bpg: number;
  bpgCount: number;
}

export interface RollEvaluationInput {
  roster: Roster;
  currentCandidates: Player[];
  allPlayers: Player[];
}

export interface CandidateRecommendation {
  player: Player;
  position: Position;
  currentWins: number;
  withPickWins: number;
  expectedWins: number;
  ceilingWins: number;
  deltaExpectedWins: number;
  deltaCeilingWins: number;
  expectedRoster: Roster;
  ceilingRoster: Roster;
}

export interface RollEvaluation {
  recommendations: CandidateRecommendation[];
  gaps: string[];
}

export interface SkipAdviceInput {
  bestDeltaExpectedWins: number;
  bestDeltaCeilingWins: number;
  teamRerollMedianDelta: number;
  decadeRerollMedianDelta: number;
  ceilingWins: number;
}

export interface SkipAdvice {
  kind: "keep" | "skip-team" | "skip-decade" | "skip-only-if-chasing-82-0";
  reason: string;
}

export function evaluateRoll(input: RollEvaluationInput): RollEvaluation {
  const currentWins = calculateTeamResult(input.roster).wins;
  const selectedBaseSlugs = new Set(rosterPlayers(input.roster).map((player) => player.baseSlug));
  const playerPools = groupPlayersByPosition(input.allPlayers);
  const recommendations = input.currentCandidates
    .filter((player) => !selectedBaseSlugs.has(player.baseSlug))
    .flatMap((player) => bestPlacementForPlayer(input.roster, player, playerPools, currentWins))
    .sort(compareRecommendations)
    .slice(0, 5);

  return {
    recommendations,
    gaps: rosterGaps(input.roster)
  };
}

export function rosterGaps(roster: Roster): string[] {
  const players = rosterPlayers(roster);
  const totals = {
    PPG: players.reduce((sum, player) => sum + player.ppg, 0) / 133.4,
    REB: players.reduce((sum, player) => sum + player.rpg, 0) / 39.7,
    AST: players.reduce((sum, player) => sum + player.apg, 0) / 29.3,
    STL: players.reduce((sum, player) => sum + (player.spg ?? 0), 0) / 6.1,
    BLK: players.reduce((sum, player) => sum + (player.bpg ?? 0), 0) / 3.2
  };

  return Object.entries(totals)
    .sort((left, right) => left[1] - right[1])
    .map(([category]) => category)
    .slice(0, 3);
}

export function recommendSkip(input: SkipAdviceInput): SkipAdvice {
  const teamAdvantage = input.teamRerollMedianDelta - input.bestDeltaExpectedWins;
  const decadeAdvantage = input.decadeRerollMedianDelta - input.bestDeltaExpectedWins;

  if (teamAdvantage >= 1.5 && teamAdvantage >= decadeAdvantage) {
    return { kind: "skip-team", reason: "Rerolling the team has a better expected candidate distribution." };
  }

  if (decadeAdvantage >= 1.5) {
    return { kind: "skip-decade", reason: "Rerolling the decade better matches the current roster gaps." };
  }

  if (input.ceilingWins < 82 && input.bestDeltaExpectedWins > 0 && input.bestDeltaCeilingWins < 1) {
    return { kind: "skip-only-if-chasing-82-0", reason: "This is fine for expected wins but lowers the 82-0 ceiling path." };
  }

  return { kind: "keep", reason: "The current roll is strong relative to reroll options." };
}

function bestPlacementForPlayer(roster: Roster, player: Player, playerPools: PlayerPoolsByPosition, currentWins: number): CandidateRecommendation[] {
  return openPositions(roster)
    .filter((position) => canPlayerPlayPosition(player, position))
    .map((position) => {
      const withPickRoster = placePlayer(roster, position, player);
      const withPickWins = calculateTeamResult(withPickRoster).wins;
      const expectedRoster = completeRoster(withPickRoster, playerPools, "expected");
      const ceilingRoster = completeRoster(withPickRoster, playerPools, "ceiling");
      const expectedWins = calculateTeamResult(expectedRoster).wins;
      const ceilingWins = calculateTeamResult(ceilingRoster).wins;

      return {
        player,
        position,
        currentWins,
        withPickWins,
        expectedWins,
        ceilingWins,
        deltaExpectedWins: expectedWins - currentWins,
        deltaCeilingWins: ceilingWins - currentWins,
        expectedRoster,
        ceilingRoster
      };
    })
    .sort(compareRecommendations)
    .slice(0, 1);
}

function completeRoster(roster: Roster, playerPools: PlayerPoolsByPosition, mode: "expected" | "ceiling"): Roster {
  if (mode === "ceiling") {
    return completeCeilingRoster(roster, playerPools);
  }

  let completed = { ...roster };
  const usedBaseSlugs = new Set(rosterPlayers(completed).map((player) => player.baseSlug));

  for (const position of openPositions(completed)) {
    const totals = rosterStatTotals(completed);
    const candidates = (playerPools.get(position) ?? [])
      .filter((player) => !usedBaseSlugs.has(player.baseSlug))
      .map((player) => ({ player, wins: resultWithPlayer(totals, player).wins }))
      .sort(compareCandidateWins);

    const chosen = medianTopQuintile(candidates);
    if (chosen) {
      completed = placePlayer(completed, position, chosen.player);
      usedBaseSlugs.add(chosen.player.baseSlug);
    }
  }

  return completed;
}

function completeCeilingRoster(roster: Roster, playerPools: PlayerPoolsByPosition): Roster {
  const positions = openPositions(roster);
  const initiallyUsedBaseSlugs = new Set(rosterPlayers(roster).map((player) => player.baseSlug));
  const candidatesByPosition = new Map(
    positions.map((position) => [
      position,
      topCeilingCandidates(roster, position, playerPools.get(position) ?? [], initiallyUsedBaseSlugs)
    ])
  );

  let bestRoster = roster;
  let bestResult = calculateTeamResult(bestRoster);

  function search(index: number, currentRoster: Roster, usedBaseSlugs: Set<string>): void {
    if (index >= positions.length) {
      const result = calculateTeamResult(currentRoster);
      if (isBetterTeamResult(result, bestResult)) {
        bestRoster = currentRoster;
        bestResult = result;
      }
      return;
    }

    const position = positions[index];
    const candidates = candidatesByPosition.get(position) ?? [];
    if (candidates.length === 0) {
      search(index + 1, currentRoster, usedBaseSlugs);
      return;
    }

    for (const player of candidates) {
      if (usedBaseSlugs.has(player.baseSlug)) {
        continue;
      }

      usedBaseSlugs.add(player.baseSlug);
      search(index + 1, placePlayer(currentRoster, position, player), usedBaseSlugs);
      usedBaseSlugs.delete(player.baseSlug);
    }
  }

  search(0, roster, initiallyUsedBaseSlugs);
  return bestRoster;
}

function groupPlayersByPosition(players: Player[]): PlayerPoolsByPosition {
  const pools: PlayerPoolsByPosition = new Map();
  for (const player of players) {
    for (const position of player.positions) {
      const pool = pools.get(position);
      if (pool) {
        pool.push(player);
      } else {
        pools.set(position, [player]);
      }
    }
  }
  return pools;
}

function topCeilingCandidates(roster: Roster, position: Position, legalPlayers: Player[], usedBaseSlugs: Set<string>): Player[] {
  const totals = rosterStatTotals(roster);
  const bestByBaseSlug = new Map<string, CandidateResult>();
  for (const player of legalPlayers) {
    if (usedBaseSlugs.has(player.baseSlug)) {
      continue;
    }

    const entry = { player, result: resultWithPlayer(totals, player) };
    const previous = bestByBaseSlug.get(player.baseSlug);
    if (!previous || compareCandidateResults(entry, previous) < 0) {
      bestByBaseSlug.set(player.baseSlug, entry);
    }
  }

  const top: CandidateResult[] = [];
  for (const entry of bestByBaseSlug.values()) {
    insertTopCandidate(top, entry, CEILING_CANDIDATES_PER_POSITION);
  }
  return top.map(({ player }) => player);
}

function rosterStatTotals(roster: Roster): RosterStatTotals {
  return rosterPlayers(roster).reduce<RosterStatTotals>(
    (totals, player) => addPlayerToTotals(totals, player),
    { ppg: 0, rpg: 0, apg: 0, spg: 0, spgCount: 0, bpg: 0, bpgCount: 0 }
  );
}

function resultWithPlayer(totals: RosterStatTotals, player: Player): TeamResult {
  const spg = positiveStat(player.spg);
  const bpg = positiveStat(player.bpg);
  const spgTotal = totals.spg + spg;
  const spgCount = totals.spgCount + (spg > 0 ? 1 : 0);
  const bpgTotal = totals.bpg + bpg;
  const bpgCount = totals.bpgCount + (bpg > 0 ? 1 : 0);
  const adjustedSpg = spgTotal * (spgCount > 0 ? 5 / spgCount : 1);
  const adjustedBpg = bpgTotal * (bpgCount > 0 ? 5 / bpgCount : 1);
  const teamRating = roundToTenth(
    100 *
      ((totals.ppg + player.ppg) / PROJECTION_BASELINES.ppg * PROJECTION_WEIGHTS.ppg +
        (totals.rpg + player.rpg) / PROJECTION_BASELINES.rpg * PROJECTION_WEIGHTS.rpg +
        (totals.apg + player.apg) / PROJECTION_BASELINES.apg * PROJECTION_WEIGHTS.apg +
        adjustedSpg / PROJECTION_BASELINES.spg * PROJECTION_WEIGHTS.spg +
        adjustedBpg / PROJECTION_BASELINES.bpg * PROJECTION_WEIGHTS.bpg)
  );
  const wins = projectedWins(teamRating);
  return { teamRating, wins, losses: 82 - wins };
}

function addPlayerToTotals(totals: RosterStatTotals, player: Player): RosterStatTotals {
  const spg = positiveStat(player.spg);
  const bpg = positiveStat(player.bpg);
  return {
    ppg: totals.ppg + player.ppg,
    rpg: totals.rpg + player.rpg,
    apg: totals.apg + player.apg,
    spg: totals.spg + spg,
    spgCount: totals.spgCount + (spg > 0 ? 1 : 0),
    bpg: totals.bpg + bpg,
    bpgCount: totals.bpgCount + (bpg > 0 ? 1 : 0)
  };
}

function positiveStat(value: number | null): number {
  return typeof value === "number" && value > 0 ? value : 0;
}

function insertTopCandidate(top: CandidateResult[], entry: CandidateResult, limit: number): void {
  const index = top.findIndex((candidate) => compareCandidateResults(entry, candidate) < 0);
  if (index === -1) {
    if (top.length < limit) {
      top.push(entry);
    }
    return;
  }

  top.splice(index, 0, entry);
  if (top.length > limit) {
    top.pop();
  }
}

function compareRecommendations(left: CandidateRecommendation, right: CandidateRecommendation): number {
  if (right.deltaExpectedWins !== left.deltaExpectedWins) {
    return right.deltaExpectedWins - left.deltaExpectedWins;
  }
  if (right.deltaCeilingWins !== left.deltaCeilingWins) {
    return right.deltaCeilingWins - left.deltaCeilingWins;
  }
  return 0;
}

function compareCandidateWins(left: { player: Player; wins: number }, right: { player: Player; wins: number }): number {
  if (right.wins !== left.wins) {
    return right.wins - left.wins;
  }
  return comparePlayerIds(left.player, right.player);
}

function compareCandidateResults(left: { player: Player; result: TeamResult }, right: { player: Player; result: TeamResult }): number {
  const resultComparison = compareTeamResults(left.result, right.result);
  if (resultComparison !== 0) {
    return resultComparison;
  }
  return comparePlayerIds(left.player, right.player);
}

function compareTeamResults(left: TeamResult, right: TeamResult): number {
  if (right.wins !== left.wins) {
    return right.wins - left.wins;
  }
  return right.teamRating - left.teamRating;
}

function comparePlayerIds(left: Player, right: Player): number {
  return left.id.localeCompare(right.id);
}

function isBetterTeamResult(candidate: TeamResult, currentBest: TeamResult): boolean {
  return candidate.wins > currentBest.wins || (candidate.wins === currentBest.wins && candidate.teamRating > currentBest.teamRating);
}

function medianTopQuintile(candidates: Array<{ player: Player; wins: number }>): { player: Player; wins: number } | undefined {
  if (candidates.length === 0) {
    return undefined;
  }
  const topCount = Math.max(1, Math.ceil(candidates.length * 0.2));
  const top = candidates.slice(0, topCount);
  return top[Math.floor((top.length - 1) / 2)];
}
