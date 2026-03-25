---
name: update-ui-dependencies
description: BeerCSSとTabulatorのCDNバージョンを更新し、関連ドキュメントと差分確認を一括で進める。UI依存の定期アップデート時に使う。
---

# Skill: UI依存（BeerCSS/Tabulator）更新

このスキルは、ZARMSの UI 依存ライブラリ（BeerCSS / material-dynamic-colors / Tabulator）のバージョン更新を、安全に実行するための手順です。

## 使う場面

- BeerCSS を新バージョンへ更新するとき
- Tabulator を新バージョンへ更新するとき
- CDNバージョンの追従と差分確認を一括で行いたいとき

## 実行手順

1. 更新対象バージョンを決める（例: `beercss=4.0.19`, `tabulator=6.3.0`）。
2. ルートで次を実行する。

```bash
npm run update:ui-deps -- --beercss=<version> --material-dynamic-colors=<version> --tabulator=<version>
```

3. 変更ファイルを確認する。
   - `projects/frontend/src/css.html`
   - `projects/frontend/src/pages/members-script.html`
4. 参照資料の整合を確認する。
   - `docs/beercss-tabulator-reference.md`
   - `docs/references/beercss-llms.md`
5. 必要に応じて手動検証を実施する（membersタブ表示、ソート、フィルタ、行クリック）。

## チェックポイント

1. 置換対象が見つからないエラーが出ていないか。
2. `beercss@x.y.z` / `material-dynamic-colors@x.y.z` / `tabulator-tables@x.y.z` が意図した値になっているか。
3. members iframe 内 Tabulator が正常描画されるか。
4. 更新内容が `docs/docs-skills-boundary.md` の役割分担に沿っているか。

## 補足

- バージョン置換は `scripts/update-ui-deps.js` が担当する。
- 仕様詳細や背景説明は `docs/` に保持し、このスキルには実行手順のみ残す。
