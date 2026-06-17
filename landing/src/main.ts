import releaseData from "../../releases.json";

const releases = releaseData.releases;

function getLatestDownloadableRelease() {
  return releases.find((release) => release.downloadUrl) ?? releases[0];
}

function setText(selector: string, value: string) {
  document.querySelectorAll(selector).forEach((element) => {
    element.textContent = value;
  });
}

function setHref(selector: string, href: string | undefined) {
  if (!href) {
    return;
  }

  document.querySelectorAll<HTMLAnchorElement>(selector).forEach((element) => {
    element.href = href;
  });
}

function renderReleaseList(container: HTMLElement) {
  container.replaceChildren(
    ...releases.map((release) => {
      const article = document.createElement("article");
      article.className = "release-card";

      const changes = Object.values(release.changes)
        .flatMap((items) => items ?? [])
        .slice(0, 3)
        .map((item) => `<li>${item}</li>`)
        .join("");

      article.innerHTML = `
        <div class="release-card-header">
          <span>${release.tag}</span>
          <time datetime="${release.date}">${release.date}</time>
        </div>
        <h3>${release.title}</h3>
        <p>${release.summary}</p>
        <ul>${changes}</ul>
        <a href="${release.releaseUrl}" rel="noreferrer">Voir la release</a>
      `;

      return article;
    })
  );
}

function renderReleaseData() {
  const latest = releases[0];
  const latestDownload = getLatestDownloadableRelease();

  setText("[data-release-version]", latest.tag);
  setText("[data-release-date]", latest.date);
  setHref("[data-release-download]", latestDownload.downloadUrl);
  setHref("[data-release-url]", latest.releaseUrl);

  const releaseList = document.querySelector<HTMLElement>("#release-list");
  if (releaseList) {
    renderReleaseList(releaseList);
  }
}

renderReleaseData();
