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
