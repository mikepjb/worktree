const markdown = window.markdownit({
  html: false,
  linkify: true,
  typographer: false,
});

const storage = window.worktreeStorage;
const outlet = document.querySelector("#app");
const navigationLinks = [...document.querySelectorAll("[data-route]")];

function element(tagName, options = {}) {
  const node = document.createElement(tagName);

  if (options.className) {
    node.className = options.className;
  }
  if (options.text !== undefined) {
    node.textContent = options.text;
  }
  if (options.href) {
    node.href = options.href;
  }

  return node;
}

function page(title, description) {
  const fragment = document.createDocumentFragment();
  fragment.append(element("h1", { text: title }));

  if (description) {
    fragment.append(
      element("p", { className: "page-description", text: description }),
    );
  }

  return fragment;
}

function emptyState(message) {
  return element("p", { className: "empty-state", text: message });
}

async function latestSnapshot() {
  return storage.getLatestSnapshot();
}

async function renderTasks() {
  const content = page("Tasks", "Tasks from the most recent repository snapshot.");
  const snapshot = await latestSnapshot();
  const tasks = snapshot?.tasks ?? [];

  if (tasks.length === 0) {
    content.append(emptyState("No cached tasks yet. Refresh a repository first."));
    return content;
  }

  const list = element("ul", { className: "item-list" });
  for (const task of tasks) {
    list.append(
      element("li", {
        text: task.description ?? task.title ?? "Untitled task",
      }),
    );
  }
  content.append(list);
  return content;
}

function noteUrl(path) {
  return `#/notes/${path.split("/").map(encodeURIComponent).join("/")}`;
}

async function renderFiles() {
  const content = page("Files", "Markdown files in the cached repository.");
  const snapshot = await latestSnapshot();
  const files = snapshot?.files ?? [];

  if (files.length === 0) {
    content.append(emptyState("No cached Markdown files yet."));
    return content;
  }

  const list = element("ul", { className: "file-list" });
  for (const file of files) {
    const item = element("li");
    item.append(
      element("a", {
        href: noteUrl(file.path),
        text: file.path,
      }),
    );
    list.append(item);
  }
  content.append(list);
  return content;
}

async function renderNote(path) {
  const content = page(path || "Note");
  const snapshot = await latestSnapshot();
  const file = snapshot?.files?.find((candidate) => candidate.path === path);

  if (!file) {
    content.append(emptyState("This note is not available in the cached snapshot."));
    return content;
  }

  const note = element("article", { className: "note" });
  note.innerHTML = markdown.render(file.content ?? "");
  content.append(note);
  return content;
}

async function renderInbox() {
  const content = page("Inbox", "Items saved locally on this device.");
  const items = await storage.listInboxItems();

  if (items.length === 0) {
    content.append(emptyState("Your local inbox is empty."));
    return content;
  }

  const list = element("ul", { className: "item-list" });
  for (const item of items) {
    list.append(element("li", { text: item.text }));
  }
  content.append(list);
  return content;
}

function renderRefresh() {
  const content = page("Refresh", "Repository synchronization will live here.");
  content.append(
    emptyState("Configure GitHub sync before refreshing the cached snapshot."),
  );
  return content;
}

function renderNotFound() {
  const content = page("Not found");
  const message = emptyState("That Worktree page does not exist. ");
  message.append(element("a", { href: "#/tasks", text: "Go to tasks." }));
  content.append(message);
  return content;
}

function parseRoute() {
  const hash = window.location.hash;
  if (!hash || hash === "#" || hash === "#/") {
    return { name: "tasks" };
  }

  const path = hash.startsWith("#/") ? hash.slice(2) : hash.slice(1);
  if (path === "tasks" || path === "files" || path === "inbox") {
    return { name: path };
  }
  if (path === "refresh") {
    return { name: "refresh" };
  }
  if (path === "notes") {
    return { name: "files" };
  }
  if (path.startsWith("notes/")) {
    try {
      return {
        name: "note",
        path: path
          .slice("notes/".length)
          .split("/")
          .map(decodeURIComponent)
          .join("/"),
      };
    } catch {
      return { name: "not-found" };
    }
  }

  return { name: "not-found" };
}

function updateNavigation(route) {
  const activeRoute = route.name === "note" ? "files" : route.name;

  for (const link of navigationLinks) {
    if (link.dataset.route === activeRoute) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  }
}

async function renderRoute() {
  const route = parseRoute();
  updateNavigation(route);
  outlet.setAttribute("aria-busy", "true");

  try {
    let content;
    switch (route.name) {
      case "tasks":
        content = await renderTasks();
        break;
      case "files":
        content = await renderFiles();
        break;
      case "note":
        content = await renderNote(route.path);
        break;
      case "inbox":
        content = await renderInbox();
        break;
      case "refresh":
        content = renderRefresh();
        break;
      default:
        content = renderNotFound();
    }
    outlet.replaceChildren(content);
  } catch (error) {
    console.error("Unable to render route:", error);
    const content = page("Something went wrong");
    content.append(
      emptyState("Worktree could not read its local data. Try reloading the app."),
    );
    outlet.replaceChildren(content);
  } finally {
    outlet.setAttribute("aria-busy", "false");
  }
}

window.addEventListener("hashchange", renderRoute);
renderRoute();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./sw.js", {
        scope: "./",
      });

      await navigator.serviceWorker.ready;
      console.info("Service worker ready:", registration.scope);
    } catch (error) {
      console.error("Service worker registration failed:", error);
    }
  });
}
