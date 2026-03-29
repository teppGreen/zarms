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

### 自動更新の一時停止
```javascript
// autoRefreshを手動再開まで停止
App.test.pauseAutoRefresh();

// 30秒だけ停止して自動再開
App.test.pauseAutoRefresh(30000);

// 停止中のautoRefreshを手動で再開
App.test.resumeAutoRefresh();
```

## 手動テストチェックリスト

### 認証フロー
- [ ] 正しいドメインのユーザーがログインできる
- [ ] 不正なドメインのユーザーがブロックされる
- [ ] メンテナンス時間中にメンテナンス画面が表示される

### データ操作
- [ ] タスクの作成・更新・有効/無効切替が正しく動作する
- [ ] ボードの作成・更新・有効/無効切替が正しく動作する
- [ ] 人物の表示・フィルタリングが正しく動作する

### Members周辺の重点確認
- [ ] 人物詳細で所属組織の追加・解除ができる
- [ ] 組織詳細で所属人物の追加・解除ができる
- [ ] 技能詳細で人物割当とレベル更新ができる
- [ ] 失敗時に再同期され、一覧と詳細の表示が一致する
- [ ] HTMLテンプレートで `//` のみ `\\/\\/` 化され、`/` 単体（特に `</dialog>` などの閉じタグ）が `\/` 化されていない

### tab-catalog周辺の重点確認
- [ ] 列の非表示・再表示が正しく動作する
- [ ] 「列表示をリセット」で全列表示に戻る
- [ ] 「CSV出力」で現在タブのCSVを取得できる

### APIセキュリティ
- [ ] HMAC署名エラー時に操作が拒否される
- [ ] タイムスタンプ許容範囲外の操作が拒否される
- [ ] 権限不足時にwrite操作が拒否される

### UI/UX
- [ ] モーダルが正しく開閉する
- [ ] フォーカスが適切に設定される
- [ ] エラーメッセージが適切に表示される
- [ ] スナックバーが正しく表示される

### タブ追加時の共通確認
- [ ] 新規タブの主要描画領域に `data-tab-render-root` を付与している
- [ ] `data-tab-render-root` または `hasRenderedContent()` により、タブ再訪時の白画面フリッカーが発生しない

### Detailモーダル統一
- [ ] member/planのタブ切替が`data-ui`で動作し、`switchTab`依存がない
- [ ] member detailの主ボタンが「変更なし=閉じる」「変更あり=変更を保存」に切り替わる
- [ ] 保存中は主要操作（閉じる/破棄/保存）が無効化される
- [ ] reset後に初期タブへ戻る（member: profile, plan: description）
- [ ] 未保存変更ありで閉じる時に確認ダイアログが表示される

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

### テストデータが表示されない
- `App.state.data` を確認してください
- データがキャッシュされている可能性があるため、強制リフレッシュを試してください

### モーダルが閉じない
- ブラウザコンソールでエラーが発生していないか確認してください
- `App.test.closeAllModals()` を使用してすべてのモーダルを閉じてください

### モーダルが開かない（タグ崩れの疑い）
- HTMLテンプレートに `<\\/dialog>` のような誤エスケープがないか確認してください
- 閉じタグ（`</dialog>`, `</div>`, `</script>`）の `/` はエスケープしないでください
- エスケープ対象は `//` のみで、単一 `/` は対象外です

## 参考資料

- [Google Apps Script Best Practices](https://developers.google.com/apps-script/guides/support/best-practices)
- [JavaScript Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
