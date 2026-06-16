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
const DECADE_PATTERNS: Array<[Decade, RegExp]> = [
  ["1960s", /\b(?:1960s|60s|60's)\b/i],
  ["1970s", /\b(?:1970s|70s|70's)\b/i],
  ["1980s", /\b(?:1980s|80s|80's)\b/i],
  ["1990s", /\b(?:1990s|90s|90's)\b/i],
  ["2000s", /\b(?:2000s|00s|00's)\b/i],
  ["2010s", /\b(?:2010s|10s|10's)\b/i],
  ["2020s", /\b(?:2020s|20s|20's)\b/i]
];

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
  for (const [decade, pattern] of DECADE_PATTERNS) {
    if (pattern.test(text)) {
      return decade;
    }
  }

  return ACTIVE_DECADES.find((decade) => text.includes(decade)) ?? null;
}

function detectVisiblePlayers(doc: Document, index: PlayerIndex, team: string | null, decade: Decade | null): Player[] {
  const elements = getVisibleCandidateElements(doc);
  const scopedPlayers = team && decade ? index.byRoll.get(`${team}::${decade}`) ?? [] : index.players;
  const visiblePlayers: Player[] = [];

  for (const element of elements) {
    const elementText = (element.textContent ?? "").toLowerCase();
    for (const player of scopedPlayers) {
      if (elementText.includes(normalizeName(player.name))) {
        if (!visiblePlayers.includes(player)) {
          visiblePlayers.push(player);
        }
      }
    }
  }

  return visiblePlayers;
}

function detectRoster(doc: Document, index: PlayerIndex): Roster {
  const rosterRoot = doc.querySelector('[aria-label="roster"]');
  const text = rosterRoot ? extractTextWithSeparators(rosterRoot) : doc.body.textContent ?? "";
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
  const matches = [...text.matchAll(/\b(PG|SG|SF|PF|C)\b/g)];
  const positionMatchIndex = matches.findIndex((match) => match[1] === position);
  if (positionMatchIndex < 0) {
    return undefined;
  }

  const start = (matches[positionMatchIndex].index ?? 0) + position.length;
  const end = matches[positionMatchIndex + 1]?.index ?? text.length;
  const segment = text
    .slice(start, end)
    .replace(/^[\s:.-]+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (!segment || /^empty\b/i.test(segment)) {
    return undefined;
  }

  return players.find((player) => segment.includes(normalizeName(player.name)));
}

function extractTextWithSeparators(root: Element): string {
  return root.textContent
    ? [...root.childNodes]
        .map((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent ?? "";
          }
          if (node.nodeType === Node.ELEMENT_NODE) {
            return extractTextWithSeparators(node as Element);
          }
          return "";
        })
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
    : "";
}

function getVisibleCandidateElements(doc: Document): Element[] {
  const candidates = [...doc.querySelectorAll("button, [role='button'], li, article, section, div")].filter(
    (element) => !isInExcludedArea(element)
  );

  return candidates.filter((element) => !candidates.some((other) => other !== element && element.contains(other)));
}

function isInExcludedArea(element: Element): boolean {
  for (let current: Element | null = element; current; current = current.parentElement) {
    const label = current.getAttribute("aria-label");
    if (label && /(roster|court|sidebar)/i.test(label)) {
      return true;
    }
  }

  return false;
}
