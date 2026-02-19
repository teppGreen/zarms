# 大学祭企画・人物情報管理システム (ZARMS) 実装仕様書（初版）

## 1. システム概要

本仕様は、既存 ZARMS と同一の Master DB（Google スプレッドシート）を基点に、以下 3 種類のスプレッドシートを相互同期して企画・人物情報を一元管理するための実装方針を定義する。

- Master DB（`zarms-db-prod`）
- 企画管理一覧（List View）
- 企画管理個別シート（Individual Sheet）

> 目的: 既存 Web アプリを介さず、シート運用のみで企画・人物データを整合的に維持する。

## 2. コンポーネント構成

### 2.1 Master DB（Single Source of Truth）

- 役割: データの正本（唯一の正確な情報源）
- 運用: 原則として管理者のみ直接編集
- 想定テーブル:
  - `plans`: 企画基本情報
  - `members`: 人物マスタ
  - `member_assignments`: 企画と人物の関連（役割含む）
  - `directories`: 組織情報

### 2.2 企画管理一覧（List View）

- ファイル数: 1
- 役割: 運営委員向け一覧表示・編集
- 想定シート:
  - `企画`（行単位で複数企画）
  - `_config`（列マッピング定義）

### 2.3 企画管理個別シート（Individual Sheet）

- ファイル数: 企画数分（N）
- 役割: 各企画担当者向け編集
- 想定シート:
  - `基本`（単一セル中心）
  - `名簿`（1:N リスト、将来拡張）
  - `_config`（マッピング定義）

## 3. 同期アーキテクチャ

### 3.1 UI → Master DB（Upstream）

- トリガー: 一覧 / 個別シートでの編集（`onEdit`）
- 要件:
  - コピー＆ペースト、オートフィル等の矩形編集を許容
  - 編集範囲を行単位で分割して順次処理
- 処理:
  1. `ConfigParser` で編集範囲に対応する `{ table, key }` を特定
  2. 同一行の ID（system 行または ID 列）を取得
  3. `ZarmsDbAdapter.update(table, id, key, value)` で更新

### 3.2 Master DB → UI（Downstream）

- トリガー: Master DB 側の変更（`onEdit` / `onChange`）または定期実行
- 要件:
  - 変更レコード ID をキーに、関連 UI へ反映
- 処理:
  1. 変更行から `table / id / key / value` を特定
  2. 一覧シートで ID 行を検索し該当セルを更新
  3. 企画関連（`plans`）は対応する個別シートを特定して更新

## 4. `_config` による動的マッピング

各 UI ファイルは `_config` シートを必須とし、以下列を持つ。

| column | 説明 | 例 |
| --- | --- | --- |
| `table` | 連携先テーブル | `plans`, `members` |
| `key` | 連携先カラム | `name`, `description` |
| `value` | セル参照または固定値 | `='基本'!C5`, `p20261001` |
| `field_type` | 制御メタ情報 | `system`, `input` |

### 4.1 `value` 判定ルール

1. 直接参照（Read/Write）  
   条件: `=` 始まり、単純セル参照（例: `='基本'!$C$5`）
   - Downstream: 参照先セルへ書き込み
   - Upstream: 参照先セル編集を DB へ反映

2. 論理式・関数（Read Only）  
   条件: `=` 始まり、関数や演算式を含む
   - Downstream: 書き込み対象外（数式保護）
   - Upstream: 同期対象外

3. 固定値（System Identity）  
   条件: `=` で始まらない
   - 役割: レコード特定（`id`, `zarms_code` など）
   - 書き換え対象外

## 5. GAS 実装要件

### 5.1 共通: `ConfigParser`

責務:
- `_config` の読込・正規化
- 編集範囲とマッピングの突合
- 編集範囲に該当する DB ターゲット列挙

想定 I/F:

```javascript
class ConfigParser {
  // editedRange に該当する { table, key, id } を返す
  // 矩形範囲編集時は複数要素
  findDbTargets(editedRange) {}
}
```

### 5.2 機能1: UI 編集検知（`onUiEdit(e)`）

- 対象: 一覧 / 個別シート
- 手順:
  1. `e.range` を取得
  2. 行単位へ正規化
  3. 各行で `ConfigParser` により更新対象を特定
  4. ID を解決し DB 更新

### 5.3 機能2: DB 変更伝播（`onDbEdit(e)`）

- 対象: Master DB
- 手順:
  1. 変更行から `id` と変更 `key` を特定
  2. 一覧シートへ反映
  3. 個別シート（`plans` 関連）へ反映

### 5.4 排他制御・ループ対策

- `LockService` による同期処理の排他
- Installable Trigger 利用時は実行ユーザー起因の再入をガード
- 再入ガードは `PropertiesService` に短寿命の実行フラグ（例: `sync_in_progress_<sheetId>`）を保存し、開始時チェック・終了時削除で実装
- `setValue` による再発火前提差異を考慮し、明示ガードを保持

## 6. シート別設計メモ

### 6.1 個別シート

- 当面: `基本` タブの単一セル同期を優先
- 将来: `名簿` タブ（1:N）は開始行指定または動的範囲方式を追加設計

### 6.2 一覧シート

- ID 列（例: A 列）を主キー参照に利用
- `_config` で列ごとの DB マッピングを定義

## 7. 開発フェーズ

1. **Phase 1 (Core Sync)**  
   個別シート `基本` と Master DB の双方向同期、`ConfigParser` 実装
2. **Phase 2 (List Sync)**  
   一覧シートと Master DB の双方向同期
3. **Phase 3 (Complex Data)**  
   `名簿` など 1:N データ同期

## 8. 未確定事項（実装前確認）

- Master DB 上の `plans` テーブル定義・シート名・必須カラム
- 企画と個別シート ID の保持先（`plans.document_url` 等）
- `名簿` タブ空行の取り扱い（固定行か動的範囲か）

上記 3 点は実装着手前に確定し、本仕様へ追記する。
