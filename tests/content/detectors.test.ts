import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { normalizePlayers } from "../../src/data/players";
import { detectGameState } from "../../src/content/detectors";

const index = normalizePlayers([
  { team: "LAL", player: "Kobe Bryant", pos: "SG", positions: ["SG", "SF"], ppg: 30, rpg: 6.9, apg: 5.9, spg: 2.2, bpg: 0.8, id: "kobe", baseSlug: "kobe", era: "2000s" },
  { team: "LAL", player: "Shaquille O'Neal", pos: "C", positions: ["C"], ppg: 29.7, rpg: 13.6, apg: 3.8, spg: 0.5, bpg: 3, id: "shaq", baseSlug: "shaq", era: "2000s" },
  { team: "LAL", player: "Magic Johnson", pos: "PG", positions: ["PG"], ppg: 23.9, rpg: 6.3, apg: 12.2, spg: 1.7, bpg: 0.4, id: "magic", baseSlug: "magic", era: "1980s" },
  { team: "SAS", player: "Tim Duncan", pos: "PF", positions: ["PF", "C"], ppg: 25.5, rpg: 12.7, apg: 3.7, spg: 0.7, bpg: 2.5, id: "duncan", baseSlug: "duncan", era: "2000s" },
  { team: "DEN", player: "Carmelo Anthony", pos: "PF", positions: ["PF", "SF"], ppg: 26.9, rpg: 7.0, apg: 3.0, spg: 1.1, bpg: 0.5, id: "carmelo_den", baseSlug: "carmelo", era: "2010s" },
  { team: "BOS", player: "Larry Bird", pos: "SF", positions: ["SF", "PF"], ppg: 24, rpg: 10, apg: 6, spg: 1.7, bpg: 0.8, id: "bird", baseSlug: "bird", era: "1990s" },
  { team: "UTA", player: "Pete Maravich", pos: "SG", positions: ["SG", "PG"], ppg: 25.7, rpg: 4.3, apg: 5.6, spg: 1.5, bpg: 0.3, id: "pete", baseSlug: "pete", era: "1970s" },
  { team: "MIN", player: "Tony Campbell", pos: "SF", positions: ["SF", "SG"], ppg: 20.6, rpg: 4.6, apg: 2.8, spg: 1.4, bpg: 0.5, id: "campbell", baseSlug: "campbell", era: "1990s" },
  { team: "LAL", player: "A.C. Green", pos: "PF", positions: ["PF"], ppg: 14.5, rpg: 9.0, apg: 1.1, spg: 1.0, bpg: 0.4, id: "ac_green", baseSlug: "ac_green", era: "1990s" },
  { team: "LAL", player: "C.J. Watson", pos: "PG", positions: ["PG"], ppg: 8.0, rpg: 2.1, apg: 3.2, spg: 1.0, bpg: 0.2, id: "cj_watson", baseSlug: "cj_watson", era: "2000s" }
]);

