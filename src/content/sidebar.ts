import sidebarStyles from "../styles/sidebar.css?inline";
import { ACTIVE_DECADES, type Decade, type GameState, type Position } from "../domain/types";
import type { CandidateRecommendation, RerollBetterOdds, RerollHitRate, SkipAdvice } from "../scoring/projections";

export interface SidebarViewModel {
  state: GameState;
  recommendations: CandidateRecommendation[];
  gaps: string[];
  skipAdvice: SkipAdvice;
  rerollOdds?: RerollBetterOdds | null;
  loading?: string | null;
  error: string | null;
  onEdit: () => void;
  onRetry: () => void;
  onScanPage: () => void;
  onResetManualState: () => void;
  onManualSave: (state: {
    team: string | null;
    decade: Decade | null;
    round: number | null;
  }) => void;
}

const HOST_ID = "assistant-82-0-host";
const STYLE_ID = "assistant-82-0-sidebar-style";
const POSITION_ORDER: Position[] = ["PG", "SG", "SF", "PF", "C"];
const HELP_TEXT = {
  bestPick: "Le meilleur joueur à prendre maintenant selon le gain immédiat et la projection du roster.",
  pickImpact: "Gain immédiat en victoires si ce joueur est ajouté maintenant, sans supposer les prochains picks.",
  projection: "Projection réaliste après ce choix, en complétant l'équipe avec des picks probables.",
  ceiling: "Meilleur scénario estimé si les prochains choix se passent très bien.",
  alternatives: "Les autres joueurs visibles classés avec la même logique de projection.",
  skipAdvice: "Conseil qui tient compte du pick recommandé, des rerolls disponibles et du fait que chaque reroll n'est utilisable qu'une fois.",
  rerollOdds: "Probabilité de tomber sur un tirage contenant un meilleur pick que le choix recommandé actuel.",
  roster: "Joueurs déjà placés dans ton cinq. Ils sont exclus des calculs de reroll via leur identité de joueur.",
  gaps: "Catégories statistiques les plus faibles du roster actuel.",
  manual: "Corrige manuellement l'équipe, la décennie ou le tour si la page a été mal détectée."
} as const;
const SKIP_LABELS: Record<SkipAdvice["kind"], string> = {
  keep: "Garder",
  "skip-team": "Reroll équipe",
  "skip-decade": "Reroll décennie",
  "skip-only-if-chasing-82-0": "Reroll si 82-0"
};
const SKIP_REASON_TRANSLATIONS: Record<string, string> = {
  "The current roll is strong relative to reroll options.": "Le tirage actuel est solide par rapport aux options de reroll.",
  "Rerolling the team has a better expected candidate distribution.": "Changer d'équipe offre une meilleure distribution de candidats.",
  "Rerolling the decade better matches the current roster gaps.": "Changer de décennie correspond mieux aux manques actuels.",
  "This is fine for expected wins but lowers the 82-0 ceiling path.": "Ce choix reste correct, mais il limite la trajectoire vers 82-0.",
  "Wait for more player data before deciding whether to skip.": "Attends que la liste des joueurs soit détectée avant de décider.",
  "Loading player data...": "Chargement des joueurs...",
  "Waiting for player data before evaluating this roll.": "Chargement des joueurs avant l'évaluation du tirage.",
  "Waiting for a detected team and decade.": "En attente d'une équipe et d'une décennie détectées.",
  "players data unavailable": "Données joueurs indisponibles."
};

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
  const stateLabel = `${modeLabel(viewModel.state.mode)} • ${confidenceLabel(viewModel.state.confidence)}`;
  const headerLine = [
    viewModel.state.team ?? "Équipe inconnue",
    viewModel.state.decade ?? "Décennie inconnue"
  ].join(" ");
  const roundLabel = viewModel.state.round == null ? "Tour ?" : `Tour ${viewModel.state.round}`;
  const ariaExpanded = wasOpen ? "true" : "false";

  container.innerHTML = `
    <section class="${shellClass}${wasOpen ? " is-open" : ""}${wasEditing ? " is-editing" : ""}">
      <button class="assistant-toggle" type="button" data-action="toggle" aria-expanded="${ariaExpanded}">Aide 82-0</button>
      <div class="assistant-panel" role="region" aria-label="Assistant 82-0">
        <header class="assistant-header">
          <div>
            <p class="assistant-eyebrow">${escapeHtml(stateLabel)}</p>
            <h2>${escapeHtml(headerLine)}</h2>
          </div>
          <div class="assistant-round">${escapeHtml(roundLabel)}</div>
        </header>

        ${viewModel.error ? errorCard(viewModel.error) : ""}
        ${viewModel.loading ? loadingCard(viewModel.loading) : ""}
        ${bestPickCard(viewModel.recommendations[0])}
        ${recommendationsTable(viewModel.recommendations)}
        ${skipAdviceCard(viewModel.skipAdvice, viewModel.rerollOdds ?? null, viewModel.recommendations[0])}
        ${rosterCard(viewModel.state.roster)}
        ${gapsCard(viewModel.gaps)}
        ${manualEditPanel(viewModel.state, wasEditing)}

        <footer class="assistant-actions">
          <button class="assistant-button" type="button" data-action="scan-page">Analyser</button>
          <button class="assistant-button" type="button" data-action="edit">Corriger</button>
          <button class="assistant-button assistant-button--ghost" type="button" data-action="reset-manual">Réinitialiser</button>
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

function modeLabel(mode: GameState["mode"]): string {
  if (mode === "classic") {
    return "Classic";
  }
  if (mode === "hoopiq") {
    return "HoopIQ";
  }
  return "Mode inconnu";
}

function confidenceLabel(confidence: GameState["confidence"]): string {
  return confidence === "high" ? "confiance haute" : "confiance faible";
}

function cardTitle(label: string, help: string): string {
  return `
    <div class="assistant-card-heading">
      <p class="assistant-card-title">${escapeHtml(label)}</p>
      ${helpButton(help)}
    </div>
  `;
}

function helpButton(help: string): string {
  const escapedHelp = escapeHtml(help);
  return `<button class="assistant-help" type="button" aria-label="${escapedHelp}" title="${escapedHelp}" data-tooltip="${escapedHelp}">?</button>`;
}

function translateMessage(message: string): string {
  return SKIP_REASON_TRANSLATIONS[message] ?? message;
}

function wireEvents(root: Element | ShadowRoot, viewModel: SidebarViewModel): void {
  const editButton = root.querySelector<HTMLButtonElement>("button[data-action='edit']");
  const retryButton = root.querySelector<HTMLButtonElement>("button[data-action='retry']");
  const scanButton = root.querySelector<HTMLButtonElement>("button[data-action='scan-page']");
  const resetButton = root.querySelector<HTMLButtonElement>("button[data-action='reset-manual']");
  const toggleButton = root.querySelector<HTMLButtonElement>("button[data-action='toggle']");
  const shell = root.querySelector<HTMLElement>(".assistant-shell");
  const editPanel = root.querySelector<HTMLElement>("[data-assistant-edit-panel]");

  editButton?.addEventListener("click", () => {
    viewModel.onEdit();
    const isEditing = shell?.classList.contains("is-editing") ?? false;
    setEditingState(shell, toggleButton, editPanel, !isEditing);
  });
  retryButton?.addEventListener("click", () => viewModel.onRetry());
  scanButton?.addEventListener("click", () => viewModel.onScanPage());
  resetButton?.addEventListener("click", () => viewModel.onResetManualState());
  toggleButton?.addEventListener("click", () => {
    const isOpen = shell?.classList.toggle("is-open") ?? false;
    toggleButton.setAttribute("aria-expanded", String(isOpen));
  });

  root.querySelector<HTMLButtonElement>("button[data-action='save-manual']")?.addEventListener("click", () => {
    const patch = readManualPatch(root);
    if (!patch) {
      return;
    }

    viewModel.onManualSave(patch);
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

function manualEditPanel(state: GameState, isEditing: boolean): string {
  const teamValue = escapeHtml(state.team ?? "");
  const decadeValue = state.decade ?? "";
  const roundValue = state.round == null ? "" : escapeHtml(String(state.round));

  return `
    <section class="assistant-card" data-assistant-edit-panel ${isEditing ? "" : "hidden"}>
      ${cardTitle("Correction manuelle", HELP_TEXT.manual)}
      <label class="assistant-field">Équipe <input name="team" maxlength="3" value="${teamValue}" /></label>
      <label class="assistant-field">Décennie <select name="decade">
        <option value=""${decadeValue === "" ? " selected" : ""}>Inconnue</option>
        ${ACTIVE_DECADES.map((decade) => `<option value="${decade}"${decadeValue === decade ? " selected" : ""}>${decade}</option>`).join("")}
      </select></label>
      <label class="assistant-field">Tour <input name="round" type="number" min="1" max="5" value="${roundValue}" /></label>
      <button class="assistant-button assistant-button--compact" type="button" data-action="save-manual">Enregistrer</button>
    </section>
  `;
}

function readManualPatch(root: Element | ShadowRoot): {
  team: string | null;
  decade: Decade | null;
  round: number | null;
} | null {
  const teamInput = root.querySelector<HTMLInputElement>("input[name='team']");
  const decadeSelect = root.querySelector<HTMLSelectElement>("select[name='decade']");
  const roundInput = root.querySelector<HTMLInputElement>("input[name='round']");

  if (!teamInput || !decadeSelect || !roundInput) {
    return null;
  }

  const teamValue = teamInput.value.trim();
  const decadeValue = decadeSelect.value;
  const roundValue = roundInput.value.trim();

  const round = parseRound(roundValue);
  const decade = parseDecade(decadeValue);
  const roundValid = roundValue === "" || round !== null;
  const decadeValid = decadeValue === "" || decade !== null;

  if (roundValid) {
    roundInput.removeAttribute("aria-invalid");
  } else {
    roundInput.setAttribute("aria-invalid", "true");
  }

  if (decadeValid) {
    decadeSelect.removeAttribute("aria-invalid");
  } else {
    decadeSelect.setAttribute("aria-invalid", "true");
  }

  if (!roundValid || !decadeValid) {
    return null;
  }

  teamInput.removeAttribute("aria-invalid");
  decadeSelect.removeAttribute("aria-invalid");
  roundInput.removeAttribute("aria-invalid");

  return {
    team: teamValue === "" ? null : teamValue.toUpperCase(),
    decade,
    round
  };
}

function parseRound(value: string): number | null {
  if (value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    return null;
  }

  return parsed;
}

function parseDecade(value: string): Decade | null {
  if (value === "") {
    return null;
  }

  return ACTIVE_DECADES.includes(value as Decade) ? (value as Decade) : null;
}

function errorCard(error: string): string {
  return `
    <section class="assistant-card assistant-card--error" aria-label="Sidebar error">
      <p class="assistant-card-title">Données indisponibles</p>
      <p class="assistant-copy">${escapeHtml(translateMessage(error))}</p>
      <button class="assistant-button assistant-button--compact" type="button" data-action="retry">Réessayer</button>
    </section>
  `;
}

function loadingCard(message: string): string {
  return `
    <section class="assistant-card assistant-card--loading" aria-label="Sidebar loading">
      <p class="assistant-card-title">Chargement</p>
      <p class="assistant-copy">${escapeHtml(translateMessage(message))}</p>
    </section>
  `;
}

function bestPickCard(recommendation?: CandidateRecommendation): string {
  if (!recommendation) {
    return `
      <section class="assistant-card">
        ${cardTitle("Meilleur choix", HELP_TEXT.bestPick)}
        <p class="assistant-copy">Aucune recommandation pour le tirage actuel.</p>
      </section>
    `;
  }

  return `
    <section class="assistant-card assistant-card--highlight" aria-label="Best recommendation">
      ${cardTitle("Meilleur choix", HELP_TEXT.bestPick)}
      <div class="assistant-best">
        <div>
          <div class="assistant-player">${escapeHtml(recommendation.player.name)}</div>
          <div class="assistant-meta">${escapeHtml(recommendation.player.team)} ${escapeHtml(recommendation.player.decade)}</div>
        </div>
        <div class="assistant-position">${escapeHtml(recommendation.position)}</div>
      </div>
      <div class="assistant-stats">
        <div>Impact pick ${formatDelta(pickImpactWins(recommendation))} ${helpButton(HELP_TEXT.pickImpact)}</div>
        <div>Projection réaliste ${formatWins(recommendation.expectedWins)} ${helpButton(HELP_TEXT.projection)}</div>
        <div>Plafond ${formatWins(recommendation.ceilingWins)} ${helpButton(HELP_TEXT.ceiling)}</div>
        <div>Gain réaliste ${formatDelta(recommendation.deltaExpectedWins)} ${helpButton(HELP_TEXT.projection)}</div>
        <div>Gain plafond ${formatDelta(recommendation.deltaCeilingWins)} ${helpButton(HELP_TEXT.ceiling)}</div>
      </div>
    </section>
  `;
}

function recommendationsTable(recommendations: CandidateRecommendation[]): string {
  if (recommendations.length === 0) {
    return `
      <section class="assistant-card">
        ${cardTitle("Alternatives", HELP_TEXT.alternatives)}
        <p class="assistant-copy">Aucun autre pick disponible.</p>
      </section>
    `;
  }

  const rows = recommendations
    .map(
      (recommendation) => `
        <tr>
          <td>${escapeHtml(recommendation.player.name)}</td>
          <td>${escapeHtml(recommendation.position)}</td>
          <td>${formatDelta(pickImpactWins(recommendation))}</td>
          <td>${formatWins(recommendation.expectedWins)}</td>
          <td>${formatWins(recommendation.ceilingWins)}</td>
          <td>${formatDelta(recommendation.deltaExpectedWins)}</td>
        </tr>
      `
    )
    .join("");

  return `
    <section class="assistant-card">
      ${cardTitle("Alternatives", HELP_TEXT.alternatives)}
      <div class="assistant-table-wrap">
        <table class="assistant-table">
          <thead>
            <tr>
              <th scope="col">Joueur</th>
              <th scope="col">Pos</th>
              <th scope="col">Impact</th>
              <th scope="col">Réaliste</th>
              <th scope="col">Plafond</th>
              <th scope="col">Gain</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function skipAdviceCard(skipAdvice: SkipAdvice, rerollOdds: RerollBetterOdds | null, recommendation: CandidateRecommendation | undefined): string {
  const label = SKIP_LABELS[skipAdvice.kind];
  const odds = rerollOdds && recommendation ? rerollOddsList(rerollOdds, recommendation.player.name) : "";

  return `
    <section class="assistant-card">
      ${cardTitle("Conseil reroll", HELP_TEXT.skipAdvice)}
      <div class="assistant-pill assistant-pill--${escapeHtml(skipAdvice.kind)}">${escapeHtml(label)}</div>
      <p class="assistant-copy">${escapeHtml(translateMessage(skipAdvice.reason))}</p>
      ${odds}
    </section>
  `;
}

