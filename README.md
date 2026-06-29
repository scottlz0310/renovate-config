# renovate-config

Renovateの設定を一元管理するためのリポジトリ

各言語・環境（Python, Node.js, TypeScript, Android, Docker, C#, C++, Rust, Go）に対応した設定と、プロジェクト毎の部分的な調整設定（プリセット）を提供します。

## クイックスタート

### CLI ツールで自動設定（推奨）

```bash
# pnpm dlx で実行（推奨: グローバルに入れない）
# ※ npm で 404 になる場合: パッケージが未公開/非公開、または権限がありません
pnpm dlx @scottlz0310/renovate-config-init

# このリポジトリを clone して開発/動作確認する場合
pnpm install
pnpm run dev

# グローバルインストール（npm レジストリから）
pnpm add -g @scottlz0310/renovate-config-init

# GitHubから直接インストール
pnpm add -g git+https://github.com/scottlz0310/renovate-config.git

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
| Node.js | `languages/nodejs` | npm/pnpm パッケージ。npm 更新は公開後 1 日待機 |
| Node.js (major opt-in) | `languages/nodejs-major` | Node.js メジャーバージョン更新を有効化（engines/nvm/Docker 対応）|
| TypeScript | `languages/typescript` | TypeScript 関連 |
| Android | `languages/android` | Android (Kotlin/Java, Gradle) |
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
| Lefthook | `tools/lefthook` | Lefthook (Git hooks manager) |

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

## Node.js メジャーバージョン更新（opt-in）

`languages/nodejs-major` は、デフォルトで無効化されている Node.js メジャーバージョン更新を有効にするオプトインプリセットです。

- `package.json` の `engines.node` フィールドのバージョン範囲を bump（例: `>=22` → `>=24`）
- `.nvmrc` / `.node-version` のメジャー更新
- Docker ベースイメージ（`node`, `library/node`）のメジャー更新

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

## 開発

### ローカルパスからのインストール（未リリース時のテスト用）

別リポジトリで `renovate-config-init` を試したい場合は、ローカルの CLI をグローバルに入れて動作確認できます。

```bash
# renovate-config を clone したディレクトリで
pnpm install

# CLI をグローバルインストール（絶対パス推奨）
pnpm add -g "$(pwd)"

# 別リポジトリで動作確認
cd /path/to/your-project
renovate-config-init --help
```

## デフォルト設定

`presets/default.json` には以下が含まれます：

- セマンティックコミットの有効化
- 依存関係ダッシュボードの有効化
- マイナー・パッチ更新の分離
- 脆弱性アラートの有効化
- タイムゾーン: Asia/Tokyo

`presets/languages/nodejs.json` では npm パッケージ更新に `minimumReleaseAge: "1 day"` と `internalChecksFilter: "strict"` を適用します。pnpm 11 の minimum release age policy と Renovate の PR 作成タイミングを揃え、公開直後のパッケージを含む lockfile で CI が失敗することを抑制します。

## ライセンス

MIT License

## 貢献

Issues や Pull Requests を歓迎します。
