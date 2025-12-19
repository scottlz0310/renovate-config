# リポジトリ構造再配置計画

## 概要

現在のリポジトリはmonorepo構造を採用していますが、実際にはその必要性がありません。CLIツールを中心に据えた、よりシンプルで直感的な構造に再配置する必要があります。

## 現状の問題点

### 1. 不必要なmonorepo構造

```
renovate-config/
├── packages/
│   └── cli/              # CLIツール（メインのパッケージ）
├── presets/              # Renovateプリセット（静的JSONファイル）
├── scripts/              # バリデーションスクリプト
└── package.json          # ワークスペース設定（private: true）
```

**問題点：**
- CLIツールがサブディレクトリに配置されているため、GitHubから直接インストールできない
- `pnpm add -g git+https://...` が動作しない（ルートのpackage.jsonがprivate）
- monorepoの複雑さが不要（複数の独立したパッケージを管理していない）
- 開発体験が複雑化（workspace コマンドが必要）

### 2. インストール方法の制限

**現状の動作：**
- ✅ `pnpm dlx @scottlz0310/renovate-config-init` - npm経由で動作
- ✅ `pnpm add -g @scottlz0310/renovate-config-init` - npm経由で動作
- ❌ `pnpm add -g git+https://github.com/...` - 動作しない（privateパッケージ）
- ⚠️ リポジトリクローン → ローカルインストール - 回りくどい

### 3. 配布方法の不整合

- Renovateプリセット: GitHubリポジトリ経由で配布（`github>scottlz0310/renovate-config//presets/...`）
- CLIツール: npmレジストリ経由で配布（`@scottlz0310/renovate-config-init`）

異なる配布経路により、ユーザーの混乱を招く可能性があります。

## 提案する新しい構造

### オプションA: CLIを中心に据えた構造（推奨）

```
renovate-config/
├── src/                  # CLIのソースコード
│   ├── index.ts
│   ├── detector.ts
│   ├── generator.ts
│   └── prompts.ts
├── dist/                 # ビルド成果物
├── presets/              # Renovateプリセット（CLIに組み込み）
│   ├── default.json
│   ├── languages/
│   ├── tools/
│   └── options/
├── test/                 # テスト
├── scripts/              # バリデーションスクリプト
├── docs/                 # ドキュメント
├── package.json          # メインのpackage.json（public）
├── tsconfig.json
└── README.md
```

**メリット：**
- シンプルで直感的な構造
- `pnpm add -g git+https://github.com/scottlz0310/renovate-config.git` が動作する
- CLIがリポジトリのメインコンテンツとして明確
- ビルド・開発フローがシンプル
- monorepoツール（workspace機能）が不要

**デメリット：**
- 既存のディレクトリ構造を大きく変更する必要がある
- 移行作業が必要

### オプションB: デュアルパッケージ構造

プリセットとCLIを完全に分離し、2つの独立したnpmパッケージとして配布：

```
renovate-config/
├── packages/
│   ├── presets/
│   │   ├── presets/
│   │   └── package.json  # @scottlz0310/renovate-config-presets
│   └── cli/
│       ├── src/
│       └── package.json  # @scottlz0310/renovate-config-init
└── package.json          # ワークスペース設定
```

**メリット：**
- プリセットを独立したnpmパッケージとして配布可能
- 現在の構造に近い

**デメリット：**
- monorepo構造を維持する必要がある
- GitHubからの直接インストール問題は解決しない
- 複雑さが増す

## 推奨する移行計画（オプションA）

### フェーズ1: 準備

1. **新しいブランチを作成**
   ```bash
   git checkout -b refactor/simplify-structure
   ```

2. **バックアップとタグ作成**
   ```bash
   git tag -a backup-before-restructure -m "Backup before repository restructure"
   ```

### フェーズ2: ディレクトリ移動

1. **CLIのソースを移動**
   ```bash
   # packages/cli/src → src
   mv packages/cli/src ./src

   # packages/cli/test → test
   mv packages/cli/test ./test

   # packages/cli/dist → dist (ビルド後)
   # packages/cli の設定ファイルを移動
   mv packages/cli/tsconfig.json ./tsconfig.json
   mv packages/cli/package.json ./package.json.new
   ```

2. **package.jsonの統合**
   - `packages/cli/package.json` の内容をルートの `package.json` にマージ
   - `"private": true` を削除
   - `"name"` を `@scottlz0310/renovate-config-init` に設定
   - `"bin"` フィールドを更新: `"./dist/index.js"`
   - workspaces設定を削除

3. **プリセットの配置確認**
   ```bash
   # presetsはそのまま維持（変更不要）
   # ルート直下にあるため、GitHub経由の参照パスは変更なし
   ```

4. **不要なファイル・ディレクトリの削除**
   ```bash
   rm -rf packages/
   rm pnpm-workspace.yaml
   ```

### フェーズ3: 設定ファイルの更新

1. **package.jsonの更新**
   ```json
   {
     "name": "@scottlz0310/renovate-config-init",
     "version": "2.0.0",  // メジャーバージョンアップ（破壊的変更）
     "type": "module",
     "description": "CLI tool to initialize Renovate configuration with auto-detection",
     "bin": {
       "renovate-config-init": "./dist/index.js"
     },
     "files": [
       "dist",
       "presets"
     ],
     "scripts": {
       "build": "tsc",
       "dev": "tsx src/index.ts",
       "test": "vitest run",
       "validate": "node scripts/validate-presets.js",
       "lint": "biome ci .",
       "format": "biome format --write .",
       "prepare": "pnpm run build"
     }
   }
   ```

