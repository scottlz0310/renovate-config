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

GitHub App の作成から Secret / Variable の登録までは `scripts/create-github-app.js` が行う。前提は `gh` と wrangler（`bunx wrangler login`）にログイン済みであること、Worker をデプロイ済みであること（下記「定期実行」）。

```sh
bun scripts/create-github-app.js
```

ブラウザで GitHub の確認画面が開くので、内容を確認して「Create GitHub App」を押す。所有者（個人 / 組織）はリポジトリから自動判定する。スクリプトは次を登録する。鍵はメモリ上でのみ扱い、ディスクには書かない。

- GitHub の Variable `GLOBAL_AUTOMERGE_CLIENT_ID` と Secret `GLOBAL_AUTOMERGE_PRIVATE_KEY`
- Cloudflare Workers の Secret `GITHUB_APP_CLIENT_ID` と `GITHUB_APP_PRIVATE_KEY`（PKCS#8 に変換済み）

その後、自動マージの対象にしたいリポジトリにだけ App をインストールする。巡回範囲はインストール先で決まる。

App に付与する権限は Contents / Pull requests / Actions が Read and write、Checks / Commit statuses が Read-only。Actions は、Worker の `workflow_dispatch`（write）と、非公開リポジトリでの CI 状態の取得（read）に使う。手動で作る場合も同じ権限にする。

`GLOBAL_AUTOMERGE_CLIENT_ID` が未登録の間、ワークフローはジョブごとスキップされる。削除すれば停止できる。

## 定期実行（Cloudflare Workers）

Actions の `schedule` は間引き・遅延されるため、`workflow_dispatch` を Cloudflare Workers の Cron Trigger（`17,47 * * * *`）から呼ぶ（`workers/automerge-trigger`）。Worker は App の JWT で Installation Access Token（`actions: write`、本リポジトリのみ）を発行して dispatch する。PAT は使わない。多重起動は `concurrency` が防ぐ。

1. 既存の App を使う場合は、App の権限に Actions を **Read and write** で追加し、インストール先で承認する（未承認だとトークン発行が失敗する）。
2. Worker をデプロイする（`workers/automerge-trigger` で実行）。

   ```sh
   bunx wrangler deploy --config wrangler.jsonc
   ```

3. Secret を登録する。新規に App を作るときは上の `scripts/create-github-app.js` が登録する。既存の App、鍵の紛失、ローテーションの場合は、App の設定ページの「Generate a private key」で新しい鍵を作り（鍵は複数持てるため、Actions 用の鍵には影響しない）、PEM を渡して再実行する。PKCS#8 への変換と登録まで行い、何度実行しても同じ結果になる。

   ```sh
   bun scripts/sync-worker-secrets.js <秘密鍵.pem>
   ```

4. 動作確認: Cloudflare ダッシュボードの Cron で手動実行するか、次の定時に Actions の「Global Automerge」が `workflow_dispatch` で起動することを確認する。

## 動作確認

Actions の「Global Automerge」を手動実行する。`dry_run` を有効にするとマージせず判定結果だけを表示し、`repository`（`owner/name`）で対象を 1 リポジトリに絞れる。

結果は実行ページの Summary に表で出る。候補 PR が無いリポジトリは件数にまとめ、マージした PR、スキップの理由、エラーだけを一覧にする。詳細は「Merge at most one Renovate PR per repository」ステップのログにある。

## lock file maintenance を自動マージする前提

lock file maintenance は `minimumReleaseAge` を無効にしており、公開直後の版を取り込める。自動マージの対象にするリポジトリでは、パッケージマネージャ側の最小リリース経過日数を 3 日で有効にする。

| 種別         | 設定                                                                        | 備考                                          |
| ------------ | --------------------------------------------------------------------------- | --------------------------------------------- |
| bun          | `bunfig.toml` の `[install]` に `minimumReleaseAge = 259200`（秒）          | 各リポジトリに必要                            |
| pnpm         | 既定で有効（pnpm 11）                                                       | 設定不要                                      |
| Rust (cargo) | `.cargo/config.toml` の `[registry]` に `global-min-publish-age = "3 days"` | Rust 1.100 以降で有効。それ未満では無視される |

Rust は、リポジトリの `rust-toolchain.toml` が 1.100 以上になるまで、この設定が効かない。1.100 への更新は Renovate が提案するので、そのマージ後に lock file maintenance が保護される。
