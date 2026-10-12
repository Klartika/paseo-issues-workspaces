GitHub Issues lists a project's open GitHub issues and creates a workspace for any of them with one press. Open it from the sidebar or the Command Center.

## The screen

When you have more than one GitHub project, a row of tabs at the top picks the one to show. Below it are that project's open issues, newest first, up to 100 of them.

Each issue shows its title and number and a **Create workspace** button. Tapping an issue's title opens it on GitHub.

## How it finds projects

The plugin looks at every git project on the host and reads its `origin` remote. A project is included when that remote points at github.com; projects without one are left out.

A new workspace is a worktree titled `#<number> <issue title>`, on a new branch `issue/<number>-<slug>` taken from a freshly fetched copy of the repository's default branch.

## Setup

The daemon host needs the GitHub CLI (`gh`) installed and signed in with `gh auth login`, using an account that can read the repositories. Requires Paseo 0.11.2 or later.

## Access and limits

The plugin runs `gh` and `git` on the daemon host as the signed-in user. It reads issues from GitHub and never writes to GitHub. Creating a workspace runs `git fetch` for the default branch and creates a local branch and worktree.

Only github.com is supported; GitHub Enterprise remotes are skipped. The list shows the newest 100 open issues.
