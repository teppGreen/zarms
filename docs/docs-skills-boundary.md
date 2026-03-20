# docs と skills の使い分けガイド

この文書は、`docs/` と `skills` の責務境界を明確にし、情報の重複と散在を防ぐための運用基準です。

## 結論（先に要点）

- `docs/` は **人間向けの仕様・運用知識の正本**。
- `.github/skills/` は **Copilot がタスク実行時に呼び出す実行ガイド**（正本）。

迷った場合は、まず `docs/` に仕様を置き、`skills` には「いつ使うか」「どこを見るか」「実行手順」を短く書く。

## 役割定義

## `docs/` に置くもの

- API仕様、データ構造、セキュリティ要件、運用手順などの長期参照情報
- 背景・理由・例外・制約を含む説明
- 人間レビュー時に単体で読んで理解できる文書

## `.github/skills/` に置くもの（正本）

- 特定タスクを実行するための短い手順
- 発火条件（いつ使うか / 使わないか）
- 実装時チェックポイントと参照先（主に `docs/` へのリンク）

## `scripts/` に置くもの

- 繰り返し実行する機械的処理（デプロイ補助、静的チェック、安全な一括置換）
- 入出力が明確で、実行結果をCLIで判定できる処理
- 実装仕様の説明は持たず、必要最小限の実行説明のみを持つ

## 書き分けの判断基準

- 仕様を説明したい → `docs/`
- 実行フローを再利用したい → `skills`
- 変更理由や背景が主題 → `docs/`
- 実装時の即時判断を助ける箇条書き → `skills`
- 反復的で機械化できる作業 → `scripts`

## 運用ルール

1. 同じ仕様を `docs` と `skills` に二重記載しない。
2. `skills` には仕様本文を写さず、参照先の `docs` を明記する。
3. `scripts` には運用背景を書かず、仕様説明は `docs` に置く。
4. 仕様変更時は `docs` を先に更新し、必要な `skills` と `scripts` の参照先だけ更新する。
5. 新規 skill 追加時は、対応する仕様ドキュメントが `docs` に存在することを確認する。
6. 運用上は `.github/skills/` のみを更新し、skills は単一配置で運用する。

## 現在の推奨マッピング

- `.github/skills/gas-html-service-practices`  
  → `docs/api-reference.md`, `docs/testing-guide.md`
- `.github/skills/ui-styling-gas`  
  → `docs/beercss-tabulator-reference.md`, `docs/references/beercss-llms.md`
- `.github/skills/members-tabulator-iframe`  
  → `docs/beercss-tabulator-reference.md`, 対象ページの実装ファイル

## 外部参照の扱い

- 外部の長文ガイドは可能な限り `docs/references/` に固定配置する。
- 参照元URLはドキュメントに残し、将来の更新時に追跡可能にする。
