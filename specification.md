# **Creative Team Management System v3.0 仕様書**

## **1\. 概要**

### **1.1. プロジェクト名**

Creative Team Management System (CTMS) (v3)

### **1.2. 目的**

現行のスプレッドシートベースのシステム（v2: [https://github.com/teppGreen/n-highschool\_magfes\_creative](https://github.com/teppGreen/n-highschool_magfes_creative)）が抱える以下の課題を解決し、業務効率とメンテナンス性を向上させる。

* **課題 (v2):**  
  1. **データ管理の複雑性:** 中央管理シートと依頼ごとにコピーされる個別管理シート間の双方向同期ロジック（flow\_syncSheet\_...）が複雑で、保守・改修が困難。  
  2. **UIの限界:** スプレッドシートのセル操作がUIであり、入力ミスや操作の煩雑さ（onEditトリガーへの依存）が発生しやすい。  
  3. **同時利用の問題:** 複数人のチームで利用する際、単一のビューシートでは編集の競合が発生する懸念がある。  
* **解決 (v3):**  
  1. **アーキテクチャの変更:** 「GAS Webアプリ (UI)」と「中央スプレッドシート (DB)」に責務を完全に分離する。  
  2. **DBの一元化:** 個別シートを廃止し、すべてのデータを単一のスプレッドシート（の各シートタブ）に集約する。  
  3. **UIの提供:** GASのHtmlServiceを用いて専用のWebアプリUIを提供し、onEditトリガーを廃止。google.script.runによる安定したロジック実行に切り替える。

### **1.3. システムアーキテクチャ**

* **UI (フロントエンド):** GAS HtmlService (HTML, CSS, JavaScript)  
* **ロジック (バックエンド):** Google Apps Script (.gsファイル)  
* **データベース (DB):** Google スプレッドシート (単一ファイル)  
* **通信:** google.script.run

## **2\. データベース(DB)設計 (Google スプレッドシート)**

単一のスプレッドシートファイル（例: ctms\_v3\_db）内に、以下のシートタブを作成し、データを一元管理する。

### **2.1. projectsシート (案件DB)**

* project\_id (主キー, プレフィックス + 連番形式, 例: P0001, P0002)  
  * **【ロジック】** バックエンドで `generateNextId` 関数により自動生成される。プレフィックス 'P' + 4桁のゼロパディングされた連番。同時実行による重複を防ぐため、LockServiceを使用してロックを取得する。  
* project\_title (案件タイトル, **【制約】** 他のprojectと重複できない)  
* project\_detail (議事録用のリッチテキスト)  
* created\_by (作成者, リレーション: membersシートのmember\_email)  
* created\_at (作成日時)

### **2.2. worksシート (制作DB)**

* work\_id (主キー, プレフィックス + 連番形式, 例: W0001, W0002)  
  * **【ロジック】** バックエンドで `generateNextId` 関数により自動生成される。プレフィックス 'W' + 4桁のゼロパディングされた連番。同時実行による重複を防ぐため、LockServiceを使用してロックを取得する。  
* project\_id (リレーション: projectsシート)  
* work\_title (制作タイトル)  
* work\_status\_key (リレーション: configシート, config\_type \= 'WORK\_STATUS')  
* work\_type\_key (リレーション: configシート, config\_type \= 'WORK\_TYPE')  
* priority\_key (リレーション: configシート, config\_type \= 'TASK\_PRIORITY', デフォルト: MEDIUM)  
* due\_datetime (納品期限日時)  
* work\_client\_email (リレーション: membersシートのmember\_email)  
* work\_folder\_id (制作フォルダID)  
* work\_detail\_content (内容, リッチテキスト: 制作物の概要と、制作物にどんな情報を入れてほしいか)  
* work\_detail\_design (デザイン要項, リッチテキスト: フォント・色味・出したいイメージ・等身など)  
* work\_detail\_regulation (入稿規定, リッチテキスト)  
* work\_detail\_note (依頼者からの備考)  
* work\_delivery\_count (成果物数: 納品したファイルの総数, 数値型, デフォルト0)  
* created\_by (レコード作成者, リレーション: membersシートのmember\_email)  
* created\_at (依頼受付日時)

### **2.3. tasksシート (タスクDB)**

* task\_id (主キー, UUID)  
* work\_id (リレーション: worksシートのwork\_id)  
* task\_title (タスクタイトル)  
* task\_detail (タスクの内容, リッチテキスト)  
* status\_key (リレーション: configシート, config\_type \= 'TASK\_STATUS', デフォルト: TODO)  
* priority\_key (リレーション: configシート, config\_type \= 'TASK\_PRIORITY', デフォルト: MEDIUM)  
* assign\_to (リレーション: membersシートのmember\_email, **【制約】1つのタスクは1人のみが担当できる**)  
* planned\_start\_datetime (予定開始日時)  
* planned\_end\_datetime (予定終了日時)  
* actual\_start\_datetime (実績開始日時)  
* actual\_end\_datetime (実績終了日時)  
* created\_by (リレーション: membersシートのmember\_email)  
* created\_at (作成日時)

### **2.4. membersシート (メンバーDB)**

* member\_email (主キー, メールアドレス)  
* slack\_member\_id (SlackのメンバーID)  
* member\_name (名前)  
* member\_team\_key (リレーション: configシート, config\_type \= 'TEAM')  
* role\_key (権限管理用, リレーション: configシート, config\_type \= 'ROLE', 例: ADMIN, EDITOR, VIEWER)  
* member\_notes (キャパシティ状況・メモ)  
* member\_icon (アイコン画像URL)  
* created\_by (登録者, リレーション: membersシートのmember\_email)  
* created\_at (登録日時)

### **2.5. work\_assignmentsシート (制作担当者 紐付けDB)**

* assignment\_id (主キー,  UUID)  
* work\_id (リレーション: worksシート)  
* member\_email (リレーション: membersシート)  
* created\_by (リレーション: membersシートのmember\_email)  
* created\_at

### **2.6. app\_assignmentsシート (使用アプリ 紐付けDB)**

* assignment\_id (主キー,  UUID)  
* work\_id (リレーション: worksシート)  
* work\_apps\_key (リレーション: configシート, config\_type \= 'APP')  
* created\_by (リレーション: membersシートのmember\_email)  
* created\_at 

### **2.7. knowledgeシート (ナレッジDB)**

* knowledge\_id (主キー, UUID)  
* work\_id (リレーション: worksシート, 1つのナレッジは1つの制作物に紐付く)  
* knowledge\_type\_key (リレーション: configシート, config\_type \= 'KNOWLEDGE\_TYPE')  
* knowledge\_content (内容のリッチテキスト)  
* created\_by (リレーション: membersシートのmember\_email)  
* created\_at

### **2.8. configシート (設定マスタDB)**

* config\_id (主キー, 自動採番)  
* config\_type (カテゴリ名, 例: TASK\_STATUS, WORK\_TYPE, APP, TEAM, ROLE, NOTIFICATION\_EMAIL, FOLDER)  
  * **FOLDER:** Google DriveのフォルダIDを保存するための設定タイプ。config\_key = 'WORK\_FOLDER\_PARENT' で親フォルダIDを指定する。  
* config\_key (バックエンドで使う不変のキー, 例: TODO, VIDEO, FIGMA, TEAM\_1, ADMIN, PRIMARY\_CONTACT, WORK\_FOLDER\_PARENT)  
* config\_value (UIに表示する文字列, 例: 未着手, 動画, Figma, 1班, 管理者, admin@example.com。FOLDERタイプの場合はGoogle DriveフォルダID)  
* config\_preset\_value (work\_detail\_regulationのプリセット用, リッチテキスト)  
* sort\_order (ドロップダウン等での表示順)  
* is\_active (true/false, 選択肢として有効か)

### **2.9. review\_requestsシート (レビュー依頼DB)**

* review\_request\_id (主キー, プレフィックス + 連番形式, 例: R0001, R0002)  
* work\_id (リレーション: worksシート)  
* review\_title (レビュー依頼のタイトル)  
* review\_comment (レビュー依頼のコメント)  
* created\_by (リレーション: membersシートのmember\_email)  
* created\_at (作成日時)

### **2.10. review\_request\_filesシート (レビュー依頼ファイル 紐付けDB)**

* file\_id (主キー, GoogleドライブのファイルID)  
* review\_request\_id (リレーション: review\_requestsシート)  
* created\_by (リレーション: membersシートのmember\_email)  
* created\_at (作成日時)

## **3\. 機能要件 (GAS Webアプリ)**

### **3.1. 共通UI**

* PC画面幅を前提としたモダンなデザインを採用する (tailwindcssを使用)。  
* 画面左側に固定サイドバーを配置し、Home, Works, Projects, Members, Knowledge, Summary のナビゲーションタブを設置する。  
* 各タブのメインコンテンツは、基本的に表形式（テーブル）とし、各カラムに対してソート・フィルタリング機能をつける。

### **3.2. Home**

* ユーザーごとにパーソナライズされた情報を表示する  
* **表示項目:**  
  * \[おはようございます,こんにちは,こんばんは(時間帯に応じて変更)\]、\[ログインしているユーザーのmember\_name\]さん  
  * ユーザーが担当者に割り当てられており、かつwork\_statusが\[CREATE\]のworks (カード形式で一覧表示)  
  * **レビュー依頼:** ユーザーが担当者に割り当てられているworksに紐づくreview\_requestsをカード形式で一覧表示（created\_atの降順）。「あなたが担当者の制作物」の隣に縦に並べて表示する。  
* **詳細表示:** 一覧の行クリックで画面内オーバーレイを表示。  
  * 一覧項目  
  * project\_detail (リッチテキストエディタで表示・編集)  
  * works (このProjectに紐づくworksを簡易テーブル表示)  
* **レビュー依頼カード詳細表示:**  
  * レビュー依頼のカードをクリックすると、モーダルで以下を表示:  
    * review\_title (タイトル)  
    * review\_comment (コメント全文)  
    * review\_request\_filesから取得したGoogleドライブのファイルリンク（1つ以上）を表示。ユーザーはリンクをクリックしてGoogleドライブ上でコメント機能を使用してフィードバックを行う。

### **3.3. Works (制作管理)**

* **一覧表示:**  
  * 表示項目: work\_id (プレフィックス + 連番形式, 例: W0001), project\_title, work\_title, work\_status\_key (のconfig\_value), due\_datetime, work\_client\_email (のmember\_name), work\_folder\_id (リンク), created\_at, 担当者 (work\_assignmentsからアイコン一覧表示)  
* **詳細表示:** 一覧の行クリック（または「詳細」ボタン）で画面内オーバーレイを表示。  
  * work\_overlay-content領域の横幅を1/3ずつ分割して表示:  
    * **左側:** ドキュメント埋め込み領域（Googleドライブのファイル表示）  
    * **中央:** タスク管理（このwork\_idに紐づくtasksを一覧表示）  
      * task\_title, status\_key, priority\_key, assign\_to (担当者の名前), planned\_end\_datetime を表示。  
      * 表示項目の編集が可能
      * 「+ 新規」ボタン（タスク追加, モーダル表示）  
    * **右側:** レビュー依頼（カード表示領域）  
      * このwork\_idに紐づくreview\_requestsをカード形式で一覧表示（created\_atの降順）。  
      * 各カードにはreview\_title、review\_commentの一部（プレビュー）、ファイル数が表示される。  
      * カードをクリックすると詳細表示（review\_title、review\_comment全文、Googleドライブのファイルリンク一覧）が表示される。  
      * 「+ 新規」ボタン（レビュー依頼作成, モーダル表示）  
  * work\_detail\_... のリッチテキスト群を表示・編集。  
  * 担当者管理: このwork\_idのwork\_assignmentsを管理。membersから検索して追加/削除が可能。  

### **3.4. Projects (案件管理)**

* **一覧表示:**  
  * 表示項目: project\_title, created\_at, created\_by (名前), Works数 (動的集計), Worksステータス (動的集計)  
* **詳細表示:** 一覧の行クリックで画面内オーバーレイを表示。  
  * 一覧項目  
  * project\_detail (リッチテキストエディタで表示・編集)  
  * works (このProjectに紐づくworksを簡易テーブル表示)  
* **新規作成:**  
  * 右上に表示する「+ New」ボタンでモーダル表示。project\_title を入力。  
  * **【ロジック】** project\_title の重複チェックを行う。project\_id（プレフィックス + 連番形式, 例: P0001）はバックエンドで自動生成する。

### **3.5. Members (メンバー管理)**

* **一覧表示:**  
  * 表示項目: member\_icon, member\_name, member\_email, member\_team\_key (のconfig\_value), role\_key (のconfig\_value), 担当Works数 (動的集計 \- work\_assignmentsからカウント)  
  * 右上に「+ New」ボタンを配置（ADMIN権限者(4.2)のみ表示）。  
* **詳細表示:** 一覧の行クリックで画面内オーバーレイを表示。  
  * member\_notes (リッチテキストエディタで表示・編集)  
  * 担当しているWorksの一覧を簡易テーブル表示 (work\_assignmentsを参照)  
* **新規作成/編集:**  
  * 「+ New」ボタン（または一覧の編集ボタン）でモーダル表示。  
  * member\_email, member\_name, slack\_member\_id, member\_icon (URL), member\_team\_key (ドロップダウン), role\_key (ドロップダウン) を編集・入力させる。  
  * **【ロジック】** ADMIN (4.2) のみ実行可能。

### **3.6. Knowledge (ナレッジ管理)**

* **一覧表示:** knowledgeシートの全データをカード形式で created\_at の降順（新しい順）で表示。  
* **新規作成:**  
  * 右上に「+ New」ボタンを配置。  
  * モーダル表示: knowledge\_type\_key (ドロップダウン), knowledge\_content (リッチテキスト), 紐づけるWorks (worksから検索して1つ選択, knowledgeシートのwork\_idとして保存)

### **3.7. Summary (統計ダッシュボード)**

* **目的:** システム全体の主要なKPI（重要業績評価指標）を可視化する。  
* **ロジック:** このタブがロードされた際、バックエンド（GAS）がDBの各シートを集計し、グラフ描画用のデータをフロントエンドに返す。（Google Chartsのライブラリ使用を想定）  
* **表示コンポーネント:**  
  1. **Workステータス:** worksシートのwork\_status\_keyを集計し、円グラフで表示（納品済みを除く）。  
  2. **担当者アサイン状況:** work\_assignmentsシートをmember\_emailで集計し、各メンバーが担当しているwork数を棒グラフで表示。  
  3. **Workタイプ（ジャンル）:** worksシートのwork\_type\_keyを集計し、円グラフで表示。  
  4. **月別依頼件数:** worksシートのcreated\_at（依頼受付日時）を月別に集計し、折れ線グラフで表示。

## **4\. その他の仕様**

### **4.1. 「新規」作成フロー**

* **(a) 新規「Work」作成:**  
  * Works UIの「+ New」ボタンでモーダル表示。  
  * 1\. project\_id を、既存のprojectsから選択、または新規作成する。（テキストを入力した際に、既存のproject\_nameにヒットしたらドロップダウンに表示、一切ヒットしなかったらドロップダウンに\[+ New (ユーザーが入力した文字列)\]を表示し、新規作成させる）  
  * 2\. work\_title, work\_type\_key (ドロップダウン), due datetime を入力。  
  * **【ロジック】** work\_type\_key を選択した時点で、configシート(2.8)のconfig\_preset\_valueを参照し、work\_detail\_regulationにプリセット値を自動入力する。  
  * 3\. detail\_content 等のリッチテキストを入力。  
  * **【ロジック】** 送信時、バックエンドで以下の処理を実行する:  
    1. work\_id（プレフィックス + 連番形式, 例: W0001）を自動生成する。  
    2. worksシートにデータを書き込む。  
    3. Google Drive の親フォルダ配下に、{project\_title}\_{work\_title} の名称で新しいフォルダを作成し、そのIDを work\_folder\_id に保存する。  
      * **【ロジック】** 親フォルダIDは、configシート (2.8) で config\_type = 'FOLDER', config\_key = 'WORK\_FOLDER\_PARENT' に設定された config\_value から取得する。設定されていない場合は空文字列を返す。  
    4. configシート (2.8) で config\_type \= 'NOTIFICATION\_EMAIL' に設定されたメールアドレス宛に、GmailApp.sendEmail() を使用して新規依頼の通知メールを送信する。  
* **(b) 新規「Project」作成:**  
  * Projectsタブ(3.2)の「+ New」ボタンから作成する  
  * 新規Work作成時に同時にProjectを作成することもできる  
  * 新規Work作成時のproject\_idの選択時に、新しい  
* **(c) 新規「Member」登録:**  
  * Membersタブ(3.4)の「+ New」ボタン（ADMINのみ可）からモーダルで登録する。  
* **(d) 新規「Task」作成:**  
  * 「Work詳細モーダル内のタスク追加ボタン」（3.3）から作成可能。  
* **(e) 新規「レビュー依頼」作成:**  
  * Work詳細画面（3.3）の右側「レビュー依頼」領域の「+ New」ボタンからモーダル表示。  
  * **【ロジック】** 以下の処理を実行する:  
    1. ユーザーがGoogleドライブからファイルを選択、またはドラッグアンドドロップでファイルを添付（1つ以上）。  
    2. ドラッグアンドドロップで添付されたファイルは、バックエンドで該当workのwork\_folder\_idにアップロードし、Googleドライブ経由で再読み込みする。  
    3. ユーザーがreview\_title（タイトル）とreview\_comment（コメント）を入力。  
    4. 投稿ボタンを押すと、バックエンドで以下の処理を実行:  
      * review\_request\_id（UUID）を自動生成する。  
      * review\_requestsシートにデータを書き込む。  
      * 添付されたファイルごとにreview\_request\_filesシートにレコードを作成（drive\_file\_id、file\_nameを保存）。  
    5. 投稿後、work詳細画面とHomeタブにレビュー依頼が表示される。

### **4.2. 認証・認可（権限管理）**

* **認証:** Google アカウント認証を使用。Webアプリへのアクセスは、membersシート(2.4)にmember\_emailが登録されているユーザーのみ許可する。  
* **認可:**  
  * ログインユーザーのmembersシートのrole\_keyを参照する。  
  * ADMIN (管理者): 全てのデータの閲覧・作成・編集・削除。Membersタブでの権限変更が可能。  
  * EDITOR (編集者): ほぼ全てのデータの閲覧・作成・編集。MembersTebの操作（権限変更）は不可。  
  * VIEWER (閲覧者): 全データの閲覧のみ。編集操作は不可。  
  * work\_client\_email (依頼者) は、 VIEWER 権限を基本とする。（特定項目の編集機能はv1プロトタイプでは除外）

### **4.3. リッチテキストエディタの操作感**

* H1, H2, H3, 太字, 斜体, 打ち消し線, 下線, 色選択（黒・赤・青・緑）
