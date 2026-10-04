const markdown = window.markdownit({ html: false, linkify: true, typographer: false });
const storage = window.worktreeStorage;
const outlet = document.querySelector("#app");
const menu = document.querySelector("#menu");
const tree = document.querySelector("#note-tree");
const expandedFolders = new Set();
let taskFilter = "active";
let liveSearchStarted = false;
const appearanceKey = "worktree-appearance";

function element(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.href) node.href = options.href;
  return node;
}
function icon(name) {
  const node = element("i", { className: `ph ph-${name}` });
  node.setAttribute("aria-hidden", "true");
  return node;
}
function page(title, description) {
  const fragment = document.createDocumentFragment();
  fragment.append(element("h1", { text: title }));
  if (description) fragment.append(element("p", { className: "page-description", text: description }));
  return fragment;
}
function emptyState(message) { return element("p", { className: "empty-state", text: message }); }
function noteUrl(path) { return `#/notes/${path.split("/").map(encodeURIComponent).join("/")}`; }
function latestSnapshot() { return storage.getLatestSnapshot(); }

function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, "");
  if (!raw || raw === "tasks") return { name: "tasks" };
  if (["inbox", "refresh"].includes(raw)) return { name: raw };
  if (raw === "files" || raw === "notes") return { name: "files" };
  if (raw.startsWith("search?")) return { name: "search", query: new URLSearchParams(raw.slice(7)).get("q") ?? "" };
  if (raw.startsWith("notes/")) {
    try { return { name: "note", path: raw.slice(6).split("/").map(decodeURIComponent).join("/") }; }
    catch { return { name: "not-found" }; }
  }
  return { name: "not-found" };
}
function updateNavigation(route) {
  for (const link of document.querySelectorAll("[data-route]")) {
    const active = route.name === "note" || route.name === "files" ? false : link.dataset.route === route.name;
    if (active) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
  }
}

function buildTree(files) {
  tree.replaceChildren();
  const root = { folders: new Map(), files: [] };
  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    let node = root;
    for (const part of parts.slice(0, -1)) {
      if (!node.folders.has(part)) node.folders.set(part, { folders: new Map(), files: [] });
      node = node.folders.get(part);
    }
    node.files.push({ name: parts.at(-1), path: file.path });
  }
  function appendContents(parent, node, prefix = "") {
    for (const [name, child] of [...node.folders].sort(([a], [b]) => a.localeCompare(b))) {
      const path = prefix ? `${prefix}/${name}` : name;
      const folder = element("div", { className: "tree-folder-wrap" });
      const button = element("button", { className: "tree-folder" });
      button.type = "button";
      button.setAttribute("aria-expanded", String(expandedFolders.has(path)));
      button.append(icon("caret-right"), icon("folder"), element("span", { text: name }));
      const children = element("div", { className: "tree-children" });
      children.hidden = !expandedFolders.has(path);
      button.addEventListener("click", () => {
        if (expandedFolders.has(path)) expandedFolders.delete(path); else expandedFolders.add(path);
        button.setAttribute("aria-expanded", String(expandedFolders.has(path)));
        children.hidden = !expandedFolders.has(path);
      });
      folder.append(button, children);
      appendContents(children, child, path);
      parent.append(folder);
    }
    for (const file of node.files.sort((a, b) => a.name.localeCompare(b.name))) {
      const link = element("a", { className: "tree-file", href: noteUrl(file.path) });
      link.append(icon("file-text"), element("span", { text: file.name }));
      if (parseRoute().path === file.path) link.setAttribute("aria-current", "page");
      parent.append(link);
    }
  }
  appendContents(tree, root);
}

