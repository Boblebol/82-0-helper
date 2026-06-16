import sidebarStyles from "../styles/sidebar.css?inline";
import type { GameState, Position } from "../domain/types";
import type { CandidateRecommendation, SkipAdvice } from "../scoring/projections";

export interface SidebarViewModel {
  state: GameState;
  recommendations: CandidateRecommendation[];
  gaps: string[];
  skipAdvice: SkipAdvice;
  error: string | null;
  onEdit: () => void;
  onRetry: () => void;
  onResetManualState: () => void;
  onManualSave: (state: {
    team: string | null;
    decade: string | null;
    round: number | null;
  }) => void;
}

const HOST_ID = "assistant-82-0-host";
const STYLE_ID = "assistant-82-0-sidebar-style";
const POSITION_ORDER: Position[] = ["PG", "SG", "SF", "PF", "C"];

export function ensureSidebarHost(): ShadowRoot {
  const documentElement = document.documentElement;
  let host = document.getElementById(HOST_ID) as HTMLElement | null;

  if (!host) {
    host = document.createElement("aside");
    host.id = HOST_ID;
    documentElement.appendChild(host);
  } else if (host.parentElement !== documentElement) {
    documentElement.appendChild(host);
  }

  const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  if (!shadowRoot.querySelector(`#${STYLE_ID}`)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = sidebarStyles;
    shadowRoot.appendChild(style);
  }

  return shadowRoot;
}

export function renderSidebar(root: Element | ShadowRoot, viewModel: SidebarViewModel): void {
  const container = ensureSidebarContainer(root);
  const wasOpen = container.querySelector(".assistant-shell")?.classList.contains("is-open") ?? false;
  const wasEditing = container.querySelector(".assistant-shell")?.classList.contains("is-editing") ?? false;
  const shellClass = "assistant-shell";
  const stateLabel = `${viewModel.state.mode} • ${viewModel.state.confidence} confidence`;
  const headerLine = [
    viewModel.state.team ?? "Unknown team",
    viewModel.state.decade ?? "Unknown decade"
  ].join(" ");
  const roundLabel = viewModel.state.round == null ? "Round ?" : `Round ${viewModel.state.round}`;
  const ariaExpanded = wasOpen ? "true" : "false";

  container.innerHTML = `
    <section class="${shellClass}${wasOpen ? " is-open" : ""}${wasEditing ? " is-editing" : ""}">
      <button class="assistant-toggle" type="button" data-action="toggle" aria-expanded="${ariaExpanded}">82 Assist</button>
      <div class="assistant-panel" role="region" aria-label="Assistant sidebar">
        <header class="assistant-header">
          <div>
            <p class="assistant-eyebrow">${escapeHtml(stateLabel)}</p>
            <h2>${escapeHtml(headerLine)}</h2>
          </div>
          <div class="assistant-round">${escapeHtml(roundLabel)}</div>
        </header>

        ${viewModel.error ? errorCard(viewModel.error) : ""}
        ${bestPickCard(viewModel.recommendations[0])}
        ${recommendationsTable(viewModel.recommendations)}
        ${skipAdviceCard(viewModel.skipAdvice)}
        ${rosterCard(viewModel.state.roster)}
        ${gapsCard(viewModel.gaps)}
        ${manualEditPanel(wasEditing)}

        <footer class="assistant-actions">
          <button class="assistant-button" type="button" data-action="edit">Edit roster</button>
          <button class="assistant-button assistant-button--ghost" type="button" data-action="reset-manual">Reset manual</button>
        </footer>
      </div>
    </section>
  `;

  wireEvents(container, viewModel);
}

function ensureSidebarContainer(root: Element | ShadowRoot): HTMLElement {
  const existing = root.querySelector<HTMLElement>("[data-assistant-sidebar-root]");
  if (existing) {
    return existing;
  }

  const container = document.createElement("div");
  container.dataset.assistantSidebarRoot = "true";
  root.appendChild(container);
  return container;
}

function wireEvents(root: Element | ShadowRoot, viewModel: SidebarViewModel): void {
  const editButton = root.querySelector<HTMLButtonElement>("button[data-action='edit']");
  const retryButton = root.querySelector<HTMLButtonElement>("button[data-action='retry']");
  const resetButton = root.querySelector<HTMLButtonElement>("button[data-action='reset-manual']");
  const toggleButton = root.querySelector<HTMLButtonElement>("button[data-action='toggle']");
  const shell = root.querySelector<HTMLElement>(".assistant-shell");
  const editPanel = root.querySelector<HTMLElement>("[data-assistant-edit-panel]");

  editButton?.addEventListener("click", () => {
    viewModel.onEdit();
    setEditingState(shell, toggleButton, editPanel, true);
  });
  retryButton?.addEventListener("click", () => viewModel.onRetry());
  resetButton?.addEventListener("click", () => viewModel.onResetManualState());
  toggleButton?.addEventListener("click", () => {
    const isOpen = shell?.classList.toggle("is-open") ?? false;
    toggleButton.setAttribute("aria-expanded", String(isOpen));
  });

  root.querySelector<HTMLButtonElement>("button[data-action='save-manual']")?.addEventListener("click", () => {
    viewModel.onManualSave(readManualPatch(root));
  });
}

function setEditingState(
  shell: HTMLElement | null,
  toggleButton: HTMLButtonElement | null,
  editPanel: HTMLElement | null,
  isEditing: boolean
): void {
  if (!shell) {
    return;
  }

  shell.classList.toggle("is-editing", isEditing);
  if (editPanel) {
    editPanel.hidden = !isEditing;
  }

  toggleButton?.setAttribute("aria-expanded", String(shell.classList.contains("is-open")));
}

