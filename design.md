# **Creative Team Management System v3.0 詳細設計書**

## **1. システムアーキテクチャ**

### **1.1. 全体構成**

CTMS v3.0は、以下の3層アーキテクチャで構成されています：

```
┌─────────────────────────────────────────┐
│  フロントエンド (HTML/CSS/JavaScript)    │
│  - index.html                           │
│  - css.html                             │
└──────────────┬──────────────────────────┘
               │ google.script.run
               │ (非同期通信)
┌──────────────▼──────────────────────────┐
│  バックエンド (Google Apps Script)       │
│  - Code.gs (メインロジック)               │
│  - Database.gs (データベース操作)        │
│  - Constants.gs (定数定義)               │
└──────────────┬──────────────────────────┘
               │ SpreadsheetApp API
               │ DriveApp API
               │ GmailApp API
┌──────────────▼──────────────────────────┐
│  データストレージ                         │
│  - Google スプレッドシート (DB)          │
│  - Google ドライブ (ファイル管理)        │
└──────────────────────────────────────────┘
```

### **1.2. ファイル構成**

#### **バックエンド (.gsファイル)**

- **Code.gs**: メインロジックとWebアプリのエントリーポイント
  - `doGet()`: Webアプリのエントリーポイント
  - 各エンティティ（Works, Projects, Members, Tasks, Knowledge, Review Requests）のCRUD操作
  - 認証・認可処理
  - 統計データ取得
  - ヘルパー関数群

- **Database.gs**: データベース操作の抽象化レイヤー
  - `getAllData()`: 全データ取得
  - `getDataById()`: IDによる単一データ取得
  - `findData()`: 条件による検索
  - `createData()`: データ作成
  - `updateData()`: データ更新
  - `deleteData()`: データ削除
  - `logOperation()`: 操作ログ記録

- **Constants.gs**: 定数定義
  - `SPREADSHEET_ID`: スプレッドシートID
  - `SHEET_NAMES`: シート名の定数
  - `ID_COLUMNS`: 各シートの主キーカラム名

#### **フロントエンド**

- **index.html**: メインHTMLとJavaScript
  - UI構造定義
  - タブ切り替えロジック
  - データ表示・編集ロジック
  - モーダル・オーバーレイ管理
  - Google Charts統合

- **css.html**: スタイルシート
  - Tailwind CSSベースのカスタムスタイル
  - レスポンシブデザイン

## **2. データフロー**

### **2.1. ページ読み込みフロー**

```
1. ユーザーがWebアプリにアクセス
   ↓
2. doGet() が実行される
   ↓
3. 認証チェック (isAuthorizedUser())
   - membersシートにユーザーのメールアドレスが存在するか確認
   - 存在しない場合: アクセス拒否ページを表示
   ↓
4. index.html をレンダリング
   ↓
5. クライアント側JavaScriptが実行される
   ↓
6. 初期データ読み込み
   - getCurrentUser(): 現在のユーザー情報取得
   - 権限に応じてUI要素の表示/非表示を制御
   - デフォルトタブ（Home）のデータを読み込み
```

### **2.2. データ取得フロー**

```
1. フロントエンド: callGAS() を呼び出し
   ↓
2. google.script.run でバックエンド関数を実行
   ↓
3. バックエンド: スプレッドシートからデータ取得
   - getSheet(): シートオブジェクト取得
   - getDataRange(): データ範囲取得
   - getValues(): 値を取得
   - mapData(): オブジェクト配列に変換
   ↓
4. 関連データのエンリッチメント
   - リレーション先のデータを取得
   - configシートから表示用の値を取得
   ↓
5. sanitizeForClient(): DateオブジェクトをISO文字列に変換
   ↓
6. フロントエンド: データを受信してUIに反映
```

### **2.3. データ作成フロー**

```
1. フロントエンド: フォーム入力
   ↓
2. バリデーション（クライアント側）
   ↓
3. callGAS() でバックエンド関数を呼び出し
   ↓
4. バックエンド: 権限チェック
   - canEdit() または isAdmin()
   ↓
5. ID生成（必要に応じて）
   - generateNextId(): LockServiceでロック取得
   - 最終IDを読み取り
   - 次のIDを生成
   ↓
6. 関連リソース作成（Work作成の場合）
   - createWorkFolder(): Googleドライブにフォルダ作成
   - createWorkDocument(): Googleドキュメント作成
   ↓
7. データ作成
   - createData(): スプレッドシートに書き込み
   - logOperation(): 操作ログ記録
   ↓
8. 通知送信（Work作成の場合）
   - sendNewWorkNotification(): メール送信
   ↓
9. フロントエンド: 成功/失敗を表示
```