async function renderTasks() {
  const snapshot = await latestSnapshot();
  const tasks = snapshot?.tasks ?? [];
  const active = tasks.filter((task) => ["pending", "recurring"].includes(task.status));
  const completed = tasks.filter((task) => task.status === "completed");
  const sorted = (taskFilter === "active" ? active : taskFilter === "completed" ? completed : [...active, ...completed]).sort((a, b) => {
    const next = (task) => task.tags?.includes("next") ? 1 : 0;
    if (next(a) !== next(b)) return next(b) - next(a);
    const dueA = a.due || "99999999999999", dueB = b.due || "99999999999999";
    if (dueA !== dueB) return dueA.localeCompare(dueB);
    const projectA = a.project ? 1 : 0, projectB = b.project ? 1 : 0;
    if (projectA !== projectB) return projectB - projectA;
    return String(a.description ?? "").localeCompare(String(b.description ?? ""), undefined, { sensitivity: "base" });
  });
  const content = page("Tasks", `${active.length} active tasks`);
  const filters = element("div", { className: "task-filters" });
  for (const [key, label] of [["active", "Active"], ["completed", "Completed"], ["all", "All"]]) {
    const button = element("button", { text: label });
    button.type = "button"; button.setAttribute("aria-pressed", String(taskFilter === key));
    button.addEventListener("click", () => { taskFilter = key; renderRoute(); });
    filters.append(button);
  }
  content.append(filters);
  if (!sorted.length) { content.append(emptyState(snapshot ? "No tasks in this filter." : "No cached tasks yet. Sync a repository first.")); return content; }
  const list = element("ul", { className: "task-list" });
  for (const task of sorted) {
    const row = element("li", { className: `task-row${task.start ? " is-started" : ""}${task.status === "completed" ? " is-completed" : ""}` });
    const description = element("span", { className: "task-description", text: task.description ?? "Untitled task" });
    const meta = element("span", { className: "task-meta" });
    if (task.tags?.includes("next")) meta.append(element("span", { className: "task-tag", text: "+next" }));
    if (task.start) meta.append(element("span", { className: "task-tag", text: "In progress" }));
    if (task.status === "recurring") meta.append(element("span", { className: "task-tag", text: "Recurring" }));
    if (task.project) meta.append(element("span", { text: task.project }));
    if (task.due) meta.append(element("time", { text: task.due.slice(0, 8) }));
    row.append(description, meta); list.append(row);
  }
  content.append(list); return content;
}
async function renderFiles() {
  const snapshot = await latestSnapshot();
  const content = page("Notes", "Choose a note from the menu.");
  if (!snapshot?.files?.length) content.append(emptyState("No cached Markdown notes yet."));
  else content.append(element("p", { className: "empty-state", text: `${snapshot.files.length} notes available in the menu.` }));
  return content;
}
async function renderNote(path) {
  const snapshot = await latestSnapshot();
  const file = snapshot?.files?.find((candidate) => candidate.path === path);
  const content = page(file?.path.split("/").at(-1) ?? "Note");
  if (!file) { content.append(emptyState("This note is not available in the cached snapshot.")); return content; }
  const article = element("article", { className: "note" });
  article.innerHTML = markdown.render(file.content ?? "");
  content.append(article); return content;
}
async function renderInbox() {
  const items = await storage.listInboxItems();
  const content = page("Inbox", `${items.length} items saved on this device.`);
  const form = element("form", { className: "inbox-form" });
  const input = element("textarea"); input.name = "text"; input.placeholder = "Capture a thought…"; input.setAttribute("aria-label", "Inbox item"); input.required = true;
  const add = element("button", { className: "primary-button", text: "Add" }); add.type = "submit";
  form.append(input, add);
  form.addEventListener("submit", async (event) => { event.preventDefault(); await storage.addInboxItem(input.value); renderRoute(); });
  content.append(form);
  if (!items.length) { content.append(emptyState("Your local inbox is empty.")); return content; }
  const actions = element("div", { className: "inbox-actions" });
  const copy = element("button", { text: "Copy all" }); copy.type = "button";
  copy.addEventListener("click", async () => { await navigator.clipboard.writeText(items.map((item) => item.text).join("\n")); });
  const clear = element("button", { text: "Clear inbox" }); clear.type = "button";
  clear.addEventListener("click", async () => { if (confirm("Clear all inbox items?")) { await storage.clearInbox(); renderRoute(); } });
  actions.append(copy, clear); content.append(actions);
  const list = element("ul", { className: "item-list" });
  for (const item of items) {
    const row = element("li", { className: "task-row" }); row.append(element("span", { className: "task-description", text: item.text }));
    const remove = element("button", { className: "icon-button" }); remove.append(icon("x")); remove.type = "button"; remove.setAttribute("aria-label", "Remove inbox item");
    remove.addEventListener("click", async () => { await storage.removeInboxItem(item.id); renderRoute(); });
    row.append(remove); list.append(row);
  }
  content.append(list); return content;
}

