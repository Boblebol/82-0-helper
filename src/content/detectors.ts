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

const TEAM_CODES = "ATL|BOS|BKN|CHA|CHI|CLE|DAL|DEN|DET|GSW|HOU|IND|LAC|LAL|MEM|MIA|MIL|MIN|NOP|NYK|OKC|ORL|PHI|PHX|POR|SAC|SAS|TOR|UTA|WAS";
const TEAM_PATTERN = new RegExp(`\\b(${TEAM_CODES})\\b`);
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
  const text = extractVisibleText(doc.body);
  const visibleRoll = detectVisibleRoll(doc);
  const mode = detectMode(text);
  const round = detectRound(text);
  const team = visibleRoll?.team ?? detectTeam(text);
  const decade = visibleRoll?.decade ?? detectDecade(text);
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

function detectVisibleRoll(doc: Document): { team: string; decade: Decade } | null {
  const counts = new Map<string, { team: string; decade: Decade; count: number }>();
  const elements = getVisibleRollCandidateElements(doc);

  for (const element of elements) {
    const text = extractVisibleText(element);
    const roll = detectRollPair(text);
    if (!roll) {
      continue;
    }

    const key = `${roll.team}::${roll.decade}`;
    const current = counts.get(key);
    counts.set(key, {
      team: roll.team,
      decade: roll.decade,
      count: (current?.count ?? 0) + 1
    });
  }

  return [...counts.values()].sort((left, right) => right.count - left.count)[0] ?? null;
}

function detectRollPair(text: string): { team: string; decade: Decade } | null {
  for (const decade of ACTIVE_DECADES) {
    const teamBeforeDecade = new RegExp(`\\b(${TEAM_CODES})\\b\\s*(?:[·•|/,-]|\\s)\\s*${escapeRegExp(decade)}\\b`, "i");
    const beforeMatch = text.match(teamBeforeDecade);
    if (beforeMatch) {
      return { team: beforeMatch[1].toUpperCase(), decade };
    }

    const decadeBeforeTeam = new RegExp(`\\b${escapeRegExp(decade)}\\b\\s*(?:[·•|/,-]|\\s)\\s*(${TEAM_CODES})\\b`, "i");
    const afterMatch = text.match(decadeBeforeTeam);
    if (afterMatch) {
      return { team: afterMatch[1].toUpperCase(), decade };
    }
  }

  return null;
}

function getVisibleRollCandidateElements(doc: Document): Element[] {
  const candidates = [...doc.querySelectorAll("button, [role='button'], article, li, section, div")]
    .filter((element) => isVisibleElement(element) && !isInExcludedArea(element))
    .filter((element) => {
      const text = extractVisibleText(element);
      return hasStatSignal(text) && detectRollPair(text);
    });

  return candidates.filter((element) => !candidates.some((other) => other !== element && element.contains(other)));
}

