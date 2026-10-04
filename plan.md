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

- [ ] Add settings for repository owner, name, branch, and read-only token.
- [ ] Validate settings with a test GitHub API request.
- [ ] Fetch the repository tree and retain only `tasks.json` and Markdown files.
- [ ] Download changed files by blob SHA and reuse unchanged cached files.
- [ ] Replace the local snapshot only after a complete successful refresh.
- [ ] Show offline state and the last successful refresh time.

## Interface

- [ ] Render tasks ordered by `+next`, due date, and urgency.
- [ ] Render a folder/file sidebar and Markdown note view.
- [ ] Add the local inbox: create, copy all, remove, and clear.
- [ ] Add loading, empty, authentication, sync, and offline error states.
- [ ] Add controls to clear credentials and all local data.

## Ship and verify

- [x] Add browser integration tests for routes, IndexedDB, app-shell caching, and offline reloads.
- [ ] Add a GitHub Pages deployment workflow.
- [x] Test in Chromium on localhost.
- [ ] Test from the installed mobile PWA.
- [ ] Sync once, enable airplane mode, restart the app, and verify all tasks and notes remain available.
- [ ] Verify inbox items survive restart and can be copied and cleared offline.
- [ ] Verify no token is present in source, URLs, logs, or deployed assets.
