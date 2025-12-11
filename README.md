# renovate-config

Renovateの設定を一元管理するためのリポジトリ

各言語・環境（Python, Node.js, TypeScript, Docker, C#, C++, Rust, Go）に対応した設定と、プロジェクト毎の部分的な調整設定（プリセット）を提供します。

## 概要

このリポジトリは、Renovate Bot の設定を一元管理し、複数のプロジェクトで再利用可能な設定プリセットを提供します。

## 対応言語・環境

以下の言語・環境に対応したプリセットを提供しています：

- **Python** - uv (modern Python package manager)
- **Node.js** - pnpm (modern Node.js package manager)
- **TypeScript** - TypeScript関連の依存関係 (pnpm compatible)
- **Docker** - Dockerfile, docker-compose
- **C#** - NuGet, .NET
- **C++** - Conan, vcpkg, CMake
- **Rust** - Cargo
- **Go** - Go modules
- **Pre-commit** - Pre-commit hooks

**Note:** このリポジトリはモダンなツールチェーンを採用しています。Pythonはuv、Node.js/TypeScriptはpnpmのみをサポートします。

## プリセット一覧

### 言語別プリセット

| プリセット名 | 説明 | 設定ファイル |
|------------|------|------------|
| `python` | Python プロジェクト向け設定 | `presets/languages/python.json` |
| `nodejs` | Node.js プロジェクト向け設定 | `presets/languages/nodejs.json` |
| `typescript` | TypeScript プロジェクト向け設定 | `presets/languages/typescript.json` |
| `docker` | Docker プロジェクト向け設定 | `presets/languages/docker.json` |
| `csharp` | C# (.NET) プロジェクト向け設定 | `presets/languages/csharp.json` |
| `cpp` | C++ プロジェクト向け設定 | `presets/languages/cpp.json` |
| `rust` | Rust プロジェクト向け設定 | `presets/languages/rust.json` |
| `go` | Go プロジェクト向け設定 | `presets/languages/go.json` |
| `precommit` | Pre-commit hooks 向け設定 | `precommit.json` |

### プロジェクト別調整プリセット

| プリセット名 | 説明 | 設定ファイル |
|------------|------|------------|
| `security` | セキュリティアップデートを優先 | `presets/projects/security.json` |
| `automerge` | 自動マージを有効化 | `presets/projects/automerge.json` |
| `schedule` | スケジュールベースの更新 | `presets/projects/schedule.json` |
| `monorepo` | モノレポ対応設定 | `presets/projects/monorepo.json` |
| `production` | 本番環境向け安全な設定 | `presets/projects/production.json` |

## 使い方

### 基本的な使い方

プロジェクトのルートディレクトリに `renovate.json` を作成し、使用したいプリセットを指定します。

#### 例1: Python プロジェクト

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "github>scottlz0310/renovate-config",
    "github>scottlz0310/renovate-config:python"
  ]
}
```

#### 例2: Node.js + TypeScript プロジェクト

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

#### 例3: Docker プロジェクト

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "github>scottlz0310/renovate-config",
    "github>scottlz0310/renovate-config:docker"
  ]
}
```

#### 例4: Pre-commit を使用するプロジェクト

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "github>scottlz0310/renovate-config",
    "github>scottlz0310/renovate-config:precommit"
  ]
}
```

### 複数のプリセットを組み合わせる

言語別プリセットとプロジェクト別プリセットを組み合わせることができます。

#### 例5: Python + Docker + セキュリティ重視

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

#### 例6: Node.js + 自動マージ + スケジュール設定

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

#### 例7: Go + Docker + 本番環境向け設定

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

#### 例8: Python + Pre-commit

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "github>scottlz0310/renovate-config",
    "github>scottlz0310/renovate-config:python",
    "github>scottlz0310/renovate-config:precommit"
  ]
}
```

### カスタマイズ

プリセットを拡張して、プロジェクト固有の設定を追加することもできます。

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

## サンプル設定

`examples/` ディレクトリに、様々な言語・環境に対応したサンプル設定ファイルを用意しています。

- `renovate-python.json` - Python プロジェクト
- `renovate-nodejs-typescript.json` - Node.js + TypeScript プロジェクト
- `renovate-docker.json` - Docker プロジェクト
- `renovate-go.json` - Go プロジェクト
- `renovate-rust.json` - Rust プロジェクト
- `renovate-csharp.json` - C# プロジェクト
- `renovate-cpp.json` - C++ プロジェクト
- `renovate-python-docker-security.json` - 複合例
- `renovate-nodejs-automerge-schedule.json` - 複合例
- `renovate-production-go-docker.json` - 本番環境向け例

## デフォルト設定

基本設定（`default.json`）には以下の設定が含まれています：

- セマンティックコミットの有効化
- 依存関係ダッシュボードの有効化
- マイナー・パッチ更新の分離
- 脆弱性アラートの有効化
- タイムゾーン: Asia/Tokyo

## ライセンス

MIT License

## 貢献

Issues や Pull Requests を歓迎します。
