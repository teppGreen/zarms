# 大学祭企画・人物情報管理システム (ZARMS) 実装仕様書

## 1. システム概要

本仕様は、既存 ZARMS と同一の Master DB（Google スプレッドシート）を基点に、以下 3 種類のスプレッドシートを相互同期して企画・人物情報を一元管理するための実装方針を定義する。

- Master DB（`zarms-db-prod`）（既に運用中）
- 企画管理一覧（List View）（新規作成）
- 企画管理個別シート（Individual Sheet）（新規作成）

> 目的: 既存 Web アプリを介さず、シート運用のみで企画・人物データを整合的に維持する。

## 2. コンポーネント構成

### 2.1 Master DB（Single Source of Truth）

- 役割: データの正本（唯一の正確な情報源）
- 運用: 原則として管理者のみ直接編集
- スキーマ定義（以下に書いてあるものに限らない。`docs/database_schema.mmd` に準拠すること。）:
  - `plans`: 企画基本情報テーブル
    - 主キー: `id` (UUID)
    - 識別・状態情報: `plan_number`, `zarms_code`, `plan_status`, `plan_type`
    - 基本テキスト: `name`, `description`, `plan_tags`, `plan_categories`
    - 数値情報: `estimated_staff_count`, `actual_staff_count` 等
    - リンク情報: `sheet_url` (個別シートのURLとして利用可能), `folder_url`, `slack_channel_url`
    - その他メタ情報多数（選考情報、出展者情報等）
  - `members`: 人物マスタテーブル
    - 主キー: `id` (UUID)
    - 基本情報: `email`, `name`, `display_name`, `slack_profile_url`, `profile_photo_url`
  - `plan_assignments`: 企画アサインメントテーブル
    - 主キー: `id` (UUID)
    - 関連情報: `plan_id` (対象企画ID), `member_id` (対象メンバー), `role` (代表者、副代表者等の役割)
    - 論理削除: `is_active`（`false` で無効）
  - `directory_assignments`: 組織アサインメントテーブル
    - 主キー: `id` (UUID)
    - 関連情報: `directory_id` (対象組織ID), `member_id` (対象メンバー), `role` (役割)
  - `directories`: 組織情報テーブル
    - 主キー: `id` (UUID)
    - 基本情報: `name`, `slack_channel_url`, `gfolder_id`

### 2.2 企画管理一覧（List View）

- ファイル数: 1
- 役割: 運営委員向け一覧表示・編集
- 想定シート:
  - `企画`（行単位で複数企画を表示。`plans` テーブルのレコードと1行が対応）
  - `_config`（列マッピング定義。このスプレッドシート専用の1枚。）

### 2.3 企画管理個別シート（Individual Sheet）

- ファイル数: 企画数分（N）
- 役割: 各企画担当者向け編集
- 想定シート:
  - `基本`（単一セル中心。該当の `plans` レコード1件に対する詳細情報を表示・編集）
  - `名簿`（1:N リスト。該当企画に関する `members` と `plan_assignments` 情報を表示・編集）
  - `_config`（マッピング定義。この個別シート専用の1枚。`基本` タブ・`名簿` タブ両方の定義をまとめて記載する。）

## 3. 同期アーキテクチャ

### 3.1 UI → Master DB（Upstream）

- トリガー: 一覧 / 個別シートでの編集（`onEdit`、インストーラブルトリガーとして各シートのバウンドスクリプトに設定）
- 要件:
  - コピー＆ペースト、オートフィル等の矩形編集を許容
  - 編集範囲を行単位で分割して順次処理
- 処理:
  1. `ConfigParser` で編集範囲に対応する `{ table, key }` を特定
  2. 対象レコード ID（`plans.id` 等）の取得:
     - 一覧シート（行ベース）の場合: 同一行の `field_type: system` 列から取得
     - 個別シートの場合: 編集中のスプレッドシートの URL (`SpreadsheetApp.getActiveSpreadsheet().getUrl()`) を元に、Master DBの `plans` テーブルの `sheet_url` に該当するレコードから `id` を特定
  3. `ZARMS.syncRecordToMaster(table, { id, [key]: value })` で Master DB を更新（共通モジュール経由）

### 3.2 Master DB → UI（Downstream）

