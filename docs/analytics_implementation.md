# Google Analytics & Microsoft Clarity 実装ドキュメント

## 概要

ZARMSにGoogle Analytics 4 (GA4) とMicrosoft Clarityを導入し、ユーザー行動の分析を可能にしました。

## セキュリティ対策

### トラッキングIDの管理

トラッキングIDは**scriptProperties**に保存され、コードに直書きされることはありません。

#### 設定方法

Google Apps Scriptのプロジェクト設定で、以下のプロパティを設定してください：

1. **GA4測定ID**: `GA4_MEASUREMENT_ID`
   - 形式: `G-XXXXXXXXXX`
   - Google Analytics 4プロパティから取得

2. **ClarityプロジェクトID**: `CLARITY_PROJECT_ID`
   - 形式: 英数字の文字列
   - Microsoft Clarityダッシュボードから取得

#### 設定手順

```
Apps Scriptエディタ → プロジェクトの設定 → スクリプト プロパティ
```

1. 「スクリプト プロパティを追加」をクリック
2. プロパティ名: `GA4_MEASUREMENT_ID`、値: `G-XXXXXXXXXX`
3. 「スクリプト プロパティを追加」をクリック
4. プロパティ名: `CLARITY_PROJECT_ID`、値: `your-project-id`

## 実装内容

### 1. 定数定義（src/constants.js）

```javascript
const ANALYTICS_CONFIG = {
  GA4_MEASUREMENT_ID: scriptProperties.getProperty('GA4_MEASUREMENT_ID') || '',
  CLARITY_PROJECT_ID: scriptProperties.getProperty('CLARITY_PROJECT_ID') || ''
};
```

### 2. テンプレート変数への追加（src/main.js）

`doGet`関数と`loadMainApp`関数の両方で、`ANALYTICS_CONFIG`をtemplateVariablesに追加しています。

### 3. トラッキングコードの実装

#### 3.1 register.html（サインイン/サインアップ画面）

- GA4スクリプトを動的に読み込み
- 初回ページビューを自動送信（`/register`）
- Clarityスクリプトを動的に読み込み

#### 3.2 index.html（メインアプリケーション）

- GA4スクリプトを動的に読み込み
- 初回ページビューの自動送信を**無効化**（`send_page_view: false`）
- `gtag`関数をグローバルスコープで利用可能に設定
- Clarityスクリプトを動的に読み込み

### 4. SPA対応（シングルページアプリケーション）

ZARMSはSPAとして実装されており、タブ切り替え時に`display: none/block`でDOM要素を切り替えます。このため、手動でページビューイベントを送信する必要があります。

#### 4.1 アナリティクスユーティリティ関数（src/js.html）

```javascript
/**
 * Google Analytics 4にページビューを送信します（SPA用）
 */
function sendGA4PageView(pagePath, pageTitle) {
  if (typeof window.gtag === 'function' && window.GA4_MEASUREMENT_ID) {
    window.gtag('event', 'page_view', {
      page_path: pagePath,
      page_title: pageTitle
    });
  }
}

/**
 * Microsoft Clarityにカスタムタグを設定します
 */
function setClarityTag(key, value) {
  if (typeof window.clarity === 'function') {
    window.clarity('set', key, value);
  }
}
```

#### 4.2 タブ切り替え時の送信（src/components/headers/navigation_left.html）

`App.utils.navigation.switchTab`関数内で、タブ切り替え完了後にアナリティクスイベントを送信：

```javascript
// Google Analytics 4にページビューを送信
if (typeof sendGA4PageView === 'function') {
    sendGA4PageView(pagePath, pageTitle);
}

// Microsoft Clarityにタブ情報を送信
if (typeof setClarityTag === 'function') {
    setClarityTag('current_tab', tabName);
}
```

## 取得可能なデータ

### Google Analytics 4

#### ページビュー

- **register.html**: `/register` - サインイン/サインアップ画面
- **ホーム**: `/home` - ホームタブ
- **メンバー**: `/members` - メンバータブ
- **カレンダー**: `/calendar` - カレンダータブ
- **マイボード**: `/board/my-board` - マイボードタブ
- **個別ボード**: `/board/{board-id}` - 各ボードタブ

