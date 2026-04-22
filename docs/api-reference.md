# Database Access Reference

このドキュメントは、現在のZARMSにおけるデータアクセス方式（`ZARMS_DB` ライブラリ経由）を説明します。

## 現在の方式

- `projects/database` は GAS ライブラリとしてデータ操作を提供します。
- `projects/frontend` と `projects/mobile-app` は、このライブラリを直接呼び出します。
- 旧 `database API (doPost + HMAC署名)` は廃止済みです。

## セキュリティの基本方針

- ユーザー識別はサーバー側の `Session.getActiveUser().getEmail()` で行います。
- クライアントから受け取ったメールアドレスは認証情報として扱いません。
- 認可は `permissions` テーブルを用いた既存ルールに従います。

## 権限評価ルール

`permissions` テーブルの評価優先順位は次の通りです。

1. `record_id` と `email` が一致
2. `record_id` が一致し `email` が空
3. `record_id` が空で `email` が一致
4. `record_id` と `email` が共に空

## 実装ガイド

- frontend/mobile-app からは `db_bridge.js` を通して `ZARMS_DB` を呼び出してください。
- 追加の公開エンドポイント（`doPost` など）は作成せず、ライブラリ関数として責務を分離してください。
- 認可判定に関する仕様は `projects/database` 側へ集約し、クライアント側で重複実装しないでください。

## マニフェスト要件（重要）

- `projects/database` の書き込み系処理は Google Sheets API（Advanced Service, v4）に依存します。
- そのためライブラリ呼び出し側（`projects/frontend` / `projects/mobile-app`）でも、実行プロジェクトの `appsscript.json` に必要な設定が必要です。

例:

```json
{
	"dependencies": {
		"enabledAdvancedServices": [
			{
				"userSymbol": "Sheets",
				"serviceId": "sheets",
				"version": "v4"
			}
		]
	}
}
```

- エラー `Service Google Sheets API has not been enabled for your Apps Script-managed Cloud Platform project` が発生した場合は、呼び出し側のマニフェスト設定を確認し、再デプロイしてください。

## 廃止された設定

以下の ScriptProperties は現行構成では不要です。

- `DB_API_URL`
- `DB_API_SECRET`

既存環境に残っていても動作に影響はありませんが、新規設定は行わないでください。