- トリガー: **1時間ごとの定期実行**（GAS の時間主導型トリガー。Master DB の GAS プロジェクトに GUI 上で手動設定する。設定ユーザーのアカウント権限で実行される。）
- 対象レコード: `updated_at` が前回実行日時より後のレコード。前回実行日時は **Master DB の GAS プロジェクトの `ScriptProperties`**（キー: `last_sync_downstream`）に ISO 8601 形式で保存する。
- 要件:
  - 変更レコード ID をキーに、関連 UI へ反映
- 処理:
  1. `ScriptProperties` から `last_sync_downstream` を取得し、処理開始時刻を記録
  2. Master DB の各テーブルから `updated_at > last_sync_downstream` のレコードを取得
  3. 一覧シートで該当レコードの ID 行を検索し、`_config` に基づいて該当セルを更新
  4. `table = 'plans'` の場合は、同レコードの `sheet_url` カラムから対応する個別シートを特定し、`_config` に基づいて該当セルを更新
  5. 処理完了後、`ScriptProperties` の `last_sync_downstream` を処理開始時刻で更新

> タイムアウト対策: Google Workspace 環境のため実行上限は 30 分。件数が少ない間は対策不要とする。将来的に件数が増えた場合は、バッチ処理への切り替えを検討する。

## 4. `_config` による動的マッピング

各 UI ファイル（一覧シート・個別シートそれぞれ）は `_config` シートを必須とし、以下列を持つ。

| column | 説明 | 例（`database_schema`定義に基づく） |
| --- | --- | --- |
| `table` | 連携先テーブル | `plans`, `members`, `plan_assignments` |
| `key` | Master DBの連携先カラム | `name`, `plan_status`, `estimated_staff_count` |
| `range` | 書き込み/読み取り先のセル参照（数式） | `='基本'!$C$8`, `='企画'!$A$1` |
| `value` | `field_type: system` の場合の固定値 | `p20261001`（一覧シートでのID確保用など） |
| `field_type` | 制御メタ情報 | `system`, `input`, `header` |

| `field_type` | 意味 | Upstream 動作 | Downstream 動作 |
| --- | --- | --- | --- |
| `system` | 同期処理に必要な識別情報（一覧シートでのID列など）。`value` に固定値を持つ。 | **同期対象外**（スキップ） | **同期対象外**（スキップ） |
| `input` | ユーザーが編集するデータ列。 | `range` が指すセルの値を Master DB に書き込む | Master DB の値を書き込む。<br>・`range` がある場合: 該当セルへ書き込む<br>・`range` が空の場合: `_config` シートの自身の `value` 列へ書き込む |
| `header` | ヘッダー行のセルを指し示す。データの列位置を取得するための参照。 | **同期対象外**（列位置の特定にのみ使用） | **同期対象外**（列位置の特定にのみ使用） |
| `flag` | 個別シート側でのみ操作するフラグ用データ列。 | `range` が指すセルの値を Master DB に書き込む | **同期対象外**（Master DBから上書きしない） |

### 4.2 `range` 参照式の解釈ルール

- `range` 列には必ず `='シート名'!$列$行` 形式の**単一セル参照（数式）**を入力する。
  - 例: `='基本'!$C$8`（個別シートの `基本` タブ、C8 セル）
  - 例: `='企画'!$A$1`（一覧シートの `企画` タブ、A1 セル）
- `A1:A5` のような範囲参照・名前付き範囲は**使用しない**。
- `field_type: header` の行の `range` が指すセルは**ヘッダー行のセル**である。
  - 例: `='企画'!$C$1` → `企画` シートの 1 行目が列見出し行であり、対象の `key` に対応する列は C 列である。
  - データ行は **ヘッダー行の次の行（例: 2 行目）以降**とし、`_config` の `header` から動的に列位置とデータ開始行を算出する。

### 4.3 一覧シートにおける行特定ロジック

一覧シート（`企画` シート等）では、`field_type: system` かつ `key: id` の行から「ID 列」の列位置を取得する。
Upstream / Downstream ともに、この ID 列を検索キーとして対象の行番号を特定してから、各 `input` 列のセルを読み書きする。

### 4.4 個別シートにおける ID 解決ロジック

個別シート（`基本` タブ、`名簿` タブの双方）では、Master DBでの `plans.id` をシート上に記載しない。
Upstreamの同期処理を実行する際、`SpreadsheetApp.getActiveSpreadsheet().getId()` などの情報を用いて Master DB の `plans` テーブルを検索し、`sheet_url` カラムに対象スプレッドシートのIDが含まれているレコードの `plans.id` を取得して対象レコードを特定する。

