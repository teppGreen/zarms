# Database API Endpoint Reference

このドキュメントは、unauthorizedユーザー向けにデータベースをWebアプリとして公開するためのAPI（`projects/database/src/features/api_handler.js` の `doPost`）の仕様とセキュリティ設計を解説します。

## セキュリティ設計

* **HMACシグネチャ**: リクエストの改ざんを防ぐため、共有シークレット（`DB_API_SECRET`）を用いてHMAC-SHA256で署名検証を行います。署名対象のメッセージはリクエスト内のパラメータを用いて構築されます。
* **タイムスタンプ検証**: リプレイアタックを防止するため、リクエスト送信時のタイムスタンプをISO 8601形式で送信し、API側で指定範囲内（例: 許容範囲内）の時間であるかチェックします。
* **ユーザー識別**: クライアントから送信されるリクエストにはユーザーの識別情報（メールアドレス等）を含めません。GASのWebアプリ実行権限を利用し、サーバー側で `Session.getActiveUser().getEmail()` を用いてアクセス元のGoogleアカウントを特定します。
* **アクセス制御**: `permissions` テーブルに基づき、各ユーザーのレコード単位・テーブル単位のアクセス権限（`can_read` / `can_write`）を動的に検証します。

## 権限の評価ルールと優先順位

`permissions` テーブルで定義されるアクセス権限は、以下の優先度（より具体的な条件が優先される）で評価されます。

1. **`record_id` が一致し `email` が一致する行**（特定ユーザーへの特定のレコード権限）
2. **`record_id` が一致し `email` が NULL の行**（全員への特定のレコード権限）
3. **`record_id` が NULL で `email` が一致する行**（特定ユーザーへのテーブル全体に対する権限）
4. **`record_id` が NULL で `email` が NULL の行**（全員に対するテーブル全体への権限）

## リクエスト形式 (POSTボディ JSON)

以下は、`doPost` エンドポイントが期待するリクエストボディのJSON形式です。

```json
{
  "timestamp":  "2026-03-13T04:00:00.000Z",
  "tableName":  "tasks",
  "operation":  "select",
  "dataObject": {
    "where": {
      "id": ["=", "task_12345"]
    }
  },
  "forceRefresh": false,
  "signature":  "a1b2c3d4e5f6..."
}
```

### パラメータ解説

* **`timestamp`** (String): リクエストを生成したタイムスタンプ（ISO 8601形式）。サーバー側でリプレイアタック検証に使用。
* **`tableName`** (String): DB操作対象のテーブル名（例: `tasks`, `members`, `boards`）。
* **`operation`** (String): 実行する操作名。許可されている操作リスト（`ALLOWED_OPERATIONS`）に含まれている必要があります（例: `select`, `insert`, `update`, `remove`, `bulkinsert`）。
* **`dataObject`** (Object): クエリ条件（`where`, `set`, `orderBy`等）やデータベースへ保存するデータを含むオブジェクト。
* **`forceRefresh`** (Boolean): `true` を指定すると、サーバー側のキャッシュを無視してスプレッドシートから最新データを取得します（主に `select` 操作で使用）。
* **`signature`** (String): `timestamp`, `tableName`, `operation`, `dataObject`（をJSON化したもの）, `forceRefresh`（"true" または "false" の文字列）を決められた順序で結合し、`DB_API_SECRET` を鍵として計算したHMAC-SHA256署名（16進数文字列）。
  * 結合順序: `timestamp|tableName|operation|dataObjectJson|forceRefreshString`
