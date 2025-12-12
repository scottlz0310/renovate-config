# renovate-config

Renovateの設定を一元管理するためのリポジトリ

各言語・環境（Python, Node.js, TypeScript, Docker, C#, C++, Rust, Go）に対応した設定と、プロジェクト毎の部分的な調整設定（プリセット）を提供します。

## クイックスタート

### CLI ツールで自動設定（推奨）

```bash
# npx で実行（推奨: グローバルに入れない）
npx -y @scottlz0310/renovate-config-init

# グローバルインストール
npm install -g @scottlz0310/renovate-config-init

# プロジェクトディレクトリで実行
cd your-project
renovate-config-init
```

CLIがプロジェクト構成を自動検出し、最適な `renovate.json` を生成します。

```
◆ Renovate Config Initializer

● Detected structure:
  ./                        (project root)
  ├── package.json         → Node.js
  ├── tsconfig.json        → TypeScript
  └── Dockerfile           → Docker

◆ Select Languages:
  ☑ Node.js      (detected)
  ☑ TypeScript   (detected)
  ☑ Docker       (detected)

◆ Select Tools:
  ☑ Pre-commit   (detected)

◆ Select Options:
  ☑ Auto-merge

✓ Created ./renovate.json
```

### 手動設定

プロジェクトのルートディレクトリに `renovate.json` を作成：

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

## 対応言語・環境

| 言語/環境 | プリセット | 説明 |
|----------|-----------|------|
| Node.js | `languages/nodejs` | npm/pnpm パッケージ |
| TypeScript | `languages/typescript` | TypeScript 関連 |
| Python | `languages/python` | uv/pyproject.toml |
| Docker | `languages/docker` | Dockerfile, docker-compose |
| Go | `languages/go` | Go modules |
| Rust | `languages/rust` | Cargo |
| C# | `languages/csharp` | NuGet, .NET |
| C++ | `languages/cpp` | Conan, vcpkg, CMake |

## ツール

| ツール | プリセット | 説明 |
|-------|-----------|------|
| Pre-commit | `tools/precommit` | Pre-commit hooks |

## オプション

| オプション | プリセット | 説明 |
|-----------|-----------|------|
| Automerge | `options/automerge` | minor/patch の自動マージ |
| Schedule | `options/schedule` | スケジュール更新 (月曜 3am JST) |
| Security | `options/security` | セキュリティ更新を優先 |
| Production | `options/production` | 本番環境向け保守的設定 |
| Monorepo | `options/monorepo` | モノレポ対応設定 |

## 使用例

### Python + Docker + セキュリティ重視

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "github>scottlz0310/renovate-config//presets/default",
    "github>scottlz0310/renovate-config//presets/languages/python",
    "github>scottlz0310/renovate-config//presets/languages/docker",
    "github>scottlz0310/renovate-config//presets/options/security"
  ]
}
```

### Node.js + 自動マージ + スケジュール

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "github>scottlz0310/renovate-config//presets/default",
    "github>scottlz0310/renovate-config//presets/languages/nodejs",
    "github>scottlz0310/renovate-config//presets/languages/typescript",
    "github>scottlz0310/renovate-config//presets/options/automerge",
    "github>scottlz0310/renovate-config//presets/options/schedule"
  ]
}
```

## CLI オプション

```bash
# インタラクティブモード（デフォルト）
renovate-config-init

# 検出されたプリセットを自動適用
renovate-config-init --yes

# ドライラン（ファイルを作成せずプレビュー）
renovate-config-init --dry-run

# プリセットを指定（例: nodejs,typescript,automerge）
renovate-config-init --presets nodejs,typescript,automerge

# 出力先を指定（ファイル or ディレクトリ）
renovate-config-init --output ./config/renovate.json

# ヘルプ
renovate-config-init --help
```

## デフォルト設定

`presets/default.json` には以下が含まれます：

- セマンティックコミットの有効化
- 依存関係ダッシュボードの有効化
- マイナー・パッチ更新の分離
- 脆弱性アラートの有効化
- タイムゾーン: Asia/Tokyo

## ライセンス

MIT License

## 貢献

Issues や Pull Requests を歓迎します。
