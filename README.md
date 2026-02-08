# swiss
AIにレビューをさせるためのcli
異なる観点のレビューをワークフロー的に実行する

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

ローカル実行（ビルドなし）:
```bash
npm run dev -- review --text
```

## 使い方
### レビュー 
```
cat doc.md | swiss review --text
git diff | swiss review --diff
```

### レビュー実行仕様
- `.swiss/swiss.yaml` の `reviews` を**上から順番に逐次実行**
- 各レビューは `.swiss/prompts/{review_name}.md` を使って実行
- AI出力は Structured Output（JSON Schema）で以下を取得
  - `review`: レビュー本文
  - `score`: 0-100 の整数
- `score >= 80` を **要対応** と判定し、その時点で処理を停止して結果を標準出力

### 設定
web uiでワークフローとプロンプトの作成、更新ができます
```
swiss config
```

webを起動する場合:
```
npm run web
```

### 補完
```
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