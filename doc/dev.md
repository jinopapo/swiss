# 開発者向けドキュメント

このドキュメントは、swiss の開発に必要な情報をまとめたものです。

利用方法は README.md、設定ファイル仕様は doc/config.md、
設定UI の API 仕様は doc/api.md を参照してください。

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

### lint
リポジトリ全体（cli + core + web）で ESLint を実行します。
```bash
npm run lint
```

自動修正できるものを修正する場合:
```bash
npm run lint:fix
```

個別にビルドする場合:
```bash
npm run -w core build
npm run -w cli build
npm run -w web build
```

### CLI をローカル実行（ビルドなし）
```bash
echo "hello" | npm run dev -- review example1 --text
git diff | npm run dev -- review example2 --diff
```

レビュー実行前に `.swiss/contexts/<workflow>.md` を作成し、入力（stdin）の意味づけ
（例: git diff / 仕様テキスト）を記述してください。未作成または空の場合はエラーになります。

`stdin` が空の場合は、`--diff` 指定時のみ「差分なし」としてスキップされます。
`--diff` 以外ではエラーで終了します。

`review` は **workflow 名の指定が必須** です（`swiss review <workflow>`）。
指定した workflow に対応する `.swiss/flows/<workflow>.yaml` が存在しない場合はエラーになります。

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