## 5. GAS 実装要件

### 5.1 共通モジュール: `syncRecordToMaster`

- **位置付け**: 同期専用の Master DB への更新を行うヘルパーモジュール。既存の `questions.js` で使用している `handleDatabaseProcess()` とは別に、`syncRecordToMaster()` を新設する。
- **ライブラリ名**: `ZARMS`（GAS ライブラリとして公開する。バウンドスクリプト側は最新バージョンを参照する。）
- 一覧・個別シートのバウンドスクリプトは `ZARMS.syncRecordToMaster(...)` などの形式で呼び出す構成を想定する。

> 既存の `handleDatabaseProcess` 関数との同名衝突を避けるため、専用モジュールとして切り出す。

### 5.2 共通: `ConfigParser`

責務:
- `_config` の読込・正規化
- 編集範囲とマッピングの突合
- 編集範囲に該当する DB ターゲット列挙

想定 I/F:

```javascript
class ConfigParser {
  // @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet - 対象スプレッドシート
  constructor(spreadsheet) {}

  // @param {GoogleAppsScript.Spreadsheet.Range} editedRange
  // @return {{ table: string, key: string, id: string, value: string }[]}
  // マッピング未検出時は空配列を返し、設定不正時のみ Error を送出
  // editedRange に該当する { table, key, id, value } を返す
  // 矩形範囲編集時は複数要素
  findDbTargets(editedRange) {}

  // @return {{ table: string, key: string, range: { sheet: string, col: number, row: number } | null, rowNumber: number }[]}
  // Downstream: field_type = 'input' の全マッピングを返す（range未指定もあるため null を許容。rowNumberは_configシート自体の行番号）
  getAllInputMappings() {}

  // @return {{ table: string, key: string, col: number }[]}
  // 一覧シート用: field_type = 'header' の行から列位置とデータ開始行を解決して返す
  resolveHeaderMappings() {}
}
```

### 5.3 機能1: UI 編集検知（`handleOnEdit(e)`）

- 対象: 一覧 / 個別シート（バウンドスクリプトから `ZARMS.handleOnEdit(e)` として呼び出し）
- 手順:
  1. `e.range` を取得
  2. 編集されたシート名を確認し、`_config` 上に対応する `field_type: input` のマッピングが存在しない場合はスキップ
  3. 行単位へ正規化（矩形編集対応）
  4. 各行/セル単位で `ConfigParser.findDbTargets()` により更新対象（`table`, `key`, `id`）を特定。IDがシート上から取得できない（個別シートの）場合は、現在操作中のスプレッドシートのURL等を用いて Master DB の `plans` テーブルの `sheet_url` を検索し、ID を動的に特定する。
  5. `field_type: system` のセルは処理をスキップ
  6. 特定した `id` および `key`, `value` で `ZARMS.syncRecordToMaster` を呼び出し Master DB を更新

### 5.4 機能2: DB 変更伝播（`runDownstreamSync()`）

- 対象: Master DB の GAS プロジェクト（1時間ごとの定期実行トリガーから呼び出し）
- 手順:
  1. `ScriptProperties` から `last_sync_downstream`（ISO 8601 形式）を取得。未設定の場合はすべてのレコードを対象とする。
  2. 処理開始時刻を変数に保存
  3. `plans`, `members`, `plan_assignments` 等の各テーブルから `updated_at > last_sync_downstream` のレコードを取得
     - **注意**: `updated_at` の検索条件に使用する日時は必ず `Date.toISOString()` を用いて **ISO 8601形式**（文字列）に変換してからクエリ（`['>', lastSyncStr]` 等）を実行すること。
  4. **一覧シートへの反映**:
     - 一覧シートの `SpreadsheetApp.openByUrl(listViewUrl)` で接続
     - `_config` を読み込み `ConfigParser.resolveHeaderMappings()` で列位置を解決
     - `field_type: system, key: id` 列を検索キーに、対象レコードの行番号を特定
     - 各 `field_type: input` 列のセルを更新
  5. **個別シートへの反映**（`table = 'plans'` のレコードのみ）:
     - `plans.sheet_url` から `SpreadsheetApp.openByUrl(sheetUrl)` で接続
     - `_config` を読み込み `ConfigParser.getAllInputMappings()` で対象セルを解決
     - 各対象について、`field_type` が `input` のもので値を書き込む（`flag` 型はスキップ）
     - `range` が空欄の場合は `_config` シート上の該当する行の `value` 列へ書き込む
  6. 処理完了後、`ScriptProperties` の `last_sync_downstream` を手順 2 で保存した処理開始時刻で更新

