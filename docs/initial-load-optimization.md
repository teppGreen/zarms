# 初回ローディング速度改善レポート

**対象**: フロントエンド（デスクトップ版）の初回ロード時間削減

**スコープ**: 初回ページロード（ホーム画面表示まで）

## 問題分析

### 現象
フロントエンドアクセスから home 画面表示まで約 30 秒かかっており、ユーザー体験が著しく低下していた。

### 根本原因

HARデータ分析の結果、以下の課題を特定：

1. **過度な初期データ取得**
   - `_prefetchInitialData()` が 11 テーブル全てのマスタデータを事前取得していた
   - 取得対象: boards, apps, notices, links, members, directories, directoryAssignments, skills, skillAssignments, systemUpdates, tasks
   - home 画面は実際には `tasks`, `notices`, `logs` のみを使用
   - 不要なデータまで `JSON.stringify()` で HTML に埋め込まれていた

2. **テンプレート評価の重化**
   - GAS のテンプレート評価時に、大量のデータ JSON 化処理が発生
   - 結果として、GAS がボトルネックとなっていた

3. **二重データ取得**
   - server 埋め込みデータで初期データを受け取る
   - その直後に home 画面が同じデータを GAS から再取得していた

## 実装した改善

### 1. 初期データ取得の最小化

**ファイル**: `projects/frontend/src/main.js`

#### 変更内容
```
_prefetchInitialData() → 分割
├─ _prefetchHomeInitialData()    // home 画面用（tasks, notices, logs）
└─ _prefetchMasterData()          // その他マスタデータ（遅延ロード）
```

**効果**: 埋め込みデータサイズを大幅削減し、`JSON.stringify()` 処理時間を短縮

### 2. loadAppHtml() の最適化

**ファイル**: `projects/frontend/src/main.js`

home 画面専用の初期データのみを埋め込み：
```javascript
if (!isMobile) {
    templateVariables.initialData = _prefetchHomeInitialData(activeUser.id, useApiMode);
}
```

**効果**: テンプレート変数削減により、テンプレート評価時間が短縮

### 3. loadAllData() の部分的データ対応

**ファイル**: `projects/frontend/src/js.html`

embedded initialData が部分的（home 用のみ）でも対応：
```javascript
needsBackgroundMasterDataRefresh = !embedded.boards || !embedded.members || !embedded.skills;
```

**効果**: 
- 初回表示後、100ms 後にバックグラウンドでマスタデータ取得
- UI ブロッキングなしで段階的なデータロード

### 4. home 画面の即座表示

**ファイル**: `projects/frontend/src/pages/home-script.html`

initialData がある場合、GAS 呼び出しをスキップして即座に表示：
```javascript
// initialData があれば、即座にキャッシュから描画してから、
// バックグラウンドで最新データを取得
if (hasInitialData) {
    this.renderNextTasks(this.cachedTasks);
    this.renderNoticesForHome(this.cachedNotices);
    this.renderRelatedHistoryForHome();
    setTimeout(() => this.loadData(true), 100);
    return;
}
```

**効果**: 
- ユーザーが即座に home 画面を見ることが可能
- GAS 呼び出しの遅延実行により、ブロッキングなし

## 期待効果

### 定性評価
- **初回表示**: ほぼ即座（GAS テンプレート評価 + CSS/JS ロードのみ）
- **完全準備**: バックグラウンドで段階的にマスタデータをロード

### 定量期待値
- テンプレート評価時間: **50%-70% 削減**（推定）
- HTML 埋め込みデータサイズ: **80% 削減**（11 テーブル → 3 テーブルのみ）
- 全体ローディング時間: **30 秒 → 5-10 秒** への改善を想定

## 技術的詳細

### データフロー

```
① ユーザーアクセス
    ↓
② doGet() → loadAppHtml()
    ↓
③ _prefetchHomeInitialData() 実行
    ├─ tasks (DONE以外)
    ├─ notices
    └─ logs (7日以内)
    ↓
④ templateVariables.initialData に 3 データのみ埋め込み
    ↓
⑤ HTML テンプレート評価 & 返却
    ↓
⑥ ブラウザ rendering
    ↓
⑦ App.pages.home.loadData()
    ├─ initialData からキャッシュ初期化 ✅ (GAS呼び出しなし)
    ├─ UI 即座表示
    └─ 100ms 後、バックグラウンドで最新データ取得
```

### キャッシュ戦略

- **初回**: server 埋め込み initialData（tasks, notices, logs）
- **以降**: CacheService によるキャッシュ（GAS ライブラリが管理）

## 次のステップ（検討事項）

### 優先度高
1. **本番環境での検証**
   - ハイトラフィック下でのパフォーマンス確認
   - マスタデータロード遅延による UI 安定性確認

2. **ネットワークタイミング監視**
   - ブラウザ DevTools の Performance タブで詳細計測
   - Largest Contentful Paint (LCP) の改善を検証

### 優先度中
3. **index.html コンポーネント分割**
   - home 画面不要なモーダル（50+ include）の遅延ロード
   - さらに **20%-30% の改善** が期待可能

4. **_prefetchHomeInitialData() の最適化**
   - tasks フィルタリング（task_status_key != 'DONE'）のインデックス活用
   - GAS 側クエリ実行時間の計測 & 最適化

5. **CSS/JS バンドル最適化**
   - Beer CSS の未使用クラス削除
   - JavaScript コードスプリッティング

## 参考資料

- **データベーススキーマ**: [database-schema.mmd](../database-schema.mmd)
- **API リファレンス**: [api-reference.md](./api-reference.md)
- **GAS HTML Service ガイドライン**: [gas-html-service-practices/SKILL.md](../.github/skills/gas-html-service-practices/SKILL.md)

## 実装者ノート

- 本改善は、GAS テンプレート評価のボトルネック削減に重点を置いている
- home 画面表示後の マスタデータロード は非ブロッキングであり、バックグラウンドで進行
- 既存の CacheService 大依存しており、キャッシュ戦略の変更は影響が大きいため要注意
