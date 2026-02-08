# swiss
AIにレビューをさせるための CLI。
異なる観点のレビューをワークフローとして順に実行します。

## 前提
- Node.js 20+
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
- `swiss` の実行ファイル（`cli/dist/index.js`）には、ビルド時に自動で実行権限が付与されます。
- `nodenv` を使っている場合は、必要に応じて `nodenv rehash` を実行してください。

開発/ローカル実行の方法は `doc/dev.md` を参照してください。

## 使い方
### レビュー 
```bash
cat doc.md | swiss review --text
git diff | swiss review --diff
```

### レビュー実行仕様
- `.swiss/swiss.yaml` の `reviews` を**上から順番に逐次実行**します
- 各レビューは `.swiss/prompts/{review_name}.md` の内容（レビュー観点）を使って実行します
- AI出力は Structured Output（JSON Schema）で受け取り、結果のうち **`score > 80`** のものだけを「要対応」として出力します
- 1件でも要対応が出た時点で終了し、終了コード `2` になります

### 設定
Web UI でワークフローとプロンプトの作成/更新ができます。

```bash
swiss config
```

`swiss config` は Next.js の設定UIサーバーを起動したまま待機します。
終了するときはターミナルで `Ctrl-C` を押してください（サーバーも一緒に停止します）。

開発中に Web を直接起動する場合:

```bash
npm run web
```

### 補完
```bash
swiss completion fish > ~/.config/fish/completions/swiss.fish
```

## 設定ファイル
`doc/config.md` を参照してください。

最小例:

`.swiss/swiss.yaml`
```yaml
model: gpt-5
reviews:
  - name: quality
    description: コード品質レビュー
  - name: security
    description: セキュリティレビュー
    model: gpt-5
```

`.swiss/prompts/quality.md`
```md
# コード品質レビュー
可読性、設計、保守性の観点でレビューしてください。
```