### 5.5 排他制御・ループ対策

- `LockService` は `waitLock(30000)` を上限に取得し、取得失敗時はリトライせず終了
- インストーラブルトリガー利用時は実行ユーザー起因の再入をガード
- 再入ガードは `PropertiesService` に短寿命フラグ（キー: `sync_in_progress_<sheetId>`）を保存し、開始時チェック・終了時削除で実装
  - フラグの値: 開始時刻の ISO 8601 文字列
  - **フォールバック閾値: 120 秒**（フラグ設定から 120 秒以上が経過している場合は失効扱いとして自動復旧する）
- `setValue` によるプログラムからの書き込みによる再発火（Apps Script の仕様上まれに発生し得るケース）を考慮し、再入ガードフラグを明示的に保持する

### 5.6 利用 API の選定方針

スプレッドシートの標準機能である `onEdit` 等の UI イベントをトリガーとするリアルタイム性の高い処理であるため、API は以下の方針とする。

- **SpreadsheetApp の採用（メイン）**
  - 個別シートや一覧シートなどの操作・イベント検知、および Master DB への小〜中規模な読み書きには、Apps Script 標準 API である `SpreadsheetApp` をベースとして採用する。
  - セルの位置・書式解決（例: 数式のパース等）の取得や、編集イベントオブジェクト(`e.range`)との親和性が最も高く、実装の複雑化を避けられるため。

- **Sheets API / gVizAPI との切り分け**
  - 既存の Web アプリ側でデータ取得用途で利用している `gVizAPI` (Google Visualization API) は、主にフロントエンド・ブラウザから JSONP 形式等で読み取るための仕組みであるため、バックグラウンド（サーバーサイド）の GAS 処理である本件では使用しない。
  - `Sheets API`（Advanced Google Service）は大量データを一括処理する場合に有用だが、今回の「各セルの `onEdit` をトリガーとして少数のレコードを逐次同期する」ユースケースにおいては、初期化のオーバーヘッドや実装コストを考慮し、原則利用しない。将来の一括同期処理などで速度が課題となった場合のみ、局所的にバッチ処理として導入を検討する。

### 5.7 各シート（バウンドスクリプト）側の実装方針とトリガー

各スプレッドシート（一覧シート、個別の各企画管理シート）に紐付く GAS プロジェクト（コンテナバインドスクリプト）では、本体ロジックを直接記述せず、**メイン処理を定義したライブラリ `ZARMS` を呼び出す薄いラッパー（Wrapper）** として実装する。

- **トリガーごとに単一の関数を定義**: `onEdit`, `onOpen`, `onChange` 等の各システムイベントトリガーにつき、バウンドスクリプト側で用意する関数は必ず**それぞれ 1 つだけ**とする。
- **処理の完全委譲**: 用意した関数内では、固有のデータ操作や条件分岐を行わず、`ZARMS` ライブラリが公開する関数にイベントオブジェクト（`e`）を渡し、実行を委譲する。
- **ライブラリのバージョン**: バウンドスクリプト導入時は**最新バージョン**を選択する。ライブラリ本体に更新がある場合は、Master DB の GAS プロジェクトで新規デプロイではなく**既存デプロイのバージョンを上げる**ことで対応する。

**実装想定例（一覧・個別シート側のコード）**:
```javascript
// メインライブラリ（ZARMS）を導入済みとする

function onEdit(e) {
  // UI編集トリガー: ライブラリ側のロジックを呼び出す
  ZARMS.handleOnEdit(e);
}

function onOpen(e) {
  // メニュー追加や初期化など
  ZARMS.handleOnOpen(e);
}

function onChange(e) {
  // 行追加や構造の変更など
  ZARMS.handleOnChange(e);
}
```

> 目的: こうすることで、同期ロジック等に変更があった場合でも、N 個の個別シートのスクリプトを個別に修正する必要がなくなり、`ZARMS` ライブラリの更新のみで保守が可能になる。

## 6. シート別設計メモ

### 6.1 個別シート

