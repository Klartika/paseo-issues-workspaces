GitHub Issues lists a project's open GitHub issues and creates a workspace for any of them with one press. Open it from the sidebar or the Command Center.

## The screen

When you have more than one GitHub project, a row of tabs at the top picks the one to show. Below it are that project's open issues, newest first, up to 100 of them.

Each issue shows its title and number and a **Create workspace** button, or **Open workspace** when a workspace already covers it. Tapping an issue's title opens it on GitHub.

## How it finds projects

The plugin looks at every git project on the host and reads its remotes. A project is included when a remote points at github.com. When a project has several remotes, it uses the one picked with `gh repo set-default`, then `upstream`, then `origin`, so a fork shows the upstream repository's issues. Projects without a github.com remote are left out. Several projects on the same repository, such as a checkout and a linked worktree, appear once, under the main checkout.

A new workspace is a worktree titled `#<number> <issue title>`, on a new branch `issue/<number>-<slug>` taken from a freshly fetched copy of the repository's default branch.

An issue counts as covered when a workspace in any project on the same repository has a title starting with `#<number>`, or a branch that starts with the branch prefix and the number, or contains `<number>-` after a slash. When a local branch exists for an issue but no workspace does, for example after archiving one, the plugin shows the branch and does not create a second one.

## Setup

The daemon host needs the GitHub CLI (`gh`) installed and signed in with `gh auth login`, using an account that can read the repositories. Requires Paseo 0.11.2 or later.

## Settings

Open the settings from **Settings → Plugins**:

- **Branch prefix**: the start of new branch names. Defaults to `issue/`.

The selected project is saved with this setting. Settings are stored on each host and shared by every client connected to it.

## Access and limits

The plugin runs `gh` and `git` on the daemon host as the signed-in user. It reads issues from GitHub and never writes to GitHub. Creating a workspace runs `git fetch` for the default branch and creates a local branch and worktree.

Only github.com is supported; GitHub Enterprise remotes are skipped. The list shows the newest 100 open issues.
