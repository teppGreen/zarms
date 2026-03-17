# Frontend 構成リファクタガイド（詳細版）

このドキュメントは、GAS HTML Service 前提の ZARMS フロントエンドを、
「安全に段階移行」するための実務手順をまとめたものです。

本ガイドのゴールは、次の3点です。

- 巨大ファイル化の防止
- HTML と JavaScript の責務分離
- 既存機能を壊さず段階移行できる構成への統一

---

## 1. 適用範囲

対象は次のファイル群です。

- `projects/frontend/src/pages/*.html`
- `projects/frontend/src/components/**/*.html`
- 必要に応じて `projects/frontend/src/mobile/*.html`

このガイドは「画面構造とページロジックの分離」を主眼にしています。
UIデザイン変更や機能追加はスコープ外です。

---

## 2. 基本方針

1. 画面骨格は `*.html` に置く
2. ページロジックは `*-script.html` に分離する
3. `<?!= include('...'); ?>` で合成する
4. 動的生成は「繰り返し要素」に限定する
5. 1回のPRで責務分離と仕様変更を混在させない

---

## 3. 命名規約と配置規約

### 3.1 命名

- 画面本体: `pages/xxx.html`, `components/yyy.html`
- ロジック: `pages/xxx-script.html`, `components/yyy-script.html`
- include 例: `<?!= include('pages/xxx-script'); ?>`

### 3.2 配置

- scriptlet (`<?!= include('...'); ?>`) は `index.html`（または `mobile/index.html`）にのみ記述する
- `pages/*.html` / `components/**/*.html` には scriptlet を書かない
- script の読み込み順は `index.html` 側の include 順で維持する
- script側ファイルは `<script> ... </script>` を含んだ完全な断片として管理する

---

## 4. GAS 特有の注意

- HTMLファイル内の `//` は `\/\/` で記述する
	- 例: `https:\/\/example.com`
- デプロイ時にファイル階層はフラット化される前提で、ファイル名衝突を避ける
- 長文仕様はコードコメントに残さず、`docs/` に分離する
- セキュリティ上のユーザー識別はサーバー側で取得する

---

## 5. 移行前チェックリスト

作業開始前に必ず確認する。

1. 対象ファイルを決める（1回で広げすぎない）
2. 現在の動作を手動で確認する（最低限、主要導線）
3. デプロイ可能状態であることを確認する
4. 差分が混ざらないよう、目的外の編集を避ける
5. scriptの抽出元を明確にする（再抽出時の事故防止）

---

## 6. 標準移行手順（HTML/Script分離）

### Step 1: script抽出

- 対象 `*.html` の `<script>` ブロックを `*-script.html` に移す
- script内のロジックは基本的に無変更

### Step 2: 元ファイル置換

- 元ファイルから `<script>` ブロックを削除
- `index.html`（または `mobile/index.html`）へ次を追加

```html
<?!= include('pages/xxx-script'); ?>
```

- 注意: `pages/xxx.html` 側には include を追加しない

### Step 3: 読み込み順確認

- 依存順が変わっていないか確認
- `App.*` の初期化順序が崩れていないか確認

### Step 4: 問題チェック

- Problems（構文エラー）確認
- 対象画面の最低限の手動確認

### Step 5: デプロイ前確認

- 目的外の差分がないか確認
- include重複、空ファイル化がないか確認

---

## 7. よくある失敗と対処

### 7.1 includeが重複する

症状:

- 同じ `<?!= include('...'); ?>` が2回以上入る

対処:

- `index.html` 側を確認し、includeを1つに統一する

### 7.2 scriptファイルが空になる

症状:

- `*-script.html` が空
- 元ファイル側にも script がない

原因:

- 抽出処理を既に分割済みファイルに再実行した

対処:

- `git show HEAD:<path>` を入力ソースに再生成する
- 「常にオリジナルを基準に抽出」の運用に統一する

### 7.3 参照順序崩れで実行時エラー

症状:

- `App.utils.xxx is undefined`

対処:

- `index.html` の include 位置を見直し、元の読込順へ戻す

---

## 8. 段階的移行プラン（推奨）

### Phase 1: 構造分離（このガイドの主対象）

- HTMLとscriptを分離
- 動作変更なし

### Phase 2: inline event 廃止

- `onclick`, `onchange` を段階的に `addEventListener` へ移行
- 画面単位で完結させる

### Phase 3: 責務分割

- `state`, `service`, `render`, `controller` に再編
- 既存APIとDOM契約を維持する

### Phase 4: 共通化

- `js.html` の汎用処理を機能別に分離

---

## 9. 手動テスト観点（最低限）

対象画面ごとに次を確認する。

1. 画面表示が崩れない
2. タブ切り替えが動く
3. モーダル開閉が動く
4. データ読み込みが動く
5. コンソールに新規エラーが出ない

---

## 10. レビューポイント

レビュー時は次を優先確認する。

1. scriptの内容が実質無変更か
2. `index.html` 側の include が1回のみで正しいパスか
3. 依存順序が維持されているか
4. GAS制約（`\/\/` など）を満たすか
5. 目的外の差分が混入していないか

---

## 11. ロールバック方針

問題が出た場合は、対象画面単位でロールバックする。

- 1画面分の分離差分を戻す
- 元の単一ファイル構成に戻して再確認
- 原因確定後に再度分離する

「複数画面をまとめて戻す」より、単位を小さく戻すほうが安全。

---

## 12. 完了条件

次を満たしたら、その画面の移行完了とする。

1. HTML本体とscriptが分離されている
2. 問題パネルにエラーがない
3. 主要導線が手動確認で動く
4. ドキュメント差分が更新されている

---

## 13. 今後の推奨タスク

1. `onclick` など inline event を段階的に `addEventListener` へ移行する
2. 描画関数（render）とAPI呼び出し（service）の責務を分ける
3. 共有ユーティリティを `js.html` から機能別に分割する
4. モバイル側にも同じ分離規約を適用する
