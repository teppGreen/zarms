# Detailモーダル統一規約

本ドキュメントは、frontendのdetail系モーダル（task/member/plan/directory/skill）の実装を揃えるための最小規約です。

## 1. HTMLテンプレート

- ルートは `dialog` 要素を使う。
- 3カラム構成を基本とする。
- 左列: 基本情報/監査情報。
- 中央列: `tabbed` + `page` 構造の主編集領域。
- 右列: コメント領域。
- タブ切替は `onclick` ではなく `data-ui` を使う。

### タブの最小テンプレート

```html
<nav class="tabbed small max" id="xxx-detail-tabs">
  <a class="active" data-ui="#xxx-detail-tab-main"><span>メイン</span></a>
  <a data-ui="#xxx-detail-tab-sub"><span>補助</span></a>
</nav>

<div id="xxx-detail-tab-main" class="page medium-height active"></div>
<div id="xxx-detail-tab-sub" class="page medium-height scroll"></div>
```

## 2. state契約

モーダルの状態は最低限、以下を持つ。

- `currentId`
- `currentItem`
- `originalData`
- `isLoading`
- `isSaving`
- `isDirty`

`isDirty` の更新は `toggleDirty` または `_setDirty` を経由し、ボタン状態更新と分離しない。

## 3. 主要アクション

- 変更なし: 主ボタンは「閉じる」。
- 変更あり: 主ボタンは「変更を保存」。
- 保存中/削除中/読込中: 主操作を無効化する。
- 破棄ボタンは `isDirty` が `true` の時だけ有効にする。

## 4. closeインターフェース

`close(options)` を標準とし、以下を受ける。

- `skipDirtyCheck`
- `reason`

`reason === 'escape'` の場合は文言を明示し、未保存変更の確認を必ず行う。

## 5. コメント機能

コメントは `App.utils.commentManager` を通す。

- `loadComments`
- `renderComments`
- `appendCommentToUI`

上記3関数は各モーダルで薄いラッパーに留める。

## 6. 初期化と後始末

- open直後に状態フラグを初期化する。
- 非同期開始時に `isSaving`/`isLoading` を更新する。
- finallyで必ず状態フラグを終端へ戻す。
- reset時は初期タブに戻す。

## 7. 禁止事項

- タブ切替への `onclick="...switchTab(...)"` 直書き。
- 主要ボタンの状態更新を個別DOM操作で分散実装。
- HTML内で閉じタグのスラッシュをエスケープする記述（例: `<\/dialog>`）。
