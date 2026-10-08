import { projects } from "./projects.js";

const icon = (name) =>
  `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"/></svg>`;
const external = 'target="_blank" rel="noopener noreferrer"';
const dialog = document.querySelector("#project-dialog");
const grid = document.querySelector("#project-grid");
let packages = [];
let returnFocus;
let currentProjectId;
let previewDownloads = new Set();
const storeAction = (project) =>
  project.store
    ? `<a class="project-action store-action" href="${project.store}" ${external}>Chrome 商店 ${icon("external")}</a>`
    : "";

grid.innerHTML = projects
  .map(
    (project) => `
  <article class="project-card" id="project-${project.id}" data-category="${project.category}">
    <div class="project-art art-${project.id}"><span class="art-category">${project.categoryLabel}</span>${project.art}</div>
    <div class="project-content">
      <div class="project-heading"><h3>${project.name}</h3>${icon(project.icon)}</div>
      <p class="project-kicker">${project.codeName}</p>
      <p class="project-description">${project.description}</p>
      <div class="project-tags">${project.tags.map((tag) => `<span>${tag}</span>`).join("")}</div>
      ${project.store && !project.storeAvailable ? '<p class="store-status">商店暂不可用 · 2026-10-08 核验</p>' : ""}
      <div class="project-actions"><div class="project-primary-actions">${storeAction(project)}<button class="project-action" data-open="${project.id}">${project.store ? (project.id === "highlighter" ? "详情" : "详情与助手") : "项目与安装包"} ${icon("arrow")}</button></div><a class="source-link" href="${project.source}" ${external} aria-label="${project.name} GitHub 源码，需仓库访问权限">${icon("github")} GitHub <small>需权限</small></a></div>
    </div>
  </article>`,
  )
  .join("");

document.querySelector("#download-list").innerHTML = projects
  .map(
    (project) => `
  <div class="download-row"><div class="download-name"><span class="download-icon">${icon(project.icon)}</span><span><strong>${project.name}</strong><small data-release-summary="${project.id}">${project.store ? (project.storeAvailable ? "Chrome 应用商店" : "商店暂不可用") : "查看平台与安装说明"}</small></span></div><div class="download-controls">${project.store ? `<a class="download-button" href="${project.store}" ${external}>${project.storeAvailable ? "Chrome 商店" : "查看商店"} ${icon("external")}</a>${project.id !== "highlighter" ? `<button class="helper-button" data-open="${project.id}" aria-label="下载 ${project.name} 本地助手">本地助手</button>` : ""}` : `<button class="download-button" data-open="${project.id}" aria-label="选择 ${project.name} 安装包">选择安装包 ${icon("download")}</button>`}</div></div>`,
  )
  .join("");

