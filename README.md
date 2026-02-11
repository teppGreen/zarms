# ZARMS (Zen University Festival All Resource Management System)

ZARMS（ザームス）は、大学祭実行委員会の業務効率化を目的としたタスク管理システムです。
Google Apps Script (GAS) を利用したWebアプリケーションとして構築されており、Google Sheetsをデータベースとして使用しています。

## 概要

本システムは、委員会内のタスクをボード形式で可視化し、メンバー間での進捗共有やコミュニケーションを円滑に行うためのプラットフォームを提供します。
各メンバーは自身の担当タスクを確認し、進捗状況の更新やコメントによるやり取りを行うことができます。

### 主な機能

- **進捗管理**: カンバン方式によるタスクの進捗管理
- **内容管理**: タスクの説明・期限・担当者・優先度の設定
- **コミュニケーション**: タスクごとのコメント機能
- **ダッシュボード**: 直近のタスク一覧表示、メンバーランニング、ボードランキング

## 技術スタック

### バックエンド
- **Google Apps Script (GAS)**: サーバーサイドの処理に利用
- **Google Sheets**: データベースとして利用

### フロントエンド
- **HTML5 / CSS3**: セマンティックなマークアップと高レベルのスタイリング
- **Beer CSS**: マテリアルデザインベースのCSSフレームワーク
- **JavaScript (ES6+)**:
  - **Quill.js**: リッチテキストエディタ（タスク詳細記述用）
  - **SortableJS**: ドラッグ＆ドロップによるタスク操作

## ディレクトリ構成

プロジェクトの主要なファイル構成は以下の通りです。

```
zarms/
├── src/                    # ソースコードディレクトリ
│   ├── components/         # 再利用可能なUIコンポーネント
│   │   ├── headers/        # ヘッダー関連（ナビゲーション）
│   │   ├── modals/         # 各種モーダル（タスク作成、詳細、選択画面など）
│   │   └── popups/         # ポップアップ通知など
│   ├── pages/              # 各ページのメインコンテンツ
│   │   ├── board.html      # ボード画面
│   │   ├── calendar.html   # カレンダー画面
│   │   ├── home.html       # ダッシュボード（ホーム）画面
│   │   └── members.html    # メンバー一覧画面
│   ├── constants.js        # 定数定義（テーブル名、設定値など）
│   ├── database.js         # データベース操作（Spreadsheet連携）ロジック
│   ├── main.js             # GASエントリーポイント（doGet, ルーティング）
│   ├── index.html          # アプリケーションのベースHTML
│   ├── js.html             # フロントエンドロジック（JavaScript）
│   └── css.html            # 追加スタイルシート
├── docs/                   # ドキュメント関連
└── README.md               # 本ファイル
```

## 開発環境とデプロイ

本プロジェクトは [CLASP (Command Line Apps Script Projects)](https://github.com/google/clasp) を使用して管理されています。

### 前提条件
- Google Account (権限のあるアカウント)

### 環境設定
開発モードと本番モードの切り替えは、URLパラメータ `use_prod_db=true` またはユーザープロパティによって制御されます。
- GASのscriptPropertiesにて Spreadsheet ID などの環境変数が定義されています。

### デプロイ手順
ソースコードの変更をGASプロジェクトへ反映させるには、CLASPコマンドを使用します。

```bash
# コードのプッシュ
clasp push
```