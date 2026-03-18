# Implement Log

## 2026-03-18 Cycle A

### Goal
- モーダルの即時オープンを優先し、操作待ち時間を短縮する。
- members/directory/skill/task-detail のUX劣化ポイントを潰す。

### Completed
1. `directories-select` を即時表示化。
2. `modal-flow` に背景再同期ユーティリティを追加。
3. members系モーダルの再同期を同期待ちから背景処理へ変更。
4. `skill-create` で `loadAllData` 依存を除去。
5. `directory-detail` のメンバー表示行をBeer CSS寄せに調整。
6. UI/ライブラリ設計メモを docs 化。

### Completed (this cycle)
1. `task-detail` の `isDirty` 初期値を明示的に false に統一。
2. `directory-detail` 保存時に「保存中」表示と二重送信防止を追加。
3. `skill-detail` 保存時に「保存中」表示と二重送信防止を追加。
4. `directory_assignments.role` の編集導線を `member-detail` / `directory-detail` の両方に追加。

### Next
1. membersページのタブ切り替え時レンダリングをさらに分割し、初回表示までの体感遅延を最小化。
2. `task-detail` の links/files エリアを board/task-detail 既存UIトーンに合わせて再調整。
3. `directory_assignments.role` と `skill_assignments.remark` など未露出カラムの編集導線を追加。
4. members系モーダルのレイアウトを board/task-detail の操作密度に合わせて統一。

### Notes
- 削除導線は追加しない方針を維持。
- モーダル表示をDB再取得待ちにしない。
