# Quillエディタのフォーマット方針（色指定無視）

## 目的

ZARMSで利用しているQuillエディタについて、表示崩れや読みやすさ低下を防ぐため、文字色・背景色の指定を受け付けない方針を定義する。

このドキュメントは、実装前の調査結果と実装仕様の両方をまとめた正本とする。

## 調査結果

### 1. 現在の利用箇所

- `projects/frontend/src/js.html`
  - `App.utils.quill` としてデスクトップ向け共通初期化を提供
- `projects/frontend/src/components/modals/task-detail-script.html`
- `projects/frontend/src/components/modals/member-detail-script.html`
- `projects/frontend/src/components/modals/plan-detail-script.html`
  - 上記3つは `App.utils.quill` を利用
- `projects/frontend/src/mobile/quill_editor.html`
  - モバイル向けに `new Quill(...)` を直接利用（共通化されていない）

### 2. 現在の入力導線

- ツールバーには色指定UI（`color`/`background`）は未表示
- ただし貼り付け由来のHTMLに色指定が含まれると、内部データとして保持される可能性がある
- 既存保存データに色指定が含まれる場合、再表示時に色が復元される可能性がある

### 3. Quill標準機能での制御可否

Quill 2では、カスタムCSSより前に以下の標準機能で制御できる。

- `formats` オプション
  - 許可するフォーマットを配列で明示可能
  - `color` と `background` を含めなければ、色系フォーマットは編集内容として許可しない
- `modules.clipboard.matchers`
  - クリップボード取り込み時にDeltaを加工可能
  - `attributes.color` と `attributes.background` を削除できる

参考:
- https://quilljs.com/docs/configuration/
- https://quilljs.com/docs/formats/
- https://quilljs.com/docs/modules/clipboard/

## 採用仕様

### 1. 優先方針

1. Quill標準設定（`formats` / `clipboard.matchers`）で色指定を無効化する
2. それでも残る既存HTML由来の色属性は、保存時・表示時のサニタイズで除去する
3. カスタムスタイル（CSS上書き）では解決しない

### 2. 許可フォーマット

デスクトップ共通 (`App.utils.quill`):
- `bold`
- `italic`
- `underline`
- `strike`
- `list`
- `link`
- `softbreak`（独自BR Blot）

モバイル:
- `bold`
- `italic`
- `underline`
- `strike`
- `list`
- `link`

### 3. 出力HTMLで想定される主なタグ

Quillのフォーマット解釈により、主に以下が生成対象になる。

- 段落: `p`
- 改行（desktopのShift+Enter）: `br`
- 強調: `strong`, `em`, `u`, `s`
- リスト: `ol`, `ul`, `li`
- リンク: `a`
- ルート・内部ラッパ: `div`, `span`（Quill内部構造）

注記:
- 実際の出力はQuillの内部正規化で変換されるため、貼り付け元HTMLと完全一致はしない。
- 画像・動画などの埋め込みは、現行ツールバー導線では想定しない。

### 4. 色指定の除去対象

以下を除去対象とする。

- Delta属性: `color`, `background`
- HTML属性: `color`, `bgcolor`
- インラインスタイル: `color`, `background`, `background-color`
- Quill色クラス: `ql-color-*`, `ql-bg-*`

## 実装反映方針

- デスクトップ共通モジュール `App.utils.quill`
  - `formats` を明示
  - `clipboard.matchers` で色属性削除
  - `getContent` / `setContent` で色指定除去サニタイズを実施
- モバイル `mobile/quill_editor.html`
  - 同等の `formats` / `clipboard.matchers` を適用
  - 保存時・初期表示時に色指定除去サニタイズを実施

## テスト観点（抜粋）

- 赤文字や背景色付きテキストを貼り付けても、通常文字色として保存される
- 既存データに `style="color:red"` が含まれていても、エディタ表示時に色が消える
- `bold` / `list` / `link` など非色情報は維持される
- モバイルとデスクトップで挙動差がない