2. **tsconfig.jsonの更新**
   ```json
   {
     "compilerOptions": {
       "outDir": "./dist",
       "rootDir": "./src"
     },
     "include": ["src/**/*"],
     "exclude": ["node_modules", "dist", "test"]
   }
   ```

3. **GitHub Actionsの更新**
   - `.github/workflows/ci.yml` - workspace コマンドを削除
   - `.github/workflows/validate.yml` - ビルドステップを簡略化
   - `.github/workflows/release.yml` - ディレクトリ構造の変更に対応

### フェーズ4: ドキュメント更新

1. **README.md**
   ```bash
   # GitHubから直接インストール（新しい構造で動作）
   pnpm add -g git+https://github.com/scottlz0310/renovate-config.git
   ```

2. **CONTRIBUTING.md**
   - 開発セットアップ手順を簡略化
   - workspace コマンドへの言及を削除

3. **CHANGELOG.md**
   ```markdown
   ## [2.0.0] - YYYY-MM-DD

   ### Changed
   - **破壊的変更**: リポジトリ構造をmonorepoからシンプルな構造に変更
   - CLIをルートディレクトリに移動
   - GitHubから直接インストール可能に: `pnpm add -g git+https://...`

   ### Migration Guide
   - npmレジストリからインストールしているユーザー: 影響なし
   - ローカル開発者: リポジトリを再クローンして `pnpm install`
   ```

### フェーズ5: テストと検証

1. **ローカルでの動作確認**
   ```bash
   pnpm install
   pnpm run build
   pnpm run test
   pnpm run validate
   ```

2. **インストール方法の検証**
   ```bash
   # テスト用ディレクトリで
   pnpm add -g "file:$(pwd)"
   renovate-config-init --help
   ```

3. **CIの確認**
   - Pull Requestを作成してCIが通過することを確認

### フェーズ6: リリース

1. **メジャーバージョンアップ**
   - `package.json` のバージョンを `2.0.0` に更新
   - 破壊的変更であることを明記

2. **タグとリリース**
   ```bash
   git tag -a v2.0.0 -m "Release v2.0.0 - Simplified repository structure"
   git push origin v2.0.0

   git tag -a cli-v2.0.0 -m "Release CLI v2.0.0"
   git push origin cli-v2.0.0
   ```

3. **GitHub Releaseノート**
   - 主要な変更点を明記
   - マイグレーションガイドへのリンク
   - 新しいインストール方法の説明

## 影響範囲

### ユーザーへの影響

**npmレジストリ経由のユーザー（大多数）:**
- ✅ 影響なし（パッケージ名と動作は同じ）

**GitHubリポジトリを直接参照するユーザー:**
- ✅ プリセットの参照パス変更なし（`github>scottlz0310/renovate-config//presets/...`）
- ✅ 新たにGit経由のインストールが可能に

**ローカル開発者:**
- ⚠️ リポジトリの再クローンが推奨
- ⚠️ ビルドコマンドの変更（workspace関連のコマンドが不要に）

### 破壊的変更

**該当なし** - 以下の理由により破壊的変更は最小限：
- パッケージ名とCLIコマンド名は変更なし
- npmレジストリからのインストール方法は変更なし
- Renovateプリセットのパスは変更なし

ただし、リポジトリ内部構造の大幅な変更であるため、セマンティックバージョニングに従い**メジャーバージョンアップ（v2.0.0）**とすることを推奨。

## タイムライン（目安）

- **フェーズ1-2（準備・移動）**: 1-2時間
- **フェーズ3-4（設定・ドキュメント）**: 2-3時間
- **フェーズ5（テスト）**: 1-2時間
- **フェーズ6（リリース）**: 30分

**合計**: 約5-8時間の作業時間

## リスクと軽減策

### リスク

1. **既存のCIワークフローが失敗する可能性**
   - 軽減策: フィーチャーブランチで事前にテスト

2. **ローカル開発者の環境が壊れる**
   - 軽減策: 明確なマイグレーションガイドを提供

3. **予期しない依存関係の問題**
   - 軽減策: 移動前に依存関係を確認

### ロールバック計画

問題が発生した場合：
```bash
# バックアップタグに戻る
git reset --hard backup-before-restructure
git push origin main --force

# リリースタグを削除
git tag -d v2.0.0 cli-v2.0.0
git push origin :refs/tags/v2.0.0 :refs/tags/cli-v2.0.0
```

## まとめ

現在のmonorepo構造は、このプロジェクトの規模と目的に対して過剰です。CLIを中心に据えたシンプルな構造に移行することで：

✅ GitHubから直接インストール可能
✅ 開発体験の向上
✅ メンテナンス性の向上
✅ 新規貢献者にとってわかりやすい構造

この移行は、長期的なメンテナンス性とユーザビリティの両面で大きなメリットをもたらします。

---

**作成日**: 2025-01-19
**ステータス**: 計画段階
**担当者**: TBD