async function renderRefresh() {
  const content = page("Sync / Settings", "Sync tasks and notes from GitHub. Your token stays in this browser.");
  const settings = await storage.getSettings();
  const form = element("form", { className: "sync-form" });
  for (const [name, title, type] of [["owner", "Owner", "text"], ["repository", "Repository", "text"], ["branch", "Branch", "text"], ["token", "Read-only token (optional for public repos)", "password"]]) {
    const label = element("label", { text: title }); const input = element("input"); input.name = name; input.type = type; input.required = name !== "token"; input.autocomplete = type === "password" ? "new-password" : "off";
    if (name !== "token") input.value = settings?.[name] ?? "";
    if (name === "token") input.placeholder = settings?.token ? "Saved; leave blank to keep" : "Contents: read permission";
    label.append(input); form.append(label);
  }
  const actions = element("div", { className: "sync-actions" }); const save = element("button", { className: "primary-button", text: "Validate and save" }); save.type = "submit";
  const refresh = element("button", { text: "Refresh now" }); refresh.type = "button"; refresh.dataset.refresh = "true"; actions.append(save, refresh); form.append(actions);
  const status = element("p", { className: "sync-status" }); status.setAttribute("role", "status"); form.append(status);
  form.addEventListener("submit", async (event) => { event.preventDefault(); await submitSettings(form, status); });
  refresh.addEventListener("click", () => runRefresh(form, status)); content.append(form);
  const snapshot = settings ? await storage.getSnapshot(window.worktreeGitHub.repositoryId(settings)) : undefined;
  content.append(element("p", { className: "sync-meta", text: snapshot ? `Last successful refresh: ${new Date(snapshot.storedAt).toLocaleString()}${navigator.onLine ? "" : " (offline)"}` : (navigator.onLine ? "No successful refresh yet." : "Offline — cached snapshots remain available.") }));
  const section = element("section", { className: "settings-section" }); section.append(element("h2", { text: "Appearance" }));
  const appearance = JSON.parse(localStorage.getItem(appearanceKey) || "{}");
  const mode = settingsSelect("Appearance", "mode", [["system", "System"], ["light", "Light"], ["dark", "Dark"]], appearance.mode ?? "system");
  const light = settingsSelect("Light palette", "lightPalette", [["white", "White"], ["sepia", "Sepia"], ["mist", "Mist"], ["sage", "Sage"], ["rose", "Rose"]], appearance.lightPalette ?? "white");
  const dark = settingsSelect("Dark palette", "darkPalette", [["charcoal", "Charcoal"], ["black", "Black"], ["sepia", "Sepia"], ["forest", "Forest"], ["midnight", "Midnight"], ["plum", "Plum"]], appearance.darkPalette ?? "charcoal");
  for (const control of [mode, light, dark]) { control.select.addEventListener("change", () => { appearance[control.select.name] = control.select.value; localStorage.setItem(appearanceKey, JSON.stringify(appearance)); applyTheme(); }); section.append(control.label); }
  content.append(section);
  const dataActions = element("section", { className: "settings-section" }); dataActions.append(element("h2", { text: "Local data" }));
  const clearToken = element("button", { text: "Clear GitHub credentials" }); clearToken.type = "button"; clearToken.addEventListener("click", async () => { if (confirm("Remove saved GitHub credentials?")) { await storage.clearSettings(); renderRoute(); } });
  const clearData = element("button", { text: "Clear all local data" }); clearData.type = "button"; clearData.addEventListener("click", async () => { if (confirm("Delete credentials, cached snapshots, inbox items, and appearance preferences?")) { await storage.clearAllData(); localStorage.removeItem(appearanceKey); applyTheme(); renderRoute(); } });
  dataActions.append(clearToken, clearData); content.append(dataActions); return content;
}
function settingsSelect(title, name, options, value) {
  const label = element("label", { className: "settings-control", text: title }); const select = element("select"); select.name = name;
  for (const [optionValue, optionLabel] of options) { const option = element("option", { text: optionLabel }); option.value = optionValue; select.append(option); }
  select.value = value; label.append(select); return { label, select };
}
async function collectSettings(form) {
  const data = new FormData(form), current = await storage.getSettings();
  return { owner: String(data.get("owner")).trim(), repository: String(data.get("repository")).trim(), branch: String(data.get("branch")).trim(), token: String(data.get("token")).trim() || current?.token || "" };
}
async function submitSettings(form, status) {
  const button = form.querySelector('button[type="submit"]'); button.disabled = true; status.textContent = "Checking repository access…";
  try { const settings = await collectSettings(form); await window.worktreeGitHub.validate(settings); await storage.saveSettings(settings); form.elements.token.value = ""; status.textContent = "Repository access verified and settings saved on this device."; }
  catch (error) { status.textContent = error.message || "Unable to validate GitHub settings."; } finally { button.disabled = false; }
}
async function runRefresh(form, status) {
  const button = form.querySelector("[data-refresh]"); button.disabled = true; status.textContent = "Fetching repository…";
  try { const settings = await collectSettings(form); await window.worktreeGitHub.validate(settings); const id = window.worktreeGitHub.repositoryId(settings); const previous = await storage.getSnapshot(id); const snapshot = await window.worktreeGitHub.sync(settings, previous); await storage.saveSettings(settings); await storage.replaceSnapshot(id, snapshot); form.elements.token.value = ""; status.textContent = `Refresh complete: ${snapshot.tasks.length} tasks and ${snapshot.files.length} notes.`; renderRoute(); }
  catch (error) { status.textContent = error.message || "Refresh failed. The previous snapshot was kept."; } finally { button.disabled = false; }
}
async function renderSearch(query) {
  const content = page("Search", query ? `Results for “${query}”` : "Search tasks and notes.");
  if (!query.trim()) { content.append(emptyState("Enter a search term to find tasks and notes.")); return content; }
  const snapshot = await latestSnapshot(), needle = query.toLocaleLowerCase(); const results = [];
  for (const task of snapshot?.tasks ?? []) if (String(task.description ?? "").toLocaleLowerCase().includes(needle)) results.push({ title: task.description ?? "Task", type: "Task", href: "#/tasks", text: task.description ?? "" });
  for (const file of snapshot?.files ?? []) {
    const pathMatch = file.path.toLocaleLowerCase().includes(needle), lines = String(file.content ?? "").split(/\r?\n/); const matching = lines.find((line) => line.toLocaleLowerCase().includes(needle));
    if (pathMatch || matching) results.push({ title: file.path, type: "Note", href: noteUrl(file.path), text: matching ?? file.path });
  }
  if (!results.length) { content.append(emptyState("No matching tasks or notes.")); return content; }
  const list = element("ul", { className: "search-results" });
  for (const result of results) { const li = element("li", { className: "search-result" }); const a = element("a", { href: result.href, text: result.title }); const type = element("small", { text: result.type }); const snippet = element("p", { text: result.text }); li.append(a, type, snippet); list.append(li); }
  content.append(list); return content;
}
async function renderRoute() {
  const route = parseRoute(); updateNavigation(route); outlet.setAttribute("aria-busy", "true");
  try {
    const snapshot = await latestSnapshot(); buildTree(snapshot?.files ?? []);
    const inbox = await storage.listInboxItems(); document.querySelector('[data-count="inbox"]').textContent = String(inbox.length);
    const tasks = (snapshot?.tasks ?? []).filter((task) => ["pending", "recurring"].includes(task.status)); document.querySelector('[data-count="tasks"]').textContent = String(tasks.length);
    let content;
    switch (route.name) {
      case "tasks": content = await renderTasks(); break;
      case "files": content = await renderFiles(); break;
      case "note": content = await renderNote(route.path); break;
      case "inbox": content = await renderInbox(); break;
      case "refresh": content = await renderRefresh(); break;
      case "search": content = await renderSearch(route.query); break;
      default: content = page("Not found", "That Worktree page does not exist.");
    }
    outlet.replaceChildren(content);
  } catch (error) { console.error("Unable to render route:", error); outlet.replaceChildren(page("Something went wrong", "Worktree could not read local data. Try reloading.")); }
  finally { outlet.setAttribute("aria-busy", "false"); }
}
function closeMenu() { menu.classList.remove("is-open"); document.querySelector("#menu-toggle").setAttribute("aria-expanded", "false"); document.querySelector("#menu-backdrop").hidden = true; }
function openMenu() { menu.classList.add("is-open"); document.querySelector("#menu-toggle").setAttribute("aria-expanded", "true"); document.querySelector("#menu-backdrop").hidden = false; }
function updateSearch(form, push = false) {
  const query = String(new FormData(form).get("q") ?? "").trim();
  const hash = `#/search?q=${encodeURIComponent(query)}`;
  if (push) history.pushState(null, "", hash);
  else history.replaceState(null, "", hash);
  renderRoute();
}
function submitSearch(form) {
  if (!liveSearchStarted && parseRoute().name !== "search") updateSearch(form, true);
  liveSearchStarted = false;
  document.querySelector("#mobile-search").hidden = true;
  closeMenu();
}
function applyTheme() {
  const settings = JSON.parse(localStorage.getItem(appearanceKey) || "{}"); const systemDark = matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = settings.mode === "system" || !settings.mode ? (systemDark ? "dark" : "light") : settings.mode;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.palette = theme === "dark" ? (settings.darkPalette ?? "charcoal") : (settings.lightPalette ?? "white");
  for (const logo of document.querySelectorAll(".brand img")) {
    logo.src = theme === "dark" ? "./icons/tree-mark-dark.svg" : "./icons/tree-mark.svg";
  }
}
document.querySelector("#menu-toggle").addEventListener("click", () => menu.classList.contains("is-open") ? closeMenu() : openMenu());
document.querySelector("#menu-backdrop").addEventListener("click", closeMenu);
outlet.addEventListener("click", closeMenu);
for (const form of document.querySelectorAll("#desktop-search,#mobile-search")) {
  form.addEventListener("submit", (event) => { event.preventDefault(); submitSearch(form); });
  form.elements.q.addEventListener("input", () => {
    const firstSearchInput = !liveSearchStarted && parseRoute().name !== "search";
    liveSearchStarted = true;
    updateSearch(form, firstSearchInput);
  });
}
document.querySelector("#search-toggle").addEventListener("click", () => { const form = document.querySelector("#mobile-search"); form.hidden = !form.hidden; if (!form.hidden) form.elements.q.focus(); });
document.addEventListener("click", (event) => {
  const searchForm = document.querySelector("#mobile-search");
  if (!searchForm.hidden && !searchForm.contains(event.target) && !document.querySelector("#search-toggle").contains(event.target)) searchForm.hidden = true;
});
window.addEventListener("hashchange", () => { liveSearchStarted = false; closeMenu(); renderRoute(); });
window.addEventListener("storage", applyTheme);
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applyTheme);
applyTheme(); renderRoute();
if ("serviceWorker" in navigator) window.addEventListener("load", async () => { try { const registration = await navigator.serviceWorker.register("./sw.js", { scope: "./" }); await navigator.serviceWorker.ready; console.info("Service worker ready:", registration.scope); } catch (error) { console.error("Service worker registration failed:", error); } });
