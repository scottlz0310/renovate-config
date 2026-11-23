# renovate-config

Renovateの設定を一元管理するためのリポジトリ

各言語・環境（Python, Node.js, TypeScript, Android, Docker, C#, C++, Rust, Go）とパッケージマネージャ（npm, pnpm, Bun）に対応した設定、およびプロジェクト毎の部分的な調整設定（プリセット）を提供します。

## クイックスタート

### CLI ツールで自動設定（推奨）

```bash
# bunx で実行（推奨: グローバルに入れない）
# ※ npm で 404 になる場合: パッケージが未公開/非公開、または権限がありません
bunx @scottlz0310/renovate-config-init

# このリポジトリを clone して開発/動作確認する場合
bun install
bun run dev

# グローバルインストール（npm レジストリから）
bun add --global @scottlz0310/renovate-config-init

# GitHubから直接インストール
bun add --global git+https://github.com/scottlz0310/renovate-config.git

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
  ├── Dockerfile           → Docker
  └── bun.lock             → Bun

◆ Select Languages:
  ☑ Node.js      (detected)
  ☑ TypeScript   (detected)
  ☑ Docker       (detected)

◆ Select Package Managers:
  ☑ Bun          (detected)

◆ Select Tools:
  ☑ Pre-commit   (detected)

◆ Select Options:
  ☐ Android SDK

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
		"github>scottlz0310/renovate-config//presets/languages/typescript",
		"github>scottlz0310/renovate-config//presets/package-managers/npm"
	]
}
```

## 対応言語・環境

| 言語/環境              | プリセット               | 説明                                                                                                                  |
| ---------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Node.js                | `languages/nodejs`       | npm datasource の依存パッケージ（標準の公開後 3 日待機）。Node ランタイム本体（`node-version` datasource）は 5 日待機 |
| Node.js (major opt-in) | `languages/nodejs-major` | Node.js メジャーバージョン更新を有効化（engines/nvm/Docker 対応）                                                     |
| TypeScript             | `languages/typescript`   | TypeScript 関連                                                                                                       |
| Android                | `languages/android`      | Android (Kotlin/Java, Gradle)                                                                                         |
| Python                 | `languages/python`       | uv/pyproject.toml                                                                                                     |
| Docker                 | `languages/docker`       | Dockerfile, docker-compose                                                                                            |
| Go                     | `languages/go`           | Go modules                                                                                                            |
| Rust                   | `languages/rust`         | Cargo                                                                                                                 |
| C#                     | `languages/csharp`       | NuGet, .NET                                                                                                           |
| PowerShell             | `languages/powershell`   | PowerShell Gallery の `Install-Module -RequiredVersion`（注釈付き）                                                   |
| C++                    | `languages/cpp`          | Conan, vcpkg, CMake                                                                                                   |