### **2.4. データ更新フロー**

```
1. フロントエンド: インライン編集またはフォーム送信
   ↓
2. バックエンド: 権限チェック
   ↓
3. 更新前のデータを取得（ログ記録用）
   ↓
4. 更新実行
   - updateData(): スプレッドシートの該当セルを更新
   ↓
5. フィールドごとにログ記録
   - logOperation(): 各フィールドの変更を個別に記録
   ↓
6. フロントエンド: UIを更新
```

## **3. 主要機能の詳細動作**

### **3.1. ID生成機能 (generateNextId)**

**目的**: 同時実行によるID重複を防ぎながら、連番形式のIDを生成する。

**処理フロー**:
```
1. LockService.getScriptLock() でロックを取得
   - waitLock(30000): 最大30秒待機
   ↓
2. スプレッドシートのシートを取得
   ↓
3. 最終行を取得
   ↓
4. IDカラムのインデックスを取得
   ↓
5. データ行が存在する場合:
   - 最終行のIDを読み取り
   - プレフィックスを除去
   - 数値部分を抽出
   - +1 して次の番号を計算
   ↓
6. データ行が存在しない場合:
   - 1から開始
   ↓
7. 4桁のゼロパディング
   - String(nextNumber).padStart(4, '0')
   ↓
8. プレフィックス + 番号 でIDを生成
   ↓
9. ロックを解放
```

**使用例**:
- `generateNextId(SHEET_NAMES.WORKS, 'W')` → "W0001", "W0002", ...
- `generateNextId(SHEET_NAMES.PROJECTS, 'P')` → "P0001", "P0002", ...
- `generateNextId(SHEET_NAMES.TASKS, 'T')` → "T0001", "T0002", ...
- `generateNextId(SHEET_NAMES.REVIEW_REQUESTS, 'R')` → "R0001", "R0002", ...

### **3.2. Work作成機能 (createWork)**

**処理フロー**:
```
1. ユーザー情報取得
   - Session.getActiveUser().getEmail()
   ↓
2. Work ID生成
   - generateNextId(SHEET_NAMES.WORKS, 'W')
   ↓
3. Project ID取得または作成
   - getOrCreateProjectId():
     * 既存のproject_titleを検索
     * 見つからない場合は新規作成
   ↓
4. フォルダ作成
   - createWorkFolder():
     * configシートから親フォルダID取得
     * {work_id}_{work_title} の名称でフォルダ作成
   ↓
5. Googleドキュメント作成
   - createWorkDocument():
     * ドキュメント名: "{work_id} {work_title} ドキュメント"
     * セクション追加:
       - "制作物の概要" (work_detail_content)
       - "デザイン要項" (work_detail_design)
       - "入稿規定" (work_detail_regulation)
       - "依頼者からの備考" (work_detail_note)
     * フォルダに移動
   ↓
6. Workレコード作成
   - createData(SHEET_NAMES.WORKS, newWork)
   ↓
7. 通知メール送信
   - sendNewWorkNotification():
     * configシートから通知先メールアドレス取得
     * GmailApp.sendEmail() で送信
   ↓
8. Work IDを返却
```

### **3.3. 認証・認可機能**

#### **認証 (isAuthorizedUser)**

```
1. Session.getActiveUser().getEmail() でユーザーのメールアドレス取得
   ↓
2. getMemberByEmail() でmembersシートから検索
   ↓
3. メンバーが見つかれば認証成功
```

#### **認可チェック**

- **isAdmin()**: role_key === 'ADMIN'
- **canEdit()**: role_key === 'ADMIN' || role_key === 'EDITOR'
- **getUserRole()**: 現在のユーザーのrole_keyを返却

**権限レベル**:
- ADMIN (3): 全操作可能、メンバー管理可能
- EDITOR (2): 閲覧・作成・編集可能
- VIEWER (1): 閲覧のみ
- NONE (0): アクセス不可

### **3.4. 操作ログ機能 (logOperation)**

