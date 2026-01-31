# ZARMS テストガイド

## 概要
このドキュメントでは、ZARMSアプリケーションのテスト方法について説明します。

## 開発環境の有効化

1. Google Apps Scriptのスクリプトプロパティで `MODE` を `development` に設定
2. アプリケーションを再読み込み
3. ブラウザのコンソールで `App.test` が利用可能になります

## テストヘルパー関数

### モックデータの生成
```javascript
// メンバーのモックデータを生成
const mockMember = App.test.createMockData('member', {
  display_name: 'カスタム名前'
});

// タスクのモックデータを生成
const mockTask = App.test.createMockData('task', {
  name: 'カスタムタスク名',
  task_status_key: 'IN_PROGRESS'
});

// ボードのモックデータを生成
const mockBoard = App.test.createMockData('board', {
  name: 'カスタムボード名'
});
```

### 状態のリセット
```javascript
// App.stateをクリア
App.test.resetState();
```

### モーダルの操作
```javascript
// すべてのモーダルを閉じる
await App.test.closeAllModals();
```

## 手動テストチェックリスト

### 認証フロー
- [ ] 正しいドメインのユーザーがログインできる
- [ ] 不正なドメインのユーザーがブロックされる
- [ ] メンテナンス時間中にメンテナンス画面が表示される

### データ操作
- [ ] タスクの作成・更新・削除が正しく動作する
- [ ] ボードの作成・更新・削除が正しく動作する
- [ ] メンバーの表示・フィルタリングが正しく動作する

### UI/UX
- [ ] モーダルが正しく開閉する
- [ ] フォーカスが適切に設定される
- [ ] エラーメッセージが適切に表示される
- [ ] スナックバーが正しく表示される

### セキュリティ
- [ ] XSS攻撃が防がれている（特殊文字入力のテスト）
- [ ] 危険なURLがブロックされる（javascript:, data:など）
- [ ] evalが使用されていない

### パフォーマンス
- [ ] 初期ロードが10秒以内に完了する
- [ ] タスク一覧の表示が滑らかである
- [ ] モーダルの開閉が快適である

## データベース依存性注入

テスト環境でデータベース操作をモック化する場合：

```javascript
// モック依存関係を設定
setDatabaseDependencies({
  utilitiesService: {
    getUuid: () => 'test-uuid-12345'
  }
});

// テスト実行
const uuid = generateUuid(); // 'test-uuid-12345' が返される

// 依存関係をリセット
resetDatabaseDependencies();
```

## テストのベストプラクティス

### 1. 開発環境でのテスト
- 本番環境に影響を与えないよう、必ず開発環境でテストを実行してください
- スクリプトプロパティの `DEV_SPREADSHEET_ID` を使用して、開発用のスプレッドシートを指定してください

### 2. テストデータの管理
- テスト用のデータは必ず `is_active = false` またはテスト用の識別子を付けてください
- テスト後は必ずクリーンアップを行ってください

### 3. ブラウザコンソールの活用
- ブラウザの開発者ツールを開いてテストを実行してください
- エラーメッセージやログを確認してください

### 4. 段階的なテスト
- まず小さな機能単位でテストを行ってください
- 統合テストは機能テストが完了してから実行してください

## トラブルシューティング

### App.testが利用できない
- スクリプトプロパティの `MODE` が `development` に設定されているか確認してください
- アプリケーションを再読み込みしてください

### テストデータが表示されない
- `App.state.data` を確認してください
- データがキャッシュされている可能性があるため、強制リフレッシュを試してください

### モーダルが閉じない
- ブラウザコンソールでエラーが発生していないか確認してください
- `App.test.closeAllModals()` を使用してすべてのモーダルを閉じてください

## 今後の拡張

現在は手動テストのみですが、将来的には以下を検討します：
- Google Apps Script用のユニットテストフレームワークの導入
- clasp + Jest によるローカルテスト
- E2Eテストの自動化
- CI/CDパイプラインの構築

## 参考資料

- [Google Apps Script Best Practices](https://developers.google.com/apps-script/guides/support/best-practices)
- [JavaScript Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
