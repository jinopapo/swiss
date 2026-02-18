# swiss
AIにレビューをさせるための CLI。
異なる観点のレビューをワークフローとして順に実行します。

## 前提
- Node.js 20+（本リポジトリでは Node.js 20 系以上を前提）
- `OPENAI_API_KEY` が設定されていること

```bash
export OPENAI_API_KEY=your_api_key
```

## セットアップ
```bash
npm install
npm run build
```

グローバルインストール:
```bash
npm install -g .
```

補足:
- `swiss` の実行ファイル（`cli/dist/index.js`）には、`npm run -w cli build` 内の
  `node -e "require('fs').chmodSync('dist/index.js', 0o755)"` で実行権限を付与しています。
- `nodenv` を使っている場合は、必要に応じて `nodenv rehash` を実行してください。

開発/ローカル実行の方法は `doc/dev.md` を参照してください。

## 使い方
### レビュー 
```bash
cat doc.md | swiss review example1 --text
git diff | swiss review example2 --diff
git diff | swiss review example1 example2 --diff
```

`--diff` は、stdin が空のときに「差分なし」としてスキップするための実行オプションです。
`--text` は明示用オプションですが、レビュー内容の解釈自体は `.swiss/contexts/<workflow>.md` に依存します。

`swiss review` は **workflow 名の指定が必須** です（`swiss review <workflow...>`）。
指定した workflow に対応する `.swiss/flows/<workflow>.yaml` が存在しない場合はエラーになります。

存在しない workflow を指定した場合は、エラー時に利用可能な workflow 一覧
（`.swiss/flows/*.yaml`）を表示して終了します。

### レビュー実行仕様
- `swiss review <workflow...>` で、指定順に `.swiss/flows/<workflow>.yaml` を読み込みます
- 各 workflow ごとに `.swiss/contexts/<workflow>.md` を読み込みます（未作成/空の場合はエラー）
- 各 workflow の `reviews` を**上から順番に逐次実行**し、workflow は **左から順に連結実行**されます
- 各レビューは `.swiss/prompts/{review_name}.md` の内容（レビュー観点）を使って実行します
- 入力（stdin）の意味づけ（例: git diff / 仕様テキスト）は `.swiss/contexts/<workflow>.md` に記述します
- `core/prompts` の built-in テンプレートは廃止され、入力解釈は workflow context 側で行います
- `line` は 0 以上の整数です（`0` はファイル全体への指摘を表す場合があります）
- `line = 0` の場合、CLI 出力では `行番号: 全体 (0)` と表示されます
- 1件でも要対応が出た時点でレビューを打ち切り、CLI は終了コード `2` で終了します（複数 workflow 指定時も同様）

### 設定
Web UI でワークフローとプロンプトの作成/更新ができます。

```bash
swiss config
```

> [!NOTE]
> workflow 名（`.swiss/flows/{workflow}.yaml` の `{workflow}`）には
> `a-z`, `A-Z`, `0-9`, `-`, `_` のみ使用できます。

`swiss config` は Next.js の設定UIサーバーを起動したまま待機します。
終了するときはターミナルで `Ctrl-C` を押してください（サーバーも一緒に停止します）。

Web API の後方互換:
- `/api/config` は `workflow` クエリ省略時に `default` workflow を使用します
- 明示する場合は `/api/config?workflow=<name>` を利用してください

設定UI（`swiss config`）では、初期表示時は workflow 未選択で開始します。
そのため、UI からは workflow を明示的に選択するまで `/api/config` の
「省略時 default」挙動は利用しません。

開発中に Web を直接起動する場合:

```bash
npm run web
```

### 補完
```bash
swiss completion fish > ~/.config/fish/completions/swiss.fish
```

> [!NOTE]
> fish 補完で表示される workflow 候補は、補完を実行したカレントディレクトリ配下の
> `.swiss/flows/*.yaml` を列挙します。

## 設定ファイル
`doc/config.md` を参照してください。

設定UIが利用する Web API の仕様も `doc/config.md` を参照してください。

最小例:

`.swiss/flows/default.yaml`
```yaml
model: gpt-5.2
reviews:
  - name: quality
    description: コード品質レビュー
  - name: security
    description: セキュリティレビュー
    model: gpt-5.2
```

`.swiss/contexts/default.md`
```md
# 入力の前提
- 入力は git diff です。
- 変更差分を対象にレビューしてください。
```

`.swiss/prompts/quality.md`
```md
# コード品質レビュー
可読性、設計、保守性の観点でレビューしてください。
```

`.swiss/prompts/security.md`
```md
# セキュリティレビュー
脆弱性や機密情報漏えいのリスクがないかをレビューしてください。
```