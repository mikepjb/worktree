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

  await page.getByRole("link", { name: "Files" }).click();
  await expect(page).toHaveURL(/#\/files$/);
  await expect(page.getByRole("heading", { name: "Files" })).toBeVisible();

  await page.getByRole("link", { name: "Inbox" }).click();
  await expect(page.getByText("Your local inbox is empty")).toBeVisible();

  await page.getByRole("link", { name: "Refresh" }).click();
  await expect(page.getByRole("heading", { name: "GitHub sync" })).toBeVisible();
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
  await page.getByRole("link", { name: "projects/example.md" }).click();
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
    const cache = await caches.open("worktree-shell-v2");
    const paths = (await cache.keys()).map((request) => new URL(request.url).pathname);
    return { names, paths };
  });

  expect(cacheState.names).toContain("worktree-shell-v2");
  expect(cacheState.paths).toEqual(
    expect.arrayContaining([
      "/",
      "/index.html",
      "/styles.css",
      "/app.js",
      "/storage.js",
      "/github-sync.js",
      "/manifest.webmanifest",
      "/icons/icon-192.png",
      "/icons/icon-512.png",
      "/icons/icon-maskable-512.png",
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