**目的**: すべてのデータ操作を記録し、監査証跡を残す。

**処理フロー**:
```
1. ログシートの初期化チェック
   - initializeLogSheet():
     * logsシートが存在しない場合は作成
     * ヘッダー行を設定
   ↓
2. 操作種別に応じたログ記録
   - 'add': レコード全体をnew_valueに保存
   - 'modified': 変更されたフィールドごとに個別ログ
     * old_value: 変更前の値（JSON形式）
     * new_value: 変更後の値（JSON形式）
   - 'delete': レコード全体をold_valueに保存
   ↓
3. sanitizeForClient() でDateオブジェクトを変換
   ↓
4. JSON.stringify() で文字列化
   ↓
5. logsシートに追加
```

**注意**: logsシートへの操作はログを記録しない（循環記録回避）。

### **3.5. ワークフローステータス取得 (getWorkflowTimestamps)**

**目的**: Workの各ステージ（依頼・制作・承認・納品）の日時を取得する。

**処理フロー**:
```
1. Workデータ取得
   ↓
2. logsシートから該当Workのステータス変更ログを取得
   - record_id = work_id
   - column_id = 'work_status_key'
   ↓
3. created_atの降順でソート
   ↓
4. 各ステータスに対応するログを検索
   - request: 'TO-DO'
   - production: 'CREATE'
   - approval: 'APPROVED' または 'REVIEW'（APPROVEDを優先）
   - delivery: 'DELIVERED'（なければdue_datetime）
   ↓
5. タイムスタンプオブジェクトを返却
```

### **3.6. レビュー依頼作成 (createReviewRequest)**

**処理フロー**:
```
1. Review Request ID生成
   - generateNextId(SHEET_NAMES.REVIEW_REQUESTS, 'R')
   ↓
2. Review Requestレコード作成
   - createData(SHEET_NAMES.REVIEW_REQUESTS, newReviewRequest)
   ↓
3. ファイル処理
   - 各file_idに対して:
     * review_request_filesシートにレコード作成
     * file_idとreview_request_idを保存
   ↓
4. Review Request IDを返却
```

**ファイルアップロード処理**:
```
1. フロントエンド: ファイルをBase64エンコード
   ↓
2. uploadFileToWorkFolder() を呼び出し
   ↓
3. バックエンド:
   - Workのwork_folder_idを取得
   - Utilities.base64Decode() でデコード
   - Utilities.newBlob() でBlob作成
   - folder.createFile() でアップロード
   ↓
4. ファイルIDを返却
```

## **4. UIコンポーネントの動作**

### **4.1. タブ切り替え (switchTab)**

```
1. 現在表示中のオーバーレイを閉じる
   ↓
2. アクティブなナビゲーションアイテムを更新
   ↓
3. すべてのタブコンテンツを非表示
   ↓
4. 選択されたタブを表示
   ↓
5. loadTabData() でデータを読み込み
```

### **4.2. Work詳細オーバーレイ表示**

```
1. openWorkDetailOverlay(workId) が呼び出される
   ↓
2. ローディング表示
   ↓
3. getWorkById(workId) でデータ取得
   ↓
4. 関連データ取得
   - tasks: getTasksByWorkId()
   - review_requests: getReviewRequestsByWorkId()
   - assignees: getWorkAssignees()
   ↓
5. ワークフローステータス取得
   - getWorkflowTimestamps()
   ↓
6. UI構築
   - ヘッダー: Work IDとタイトル
   - ワークフローステータスバー
   - 左側: 案件情報
   - 中央: Googleドキュメント埋め込み
   - 右側: タスク一覧とレビュー依頼一覧
   ↓
7. オーバーレイを表示
```

### **4.3. Googleドキュメント埋め込み**

```
1. work_document_idを取得
   ↓
2. Googleドキュメントの埋め込みURLを生成
   - https://docs.google.com/document/d/{document_id}/preview
   ↓
3. iframe要素を作成
   - src属性に埋め込みURLを設定
   - width: 100%, height: 100%
   ↓
4. コンテナに追加
```

### **4.4. ID検索機能**

```
1. ユーザーがIDを入力（例: W0001）
   ↓
2. プレフィックスを判定
   - 'P': Project
   - 'W': Work
   - 'T': Task
   - 'R': Review Request
   ↓
3. 対応する詳細画面を開く
   - openProjectDetailOverlay()
   - openWorkDetailOverlay()
   - など
   ↓
4. URLパラメータにIDを設定（ブックマーク対応）
```

