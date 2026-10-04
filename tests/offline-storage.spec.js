const { test, expect } = require("@playwright/test");

async function openApp(page, route = "tasks") {
  await page.goto(`/#/${route}`);
  await expect(page.locator("#app")).toHaveAttribute("aria-busy", "false");
}

async function waitForServiceWorker(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
}

test("internal routes render their offline-backed views", async ({ page }) => {
  await openApp(page);
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  await expect(page.getByText("No cached tasks yet")).toBeVisible();

  await page.goto("/#/files");
  await expect(page.locator("#app")).toHaveAttribute("aria-busy", "false");
  await expect(page.getByRole("heading", { name: "Notes" })).toBeVisible();

  await page.getByRole("link", { name: "Inbox" }).click();
  await expect(page.getByText("Your local inbox is empty")).toBeVisible();

  await page.getByRole("link", { name: "Sync / Settings" }).click();
  await expect(page.getByRole("heading", { name: "Sync / Settings" })).toBeVisible();
});

test("task badges, filtering, ordering, search, and appearance settings work", async ({ page }) => {
  await openApp(page);
  await page.evaluate(async () => {
    const futureWait = new Date(Date.now() + 86400000).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    await window.worktreeStorage.replaceSnapshot("example/notes@main", {
      tasks: [
        { description: "Z project task", status: "pending", project: "work", due: "20261201T000000Z" },
        { description: "B next task", status: "pending", tags: ["next"] },
        { description: "A due next", status: "pending", due: "20261101T000000Z" },
        { description: "Recurring thing", status: "pending", recur: "weekly" },
        { description: "Someday next", status: "pending", project: "someday", tags: ["next"], due: "20261005T000000Z" },
        { description: "Future recurring", status: "pending", recur: "weekly", wait: futureWait },
        { description: "Future regular", status: "pending", wait: futureWait },
        { description: "Recurring template", status: "recurring", recur: "weekly", wait: "20260801T000000Z" },
        { description: "Done item", status: "completed" },
      ],
      files: [{ path: "guides/search.md", content: "Look up searchable phrase here." }],
    });
    await window.worktreeStorage.addInboxItem("Inbox counter");
  });
  await page.reload();
  await expect(page.locator('[data-count="tasks"]')).toHaveText("5");
  await expect(page.locator('[data-count="inbox"]')).toHaveText("1");
  await expect(page.locator(".task-list")).toHaveCSS("padding-left", "0px");
  const tasks = page.locator(".task-description");
  await expect(tasks).toHaveText(["B next task", "A due next", "Z project task", "Recurring thing", "Someday next"]);
  await page.locator(".project-filter summary").click();
  await page.getByLabel("work", { exact: true }).uncheck();
  await expect(page.getByText("Z project task")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Z project task")).toHaveCount(0);
  await page.getByRole("button", { name: "Completed" }).click();
  await expect(tasks).toHaveText(["Done item"]);
  await page.getByRole("button", { name: "All" }).click();
  await expect(page.getByText("Future recurring")).toBeVisible();
  await expect(page.getByText("Future regular")).toBeVisible();
  await expect(page.getByText("Recurring template")).toHaveCount(0);
  await page.locator("#desktop-search input").fill("searchable phrase");
  await expect(page.getByRole("link", { name: "guides/search.md" })).toBeVisible();
  await page.goto("/#/refresh");
  await page.locator('select[name="mode"]').selectOption("dark");
  await page.locator('select[name="darkPalette"]').selectOption("sepia");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-palette", "sepia");
  await expect(page.locator(".desktop-brand img")).toHaveAttribute("src", /tree-mark-dark\.svg$/);
  await expect(page.locator('select[name="lightPalette"] option')).toHaveCount(5);
  await expect(page.locator('select[name="darkPalette"] option')).toHaveCount(6);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/tasks");
  await page.locator("#search-toggle").click();
  await expect(page.locator("#mobile-search")).toBeVisible();
  await page.locator("#menu-toggle").click();
  await expect(page.locator("#mobile-search")).toBeHidden();
  await expect(page.locator("#menu")).toHaveClass(/is-open/);
});

test("settings are saved and retrieved from IndexedDB", async ({ page }) => {
  await openApp(page);

  const settings = await page.evaluate(async () => {
    await window.worktreeStorage.saveSettings({
      owner: "example",
      repository: "notes",
      branch: "main",
      token: "read-only-token",
    });
    return window.worktreeStorage.getSettings();
  });

  expect(settings).toEqual({
    owner: "example",
    repository: "notes",
    branch: "main",
    token: "read-only-token",
  });
});

test("a failed snapshot replacement preserves the previous snapshot", async ({
  page,
}) => {
  await openApp(page);

  const result = await page.evaluate(async () => {
    const repositoryId = "example/notes@main";
    await window.worktreeStorage.replaceSnapshot(repositoryId, {
      tasks: [{ description: "Keep this task" }],
      files: [],
    });

    let replacementFailed = false;
    try {
      await window.worktreeStorage.replaceSnapshot(repositoryId, {
        tasks: [{ description: "Incomplete task" }],
        uncloneableValue: () => {},
      });
    } catch {
      replacementFailed = true;
    }

    return {
      replacementFailed,
      snapshot: await window.worktreeStorage.getSnapshot(repositoryId),
    };
  });

  expect(result.replacementFailed).toBe(true);
  expect(result.snapshot.tasks).toEqual([{ description: "Keep this task" }]);
});

test("inbox items persist across reload and can be removed and cleared", async ({
  page,
}) => {
  await openApp(page, "inbox");

  const ids = await page.evaluate(async () => {
    const first = await window.worktreeStorage.addInboxItem("First item");
    const second = await window.worktreeStorage.addInboxItem("Second item");
    return { first: first.id, second: second.id };
  });

  await page.reload();
  await expect(page.getByText("First item")).toBeVisible();
  await expect(page.getByText("Second item")).toBeVisible();
  await expect(page.locator(".item-list")).toHaveCSS("padding-left", "0px");
  await expect(page.locator(".item-list .task-row").first()).toHaveCSS("padding-left", "0px");

  await page.evaluate(async (id) => {
    await window.worktreeStorage.removeInboxItem(id);
  }, ids.first);
  await page.reload();
  await expect(page.getByText("First item")).toHaveCount(0);
  await expect(page.getByText("Second item")).toBeVisible();

  await page.evaluate(() => window.worktreeStorage.clearInbox());
  await page.reload();
  await expect(page.getByText("Your local inbox is empty")).toBeVisible();
});

test("notes render Markdown without enabling raw HTML", async ({ page }) => {
  await openApp(page);

  await page.evaluate(() =>
    window.worktreeStorage.replaceSnapshot("example/notes@main", {
      tasks: [],
      files: [
        {
          path: "projects/example.md",
          content: "# Safe heading\n\n<script id=\"unsafe\">bad()</script>",
        },
      ],
    }),
  );

  await page.goto("/#/files");
  await page.getByRole("button", { name: /projects/ }).click();
  await page.getByRole("link", { name: "example.md" }).click();
  await expect(page.getByRole("heading", { name: "Safe heading" })).toBeVisible();
  await expect(page.locator("#unsafe")).toHaveCount(0);
  await expect(page.locator("article")).toContainText("<script");
});

test("the versioned app shell contains every offline dependency", async ({
  page,
}) => {
  await openApp(page);
  await waitForServiceWorker(page);

  const cacheState = await page.evaluate(async () => {
    const names = await caches.keys();
    const cache = await caches.open("worktree-shell-v6");
    const paths = (await cache.keys()).map((request) => new URL(request.url).pathname);
    return { names, paths };
  });

  expect(cacheState.names).toContain("worktree-shell-v6");
  expect(cacheState.paths).toEqual(
    expect.arrayContaining([
      "/",
      "/index.html",
      "/styles.css",
      "/vendor/phosphor/regular.css",
      "/vendor/phosphor/Phosphor.woff2",
      "/app.js",
      "/storage.js",
      "/github-sync.js",
      "/manifest.webmanifest",
      "/icons/icon-192.png",
      "/icons/icon-512.png",
      "/icons/icon-maskable-512.png",
      "/icons/tree-mark.svg",
      "/icons/tree-mark-dark.svg",
      "/vendor/htmx.min.js",
      "/vendor/markdown-it.min.js",
      "/vendor/alpine.min.js",
      "/vendor/fonts/InterVariable.woff2",
      "/vendor/fonts/InterVariable-Italic.woff2",
    ]),
  );
});

test("cached data remains available after an offline reload", async ({
  context,
  page,
}) => {
  await openApp(page, "inbox");
  await waitForServiceWorker(page);
  await page.evaluate(() =>
    window.worktreeStorage.addInboxItem("Available without a connection"),
  );
  await page.reload();
  await expect(page.getByText("Available without a connection")).toBeVisible();

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
  await expect(page.getByText("Available without a connection")).toBeVisible();
});
