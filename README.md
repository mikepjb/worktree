# Worktree

<p align="center">
  <img src="./icons/tree-rooted-wide.svg" alt="Worktree tree icon" width="192">
</p>

_This project aims to make taskwarrior tasks and plain markdown notes available
in git via mobile._

It's relatively niche, but I spend 95% of my time with a computer between a
browser and the terminal. This means all the tools I use tend to be terminal
based and also are able to store state in a plain text manner.

## MVP version

1. PWA, public client hosted on github pages that accepts github read-only API
   key for private repo access which is stored on the client only.

3. Provide a way to view tasks, ordered by +next tag, due date and urgency

4. Side bar/hamburger menu to show:
    - 'Tasks' at the top of the menu to see tasks view
    - everything else is based on the structure of the git repo i.e like
      vscode/ide/nerdtree side bar showing folders and markdown files, clicking
      one changes the main view to show the content of that markdown file.

## Development

Start the local server with:

```sh
make dev
```

Install the pinned test dependencies and Playwright's Chromium build once, then
run the browser integration tests:

```sh
make test-setup
make test
```

Use `make test-headed` to watch the tests run in a browser window.

## Deploy to GitHub Pages

The `Deploy to GitHub Pages` workflow runs the browser tests and publishes the
static app when changes are pushed to `main` (or when manually dispatched).
Enable Pages once in the repository settings:

1. Open **Settings → Pages**.
2. Set **Build and deployment → Source** to **GitHub Actions**.
3. Push to `main`, then open the workflow run to find the deployed URL.

After deployment, open **Sync / Settings** in Worktree and enter the repository
owner, name, branch, and (for a private repository) a fine-grained GitHub token
with **Contents: read-only** access to that repository. Worktree validates the
access and stores the token in the browser's IndexedDB; do not put it in the
repository, workflow, or URL. The public Pages site contains no token.