- 当面: `基本` タブの単一セル同期を優先。`plans` テーブルのカラム（例: `name`, `description`, `slack_channel_url`, 集計項目など）をセルごとに直接マッピングする。
- Phase 3: `名簿` タブ（1:N）の実装。`members` および `plan_assignments` テーブルに対して、動的範囲方式で複数レコードの追加・更新・削除を同期する設計を追加。

### 6.2 一覧シート

- `field_type: system, key: id` 列（例: 非表示の A 列に `plans.id` を配置）を主キー参照に利用
- `_config` で列ごとの DB マッピングを定義し、行ベース（1 行 = 1 企画レコード）で `plans` テーブルを同期

### 6.3 名簿タブ（1:N 同期）の詳細仕様

個別シート内の `名簿` タブにおける、`members` および `plan_assignments` の複数レコード処理方針を以下のように定義する。

#### 列構成

`名簿` タブには以下 7 列が存在し、その先頭に `plan_assignments.id`（非表示）を設ける。

| 列 | 内容 | `field_type` | `key` | 必須 |
| --- | --- | --- | --- | --- |
| （非表示） | `plan_assignments.id` | `system` | `id` | — |
| 1 | 表示名 | `input` | `display_name`（`members`） | ✅ |
| 2 | Slack ID | `input` | `slack_profile_url`（`members`） | ✅ |
| 3 | メールアドレス | `input` | `email`（`members`） | ✅ |
| 4 | 企画内役割 | `input` | `role`（`plan_assignments`） | ✅ |
| 5 | スタッフパス | `input` | `staff_pass`（`members` 等） | ✅ |
| 6 | 備考 | `input` | `remark` | — |

> 「備考」列のみ必須入力ではない。その他の 5 列（表示名、Slack ID、メールアドレス、企画内役割、スタッフパス）はすべて必須入力とする。

#### 1. データ範囲と同期の方向性

- **Downstream 専用アーキテクチャ**: `名簿`タブはユーザーによる直接編集（Upstream同期）をサポートしない**表示専用（Read-only）領域**として運用する。ユーザーは別の登録フォーム（システム外等）を通じてMaster DBに情報を登録する。
- **動的範囲の採用**: `_config` において `field_type: header`（または `input`/`system` などの `range` 定義）行から「データ開始行」を算出する（ヘッダー行の次の行以降）。
- **完全入れ替え（Clear & Rewrite）**: `runDownstreamSync()` 実行時、該当する企画の `is_active: true` なアサインメント情報をMaster DBから取得し、対象シートのデータ領域をクリア（`clearContent`）した上で一括書き込み（`setValues`）を行うことで、常にMaster DBの情報を正本とした整合性を保つ。

#### 2. 新規作成時の処理（`registerPlanMember`）

`名簿` タブのデータソースとなるMaster DB側へレコードを直接登録・アサインするためのヘルパー関数 `registerPlanMember(planId, memberData, assignmentData)` をライブラリ側（`sync_utils.js`）で提供する。別システムやフォーム送信のハンドラーからこの関数を呼び出すことで、以下のようにアトミックに処理される。

1. **メンバー特定または新規作成**:
   - `members` テーブルを `email` で検索する。
   - 一致するレコードがあれば、その `members.id` を取得し、付随する情報（表示名など）を安全に更新する。
   - 一致しなければ、新規 UUID を生成し `members` テーブルに追加する。
2. **アサインメント作成**:
   - 新規 UUID を生成し、`plan_id` と `member_id` を紐付けた `plan_assignments` の新規レコードを追加する（`is_active: true`）。
   - すでに同企画にアサインされている場合は、役割等の更新と `is_active: true` への復帰（再登録）を行う。

#### 3. 削除（関連付け解除）の扱い

- Master DB 上でレコードの物理削除は行わず、`plan_assignments` レコードの `is_active` を `false` に更新する論理削除として扱う。
- Downstream同期は `is_active: true` のデータのみを描画するため、論理削除されたメンバーは次回の同期時にUI上から自動的に消去される。
- `members` テーブルのレコード自体は削除しない。企画から外れたメンバーは `members` テーブルに残り続ける。

## 7. 開発フェーズ

1. **Phase 1 (Core Sync)**
   個別シート `基本` タブ（対象: `plans` テーブルの一部）と Master DB の双方向同期、`ConfigParser` 実装、共通モジュール整備

