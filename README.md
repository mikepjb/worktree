# Worktree

_This project aims to make taskwarrior tasks and plain markdown notes available
in git via mobile._

It's relatively niche, but I spend 95% of my time with a computer between a
browser and the terminal. This means all the tools I use tend to be terminal
based and also are able to store state in a plain text manner.

## MVP version

1. What should this be?
    - expo/react-native app?
    - web app/pwa?
    - something else?

2. Provide a way to auth (dedicated SSH key for github access, entered in
   worktree app UI)

3. Provide a way to view tasks, ordered by +next tag, due date and urgency

4. Side bar/hamburger menu to show:
    - 'Tasks' at the top of the menu to see tasks view
    - everything else is based on the structure of the git repo i.e like
      vscode/ide/nerdtree side bar showing folders and markdown files, clicking
      one changes the main view to show the content of that markdown file.

### Notes

- Taskwarrior tasks available as tasks.json in base of repo
- Markdown has no set structure and changes over time potentially
- There are other files in my notes repo (where all of the markdown + tasks.json
  is stored). These should be ignored at least for this MVP version.
