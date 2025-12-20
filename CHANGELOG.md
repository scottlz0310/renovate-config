# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-12-20

### Changed

- **Breaking Change**: Simplified repository structure from monorepo to single-package structure
- CLI source moved to root directory (`src/` instead of `packages/cli/src/`)
- Package name changed to `@scottlz0310/renovate-config-init` (at root level)
- Removed workspace configuration (`pnpm-workspace.yaml`)

### Added

- Direct installation from GitHub now supported: `pnpm add -g git+https://github.com/scottlz0310/renovate-config.git`

### Migration Guide

- **npm registry users**: No changes required - package name and functionality remain the same
- **Local developers**: Re-clone the repository and run `pnpm install`
- **GitHub preset users**: No changes required - preset paths remain unchanged (`github>scottlz0310/renovate-config//presets/...`)

## [1.0.0] - 2025-01-19

### Added

#### Core Features
- 🎉 Initial release of renovate-config
- Centralized Renovate configuration management for multi-language projects
- Shareable preset system with `github>scottlz0310/renovate-config//presets/` format

#### Language Support
- **Node.js** - npm/pnpm package management (`languages/nodejs`)
- **TypeScript** - TypeScript-specific configurations (`languages/typescript`)
- **Python** - uv/pyproject.toml support (`languages/python`)
- **Docker** - Dockerfile and docker-compose updates (`languages/docker`)
- **Go** - Go modules management (`languages/go`)
- **Rust** - Cargo dependencies (`languages/rust`)
- **C#** - NuGet and .NET packages (`languages/csharp`)
- **C++** - Conan, vcpkg, and CMake support (`languages/cpp`)

#### Tool Support
- **Pre-commit** - Pre-commit hooks management (`tools/precommit`)
- **Lefthook** - Git hooks manager support (`tools/lefthook`)

#### Options
- **Automerge** - Automatic merging for minor/patch updates (`options/automerge`)
- **Schedule** - Scheduled updates (Monday 3am JST) (`options/schedule`)
- **Security** - Security-focused update prioritization (`options/security`)
- **Production** - Conservative settings for production environments (`options/production`)
- **Monorepo** - Monorepo-optimized configurations (`options/monorepo`)

#### CLI Tool
- **renovate-config-init** - Interactive CLI for automatic configuration generation
  - Auto-detection of project structure (languages, tools, frameworks)
  - Interactive preset selection with detected defaults
  - Support for `--yes`, `--dry-run`, `--presets`, and `--output` options
  - Generates optimized `renovate.json` based on project analysis

#### Default Configuration
- Semantic commits enabled
- Dependency dashboard enabled
- Separate minor and patch updates
- Vulnerability alerts enabled
- Timezone: Asia/Tokyo

#### Documentation
- Comprehensive README in Japanese and English
- CONTRIBUTING.md with development guidelines
- SECURITY.md for security reporting
- MIT License

#### Development Infrastructure
- **pnpm** - Package manager (migrated from npm)
- Biome for linting and formatting
- Lefthook for Git hooks
- Knip for dead code detection
- GitHub Actions for CI/CD
- Automated preset validation
- Renovate self-hosting configuration

### Changed
- Migrated package manager from npm to pnpm
- Updated all documentation to reflect pnpm usage
- Updated GitHub Actions workflows to use pnpm

[1.0.0]: https://github.com/scottlz0310/renovate-config/releases/tag/v1.0.0
