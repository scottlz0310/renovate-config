# Renovate テンプレート適用ツール 設計ドキュメント

## 概要

renovate-configテンプレートを各プロジェクトへ簡単に適用するためのCLIツール。
併せて、リポジトリをmonorepo化してプリセットとCLIを統合管理する。

## 課題

現状、テンプレートを適用するには以下の手順が必要：

1. READMEを読んで利用可能なプリセットを確認
2. 手動で`renovate.json`を作成
3. 必要なプリセットを`extends`に追加
4. プロジェクトの言語/フレームワークに応じた設定を選択

**問題点**:
- どのプリセットを選べばよいか分かりにくい
- プロジェクト構成の自動検出ができない
- 設定ミスが起きやすい
- リポジトリがJSONファイルの羅列で構造化されていない

---

## リポジトリ構成の変更 (monorepo化)

### 現在の構成

```
renovate-config/
├── default.json          # プリセットがルートに散在
├── nodejs.json
├── python.json
├── ...
├── package.json          # renovate検証用
└── README.md
```

### 新しい構成

```
renovate-config/
├── packages/
│   └── cli/                        # CLIツール
│       ├── src/
│       │   ├── index.ts
│       │   ├── detector.ts
│       │   ├── generator.ts
│       │   └── prompts.ts
│       ├── package.json
│       └── tsconfig.json
├── presets/                        # プリセット群
│   ├── default.json
│   ├── languages/
│   │   ├── nodejs.json
│   │   ├── python.json
│   │   ├── typescript.json
│   │   ├── docker.json
│   │   ├── go.json
│   │   ├── rust.json
│   │   ├── csharp.json
│   │   └── cpp.json
│   ├── tools/
│   │   └── precommit.json
│   └── options/
│       ├── automerge.json
│       ├── schedule.json
│       ├── security.json
│       ├── production.json
│       └── monorepo.json
├── docs/
│   └── design/
├── package.json                    # workspace root
├── bun.lockb
└── README.md
```

### プリセット参照の変更

