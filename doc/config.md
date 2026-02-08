# 設定ファイル仕様
## .swiss/swiss.yaml
ワークフローを定義するyaml
```
model: gpt-5.3
reivews:
  - name: review1
    description: コードの品質に関するレビュー
    model: gpt-4.5
    parallel: true
  - name: review2
    description: セキュリティに関するレビュー
```
### model
デフォルトで使用するモデルを指定します。
### reviews
ワークフロー内の各レビューを定義します。
#### reviews[].name
レビューの名前を指定します。
#### reviews[].description
レビューの説明を記述します。
#### reviews[].parallel
このレビューを他のレビューと並列で実行するかどうかを指定します。trueの場合、並列実行されます。
#### reviews[].model
このレビューで使用するモデルを指定します。指定しない場合、デフォルトのmodelが使用されます。

## .swiss/prompts/{review_name}.md
各レビューで使用するプロンプトを定義するmarkdownファイル
```
# コードの品質に関するレビュー
以下のコードの品質についてレビューしてください。
```