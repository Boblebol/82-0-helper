import type { Player, Position, Roster } from "../domain/types";
import { calculateTeamResult, canPlayerPlayPosition, openPositions, placePlayer, rosterPlayers, type TeamResult } from "./formula";

const CEILING_CANDIDATES_PER_POSITION = 12;

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
  const recommendations = input.currentCandidates
    .filter((player) => !selectedBaseSlugs.has(player.baseSlug))
    .flatMap((player) => bestPlacementForPlayer(input.roster, player, input.allPlayers, currentWins))
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

function bestPlacementForPlayer(roster: Roster, player: Player, allPlayers: Player[], currentWins: number): CandidateRecommendation[] {
  return openPositions(roster)
    .filter((position) => canPlayerPlayPosition(player, position))
    .map((position) => {
      const withPickRoster = placePlayer(roster, position, player);
      const withPickWins = calculateTeamResult(withPickRoster).wins;
      const expectedRoster = completeRoster(withPickRoster, allPlayers, "expected");
      const ceilingRoster = completeRoster(withPickRoster, allPlayers, "ceiling");
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

function completeRoster(roster: Roster, allPlayers: Player[], mode: "expected" | "ceiling"): Roster {
  if (mode === "ceiling") {
    return completeCeilingRoster(roster, allPlayers);
  }

  let completed = { ...roster };
  const usedBaseSlugs = new Set(rosterPlayers(completed).map((player) => player.baseSlug));

  for (const position of openPositions(completed)) {
    const candidates = allPlayers
      .filter((player) => !usedBaseSlugs.has(player.baseSlug))
      .filter((player) => canPlayerPlayPosition(player, position))
      .map((player) => ({ player, wins: calculateTeamResult(placePlayer(completed, position, player)).wins }))
      .sort((left, right) => right.wins - left.wins);

    const chosen = medianTopQuintile(candidates);
    if (chosen) {
      completed = placePlayer(completed, position, chosen.player);
      usedBaseSlugs.add(chosen.player.baseSlug);
    }
  }

  return completed;
}

function completeCeilingRoster(roster: Roster, allPlayers: Player[]): Roster {
  const positions = openPositions(roster);
  const initiallyUsedBaseSlugs = new Set(rosterPlayers(roster).map((player) => player.baseSlug));
  const candidatesByPosition = new Map(
    positions.map((position) => [
      position,
      allPlayers
        .filter((player) => !initiallyUsedBaseSlugs.has(player.baseSlug))
        .filter((player) => canPlayerPlayPosition(player, position))
        .map((player) => ({ player, result: calculateTeamResult(placePlayer(roster, position, player)) }))
        .sort((left, right) => compareTeamResults(left.result, right.result))
        .slice(0, CEILING_CANDIDATES_PER_POSITION)
        .map(({ player }) => player)
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
    search(index + 1, currentRoster, usedBaseSlugs);

    for (const player of candidatesByPosition.get(position) ?? []) {
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

function compareRecommendations(left: CandidateRecommendation, right: CandidateRecommendation): number {
  if (right.deltaExpectedWins !== left.deltaExpectedWins) {
    return right.deltaExpectedWins - left.deltaExpectedWins;
  }
  if (right.deltaCeilingWins !== left.deltaCeilingWins) {
    return right.deltaCeilingWins - left.deltaCeilingWins;
  }
  return 0;
}

function compareTeamResults(left: TeamResult, right: TeamResult): number {
  if (right.wins !== left.wins) {
    return right.wins - left.wins;
  }
  return right.teamRating - left.teamRating;
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
