# renovate-config

Centralized Renovate configuration presets for multi-language projects.

This repository provides:
- Reusable presets under `presets/` (languages/tools/options)
- A CLI to generate `renovate.json` automatically

## Quick Start

### Generate `renovate.json` with the CLI (recommended)

```bash
# Run via pnpm dlx (recommended)
# Note: if you see a 404, the package may be unpublished/private or you may not have access.
pnpm dlx @scottlz0310/renovate-config-init

# If you're running from this repository (local development)
pnpm install
pnpm run dev

# Install globally (from npm registry)
pnpm add -g @scottlz0310/renovate-config-init

# Install directly from GitHub
pnpm add -g git+https://github.com/scottlz0310/renovate-config.git

# Then run in your project
cd your-project
renovate-config-init
```

The CLI detects your project structure and guides you through:
1) Languages
2) Tools
3) Options

### Manual setup

Create `renovate.json` in your project root:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "github>scottlz0310/renovate-config//presets/default",
    "github>scottlz0310/renovate-config//presets/languages/nodejs",
    "github>scottlz0310/renovate-config//presets/languages/typescript"
  ]
}
```

## Presets

### Languages

Use: `github>scottlz0310/renovate-config//presets/languages/<name>`

- `nodejs`
- `typescript`
- `python`
- `docker`
- `go`
- `rust`
- `csharp`
- `cpp`

### Tools

Use: `github>scottlz0310/renovate-config//presets/tools/<name>`

- `precommit`
- `lefthook`

### Options

Use: `github>scottlz0310/renovate-config//presets/options/<name>`

- `automerge`
- `schedule`
- `security`
- `production`
- `monorepo`

## CLI Options

```bash
# Interactive mode (default)
renovate-config-init

# Apply detected presets without prompting
renovate-config-init --yes

# Dry run (preview without writing files)
renovate-config-init --dry-run

# Specify presets (e.g. nodejs,typescript,automerge)
renovate-config-init --presets nodejs,typescript,automerge

# Specify output path (file or directory)
renovate-config-init --output ./config/renovate.json
```

## License

MIT License
