# Table Coverage Checklist

Phase4-5で変更した画面・機能に対して、対象テーブルの閲覧/編集/保存/再読込の到達確認を管理するチェックシート。

## Frontend Coverage

- [ ] `notices`: home表示、notices一覧表示、詳細表示
- [ ] `links`: noticesタブで一覧表示、追加、更新、削除
- [ ] `logs`: home更新履歴、insights曜日別集計
- [ ] `apps`: navigation-top のリンク一覧表示
- [ ] `system_updates`: infoメニュー表示、更新検知モーダル

## Access Mode Coverage

- [ ] Libraryモードで `handleDatabaseProcess` / `handleBatchDatabaseProcess` が動作
- [ ] APIモードで同等動作し、`useApiMode` が全呼び出しに伝播
- [ ] registerフローで `findUserBySlackUrl` / `registerUserEmail` が `useApiMode` 連携

## UI State Coverage

- [ ] home/notices/insights で loading/empty/error の3状態が崩れない
- [ ] notices詳細を Esc で閉じてもクリック不能状態にならない
- [ ] Alt+6/Alt+7/Alt+R が期待通りに動作

## Deployment

- [ ] `npm run deploy:frontend:dev` 実行
- [ ] デプロイ後に主要導線（home/notices/insights）を手動確認
