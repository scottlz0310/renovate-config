# renovate-config

Centralized Repository for Renovate Configuration Management

This repository provides configurations for various languages and environments (Python, Node.js, TypeScript, Docker, C#, C++, Rust, Go) and project-specific adjustment presets.

## Overview

This repository centralizes Renovate Bot configurations and provides reusable configuration presets for multiple projects.

## Supported Languages & Environments

Presets are available for the following languages and environments:

- **Python** - uv (modern Python package manager)
- **Node.js** - pnpm (modern Node.js package manager)
- **TypeScript** - TypeScript-related dependencies (pnpm compatible)
- **Docker** - Dockerfile, docker-compose
- **C#** - NuGet, .NET
- **C++** - Conan, vcpkg, CMake
- **Rust** - Cargo
- **Go** - Go modules

**Note:** This repository adopts modern toolchains. Python supports uv only, Node.js/TypeScript supports pnpm only.

## Available Presets

### Language-specific Presets

| Preset Name | Description | Configuration File |
|------------|-------------|-------------------|
| `python` | Python project configuration | `presets/languages/python.json` |
| `nodejs` | Node.js project configuration | `presets/languages/nodejs.json` |
| `typescript` | TypeScript project configuration | `presets/languages/typescript.json` |
| `docker` | Docker project configuration | `presets/languages/docker.json` |
| `csharp` | C# (.NET) project configuration | `presets/languages/csharp.json` |
| `cpp` | C++ project configuration | `presets/languages/cpp.json` |
| `rust` | Rust project configuration | `presets/languages/rust.json` |
| `go` | Go project configuration | `presets/languages/go.json` |

### Project-specific Adjustment Presets

| Preset Name | Description | Configuration File |
|------------|-------------|--------------------|
| `security` | Prioritize security updates | `presets/projects/security.json` |
| `automerge` | Enable automatic merging | `presets/projects/automerge.json` |
| `schedule` | Schedule-based updates | `presets/projects/schedule.json` |
| `monorepo` | Monorepo configuration | `presets/projects/monorepo.json` |
| `production` | Production-safe configuration | `presets/projects/production.json` |

## Usage

### Basic Usage

Create a `renovate.json` file in your project root and specify the presets you want to use.

#### Example 1: Python Project

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "github>scottlz0310/renovate-config",
    "github>scottlz0310/renovate-config:python"
  ]
}
```

#### Example 2: Node.js + TypeScript Project

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "github>scottlz0310/renovate-config",
    "github>scottlz0310/renovate-config:nodejs",
    "github>scottlz0310/renovate-config:typescript"
  ]
}
```

#### Example 3: Docker Project

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "github>scottlz0310/renovate-config",
    "github>scottlz0310/renovate-config:docker"
  ]
}
```

### Combining Multiple Presets

You can combine language-specific and project-specific presets.

#### Example 4: Python + Docker + Security Focus

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "github>scottlz0310/renovate-config",
    "github>scottlz0310/renovate-config:python",
    "github>scottlz0310/renovate-config:docker",
    "github>scottlz0310/renovate-config:security"
  ]
}
```

#### Example 5: Node.js + Auto-merge + Schedule

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "github>scottlz0310/renovate-config",
    "github>scottlz0310/renovate-config:nodejs",
    "github>scottlz0310/renovate-config:typescript",
    "github>scottlz0310/renovate-config:automerge",
    "github>scottlz0310/renovate-config:schedule"
  ]
}
```

#### Example 6: Go + Docker + Production Configuration

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "github>scottlz0310/renovate-config",
    "github>scottlz0310/renovate-config:go",
    "github>scottlz0310/renovate-config:docker",
    "github>scottlz0310/renovate-config:production"
  ]
}
```

### Customization

You can extend presets with project-specific configurations.

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "github>scottlz0310/renovate-config",
    "github>scottlz0310/renovate-config:nodejs"
  ],
  "packageRules": [
    {
      "matchPackageNames": ["express"],
      "enabled": false
    }
  ]
}
```

## Example Configurations

The `examples/` directory contains sample configuration files for various languages and environments:

- `renovate-python.json` - Python project
- `renovate-nodejs-typescript.json` - Node.js + TypeScript project
- `renovate-docker.json` - Docker project
- `renovate-go.json` - Go project
- `renovate-rust.json` - Rust project
- `renovate-csharp.json` - C# project
- `renovate-cpp.json` - C++ project
- `renovate-python-docker-security.json` - Combined example
- `renovate-nodejs-automerge-schedule.json` - Combined example
- `renovate-production-go-docker.json` - Production-focused example

## Default Configuration

The base configuration (`default.json`) includes:

- Semantic commits enabled
- Dependency dashboard enabled
- Separate minor and patch updates
- Vulnerability alerts enabled
- Timezone: Asia/Tokyo

## License

MIT License

## Contributing

Issues and Pull Requests are welcome.
