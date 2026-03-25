# Database API Endpoint Reference

このドキュメントは、データベースをWebアプリとして公開するためのAPI（`projects/database/src/features/api_handler.js` の `doPost`）の仕様と、その強固なセキュリティ設計について詳細に解説します。

## セキュリティ設計の全体像

ZARMSのAPIは、データソース（Google Sheets）の直接的なアクセス権限をユーザーに与えず、安全な中間レイヤーを通じて操作を制限する「最小権限の原則」に基づいて設計されています。

### 1. 多層的な防御策 (Multi-layered Defense)

| レイヤー | 対策技術 | 目的 |
| :--- | :--- | :--- |
| **認証 (Authentication)** | Google 認証 & `getActiveUser` | アクセス者の特定。フロントエンドからの偽装は不可能です。 |
| **整合性 (Integrity)** | HMAC-SHA256 署名 | 通信内容の改ざん防止。共有シークレットを知る者のみが有効な署名を生成できます。 |
| **鮮度 (Freshness)** | タイムスタンプ検証 | リプレイアタック（有効なリクエストの再利用）の防止。 |
| **認可 (Authorization)** | 権限テーブル連携 | `permissions` テーブルに基づき、レコード単位のアクセス制御を行います。 |
| **堅牢化 (Hardening)** | `secureCompare` | タイミング攻撃（比較時間の差異による情報漏洩）を防止します。 |

### 2. HMAC署名の詳細仕様

リクエストの改ざんを防ぐため、共有シークレット（`DB_API_SECRET`）を用いてHMAC-SHA256で署名検証を行います。

*   **署名対象文字列の生成**:
    以下のパラメータをパイプ記号（`|`）で結合します。
    `timestamp|tableName|operation|dataObjectJson|forceRefreshString`
    *(例: `2026-03-13T04:00:00Z|tasks|select|{"where":{"id":["=","task_1"]}}|false`)*
*   **検証プロセス**:
    API側でリクエストデータから再度同一の署名を計算し、クライアントから送られた `signature` と **定時間比較 (`secureCompare`)** を行います。これにより、1ビットの改ざんも検知可能です。

### 3. タイムスタンプ検証 (リプレイアタック防止)

クライアントはリクエスト送信時の時刻を `ISO 8601` 形式で含める必要があります。
API側では、現在時刻とリクエスト時刻の差が **±5分以内 (`API_AUTH_CONFIG.TIMESTAMP_TOLERANCE_MS`)** であることを確認します。この許容範囲を超えたリクエストは、たとえ署名が正しくても無効として却下されます。

### 4. ユーザー識別と実行権限

*   **非識別リクエスト**: フロントエンドからメールアドレスなどは送信しません。
*   **サーバー側取得**: GASの実行環境が提供する `Session.getActiveUser().getEmail()` を使用して、アクセス元のGoogleアカウントを特定します。この情報はGoogleによって保証されており、フロントエンド側で操作することはできません。

## 権限の評価ルールと優先順位

`permissions` テーブルで定義されるアクセス権限は、以下の優先度（より具体的な条件が優先される）で評価されます。

1.  **レコード限定権限**: `record_id` と `email` が共に一致（特定ユーザーへの特定レコード操作許可）。
2.  **共有レコード権限**: `record_id` が一致し `email` が空（全ユーザーへの特定レコード操作許可）。
3.  **テーブル全体権限**: `record_id` が空で `email` が一致（特定ユーザーへのテーブル全体操作許可）。
4.  **公開テーブル権限**: `record_id` ・ `email` 共に空（全ユーザーへのテーブル全体操作許可）。

## リクエスト形式 (POSTボディ JSON)

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

*   **`timestamp`** (String): ISO 8601形式。サーバーとクライアントの間で時刻が同期されている必要があります。
*   **`tableName`** (String): 操作対象テーブル名。
*   **`operation`** (String): `select`, `insert`, `update`, `remove`, `bulkinsert` のいずれか。
*   **`dataObject`** (Object): クエリ条件や保存データ。空の場合は `{}`。
*   **`forceRefresh`** (Boolean): サーバーキャッシュを無視してSSから直接読み込む場合に `true`。
*   **`signature`** (String): HMAC-SHA256ハッシュの16進数文字列。

## 運用上の注意点

1.  **秘密鍵の管理**: `DB_API_SECRET` はスクリプトのプロパティとして安全に保管し、決してコード内にハードコードしないでください。
2.  **エラーレスポンス**: セキュリティの観点から、権限不足や署名エラー時に詳細な内部情報（スタックトレース等）を返さないように制御されています。
3.  **HTTPS強制**: GAS Web App は常にHTTPS経由で通信されるため、経路上の暗号化はGoogleによって保証されています。
