import {
  ACTIVE_DECADES,
  POSITIONS,
  type Decade,
  type DetectedGameState,
  type Player,
  type Position,
  type Roster
} from "../domain/types";
import { normalizeName, type PlayerIndex } from "../data/players";

const TEAM_PATTERN = /\b(ATL|BOS|BKN|CHA|CHI|CLE|DAL|DEN|DET|GSW|HOU|IND|LAC|LAL|MEM|MIA|MIL|MIN|NOP|NYK|OKC|ORL|PHI|PHX|POR|SAC|SAS|TOR|UTA|WAS)\b/;
const ROUND_PATTERN = /\bRound\s+([1-5])\b/i;

export function detectGameState(doc: Document, index: PlayerIndex): DetectedGameState {
  const text = doc.body.textContent ?? "";
  const mode = detectMode(text);
  const round = detectRound(text);
  const team = detectTeam(text);
  const decade = detectDecade(text);
  const visiblePlayers = detectVisiblePlayers(doc, index, team, decade);
  const roster = detectRoster(doc, index);
  const confidence = team && decade ? "high" : "low";

  return { mode, round, team, decade, visiblePlayers, roster, confidence };
}

function detectMode(text: string): DetectedGameState["mode"] {
  if (/\bHoopIQ\b/i.test(text)) return "hoopiq";
  if (/\bClassic\b/i.test(text)) return "classic";
  return "unknown";
}

function detectRound(text: string): number | null {
  const match = text.match(ROUND_PATTERN);
  return match ? Number(match[1]) : null;
}

function detectTeam(text: string): string | null {
  return text.match(TEAM_PATTERN)?.[1] ?? null;
}

function detectDecade(text: string): Decade | null {
  return ACTIVE_DECADES.find((decade) => text.includes(decade)) ?? null;
}

function detectVisiblePlayers(doc: Document, index: PlayerIndex, team: string | null, decade: Decade | null): Player[] {
  const elements = [...doc.querySelectorAll("button, [role='button'], li, article, div")];
  const visibleText = elements.map((element) => element.textContent ?? "").join("\n").toLowerCase();
  const scopedPlayers = team && decade ? index.byRoll.get(`${team}::${decade}`) ?? [] : index.players;
  const visiblePlayers: Player[] = [];

  for (const element of elements) {
    const elementText = (element.textContent ?? "").toLowerCase();
    for (const player of scopedPlayers) {
      if (visibleText.includes(normalizeName(player.name)) && elementText.includes(normalizeName(player.name))) {
        if (!visiblePlayers.includes(player)) {
          visiblePlayers.push(player);
        }
      }
    }
  }

  return visiblePlayers;
}

function detectRoster(doc: Document, index: PlayerIndex): Roster {
  const text = doc.querySelector('[aria-label="roster"]')?.textContent ?? doc.body.textContent ?? "";
  const roster: Roster = {};
  for (const position of POSITIONS) {
    const player = findRosterPlayerForPosition(text, position, index.players);
    if (player) {
      roster[position] = player;
    }
  }
  return roster;
}

function findRosterPlayerForPosition(text: string, position: Position, players: Player[]): Player | undefined {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const matchingLine = lines.find((line) => line.startsWith(`${position} `));
  if (!matchingLine) {
    return undefined;
  }

  const segment = matchingLine.toLowerCase();
  return players.find((player) => segment.includes(normalizeName(player.name)));
}