function rerollOddsList(rerollOdds: RerollBetterOdds, baselinePlayerName: string): string {
  return `
    <div class="assistant-reroll-odds" aria-label="reroll odds">
      <div class="assistant-reroll-title">Probabilités ${helpButton(HELP_TEXT.rerollOdds)}</div>
      ${rerollOddsRow("Reroll équipe", rerollOdds.team, baselinePlayerName)}
      ${rerollOddsRow("Reroll décennie", rerollOdds.decade, baselinePlayerName)}
    </div>
  `;
}

function rerollOddsRow(label: string, rate: RerollHitRate, baselinePlayerName: string): string {
  if (!rate.available) {
    return `
      <p>
        <span>${escapeHtml(label)}</span>
        <strong>utilisé</strong>
      </p>
    `;
  }

  if (rate.totalRolls === 0) {
    return `
      <p>
        <span>${escapeHtml(label)}</span>
        <strong>n/d</strong>
      </p>
    `;
  }

  return `
    <p>
      <span>${escapeHtml(label)}</span>
      <strong>${formatPercent(rate.probability)} meilleur que ${escapeHtml(baselinePlayerName)}</strong>
      <em>${rate.betterRolls}/${rate.totalRolls} tirages</em>
    </p>
  `;
}

function rosterCard(roster: GameState["roster"]): string {
  const rows = POSITION_ORDER.map((position) => {
    const player = roster[position];
    return `
      <li>
        <span class="assistant-roster-pos">${escapeHtml(position)}</span>
        <span class="assistant-roster-name">${escapeHtml(player?.name ?? "Libre")}</span>
      </li>
    `;
  }).join("");

  return `
    <section class="assistant-card">
      ${cardTitle("Équipe", HELP_TEXT.roster)}
      <ul class="assistant-roster">${rows}</ul>
    </section>
  `;
}

function gapsCard(gaps: string[]): string {
  const items = gaps.length > 0
    ? gaps.map((gap) => `<li>${escapeHtml(gap)}</li>`).join("")
    : "<li>Aucun</li>";

  return `
    <section class="assistant-card">
      ${cardTitle("Manques", HELP_TEXT.gaps)}
      <ul class="assistant-gaps">${items}</ul>
    </section>
  `;
}

function formatWins(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function pickImpactWins(recommendation: CandidateRecommendation): number {
  return recommendation.withPickWins - recommendation.currentWins;
}

function formatDelta(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatWins(value)}`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)} %`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
