# GitHub Issues for Paseo

A [Paseo](https://paseo.sh) plugin that lists a project's open GitHub issues, laid out like github.com, and creates a worktree workspace for one with a single press, optionally with an agent working on it.

See [OVERVIEW.md](OVERVIEW.md) for how it finds issues, names branches, and detects existing workspaces.

## Requirements

- Paseo 0.11.2 or later, with plugins enabled on the daemon.
- The GitHub CLI (`gh`) on the daemon host, signed in with `gh auth login`.
- Your repositories added to Paseo as projects, with a github.com remote.

## Develop

```bash
npm install
npm run typecheck
npm test
paseo plugin install "$PWD"
# after edits
paseo plugin reload issues-workspaces
paseo plugin logs issues-workspaces
```

## License

MIT