const filterButtons = [...document.querySelectorAll("[data-filter]")];
function filterProjects(category) {
  filterButtons.forEach((button) => {
    const active = button.dataset.filter === category;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  let count = 0;
  grid.querySelectorAll(".project-card").forEach((card) => {
    card.hidden = category !== "all" && card.dataset.category !== category;
    if (!card.hidden) count++;
  });
  document.querySelector("#filter-status").textContent = `显示 ${count} 个项目`;
}
filterButtons.forEach((button) =>
  button.addEventListener("click", () => filterProjects(button.dataset.filter)),
);

document.querySelectorAll(".satellite").forEach((button) => {
  button.addEventListener("click", () => {
    const project = projects.find((item) => item.id === button.dataset.project);
    document.querySelectorAll(".satellite").forEach((satellite) => {
      const active = satellite === button;
      satellite.classList.toggle("active", active);
      satellite.setAttribute("aria-pressed", String(active));
    });
    document.querySelector("#preview-title").textContent = project.name;
    document.querySelector("#preview-text").textContent = project.tagline;
    document.querySelector("#orbit-preview").href = `#project-${project.id}`;
  });
});
document
  .querySelector("#orbit-preview")
  .addEventListener("click", () => filterProjects("all"));

const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
function renderPackage(item) {
  const preview =
    location.hostname === "127.0.0.1" &&
    previewDownloads.has(item.previewUrl) &&
    item.previewUrl;
  const target = item.url || preview;
  let action = '<span class="package-pending">待公开下载</span>';
  if (target) {
    const url = new URL(target, location.href);
    if (
      url.protocol === "https:" ||
      (preview && url.origin === location.origin)
    ) {
      action = `<a class="download-button" href="${escapeHtml(url.href)}" ${external}>${item.url ? "下载" : "本地下载"} ${icon("download")}</a>`;
    }
  }
  return `<div class="package-item"><span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.version)} · ${escapeHtml(item.platform)} · ${escapeHtml(item.sizeLabel)}</small></span>${action}</div>${item.sha256 ? `<details class="package-checksum"><summary>SHA-256 校验值</summary><code>${escapeHtml(item.sha256)}</code></details>` : ""}`;
}
function renderProject(id) {
  const project = projects.find((item) => item.id === id);
  if (!project) return;
  const available = packages.filter((item) => item.project === id);
  document.querySelector("#dialog-content").innerHTML = `
    <span class="dialog-project-icon">${icon(project.icon)}</span><p class="eyebrow">${project.categoryLabel}</p><h2 id="dialog-title">${project.name}</h2>
    <p class="dialog-description">${project.description}</p><ul class="dialog-features">${project.features.map((feature) => `<li>${feature}</li>`).join("")}</ul>
    ${project.store ? `<h3 class="dialog-section-title">Chrome 扩展</h3><a class="button primary" href="${project.store}" ${external}>${project.storeAvailable ? "前往 Chrome 应用商店" : "查看商店页面"} ${icon("external")}</a>${!project.storeAvailable ? '<p class="store-status">商店暂不可用，当前无法通过商店安装。</p>' : ""}` : ""}
    ${available.length ? `<h3 class="dialog-section-title">${project.store ? "本地助手安装包" : "安装包"}</h3>${available.map(renderPackage).join("")}` : !project.store ? '<p class="package-note">安装包信息暂不可用，你可以先查看项目源码。</p>' : ""}
    <p class="package-note">${project.installNote}</p>
    <div class="dialog-links"><a class="text-link" href="${project.source}" ${external}>GitHub 源码（需访问权限） ${icon("external")}</a>${project.docs ? `<a class="text-link" href="${project.docs}" ${external}>公开使用与安装说明 ${icon("external")}</a>` : ""}</div>`;
}
function openProject(id) {
  if (!projects.some((project) => project.id === id)) return;
  renderProject(id);
  currentProjectId = id;
  returnFocus = document.activeElement;
  dialog.showModal();
}
document
  .querySelectorAll("[data-open]")
  .forEach((button) =>
    button.addEventListener("click", () => openProject(button.dataset.open)),
  );
document
  .querySelector(".dialog-close")
  .addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
dialog.addEventListener("close", () => {
  currentProjectId = null;
  returnFocus?.focus({ preventScroll: true });
});
document.querySelector("#year").textContent = new Date().getFullYear();

try {
  const response = await fetch("./releases.json");
  if (!response.ok) throw new Error("Release data unavailable");
  const release = await response.json();
  packages = release.packages;
  if (location.hostname === "127.0.0.1") {
    try {
      const preview = await fetch("./preview-config.json");
      if (preview.ok)
        previewDownloads = new Set((await preview.json()).downloads);
    } catch {}
  }
  for (const project of projects) {
    const available = packages.filter((item) => item.project === project.id);
    if (available.length && !project.store)
      document.querySelector(
        `[data-release-summary="${project.id}"]`,
      ).textContent = available
        .map((item) => `${item.version} · ${item.platform}`)
        .join(" / ");
  }
  if (dialog.open) {
    renderProject(currentProjectId);
  }
} catch {
  projects
    .filter((project) => !project.store)
    .forEach((project) => {
      document.querySelector(
        `[data-release-summary="${project.id}"]`,
      ).textContent = "安装包信息暂不可用 · 可查看源码";
    });
}
