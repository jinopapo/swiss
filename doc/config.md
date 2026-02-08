# 設定ファイル仕様
このドキュメントでは、swiss が参照する設定ファイルの仕様を説明します。

- ワークフロー定義: `.swiss/swiss.yaml`
- レビュー観点（プロンプト）: `.swiss/prompts/{review_name}.md`

> [!NOTE]
> `.swiss/swiss.yaml` のスキーマは `core/src/config.ts` の Zod 定義に準拠します。

## .swiss/swiss.yaml
ワークフロー（レビューの並び）を定義する YAML です。

### スキーマ
```yaml
model: <string>
reviews:
  - name: <string>
    description: <string?>
    model: <string?>
```

### model（必須）
デフォルトで使用するモデルを指定します。

### reviews（必須）
ワークフロー内の各レビューを上から順に定義します（1件以上）。

#### reviews[].name（必須）
レビューの名前を指定します。対応するプロンプトファイルとして `.swiss/prompts/{name}.md` が参照されます。

#### reviews[].description（任意）
レビューの説明です。現状 CLI の実行には必須ではありませんが、設定の意図を明確にするために推奨です。

#### reviews[].model（任意）
このレビューで使用するモデルを指定します。指定しない場合、ルートの `model` が使用されます。

### 例（最小）
```yaml
model: gpt-5
reviews:
  - name: quality
```

### 例（複数レビュー + レビューごとの model 上書き）
```yaml
model: gpt-5
reviews:
  - name: quality
    description: コード品質レビュー
  - name: security
    description: セキュリティレビュー
    model: gpt-5
```

## .swiss/prompts/{review_name}.md
各レビューで使用する「レビュー観点」を定義する Markdown ファイルです。

- ファイル名は `.swiss/swiss.yaml` の `reviews[].name` と一致させます
- 内容は自由形式ですが、どの観点でレビューさせたいかを具体的に書くのがおすすめです

### 例
```md
# コード品質レビュー
可読性、設計、保守性の観点でレビューしてください。
```