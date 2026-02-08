# 開発者向けドキュメント

このドキュメントは、swiss の開発に必要な情報をまとめたものです。

利用方法は README.md、設定ファイル仕様は doc/config.md を参照してください。

## リポジトリ構成（monorepo）
- `cli/`: CLI（`swiss` コマンド）
- `core/`: コアロジック（設定ロード、レビュー実行）
- `web/`: 設定用 Web UI（Next.js）
- `doc/`: ドキュメント

## セットアップ
```bash
npm install
```

## よく使うコマンド

### ビルド
リポジトリ全体（core + cli + web）をビルドします。
```bash
npm run build
```

個別にビルドする場合:
```bash
npm run -w core build
npm run -w cli build
npm run -w web build
```

### CLI をローカル実行（ビルドなし）
```bash
echo "hello" | npm run dev -- review --text
git diff | npm run dev -- review --diff
```

> [!NOTE]
> `swiss review` は標準入力（stdin）が必須です。空の場合はエラーで終了します。

### Web UI（設定画面）

#### 開発用に Web サーバーを起動
```bash
npm run web
```

#### CLI 経由で設定 UI を起動
```bash
swiss config
```

`swiss config` は、利用者のカレントディレクトリを `SWISS_BASE_DIR` として Web に渡し、
そのディレクトリ配下の `.swiss/` を編集対象として扱います。

終了するときはターミナルで `Ctrl-C` を押してください（サーバーも一緒に停止します）。

## グローバルインストールと nodenv まわり

グローバルインストール:
```bash
npm install -g .
```

`nodenv` を使っている場合は、必要に応じて `nodenv rehash` を実行してください。

`nodenv: swiss: command not found` が出る場合:
```bash
npm run -w cli build
npm install -g .
nodenv rehash
```

それでも解消しない場合は、以下で実行権限を確認してください（`x` が付いていること）。
```bash
ls -l cli/dist/index.js
```

## リリース/配布のメモ
- ルートの `npm run prepack` は `core` と `cli` を先にビルドします
- ルートの `bin` は `cli/dist/index.js` を指しています
