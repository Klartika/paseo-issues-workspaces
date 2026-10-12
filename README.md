# GitHub Issues for Paseo

A [Paseo](https://paseo.sh) plugin that adds a GitHub Issues screen, opened from the sidebar or the Command Center. The screen is empty so far.

## Requirements

- Paseo 0.11.2 or later, with plugins enabled on the daemon.

## Develop

```bash
npm install
npm run typecheck
paseo plugin install "$PWD"
# after edits
paseo plugin reload issues-workspaces
paseo plugin logs issues-workspaces
```

## License

MIT
