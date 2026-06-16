import { describe, expect, it, vi } from "vitest";
import { startAssistant } from "../../src/content/index";

describe("content entrypoint", () => {
  it("mounts the assistant host and renders after player data loads", async () => {
    document.body.innerHTML = `
      <main>
        <p>Classic</p>
        <p>Round 1</p>
        <h2>LAL 2000s</h2>
        <button>Kobe Bryant 30.0 PPG</button>
      </main>
    `;

    await startAssistant({
      fetchPlayers: async () => ({
        players: [
          {
            id: "kobe",
            baseSlug: "kobe",
            name: "Kobe Bryant",
            team: "LAL",
            decade: "2000s",
            primaryPosition: "SG",
            positions: ["SG"],
            ppg: 30,
            rpg: 6.9,
            apg: 5.9,
            spg: 2.2,
            bpg: 0.8
          }
        ],
        byRoll: new Map([
          [
            "LAL::2000s",
            [
              {
                id: "kobe",
                baseSlug: "kobe",
                name: "Kobe Bryant",
                team: "LAL",
                decade: "2000s",
                primaryPosition: "SG",
                positions: ["SG"],
                ppg: 30,
                rpg: 6.9,
                apg: 5.9,
                spg: 2.2,
                bpg: 0.8
              }
            ]
          ]
        ]),
        byName: new Map()
      }),
      observeMutations: false
    });

    const host = document.getElementById("assistant-82-0-host");
    expect(host?.shadowRoot?.textContent).toContain("Kobe Bryant");
  });

  it("renders retry state when data loading fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await startAssistant({
      fetchPlayers: async () => {
        throw new Error("network down");
      },
      observeMutations: false
    });

    const host = document.getElementById("assistant-82-0-host");
    expect(host?.shadowRoot?.textContent).toContain("players data unavailable");
  });
});