Renovateはサブディレクトリからのプリセット読み込みをサポートしています（[v24.91.0](https://github.com/renovatebot/renovate/issues/8674)以降）。

**構文**: `github>owner/repo//path/to/preset`

| 変更前 | 変更後 |
|--------|--------|
| `github>scottlz0310/renovate-config:default` | `github>scottlz0310/renovate-config//presets/default` |
| `github>scottlz0310/renovate-config:nodejs` | `github>scottlz0310/renovate-config//presets/languages/nodejs` |
| `github>scottlz0310/renovate-config:automerge` | `github>scottlz0310/renovate-config//presets/options/automerge` |

---

## 破壊的変更への対応

### 問題

現在このリポジトリを参照している既存プロジェクトがある場合、プリセットをサブディレクトリに移動すると参照が壊れる。

```json
// 既存プロジェクトの renovate.json - mainブランチ変更後に壊れる
{
  "extends": [
    "github>scottlz0310/renovate-config:nodejs"  // ❌ 見つからなくなる
  ]
}
```

### 解決策: フィーチャーブランチでの開発 + 段階的移行

#### Phase 1: フィーチャーブランチで開発

```bash
git checkout -b feat/monorepo-cli
```

- `feat/monorepo-cli` ブランチで全ての変更を行う
- mainブランチは現状維持（既存参照を壊さない）
- 開発・テストが完了するまでマージしない

#### Phase 2: 後方互換性の維持（オプション）

ルートにリダイレクト用のプリセットを残す方法もある：

```json
// /nodejs.json (ルートに残す)
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "description": "Deprecated: Use github>scottlz0310/renovate-config//presets/languages/nodejs",
  "extends": ["github>scottlz0310/renovate-config//presets/languages/nodejs"]
}
```

ただし、これはメンテナンス負担が増えるため**非推奨**。

#### Phase 3: mainへのマージとアナウンス

1. CHANGELOG / README に破壊的変更を明記
2. 既存ユーザーへの移行ガイドを提供
3. mainブランチにマージ

---

## CLI ツール

### インストール

```bash
# グローバルインストール (推奨)
npm install -g @scottlz0310/renovate-config-init
```

### 使用例

```bash
# 任意のプロジェクトディレクトリで実行
cd ~/projects/my-app
renovate-config-init

# npx でも実行可能 (インストール不要)
npx @scottlz0310/renovate-config-init
```

既存プロジェクトの移行も同じコマンドで対応可能（既存の `renovate.json` を上書き）。

### 技術スタック

- **Runtime**: Node.js
- **Language**: TypeScript (tsx)
- **CLI Framework**: [@clack/prompts](https://github.com/bombshell-dev/clack)
- **Project Detection**: fast-glob

**Node.jsを選択した理由**:
- 実行頻度が低い（プロジェクト初期設定時のみ）ため、起動速度の恩恵が小さい
- npm配布・sysup連携が既存の仕組みで完結
- Bun/Rust/Goは「そこまで要らない」

### ユーザーフロー

```
┌─────────────────────────────────────────────────────────────┐
│  $ renovate-config-init                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ◆ Renovate Config Initializer                              │
│                                                             │
│  ● Scanning project structure...                            │
│                                                             │
│  ◆ Detected structure:                                      │
│    ./                        (monorepo root)                │
│    ├── package.json          → nodejs, typescript           │
│    ├── Dockerfile            → docker                       │
│    ├── .pre-commit-config.yaml → precommit                  │
│    └── packages/             (2 packages detected)          │
│        ├── api/              → nodejs, typescript           │
│        └── web/              → nodejs, typescript           │
│                                                             │
│  ◆ Select presets: (↑↓ navigate, space toggle, enter apply) │
│                                                             │
│    Languages:                                               │
│    ☑ nodejs      (detected)                                 │
│    ☑ typescript  (detected)                                 │
│    ☑ docker      (detected)                                 │
│    ☐ python                                                 │
│    ☐ go                                                     │
│    ☐ rust                                                   │
│    ☐ csharp                                                 │
│    ☐ cpp                                                    │
│                                                             │
│    Tools:                                                   │
│    ☑ precommit   (detected)                                 │
│                                                             │
│    Options:                                                 │
│    ☐ automerge   - auto-merge minor/patch updates           │
│    ☐ schedule    - scheduled updates (Mon 3am JST)          │
│    ☐ security    - prioritize security updates              │
│    ☐ production  - conservative settings                    │
│    ☐ monorepo    - monorepo-specific settings               │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ◆ Output locations:                                        │
│    ☑ ./renovate.json                    (root)              │
│    ☑ ./packages/api/renovate.json       (inherit root)      │
│    ☑ ./packages/web/renovate.json       (inherit root)      │
│                                                             │
│  ◇ Apply? (Y/n)                                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✓ Created ./renovate.json                                  │
│  ✓ Created ./packages/api/renovate.json                     │
│  ✓ Created ./packages/web/renovate.json                     │
│                                                             │
│  Done! 3 files created.                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### monorepo時の生成ファイル

**ルート (./renovate.json)**:
```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "github>scottlz0310/renovate-config//presets/default",
    "github>scottlz0310/renovate-config//presets/languages/nodejs",
    "github>scottlz0310/renovate-config//presets/languages/typescript",
    "github>scottlz0310/renovate-config//presets/languages/docker",
    "github>scottlz0310/renovate-config//presets/tools/precommit"
  ]
}
```

**サブパッケージ (./packages/api/renovate.json)**:
```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "../.."
  ]
}
```

### 検出ルール

| ファイル/パターン | 検出されるプリセット |
|------------------|---------------------|
| `package.json` | languages/nodejs |
| `tsconfig.json` | languages/typescript |
| `pyproject.toml`, `uv.lock` | languages/python |
| `Dockerfile`, `docker-compose.yml` | languages/docker |
| `go.mod` | languages/go |
| `Cargo.toml` | languages/rust |
| `*.csproj`, `*.sln` | languages/csharp |
| `CMakeLists.txt`, `conanfile.txt` | languages/cpp |
| `.pre-commit-config.yaml` | tools/precommit |

### CLI オプション

```bash
# インタラクティブモード (デフォルト)
renovate-config-init

# 自動検出のみで生成 (CI/CD用)
renovate-config-init --yes

# 特定プリセットを強制
renovate-config-init --presets nodejs,typescript,docker