function manualEditPanel(isEditing: boolean): string {
  return `
    <section class="assistant-card" data-assistant-edit-panel ${isEditing ? "" : "hidden"}>
      <p class="assistant-card-title">Manual correction</p>
      <label class="assistant-field">Team <input name="team" maxlength="3" /></label>
      <label class="assistant-field">Decade <select name="decade">
        <option value="">Unknown</option>
        <option value="1960s">1960s</option>
        <option value="1970s">1970s</option>
        <option value="1980s">1980s</option>
        <option value="1990s">1990s</option>
        <option value="2000s">2000s</option>
        <option value="2010s">2010s</option>
        <option value="2020s">2020s</option>
      </select></label>
      <label class="assistant-field">Round <input name="round" type="number" min="1" max="5" /></label>
      <button type="button" data-action="save-manual">Save</button>
    </section>
  `;
}

function readManualPatch(root: Element | ShadowRoot): {
  team: string | null;
  decade: string | null;
  round: number | null;
} {
  const teamValue = root.querySelector<HTMLInputElement>("input[name='team']")?.value.trim() ?? "";
  const decadeValue = root.querySelector<HTMLSelectElement>("select[name='decade']")?.value ?? "";
  const roundValue = root.querySelector<HTMLInputElement>("input[name='round']")?.value ?? "";
  const parsedRound = roundValue === "" ? Number.NaN : Number(roundValue);

  return {
    team: teamValue === "" ? null : teamValue.toUpperCase(),
    decade: decadeValue === "" ? null : decadeValue,
    round: Number.isFinite(parsedRound) ? parsedRound : null
  };
}

function errorCard(error: string): string {
  return `
    <section class="assistant-card assistant-card--error" aria-label="Sidebar error">
      <p class="assistant-card-title">Data unavailable</p>
      <p class="assistant-copy">${escapeHtml(error)}</p>
      <button class="assistant-button assistant-button--compact" type="button" data-action="retry">Retry</button>
    </section>
  `;
}

function bestPickCard(recommendation?: CandidateRecommendation): string {
  if (!recommendation) {
    return `
      <section class="assistant-card">
        <p class="assistant-card-title">Best pick</p>
        <p class="assistant-copy">No recommendation available for the current roll.</p>
      </section>
    `;
  }

  return `
    <section class="assistant-card assistant-card--highlight" aria-label="Best recommendation">
      <p class="assistant-card-title">Best pick</p>
      <div class="assistant-best">
        <div>
          <div class="assistant-player">${escapeHtml(recommendation.player.name)}</div>
          <div class="assistant-meta">${escapeHtml(recommendation.player.team)} ${escapeHtml(recommendation.player.decade)}</div>
        </div>
        <div class="assistant-position">${escapeHtml(recommendation.position)}</div>
      </div>
      <div class="assistant-stats">
        <div>Expected record ${formatWins(recommendation.expectedWins)}</div>
        <div>Ceiling record ${formatWins(recommendation.ceilingWins)}</div>
        <div>Expected ${formatDelta(recommendation.deltaExpectedWins)}</div>
        <div>Ceiling ${formatDelta(recommendation.deltaCeilingWins)}</div>
      </div>
    </section>
  `;
}

function recommendationsTable(recommendations: CandidateRecommendation[]): string {
  if (recommendations.length === 0) {
    return `
      <section class="assistant-card">
        <p class="assistant-card-title">Top picks</p>
        <p class="assistant-copy">No alternative picks are available.</p>
      </section>
    `;
  }

  const rows = recommendations
    .map(
      (recommendation) => `
        <tr>
          <td>${escapeHtml(recommendation.player.name)}</td>
          <td>${escapeHtml(recommendation.position)}</td>
          <td>${formatWins(recommendation.expectedWins)}</td>
          <td>${formatWins(recommendation.ceilingWins)}</td>
          <td>${formatDelta(recommendation.deltaExpectedWins)}</td>
        </tr>
      `
    )
    .join("");

  return `
    <section class="assistant-card">
      <p class="assistant-card-title">Top picks</p>
      <div class="assistant-table-wrap">
        <table class="assistant-table">
          <thead>
            <tr>
              <th scope="col">Player</th>
              <th scope="col">Pos</th>
              <th scope="col">Expected</th>
              <th scope="col">Ceiling</th>
              <th scope="col">Delta</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function skipAdviceCard(skipAdvice: SkipAdvice): string {
  const label = skipAdvice.kind.replace(/-/g, " ");

  return `
    <section class="assistant-card">
      <p class="assistant-card-title">Skip advice</p>
      <div class="assistant-pill">${escapeHtml(label)}</div>
      <p class="assistant-copy">${escapeHtml(skipAdvice.reason)}</p>
    </section>
  `;
}

function rosterCard(roster: GameState["roster"]): string {
  const rows = POSITION_ORDER.map((position) => {
    const player = roster[position];
    return `
      <li>
        <span class="assistant-roster-pos">${escapeHtml(position)}</span>
        <span class="assistant-roster-name">${escapeHtml(player?.name ?? "Open")}</span>
      </li>
    `;
  }).join("");

  return `
    <section class="assistant-card">
      <p class="assistant-card-title">Roster</p>
      <ul class="assistant-roster">${rows}</ul>
    </section>
  `;
}

function gapsCard(gaps: string[]): string {
  const items = gaps.length > 0
    ? gaps.map((gap) => `<li>${escapeHtml(gap)}</li>`).join("")
    : "<li>None</li>";

  return `
    <section class="assistant-card">
      <p class="assistant-card-title">Gaps</p>
      <ul class="assistant-gaps">${items}</ul>
    </section>
  `;
}

function formatWins(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDelta(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatWins(value)}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
