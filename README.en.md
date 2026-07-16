# renovate-config

Centralized Renovate configuration presets for multi-language projects.

This repository provides:

- Reusable presets under `presets/` (languages/package-managers/tools/options)
- A CLI to generate `renovate.json` automatically

## Quick Start

### Generate `renovate.json` with the CLI (recommended)

```bash
# Run via bunx (recommended)
# Note: if you see a 404, the package may be unpublished/private or you may not have access.
bunx @scottlz0310/renovate-config-init

# If you're running from this repository (local development)
bun install
bun run dev

# Install globally (from npm registry)
bun add --global @scottlz0310/renovate-config-init

# Install directly from GitHub
bun add --global git+https://github.com/scottlz0310/renovate-config.git

# Then run in your project
cd your-project
renovate-config-init
```

The CLI detects your project structure and guides you through:
1) Languages
2) Package managers
3) Tools
4) Options

### Manual setup

Create `renovate.json` in your project root:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "github>scottlz0310/renovate-config//presets/default",
    "github>scottlz0310/renovate-config//presets/languages/nodejs",
    "github>scottlz0310/renovate-config//presets/languages/typescript",
    "github>scottlz0310/renovate-config//presets/package-managers/npm"
  ]
}
```

## Presets

### Languages

Use: `github>scottlz0310/renovate-config//presets/languages/<name>`

- `nodejs`
- `nodejs-major` — opt-in preset to enable Node.js major version updates (engines/nvm/nodenv/Docker)
- `typescript`
- `android`
- `python`
- `docker`
- `go`
- `rust`
- `csharp`
- `cpp`

### Package managers

Use: `github>scottlz0310/renovate-config//presets/package-managers/<name>`

- `npm` — detected from `package-lock.json`
- `pnpm` — detected from `pnpm-lock.yaml`
- `bun` — detected from `bun.lock` or legacy `bun.lockb`; also updates `.bun-version`

Corepack and Renovate do not support updating Bun through the `package.json` `packageManager` field. Use `.bun-version` with the `package-managers/bun` preset instead. Prefer the text-based `bun.lock` format for new projects.

For a Node.js and TypeScript repository using Bun, commit `bun.lock` and `.bun-version`, then extend all four presets:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "github>scottlz0310/renovate-config//presets/default",
    "github>scottlz0310/renovate-config//presets/languages/nodejs",
    "github>scottlz0310/renovate-config//presets/languages/typescript",
    "github>scottlz0310/renovate-config//presets/package-managers/bun"
  ]
}
```

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

## Node.js Major Version Updates (opt-in)

The `languages/nodejs-major` preset enables Node.js major version updates, which are disabled by default in Renovate.

- Bumps the `engines.node` range in `package.json` (e.g. `>=22` → `>=24`)
- Enables major updates in `.nvmrc` and `.node-version`
- Enables major updates for Docker base images (`node`, `library/node`)

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "github>scottlz0310/renovate-config//presets/default",
    "github>scottlz0310/renovate-config//presets/languages/nodejs",
    "github>scottlz0310/renovate-config//presets/languages/nodejs-major"
  ]
}
```

## CLI Options

```bash
# Interactive mode (default)
renovate-config-init

# Apply detected presets without prompting
renovate-config-init --yes

# Dry run (preview without writing files)
renovate-config-init --dry-run

# Specify presets (e.g. nodejs,pnpm,typescript,automerge)
renovate-config-init --presets nodejs,pnpm,typescript,automerge

# Specify output path (file or directory)
renovate-config-init --output ./config/renovate.json
```

## License

MIT License
