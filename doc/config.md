# 設定ファイル仕様
このドキュメントでは、swiss が参照する設定ファイルの仕様を説明します。

- ワークフロー定義: `.swiss/flows/{workflow}.yaml`
- レビュー観点（プロンプト）: `.swiss/prompts/{review_name}.md`

> [!NOTE]
> `.swiss/flows/{workflow}.yaml` のスキーマは `core/src/config.ts` の Zod 定義に準拠します。

## .swiss/flows/{workflow}.yaml
ワークフロー（レビューの並び）を定義する YAML です。CLI は `swiss review <workflow>` でこのファイルを読み込みます。

### workflow 名の制約
`{workflow}` には以下のみ使用できます。

- 英字（`a-z`, `A-Z`）
- 数字（`0-9`）
- ハイフン（`-`）
- アンダースコア（`_`）

### スキーマ
```yaml
model: <string>
reviews:
  - name: <string>
    description: <string?>
    model: <string?>
    parallel: <boolean?>
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
    parallel: false
  - name: security
    description: セキュリティレビュー
    model: gpt-5
    parallel: true
```

## 設定UI / Web API について

設定UI（`swiss config` / `npm run web`）が利用する Web API の仕様は `doc/api.md` を参照してください。

## .swiss/prompts/{review_name}.md
各レビューで使用する「レビュー観点」を定義する Markdown ファイルです。

- ファイル名は `.swiss/flows/{workflow}.yaml` の `reviews[].name` と一致させます
- 内容は自由形式ですが、どの観点でレビューさせたいかを具体的に書くのがおすすめです

## ディレクトリ例
```text
.swiss/
  flows/
    default.yaml
    security.yaml
  prompts/
    quality.md
    security.md
```

### 例
```md
# コード品質レビュー
可読性、設計、保守性の観点でレビューしてください。
```