function detectVisiblePlayers(doc: Document, index: PlayerIndex, team: string | null, decade: Decade | null): Player[] {
  const scopedPlayers = team && decade ? index.byRoll.get(`${team}::${decade}`) ?? [] : index.players;
  const elements = getVisibleCandidateElements(doc, decade);
  const visiblePlayers: Player[] = [];

  for (const element of elements) {
    const elementText = extractVisibleText(element).toLowerCase();
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
  const roster = detectLineupTrayRoster(doc, index);
  const rosterRoot = doc.querySelector('[aria-label="roster"]');
  if (!rosterRoot) {
    return roster;
  }

  const text = extractTextWithSeparators(rosterRoot);
  for (const position of POSITIONS) {
    const player = findRosterPlayerForPosition(text, position, index.players);
    if (player) {
      roster[position] = player;
    }
  }
  return roster;
}

function detectLineupTrayRoster(doc: Document, index: PlayerIndex): Roster {
  const roster: Roster = {};
  const labels = [...doc.querySelectorAll("[data-lineup-tray] [aria-label]")]
    .map((element) => element.getAttribute("aria-label") ?? "")
    .filter(Boolean);

  for (const label of labels) {
    const match = label.match(/^\s*(PG|SG|SF|PF|C)\s*:\s*([^,]+?)\s*(?:,|$)/);
    if (!match) {
      continue;
    }

    const position = match[1] as Position;
    const player = findPlayerByName(match[2], index);
    if (player) {
      roster[position] = player;
    }
  }

  return roster;
}

function findPlayerByName(name: string, index: PlayerIndex): Player | undefined {
  return index.byName.get(normalizeName(name)) ?? index.players.find((player) => normalizeName(player.name) === normalizeName(name));
}

function findRosterPlayerForPosition(text: string, position: Position, players: Player[]): Player | undefined {
  const matches = [...text.matchAll(/(^|\s)(PG|SG|SF|PF|C)(?=\s|:|-|$)/g)];
  const positionMatchIndex = matches.findIndex((match) => match[2] === position);
  if (positionMatchIndex < 0) {
    return undefined;
  }

  const match = matches[positionMatchIndex];
  const prefixLength = match[1].length;
  const start = (match.index ?? 0) + prefixLength + position.length;
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

function getVisibleCandidateElements(doc: Document, decade: Decade | null): Element[] {
  const labeledContainers = [...doc.querySelectorAll("[aria-label]")].filter((element) =>
    isVisibleElement(element) && isRealOptionsLabel(element.getAttribute("aria-label") ?? "")
  );
  if (labeledContainers.length > 0) {
    return labeledContainers
      .flatMap((container) => getLeafCandidates(container))
      .filter((element) => isVisibleElement(element))
      .filter((element) => isCandidateText(element, decade, false));
  }

  const interactiveCandidates = [...doc.querySelectorAll("button, [role='button']")].filter(
    (element) => isVisibleElement(element) && !isInExcludedArea(element)
  );
  const optionButtons = interactiveCandidates.filter((element) => isCandidateText(element, decade, true));
  if (optionButtons.length > 0) {
    return optionButtons;
  }

  const fallbackCandidates = [...doc.querySelectorAll("article, li, section, div")].filter(
    (element) => isVisibleElement(element) && !isInExcludedArea(element)
  );

  return fallbackCandidates
    .filter((element) => !fallbackCandidates.some((other) => other !== element && element.contains(other)))
    .filter((element) => isCandidateText(element, decade, true));
}

function getLeafCandidates(root: Element): Element[] {
  const descendants = [...root.querySelectorAll("button, [role='button'], li, article, section, div")];
  const candidates = descendants.length > 0 ? descendants : [root];
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

function isCandidateText(element: Element, decade: Decade | null, requireStatSignals: boolean): boolean {
  const text = extractVisibleText(element).toLowerCase();
  if (hasStatSignal(text)) {
    return true;
  }

  if (decade && text.includes(decade.toLowerCase())) {
    return true;
  }

  return !requireStatSignals && text.length > 0;
}

function hasStatSignal(text: string): boolean {
  const normalized = text.toLowerCase();
  return normalized.includes("ppg") || normalized.includes("rpg") || normalized.includes("apg");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractVisibleText(root: Element): string {
  if (!isVisibleElement(root)) {
    return "";
  }

  return [...root.childNodes]
    .map((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent ?? "";
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        return extractVisibleText(node as Element);
      }

      return "";
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function isVisibleElement(element: Element): boolean {
  for (let current: Element | null = element; current; current = current.parentElement) {
    if ((current as HTMLElement).hidden || current.getAttribute("aria-hidden") === "true") {
      return false;
    }

    const inlineStyle = (current.getAttribute("style") ?? "").toLowerCase();
    if (/\bdisplay\s*:\s*none\b/.test(inlineStyle) || /\bvisibility\s*:\s*hidden\b/.test(inlineStyle)) {
      return false;
    }

    if (typeof getComputedStyle !== "undefined") {
      const style = getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden") {
        return false;
      }
    }
  }

  return true;
}

function isRealOptionsLabel(label: string): boolean {
  const normalized = label.toLowerCase();
  if (/status\b/.test(normalized)) {
    return false;
  }

  return (
    /\b(players?|options?|choices?|candidates?|picks?|cards?|pool|board)\b/.test(normalized) ||
    /\bdraft\s+(players?|options?|choices?|candidates?|picks?|cards?|pool|board)\b/.test(normalized)
  );
}