2. **Phase 2 (List Sync)**
   一覧シート（対象: `plans` テーブル全域）と Master DB の双方向同期

3. **Phase 3 (Complex Data)**
   `名簿` タブ（対象: `members`, `plan_assignments`）など 1:N 関連データの同期

4. **Phase 4 (Documentation & Setup Guide)**
   実装完了後、各 UI スプレッドシートの構築・初期設定をまとめた「スプレッドシート設定手順書」を作成する。記載内容:
   - `_config` シートの設定例（一覧シート用・個別シート用）
   - トリガー設定手順（Master DB上の定期実行Downstreamトリガー、一覧・個別シート上の `onEdit` インストーラブルトリガー等）
   - `ZARMS` ライブラリの導入手順（各バウンドスクリプトでの最新バージョン設定と `handleOnEdit` 呼び出し）

---

## 8. 構築・運用手順書 (Spreadsheet Setup Guide)

新しく「一覧シート」や「個別シート」を作成する際の初期設定と運用手順を以下にまとめる。

### 8.1 共通設定：ZARMS ライブラリの連携

任意のUI用スプレッドシート（一覧・個別シート）を作成後、バックグラウンドのGASエディタ（拡張機能 > Apps Script）を開き、以下の設定を行う。

1. **ライブラリ追加**:
   - `ライブラリ` の「＋」アイコンをクリック
   - Master DBのGASプロジェクトの「スクリプトID」を入力して検索
   - IDを `ZARMS` に設定し、最新バージョンを選択して「追加」
2. **スクリプト記述**:
   - `コード.gs` に以下のコードのみ記述する。
   ```javascript
   function onEdit(e) {
     ZARMS.handleOnEdit(e);
   }
   ```
3. **トリガー登録（インストーラブルトリガー）**:
   - 左側メニューの「トリガー」からトリガーを追加。
   - 実行する関数: `onEdit`
   - イベントのソース: `スプレッドシートから`
   - イベントの種類: `編集時`
   - 目的: 管理者権限（ZARMSシステムとしての権限）でMaster DBにアクセスできるようにするため。

### 8.2 一覧シートの構築

1. Master DBのGASプロジェクトの `ScriptProperties` に `LIST_VIEW_SPREADSHEET_ID` キーを作成し、作成した一覧スプレッドシートのIDを登録する。
2. スプレッドシート内に `企画` などの表示用タブ（例: A列に非表示で `id` 列を確保）と、`_config` タブを作成する。
3. `_config` の設定例:
   - `table`: "plans" (全行)
   - ヘッダーマッピング用: ID列などに `field_type: system`, `key: id`, `range: ='企画'!$A` を設定。
   - 他のデータ列: `field_type: header`, `range: ='企画'!$B` 〜 `$Z` を指定。

### 8.3 個別シートの構築

企画ごとに作成される個別シートは、以下の要領で準備する。
1. タブの構成:
   - `基本`: 企画の単一情報（詳細、ステータス、メモ等）を記載。
   - `名簿`: 所属メンバーの一覧を表示するためのRead-only領域。事前にヘッダーおよび非表示ID列（A列など）を記述しておく。
   - `_config`: マッピング設定用タブ。
2. `_config` の設定例（基本タブ）:
   - `field_type: input` かつ、`range` に単一セル（例: `='基本'!$C$5`）を指定。
3. `_config` の設定例（名簿タブ 1:N用）:
   - `field_type: system`, `key: id`, `range: ='名簿'!$A$2` (非表示のID列、ヘッダーの次の行)
   - その他の列 (`role`, `display_name`, `email` 等): `field_type: input` かつ、`range: ='名簿'!$B$2` などの行指定付き単一セル参照でデータ開始行を指示する。
4. URLの登録:
   - Master DB側で、`plans` テーブルの対象レコードの `sheet_url` カラムに作製したスプレッドシートのURLを記録する。これにより同期の紐付けが完了する。

### 8.4 Downstream 定期実行の登録 (Master DB側)

1. Master DBのスプレッドシートに紐付くGASプロジェクト（`ZARMS`コア・ライブラリ）のトリガーを開く。
2. `runDownstreamSync` 関数に対し、「時間主導型」の「1時間ごとの定期実行」を設定する。
3. （必要に応じて）GUI等に手動による「いますぐ同期（Downstream）」ボタンを配置して `runDownstreamSync` を直叩きできるようにする。