## **5. エラーハンドリング**

### **5.1. 認証エラー**

```
1. isAuthorizedUser() が false を返す
   ↓
2. doGet() でアクセス拒否ページを表示
   - "アクセス権限がありません"
```

### **5.2. 権限エラー**

```
1. 編集操作時に canEdit() が false
   ↓
2. バックエンドでエラーをスロー
   - throw new Error('この操作には編集権限が必要です。')
   ↓
3. フロントエンドでエラーメッセージを表示
```

### **5.3. データ取得エラー**

```
1. スプレッドシートアクセスエラー
   ↓
2. try-catch でエラーをキャッチ
   ↓
3. Logger.log() でログ記録
   ↓
4. フロントエンドにエラーメッセージを返却
```

### **5.4. ファイル操作エラー**

```
1. Googleドライブアクセスエラー
   ↓
2. エラーメッセージを返却
   - "ファイルが見つかりません"
   - "フォルダ作成エラー"
   ↓
3. フロントエンドでアラート表示
```

## **6. セキュリティ**

### **6.1. 認証**

- Googleアカウント認証を使用
- membersシートに登録されていないユーザーはアクセス不可
- `Session.getActiveUser().getEmail()` でユーザー識別

### **6.2. 認可**

- すべての編集操作で権限チェックを実施
- ADMIN権限が必要な操作:
  - メンバー作成・編集
  - メンバーの権限変更
- EDITOR権限が必要な操作:
  - データの作成・編集
- VIEWER権限:
  - 閲覧のみ

### **6.3. データ検証**

- フロントエンド: クライアント側バリデーション
- バックエンド: サーバー側バリデーション
- project_titleの重複チェック
- 必須フィールドのチェック

### **6.4. XSS対策**

- `escapeHtml()` 関数でHTMLエスケープ
- ユーザー入力データのサニタイズ

## **7. パフォーマンス考慮事項**

### **7.1. データ取得の最適化**

- 必要なデータのみ取得（関連データのエンリッチメントは必要最小限）
- キャッシュは使用せず、常に最新データを取得

### **7.2. ロック処理**

- ID生成時のLockService使用
- 最大30秒の待機時間
- 必ずロックを解放（finallyブロック）

### **7.3. バッチ処理**

- 複数ファイルのアップロードは順次処理
- 通知メールは非同期で送信（エラーが発生しても処理は継続）

## **8. データ整合性**

### **8.1. リレーション整合性**

- 外部キー参照の整合性はアプリケーションレベルで保証
- 存在しないIDを参照する場合は空文字列またはnullを返却

### **8.2. トランザクション**

- Google Apps Scriptでは明示的なトランザクションは使用不可
- 重要な操作は順次実行し、エラー時はロールバック処理を実装

### **8.3. 操作ログ**

- すべてのデータ操作を記録
- 変更履歴の追跡が可能
- ログから過去の状態を復元可能

## **9. 拡張性**

### **9.1. 新規シート追加**

1. Constants.gsにシート名を追加
2. ID_COLUMNSに主キーカラムを追加
3. Code.gsにCRUD関数を追加
4. Database.gsの関数は既存のものを使用可能

### **9.2. 新規機能追加**

- モジュール化された関数構造により、新機能の追加が容易
- 既存のデータベース操作関数を再利用可能

## **10. デプロイメント**

### **10.1. スプレッドシート準備**

1. スプレッドシートを作成
2. 各シートタブを作成（ヘッダー行を含む）
3. configシートに初期データを設定

### **10.2. GASプロジェクト設定**

1. Google Apps Scriptエディタで新規プロジェクト作成
2. 各.gsファイルを追加
3. index.htmlとcss.htmlを追加
4. スプレッドシートIDを設定（Constants.gs）

### **10.3. Webアプリとして公開**

1. 「公開」→「ウェブアプリケーションとして導入」
2. 実行ユーザー: 自分
3. アクセス権限: 全員（または組織内）
4. バージョン: 新規作成

### **10.4. 権限設定**

- スプレッドシートの共有設定
- Googleドライブフォルダの共有設定
- 通知メール送信権限

