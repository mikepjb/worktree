# Build plan

## Foundation

- [x] Create `index.html`, `styles.css`, `app.js`, `sw.js`, and `manifest.webmanifest`.
- [x] Add app icons and use relative URLs so GitHub Pages subpaths work.
- [x] Vendor HTMX and a safe Markdown renderer; disable raw HTML.
- [x] Register the service worker and handle its first-load activation.

## Offline storage

- [x] Add IndexedDB stores for settings, repository snapshots, and inbox items.
- [x] Precache the app shell in the service worker with a versioned cache.
- [x] Add internal routes for tasks, notes, the file tree, inbox, and refresh.

## GitHub sync

- [x] Add settings for repository owner, name, branch, and read-only token.
- [x] Validate settings with a test GitHub API request.
- [x] Fetch the repository tree and retain only `tasks.json` and Markdown files.
- [x] Download changed files by blob SHA and reuse unchanged cached files.
- [x] Replace the local snapshot only after a complete successful refresh.
- [x] Show offline state and the last successful refresh time.

## Interface

- [x] Add responsive navigation with a persistent desktop menu and mobile drawer.
- [x] Add Phosphor icons, global task/inbox counts, and a collapsible note tree.
- [x] Add search across task descriptions, note paths, and note content.
- [x] Add persisted System/Light/Dark appearance and independent palettes.
- [x] Render active, completed, and all task filters; order by `+next`, due date, project, and description.
- [x] Add the local inbox: create, copy all, remove, and clear.
- [x] Add focused browser tests for search, sorting, menu behavior, and appearance options.

## Ship and verify

- [x] Add browser integration tests for routes, IndexedDB, app-shell caching, and offline reloads.
- [x] Add a GitHub Pages deployment workflow that tests before deploy.
- [x] Test in Chromium on localhost.
- [ ] Test from the installed mobile PWA.
- [ ] Sync once, enable airplane mode, restart the app, and verify all tasks and notes remain available.
- [ ] Verify inbox items survive restart and can be copied and cleared offline.
- [ ] Verify no token is present in source, URLs, logs, or deployed assets.