#### 自動収集されるイベント

GA4は以下のイベントを自動的に収集します：

- `page_view`: ページビュー（手動送信）
- `click`: クリックイベント（拡張計測が有効な場合）
- `scroll`: スクロールイベント（拡張計測が有効な場合）
- `file_download`: ファイルダウンロード（拡張計測が有効な場合）
- `video_*`: 動画再生イベント（拡張計測が有効な場合）

#### カスタムイベントの追加（将来の拡張）

必要に応じて、以下のようなカスタムイベントを追加できます：

```javascript
// タスク作成イベント
window.gtag('event', 'task_created', {
  board_id: boardId,
  task_status: status
});

// モーダル表示イベント
window.gtag('event', 'modal_opened', {
  modal_type: modalType
});
```

### Microsoft Clarity

Clarityは以下のデータを自動的に収集します：

#### セッションレコーディング

- ユーザーの操作を動画として記録
- クリック、スクロール、入力などの操作を可視化
- 個人情報は自動的にマスキング

#### ヒートマップ

- クリックヒートマップ: ユーザーがクリックした場所を可視化
- スクロールヒートマップ: ユーザーがスクロールした範囲を可視化

#### カスタムタグ

現在の実装では、タブ切り替え時に`current_tab`タグを設定しています：

- `current_tab`: 現在表示中のタブ名（例: `home`, `board-uuid`）

#### 追加できるカスタムタグ（将来の拡張）

```javascript
// ユーザーロール
setClarityTag('user_role', 'admin');

// 所属ディレクトリ
setClarityTag('directory', 'marketing');
```

## 動作確認方法

### Google Analytics 4

1. Google Analyticsダッシュボードにログイン
2. 「リアルタイム」レポートを開く
3. ZARMSにアクセスして、タブを切り替える
4. リアルタイムレポートでページビューが記録されることを確認

### Microsoft Clarity

1. Microsoft Clarityダッシュボードにログイン
2. プロジェクトを選択
3. 「Recordings」タブでセッションレコーディングを確認
4. 「Heatmaps」タブでヒートマップを確認

## 注意事項

### プライバシー

- このシステムは業務システムであり、組織内のメンバーのみが使用します
- Google AnalyticsとMicrosoft Clarityは、データ処理規約に基づいてデータを処理します
- 必要に応じて、プライバシーポリシーを更新してください

### パフォーマンス

- トラッキングスクリプトは非同期で読み込まれるため、ページの読み込み速度に影響しません
- IDが設定されていない場合、トラッキングスクリプトは読み込まれません

### デバッグ

ブラウザのコンソールで以下のログを確認できます：

```
[Analytics] GA4 page_view sent: /home ホーム
[Analytics] Clarity tag set: current_tab home
```

## トラブルシューティング

### データが記録されない場合

1. scriptPropertiesに正しいIDが設定されているか確認
2. ブラウザのコンソールでエラーが出ていないか確認
3. 広告ブロッカーやプライバシー拡張機能を無効化
4. Google Analytics 4の管理画面で「データストリーム」が正しく設定されているか確認

### IDの確認方法

Apps Scriptエディタのコンソールで以下を実行：

```javascript
const scriptProperties = PropertiesService.getScriptProperties();
Logger.log('GA4_MEASUREMENT_ID:', scriptProperties.getProperty('GA4_MEASUREMENT_ID'));
Logger.log('CLARITY_PROJECT_ID:', scriptProperties.getProperty('CLARITY_PROJECT_ID'));
```

## まとめ

この実装により、ZARMSは以下を実現します：

1. **セキュア**: トラッキングIDはscriptPropertiesで管理
2. **SPA対応**: タブ切り替え時も正確にページビューを送信
3. **詳細な分析**: ユーザー行動を可視化し、UX改善に活用可能
4. **拡張可能**: カスタムイベントやタグを追加して、さらに詳細な分析が可能