# dry-run (ファイル生成せずに出力)
renovate-config-init --dry-run

# 出力先を指定
renovate-config-init --output .github/renovate.json
```

---

## 実装詳細

### packages/cli/package.json

```json
{
  "name": "@scottlz0310/renovate-config-init",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "renovate-config-init": "./dist/index.js"
  },
  "files": ["dist"],
  "dependencies": {
    "@clack/prompts": "^0.9.1",
    "fast-glob": "^3.3"
  },
  "devDependencies": {
    "@types/node": "^22",
    "tsx": "^4",
    "typescript": "^5.7"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts"
  }
}
```

### 検出ロジック (detector.ts)

```typescript
interface DetectionResult {
  preset: string;           // e.g., "languages/nodejs"
  confidence: 'high' | 'medium' | 'low';
  matchedFiles: string[];
}

interface DetectionRule {
  preset: string;
  patterns: string[];
  excludePatterns?: string[];
  confidence: 'high' | 'medium' | 'low';
}

const DETECTION_RULES: DetectionRule[] = [
  {
    preset: 'languages/nodejs',
    patterns: ['package.json'],
    confidence: 'high',
  },
  {
    preset: 'languages/typescript',
    patterns: ['tsconfig.json'],
    confidence: 'high',
  },
  {
    preset: 'languages/python',
    patterns: ['pyproject.toml', 'uv.lock'],
    confidence: 'high',
  },
  {
    preset: 'languages/docker',
    patterns: ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml'],
    confidence: 'high',
  },
  {
    preset: 'languages/go',
    patterns: ['go.mod'],
    confidence: 'high',
  },
  {
    preset: 'languages/rust',
    patterns: ['Cargo.toml'],
    confidence: 'high',
  },
  {
    preset: 'languages/csharp',
    patterns: ['*.csproj', '*.sln'],
    confidence: 'high',
  },
  {
    preset: 'languages/cpp',
    patterns: ['CMakeLists.txt', 'conanfile.txt', 'vcpkg.json'],
    confidence: 'high',
  },
  {
    preset: 'tools/precommit',
    patterns: ['.pre-commit-config.yaml'],
    confidence: 'high',
  },
];

export async function detectPresets(cwd: string): Promise<DetectionResult[]> {
  // fast-globでパターンマッチング
}
```

### 生成ロジック (generator.ts)

```typescript
const REPO_OWNER = 'scottlz0310';
const REPO_NAME = 'renovate-config';
const PRESETS_PATH = 'presets';

interface GenerateOptions {
  presets: string[];  // e.g., ["languages/nodejs", "options/automerge"]
}

export function generateConfig(options: GenerateOptions): object {
  const { presets } = options;

  return {
    $schema: 'https://docs.renovatebot.com/renovate-schema.json',
    extends: [
      `github>${REPO_OWNER}/${REPO_NAME}//${PRESETS_PATH}/default`,
      ...presets.map(p => `github>${REPO_OWNER}/${REPO_NAME}//${PRESETS_PATH}/${p}`),
    ],
  };
}
```

---

## 開発計画

### ブランチ戦略

```
main (現状維持)
  │
  └── feat/monorepo-cli (開発ブランチ)
        ├── Step 1: monorepo構造のセットアップ
        ├── Step 2: プリセットの移動
        ├── Step 3: CLI実装
        ├── Step 4: テスト・検証
        └── Step 5: ドキュメント整備
              │
              └── main にマージ (破壊的変更)
```

### タスク

1. [ ] `feat/monorepo-cli` ブランチ作成
2. [ ] workspace設定 (npm workspaces)
3. [ ] `presets/` ディレクトリ構造作成
4. [ ] プリセットファイル移動
5. [ ] CLI実装
6. [ ] プリセット検証スクリプト更新
7. [ ] README更新
8. [ ] テスト
9. [ ] npm公開
10. [ ] mainへマージ

---

## 参考資料

- [Renovate: Shareable Config Presets](https://docs.renovatebot.com/config-presets/)
- [Renovate: Support loading presets from subdirectories (#8674)](https://github.com/renovatebot/renovate/issues/8674)
- [@clack/prompts](https://github.com/bombshell-dev/clack)
