# Web API 仕様（設定UI）

設定UI（`swiss config` / `npm run web`）で利用する API 仕様です。

## エンドポイント一覧

- `GET /api/workflows`
  - `.swiss/flows/*.yaml` から workflow 名一覧を返します
- `POST /api/workflows/rename`
  - workflow 名を変更します（`from`, `to` を指定）
- `GET /api/config?workflow=<name>`
  - 指定 workflow の設定を返します
- `POST /api/config?workflow=<name>`
  - 指定 workflow の設定を保存します
- `GET /api/prompts`
  - `.swiss/prompts/*.md` の一覧（`name`, `content`）を返します
- `POST /api/prompts/<name>`
  - 指定 prompt を保存します

## `/api/config` の挙動

- `workflow` クエリを省略した場合は `default` workflow を利用します（後方互換）
- 指定 workflow の設定ファイルが存在しない場合はエラーではなく空設定を返します
- `workflow` 名に `a-z`, `A-Z`, `0-9`, `-`, `_` 以外を含む場合は `400` を返します

空設定のレスポンス例:

```json
{
  "config": {
    "model": "",
    "reviews": []
  }
}
```

## `/api/workflows` の挙動

- `GET /api/workflows` は、内部で `.swiss/flows` ディレクトリを必要に応じて作成してから一覧を返します
- `POST /api/workflows/rename` は、`from` / `to` が未指定の場合 `400` を返します
  - 変更先が既に存在する場合は `409` を返します

## `/api/prompts` の挙動

- `GET /api/prompts` は、内部で `.swiss/prompts` ディレクトリを必要に応じて作成してから一覧を返します
- `POST /api/prompts/<name>` は、リクエスト本文の `content`（文字列）を `.swiss/prompts/<name>.md` として保存します
  - `content` を省略した場合は空文字列として保存されます
  - 現在の実装では `<name>` に対するバリデーションは行っていません

## CLI との挙動差分

- `swiss review <workflow>`（CLI）は `.swiss/flows/<workflow>.yaml` が存在しない場合にエラー終了します
- 一方、`GET /api/config?workflow=<name>` は workflow が未作成でも空設定を返します