describe("DOM detectors", () => {
  it("detects Classic roll, visible players, round, and roster", () => {
    document.body.innerHTML = readFileSync("tests/fixtures/classic-draft.html", "utf8");

    const state = detectGameState(document, index);

    expect(state.mode).toBe("classic");
    expect(state.round).toBe(3);
    expect(state.team).toBe("LAL");
    expect(state.decade).toBe("2000s");
    expect(state.visiblePlayers.map((player) => player.name)).toEqual(["Kobe Bryant", "Shaquille O'Neal"]);
    expect(state.roster.PG?.name).toBe("Magic Johnson");
    expect(state.roster.PF?.name).toBe("Tim Duncan");
    expect(state.confidence).toBe("high");
  });

  it("ignores roster-only players when detecting visible draft options", () => {
    document.body.innerHTML = `
      <main>
        <section aria-label="draft status">
          <p>Classic</p>
          <p>Round 3</p>
          <h2>LAL 2000s</h2>
        </section>
        <section aria-label="players">
          <button>Kobe Bryant 30.0 PPG 6.9 RPG 5.9 APG</button>
        </section>
        <section aria-label="roster">
          <div>PG Magic Johnson</div>
          <div>SG Shaquille O'Neal</div>
          <div>SF Empty</div>
          <div>PF Tim Duncan</div>
          <div>C Empty</div>
        </section>
      </main>
    `;

    const state = detectGameState(document, index);

    expect(state.visiblePlayers.map((player) => player.name)).toEqual(["Kobe Bryant"]);
  });

  it("prefers buttons over unlabeled roster-like containers for visible options", () => {
    document.body.innerHTML = `
      <main>
        <section aria-label="draft status">
          <p>Classic</p>
          <p>Round 3</p>
          <h2>LAL 2000s</h2>
        </section>
        <section>
          <div>PG Magic Johnson</div>
          <div>SG Shaquille O'Neal</div>
        </section>
        <section aria-label="players">
          <button>Kobe Bryant 30.0 PPG 6.9 RPG 5.9 APG</button>
        </section>
      </main>
    `;

    const state = detectGameState(document, index);

    expect(state.visiblePlayers.map((player) => player.name)).toEqual(["Kobe Bryant"]);
  });

  it("ignores draft status labels when real button candidates are present", () => {
    document.body.innerHTML = `
      <main>
        <section aria-label="draft status">
          <p>Classic</p>
          <p>Round 3</p>
          <h2>LAL 2000s</h2>
        </section>
        <section>
          <button>Kobe Bryant 30.0 PPG 6.9 RPG 5.9 APG</button>
        </section>
      </main>
    `;

    const state = detectGameState(document, index);

    expect(state.visiblePlayers.map((player) => player.name)).toEqual(["Kobe Bryant"]);
  });

  it("parses roster slots with newlines, colons, and compact text", () => {
    document.body.innerHTML = `
      <main>
        <section aria-label="draft status">
          <p>Classic</p>
          <p>Round 3</p>
          <h2>LAL 2000s</h2>
        </section>
        <section aria-label="players">
          <button>Kobe Bryant 30.0 PPG 6.9 RPG 5.9 APG</button>
        </section>
        <section aria-label="roster">
          <div>PG\nMagic Johnson</div>
          <div>SG: Shaquille O'Neal</div>
          <div>SF Empty PF Tim Duncan C Empty</div>
        </section>
      </main>
    `;

    const state = detectGameState(document, index);

    expect(state.roster.PG?.name).toBe("Magic Johnson");
    expect(state.roster.SG?.name).toBe("Shaquille O'Neal");
    expect(state.roster.PF?.name).toBe("Tim Duncan");
  });

  it("parses dotted initials in roster player names", () => {
    document.body.innerHTML = `
      <main>
        <section aria-label="draft status">
          <p>Classic</p>
          <p>Round 3</p>
          <h2>LAL 1990s</h2>
        </section>
        <section aria-label="roster">
          <div>PF A.C. Green C Empty</div>
          <div>PG C.J. Watson SG Empty</div>
        </section>
      </main>
    `;

    const state = detectGameState(document, index);

    expect(state.roster.PF?.name).toBe("A.C. Green");
    expect(state.roster.PG?.name).toBe("C.J. Watson");
  });

  it("parses roster slots when sibling text nodes collapse without separators", () => {
    document.body.innerHTML = `
      <main>
        <section aria-label="draft status">
          <p>Classic</p>
          <p>Round 3</p>
          <h2>LAL 2000s</h2>
        </section>
        <section aria-label="players">
          <button>Kobe Bryant 30.0 PPG 6.9 RPG 5.9 APG</button>
        </section>
        <section aria-label="roster">
          <div><span>PG</span><span>Magic Johnson</span></div>
          <div><span>SG</span><span>Empty</span></div>
          <div><span>SF</span><span>Empty</span></div>
          <div><span>PF</span><span>Tim Duncan</span></div>
          <div><span>C</span><span>Empty</span></div>
        </section>
      </main>
    `;

    const state = detectGameState(document, index);

    expect(state.roster.PG?.name).toBe("Magic Johnson");
    expect(state.roster.PF?.name).toBe("Tim Duncan");
  });

  it("does not parse live draft option positions as roster slots", () => {
    document.body.innerHTML = `
      <main>
        <span>Round 2/5</span>
        <div class="fixed top-12">
          <div><span>MIN</span></div>
          <div>90's</div>
          <span>Team</span>
          <span>Era</span>
        </div>
        <section>
          <div>All G F C PPG</div>
          <p>68 players available</p>
          <div class="flex flex-row items-center justify-between px-3 py-2 rounded-lg border">
            <div>
              <p>Tony Campbell</p>
              <p>SF · SG</p>
              <p>MIN · 1990s</p>
            </div>
            <div>
              <span>20.6</span><span>PPG</span>
              <span>4.6</span><span>RPG</span>
              <span>2.8</span><span>APG</span>
            </div>
          </div>
        </section>
        <section class="hidden md:flex">
          <button><span>PM</span><span>SG</span></button>
        </section>
      </main>
    `;

    const state = detectGameState(document, index);

    expect(state.round).toBe(2);
    expect(state.team).toBe("MIN");
    expect(state.decade).toBe("1990s");
    expect(state.visiblePlayers.map((player) => player.name)).toEqual(["Tony Campbell"]);
    expect(state.roster).toEqual({});
  });

  it("detects a lowercase roll from a live div player card", () => {
    document.body.innerHTML = `
      <main>
        <span>Round 1/5</span>
        <section>
          <button>All</button>
          <button>G</button>
          <button>F</button>
          <button>C</button>
          <div class="flex flex-row items-center justify-between px-3 py-2 rounded-lg border">
            <div>
              <p>Carmelo Anthony</p>
              <p>PF · SF</p>
              <p>den · 2010s</p>
            </div>
            <div>
              <span>26.9</span><span>PPG</span>
              <span>7.0</span><span>RPG</span>
              <span>3.0</span><span>APG</span>
            </div>
          </div>
        </section>
      </main>
    `;

    const state = detectGameState(document, index);

    expect(state.team).toBe("DEN");
    expect(state.decade).toBe("2010s");
    expect(state.visiblePlayers.map((player) => player.name)).toEqual(["Carmelo Anthony"]);
    expect(state.confidence).toBe("high");
  });

  it("does not treat the slot machine preview as an active roll before players load", () => {
    document.body.innerHTML = `
      <main>
        <span>Round 2/5</span>
        <section>
          <div>
            <p>TEAM</p>
            <p>ATL</p>
            <p>Team</p>
          </div>
          <div>
            <p>ERA</p>
            <p>60's</p>
            <p>Decade</p>
          </div>
          <button>SPIN</button>
        </section>
        <div data-lineup-tray>
          <div role="button" aria-label="SG: Pete Maravich, tap to select for swap">
            <div>PM</div><span>SG</span>
          </div>
        </div>
      </main>
    `;

    const state = detectGameState(document, index);

    expect(state.round).toBe(2);
    expect(state.team).toBeNull();
    expect(state.decade).toBeNull();
    expect(state.visiblePlayers).toEqual([]);
    expect(state.roster.SG?.name).toBe("Pete Maravich");
    expect(state.confidence).toBe("low");
  });

  it("recovers placed players from the 82-0 lineup tray aria labels", () => {
    document.body.innerHTML = `
      <main>
        <span>Round 2/5</span>
        <div data-lineup-tray>
          <div role="button" aria-label="PG empty">
            <div>PG</div><span>PG</span>
          </div>
          <div role="button" aria-label="SG: Pete Maravich, tap to select for swap">
            <div>PM</div><span>SG</span>
          </div>
          <div role="button" aria-label="SF empty">
            <div>SF</div><span>SF</span>
          </div>
          <div role="button" aria-label="PF empty">
            <div>PF</div><span>PF</span>
          </div>
          <div role="button" aria-label="C empty">
            <div>C</div><span>C</span>
          </div>
        </div>
      </main>
    `;

    const state = detectGameState(document, index);

    expect(state.roster.SG?.name).toBe("Pete Maravich");
  });

  it("detects consumed team and available decade rerolls from visible buttons", () => {
    document.body.innerHTML = `
      <main>
        <span>Round 2/5</span>
        <section>
          <button disabled>Team</button>
          <button>Era</button>
        </section>
        <section aria-label="players">
          <button>
            <span>Tony Campbell</span>
            <span>MIN · 1990s</span>
            <span>20.6 PPG</span>
          </button>
        </section>
      </main>
    `;

    const state = detectGameState(document, index);

    expect(state.skipsUsed).toEqual({ team: true, decade: false });
  });

  it("detects shorthand decade labels like 00's", () => {
    document.body.innerHTML = `
      <main>
        <section aria-label="draft status">
          <p>Classic</p>
          <p>Round 3</p>
          <h2>LAL 00's</h2>
        </section>
      </main>
    `;

    const state = detectGameState(document, index);

    expect(state.decade).toBe("2000s");
  });

  it("detects team abbreviations rendered in lowercase player metadata", () => {
    document.body.innerHTML = `
      <main>
        <p>Classic</p>
        <p>Round 1/5</p>
        <section aria-label="players">
          <button>
            <span>Carmelo Anthony</span>
            <span>PF · SF</span>
            <span>den · 2010s</span>
            <span>26.9 PPG</span>
          </button>
        </section>
      </main>
    `;

    const state = detectGameState(document, index);

    expect(state.team).toBe("DEN");
    expect(state.decade).toBe("2010s");
    expect(state.visiblePlayers.map((player) => player.name)).toEqual(["Carmelo Anthony"]);
    expect(state.confidence).toBe("high");
  });

  it("prefers the visible player card roll over stale hidden team text", () => {
    document.body.innerHTML = `
      <main>
        <section aria-label="players" hidden>
          <button>
            <span>Larry Bird</span>
            <span>BOS · 1990s</span>
            <span>24.0 PPG</span>
          </button>
        </section>
        <section aria-label="players">
          <button>
            <span>Carmelo Anthony</span>
            <span>PF · SF</span>
            <span>den · 2010s</span>
            <span>26.9 PPG</span>
          </button>
        </section>
      </main>
    `;

    const state = detectGameState(document, index);

    expect(state.team).toBe("DEN");
    expect(state.decade).toBe("2010s");
    expect(state.visiblePlayers.map((player) => player.name)).toEqual(["Carmelo Anthony"]);
  });

  it("does not treat stray lowercase min text as the Minnesota roll", () => {
    document.body.innerHTML = `
      <main>
        <section aria-label="players">
          <button>
            <span>min</span>
            <span>Carmelo Anthony</span>
            <span>PF · SF</span>
            <span>den · 2010s</span>
            <span>26.9 PPG</span>
          </button>
        </section>
      </main>
    `;

    const state = detectGameState(document, index);

    expect(state.team).toBe("DEN");
    expect(state.decade).toBe("2010s");
    expect(state.visiblePlayers.map((player) => player.name)).toEqual(["Carmelo Anthony"]);
  });

  it("returns low confidence when the current roll is missing", () => {
    document.body.innerHTML = readFileSync("tests/fixtures/incomplete-state.html", "utf8");

    const state = detectGameState(document, index);

    expect(state.team).toBeNull();
    expect(state.decade).toBeNull();
    expect(state.confidence).toBe("low");
  });
});