`languages/android` は、リポジトリ内の `.ktlint-version`（`1.8.0` のように `x.y.z` だけを書いたファイル）から ktlint の版を検出し、[ktlint/ktlint](https://github.com/ktlint/ktlint) の GitHub Releases で更新を提案します。CI・lefthook・インストールスクリプトがこのファイルを読む構成にすると、版の定義を 1 か所にできます。

PowerShell Gallery のモジュールを更新するには、workflow（`.github/workflows/*.yml` / `*.yaml`）または PowerShell スクリプト内で、インストール行の直前に注釈を置きます。

```powershell
# renovate: datasource=nuget registryUrl=https://www.powershellgallery.com/api/v2 depName=Pester
Install-Module Pester -RequiredVersion 5.7.1 -Force -Scope CurrentUser
```

## パッケージマネージャ

| パッケージマネージャ | プリセット              | 検出ファイル            |
| -------------------- | ----------------------- | ----------------------- |
| npm                  | `package-managers/npm`  | `package-lock.json`     |
| pnpm                 | `package-managers/pnpm` | `pnpm-lock.yaml`        |
| Bun                  | `package-managers/bun`  | `bun.lock`, `bun.lockb` |

`package-managers/bun` は `.bun-version` の Bun ランタイム更新にも対応します。`package.json` の `packageManager` フィールドによる Bun バージョン更新は Corepack と Renovate が対応していないため対象外です。新規プロジェクトではテキスト形式の `bun.lock` を推奨します。

## ツール

| ツール     | プリセット        | 説明                         |
| ---------- | ----------------- | ---------------------------- |
| Pre-commit | `tools/precommit` | Pre-commit hooks             |
| Lefthook   | `tools/lefthook`  | Lefthook (Git hooks manager) |

## オプション

| オプション  | プリセット            | 説明                                                                               |
| ----------- | --------------------- | ---------------------------------------------------------------------------------- |
| Android SDK | `options/android-sdk` | 安定版 API（マイナー API レベル含む）の compileSdk / targetSdk 更新 PR（任意選択） |

### 非推奨 options の移行

`options/schedule`・`options/production`・`options/automerge`・`options/security`・`options/monorepo` は非推奨です。従来のスケジュール・長い待機期間・自動マージ・承認要求・これら5 options由来のグループ化を中央で一括解除しました。利用側の `extends` を変更しなくても、次回の Renovate 巡回から解除が反映されます。ファイルは既存参照がエラーにならないための空の受け皿として残します。CLI の選択肢からは除外し、`--presets` で指定した場合も既存の不明プリセット検査でエラーになります。

これらを参照している間は、次回の Renovate 巡回で Dependency Dashboard の末尾に `extends` からの削除案内を表示します。複数参照しても同じ案内を1つ表示し、すべての参照を削除すると案内も消えます。独自の Config Warning Issue や更新 PR 本文への警告は追加しません。利用側で Dashboard を無効化したり `dependencyDashboardFooter` を上書きした場合は表示されません。

### Android SDK の更新提案

`options/android-sdk` は明示的に選択した場合だけ適用されます。CLI のオプション選択、または次のコマンドで追加できます。CLI は SDK プリセットを最後に配置します。

```bash
bunx @scottlz0310/renovate-config-init --presets android,android-sdk
```

手動設定では、共通のグループ化・自動マージ設定を上書きするため、`options/android-sdk` を **extends の最後**に指定してください。

```json
{
	"extends": [
		"github>scottlz0310/renovate-config//presets/default",
		"github>scottlz0310/renovate-config//presets/languages/android",
		"github>scottlz0310/renovate-config//presets/options/android-sdk"
	]
}
```

対応書式は `build.gradle.kts` 内の、トップレベルの `android { ... }` にある AGP 9 ブロック構文（AGP 8.13+）および既存の整数代入です。閉じ括弧は行頭、内部の設定はインデントする通常の書式を対象とします。

```kotlin
android {
    compileSdk {
        version = release(37) {
            minorApiLevel = 2
        }
    }
    defaultConfig {
        minSdk = 26
        targetSdk = 36
    }
}
```

- 既存の整数代入（`compileSdk = 37` など）にも対応します。マイナー API レベル（例: `37.2` や `36.1`）へ更新する際は AGP 9 ブロック構文へ自動変換します（AGP 8.13+ が前提です。古い AGP を使用している環境では更新 PR の CI 失敗によって AGP の更新が必要であることを検知できます）。メジャー `.0` 版（例: `38.0`）への更新時は元の記法を維持します（整数代入は `compileSdk = 38`、ブロック構文は `version = release(38)`）。既存ブロックの更新時は行末コメントと改行コード（LF / CRLF）を保持します。
- `compileSdk` と `targetSdk` は別 PR とし、通常のライブラリ更新グループから外します。Dashboard 承認を挟まず PR を自動作成します。利用側の schedule・PR 件数制限は適用されます。
- `targetSdk` の候補は、同じ Android ブロックで先に宣言された現在の `compileSdk` のメジャー API レベル以下（整数版のみ）に制限します。例では最大 37 です。両方が古い場合は、`compileSdk` の PR をマージすると次回の Renovate 実行で `targetSdk` の候補が増えます。
- `minSdk`、Groovy DSL、変数参照、Version Catalog、式、プレビュー SDK（`version = preview(...)`）、`sdkExtension` 等を含むブロック構文は対象外です。`compileSdk` が対応書式でない場合、`targetSdk` の PR も作りません。
- Renovate 自体の自動マージは無効化します。`presets/default` と併用した場合、`compileSdk` のマイナー更新（例: `37.0` → `37.2`）は `automerge-candidate` が付与され集中型オートマージの対象になります。`compileSdk` のメジャー更新（`major-manual-review`）と `targetSdk` の更新（`manual-verification-required`）は手動マージのままです。
- `targetSdk` の PR には `manual-verification-required` ラベルと手動確認の注意書きを付けます。ビルドや CI の成功だけでは、更新後の Android の動作変更や表示崩れを検証できません。対象 API の実機・エミュレータで主要画面、遷移、システムバーとの重なりを手動確認し、既存 UI テストも実行してください。`compileSdk` のみの更新はビルド・Android Lint・既存テストを基本とします。
- ラベルはマージ制限ではありません。利用側の `packageRules` での再上書きや、別の自動マージ用 GitHub Actions 等がないことも確認してください。

取得元には Google 公式の [Android SDK Repository XML](https://dl.google.com/android/repository/repository2-3.xml) を使い、安定版チャンネル（`channel-0`）かつ `codename` 空の正式版プラットフォーム（マイナー API レベル含む）のみを採用します。`-beta*`・`CANARY`・`-ext*` 等のプレビュー・拡張パッケージは除外します。XML には各プラットフォームのリリース日時が含まれないため、この datasource に対しては `minimumReleaseAge: null` を設定し、`presets/default` の 3 日待機で PR 作成が止まらないようにしています。

SDK 更新の提案は、Google Play の提出期限や最低 target API 要件への適合を保証しません。公式の動作変更・Play 要件の確認、各アプリの lint と UI テストの整備は引き続き必要です。

## 使用例

### Python + Docker

```json
{
	"$schema": "https://docs.renovatebot.com/renovate-schema.json",
	"extends": [
		"github>scottlz0310/renovate-config//presets/default",
		"github>scottlz0310/renovate-config//presets/languages/python",
		"github>scottlz0310/renovate-config//presets/languages/docker"
	]
}
```

### Node.js + pnpm

```json
{
	"$schema": "https://docs.renovatebot.com/renovate-schema.json",
	"extends": [
		"github>scottlz0310/renovate-config//presets/default",
		"github>scottlz0310/renovate-config//presets/languages/nodejs",
		"github>scottlz0310/renovate-config//presets/languages/typescript",
		"github>scottlz0310/renovate-config//presets/package-managers/pnpm"
	]
}
```

### Node.js + TypeScript + Bun

Bunを使うリポジトリでは、言語プリセットに加えて `package-managers/bun` を `extends` します。`bun.lock` と `.bun-version` をコミットし、Bunのバージョンは `package.json` の `packageManager` ではなく `.bun-version` で管理してください。

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

# プリセットを指定（例: nodejs,pnpm,typescript）
renovate-config-init --presets nodejs,pnpm,typescript

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
bun install

# CLI をグローバルインストール（絶対パス推奨）
bun add --global "$(pwd)"

# 別リポジトリで動作確認
cd /path/to/your-project
renovate-config-init --help
```

## デフォルト設定

`presets/default.json` が標準設定の唯一の正です。直下の `default.json` は `github>scottlz0310/renovate-config//presets/default` を参照する別名で、オンボーディングの自動検出や `local>scottlz0310/renovate-config` からも同じ設定に解決します。設定の変更は `presets/default.json` で行ってください。

標準設定には以下が含まれます：

- セマンティックコミットの有効化
- 依存関係ダッシュボードの有効化
- マイナー・パッチ更新の分離
- 脆弱性アラートの有効化
- タイムゾーン: Asia/Tokyo
- スケジュール制限なし（`schedule: []`）。Renovate の巡回時に随時提案
- 標準の公開後待機期間は3日（`minimumReleaseAge: "3 days"`）。`internalChecksFilter: "strict"` で待機中の版によるブランチ作成を抑制
- 手動マージを前提とし、GitHub Actions・言語別・`config:recommended` 由来の既存グループ化は維持
- lockfile maintenance は公開日時を持たないため `minimumReleaseAge: null` とする（これだけで maintenance を有効化しない）

個別プリセット・利用側で明示した設定は引き続き優先されます。公開日時がない datasource では、標準の待機期間だけで3日の経過を保証できません。

**Node ランタイム本体（`node-version` datasource — `.node-version` / `.nvmrc` / `engines.node`）は `minimumReleaseAge: "5 days"` と、npm パッケージより長く待機します。** ここで待つ対象がパッケージ自体ではなく**他ベンダーの追随**（Cloudflare Pages や `node-build` の定義追加、Docker 公式イメージ、`actions/setup-node` のマニフェスト）であり、いずれもリリースから数日遅れるためです。リリース当日に更新ブランチを立てると、外部ビルド環境が `node-build: definition not found` のようなエラーで失敗します。Node のリリース間隔（2 週間程度）より十分短く、かつ外部が追随する時間を取れる値として 5 日としています。

## ライセンス

MIT License

## 貢献

Issues や Pull Requests を歓迎します。
