# 集中型オートマージ

GitHub App のインストール先リポジトリを巡回し、安全な Renovate PR を 1 リポジトリにつき最大 1 本だけスカッシュマージするワークフロー（`.github/workflows/global-automerge.yml`、ロジックは `scripts/global-automerge.js`）。

## 動作

1. 次のどれかなら、そのリポジトリには触れずに終える。
   - `automerge-candidate` ラベルを持つ Renovate PR が無い。
   - `main` / `master` / `renovate/*` 以外のリモートブランチ（作業中ブランチ）がある。ローカル作業中に main が動いてリベースやコンフリクトが起きるのを防ぐため。
2. マージ対象を最大 1 本選ぶ。
   - **Priority 1**: `lockfile-maintenance` 以外の候補のうち、CI が成功し、mergeable で、base に追従済みの最古の 1 本。最古の PR が失敗中でも後続は詰まらない。
   - **Priority 2**: `lockfile-maintenance` の PR。Priority 1 の候補が 1 本でも open の間（CI 失敗中を含む）は処理しない。
3. `gh pr merge --squash --delete-branch --match-head-commit <選出時の SHA>` でマージする。後続 PR のリベースと再 CI は Renovate に任せ、待機しない。

候補から外れる PR: 作成者が Renovate でない、`renovate/` 以外のブランチ、fork 由来、ドラフト、base が `main` / `master` 以外、`major-manual-review` または `manual-verification-required` ラベル付き。

CI の判定は、チェックが 1 件以上あり、すべて完了していて、成功・スキップ・中立のいずれかであること。チェックが 0 件の PR はマージしない。

## ラベル

`presets/default.json` の packageRules が付与する。Renovate 自体は自動マージしない。

| 更新種別              | ラベル                                        |
| --------------------- | --------------------------------------------- |
| minor / patch         | `automerge-candidate`                         |
| lock file maintenance | `automerge-candidate`, `lockfile-maintenance` |
| major                 | `major-manual-review`                         |

## セットアップ

1. GitHub App を作成し、権限を付与する。
   - Contents: Read and write
   - Pull requests: Read and write
   - Actions: Read-only（非公開リポジトリで CI の状態を読むために必要）
   - Checks: Read-only
   - Commit statuses: Read-only
2. 自動マージの対象にしたいリポジトリにだけ App をインストールする。巡回範囲はインストール先で決まる。
3. 本リポジトリの Settings に登録する。
   - Variables: `GLOBAL_AUTOMERGE_CLIENT_ID`（App の Client ID）
   - Secrets: `GLOBAL_AUTOMERGE_PRIVATE_KEY`（秘密鍵）

`GLOBAL_AUTOMERGE_CLIENT_ID` が未登録の間、ワークフローはジョブごとスキップされる。削除すれば停止できる。

## 動作確認

Actions の「Global Automerge」を手動実行する。`dry_run` を有効にするとマージせず判定結果だけを表示し、`repository`（`owner/name`）で対象を 1 リポジトリに絞れる。

## lock file maintenance を自動マージする前提

lock file maintenance は `minimumReleaseAge` を無効にしており、公開直後の版を取り込める。自動マージの対象にするリポジトリでは、パッケージマネージャ側の最小リリース経過日数の設定（bun / pnpm）が有効であることを確認する。Rust (cargo) など同等の仕組みが未確認のエコシステムは、確認できるまで対象に含めない。
