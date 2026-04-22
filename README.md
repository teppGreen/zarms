# ZARMS (ZEN University Festival All Resource Management System)

ZARMS（ザームス）は、大学祭実行委員会の業務効率化を目的としたタスク管理システムです。
Google Apps Script (GAS) を利用したWebアプリケーションとして構築されており、Google Sheetsをデータベースとして使用しています。

## 概要

本システムは、委員会内のタスクをボード形式で可視化し、メンバー間での進捗共有やコミュニケーションを円滑に行うためのプラットフォームを提供します。
各メンバーは自身の担当タスクを確認し、進捗状況の更新やコメントによるやり取りを行うことができます。

### 主な機能

- **進捗管理**: カンバン方式によるタスクの進捗管理
- **内容管理**: タスクの説明・期限・担当者・優先度の設定
- **コミュニケーション**: タスクごとのコメント機能
- **ダッシュボード**: マイタスク、お知らせ、更新履歴の表示
- **分析**: 更新履歴ログの曜日別可視化

### モバイル版

ZARMSは画面サイズが600px未満のデバイス（スマートフォンなど）からアクセスした場合、frontendのregister画面で自動的に独立した mobile-app Webアプリへリダイレクトされます。

#### モバイル版の特徴
- **3タブ構成**: 画面下部ナビゲーションで「タスク / 当日出欠 / マニュアル」を切り替え
- **マイボード専用**: 自分の担当タスクのみを表示
- **フィルタ機能**: ステータスや優先度でタスクをフィルタリング
- **期限順ソート**: 期限が近いタスクから順に表示
- **当日出欠**: 曜日別の予定時刻編集と、位置情報を使った稼働開始/終了打刻
- **全画面モーダル**: タスク詳細や編集画面は全画面表示で操作しやすく
- **ブラウザ履歴対応**: 戻る・進むボタンで直感的に画面遷移

#### モバイル版で利用できる機能
- タスク一覧表示（マイボードのみ）
- タスク詳細の表示・編集
- タスクの作成
- フィルタリング（ステータス、優先度）
- 当日出欠（予定時刻編集、稼働開始/終了打刻）
- マニュアル（ヘルプサイトへのリンク）

#### モバイル版で利用できない機能
- カンバンボード表示
- タスクのドラッグ&ドロップ
- 関連タスク、リスト、コメント機能
- メンバー管理
- ボード管理
- カレンダー表示

#### デスクトップ版への切り替え
現在の mobile-app にはデスクトップ版へ直接切り替えるメニューはありません。
デスクトップ版を利用する場合は、PC から frontend Web アプリのURLへアクセスしてください。

## 技術スタック

### 構成
本システムはモノレポ構成となっており、以下の3つのGASプロジェクトで構成されています。
1. **Database (Library)**: スプレッドシートへの低レベルなアクセスを担当し、ライブラリとして提供されます。
2. **Frontend (Web App)**: UIおよびビジネスロジックを担当し、Databaseライブラリを呼び出して動作します。
3. **Mobile App (Web App)**: スマートフォン向けUIを担当し、Databaseライブラリを呼び出して動作します。

### バックエンド
- **Google Apps Script (GAS)**: サーバーサイドの処理に利用
- **Google Sheets**: データベースとして利用

### 実行時依存（重要）
- `projects/database` は書き込み処理で Google Sheets API（Advanced Service, v4）を利用します。
- `projects/frontend` / `projects/mobile-app` からライブラリを呼び出す場合、呼び出し側の `appsscript.json` に必要なスコープ設定が必要です。
- `Service Google Sheets API has not been enabled ...` が発生した場合は、呼び出し側の `appsscript.json` に `dependencies.enabledAdvancedServices`（`sheets:v4`）を追加し、再デプロイしてください。

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
├── projects/
│   ├── database/           # データベース操作（GASライブラリ）
│   │   ├── src/
│   │   │   ├── constants.js   # 共通定数・スキーマ定義
│   │   │   ├── database.js    # 抽象化されたDB操作ロジック
│   │   │   ├── db_features.js # 特定機能向けのDB操作（マイボード等）
│   │   │   └── sync/          # 同期処理ロジック
│   │   └── package.json
│   ├── frontend/           # フロントエンド（PC向け GAS Web App）
│       ├── src/
│       │   ├── components/    # 再利用可能なUIコンポーネント
│       │   ├── pages/         # 各ページのコンテンツ
│       │   ├── main.js        # Webアプリのエントリーポイント
│       │   ├── db_bridge.js   # Library呼び出しのブリッジ層
│       │   └── index.html     # メインHTML
│       └── package.json
│   └── mobile-app/         # モバイル版（GAS Web App）
│       ├── src/
│       │   ├── mobile/        # モバイルUI本体
│       │   ├── main.js        # mobile-appエントリーポイント
│       │   ├── db_bridge.js   # Library呼び出しのブリッジ層
│       │   └── appsscript.json
│       └── package.json
├── scripts/
│   └── update-library-id.js # Library ID自動同期スクリプト
├── package.json            # ルート管理（ワークスペース設定）
└── README.md
```

## ドキュメント

本プロジェクトの詳細な仕様やガイドラインについては、以下のドキュメントを参照してください：

* **[データベーススキーマ](docs/database-schema.mmd)**: テーブル構造やリレーションの定義
* **[APIリファレンス](docs/api-reference.md)**: Databaseライブラリ呼び出しと権限評価ルール
* **[テストガイド](docs/testing-guide.md)**: ローカルでの結合テスト実行方法
* **[docsとskillsの使い分け](docs/docs-skills-boundary.md)**: 仕様文書と実行ガイドの責務分担
* **[Copilot Skills（正本）](.github/skills/)**: GitHub Copilot がタスク実行時に参照するスキル集
* **[Beer CSS / Tabulator リファレンス](docs/beercss-tabulator-reference.md)**: 実装方針と更新運用
* **[AIエージェント向けガイドライン](.github/copilot-instructions.md)**: AIが開発・計画を行うためのプロジェクト規約・振る舞い指示

## 開発環境とデプロイ

本プロジェクトは [CLASP (Command Line Apps Script Projects)](https://github.com/google/clasp) を使用して管理されています。

### 前提条件
- Google Account (権限のあるアカウント)
- Node.js 環境
- **1PasswordCLI** (`op` コマンド) がインストールされ、認証済みであること

### 環境設定
[セットアップガイド](docs/setup-guide.md) を参照してください。
