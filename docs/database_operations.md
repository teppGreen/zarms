# データベース操作ガイド (database.js)

このドキュメントでは、ZARMSプロジェクトにおけるGoogle Apps Scriptベースのデータベース操作ライブラリ（`projects/database/src/database.js`）の使用方法について解説します。
スプレッドシートに基づくデータベースへのアクセスを高速かつ抽象的に行うための関数が用意されています。

## 目次
1. [基本的なコンセプト](#基本的なコンセプト)
2. [データの取得 (Select)](#データの取得-select)
    - [基本的なSELECT](#基本的なselect)
    - [JOINを使ったSELECT](#joinを使ったselect)
3. [データの挿入 (Insert)](#データの挿入-insert)
    - [単一レコードの挿入](#単一レコードの挿入)
    - [複数レコードのバルク挿入](#複数レコードのバルク挿入)
4. [データの更新 (Update)](#データの更新-update)
5. [データの削除 (Remove)](#データの削除-remove)
6. [クエリ構文 (Query Object)](#クエリ構文-query-object)

---

## 基本的なコンセプト

このライブラリは、Google Visualization APIを使った高速な参照（SELECT）と、Google Sheets APIを使った書き込み（INSERT/UPDATE/DELETE）を組み合わせて実装されています。

以下のパラメータが各関数で共通して使用されます。
- `sheetName` (String): 操作対象のシート名（テーブル名に該当します）
- `userId` (String): 操作を実行しているユーザーID（監査・ログ用途などで使用されます）
- `query` (Object): レコードの検索や更新、削除の条件を指定する共通オブジェクト

---

## データの取得 (Select)

データの取得には `select` と `selectWithJoin` を使用します。これらはGoogle Visualization API (GViz) を用いて高速なデータ検索（読み取り）を実現します。

### 基本的なSELECT
```javascript
/**
 * select(sheetName, query)
 */
const records = select('members', {
    where: {
        is_active: ['=', true],
        grade: ['=', 3]
    },
    orderBy: {
        created_at: 'DESC'
    },
    limit: 10
});
```

### JOINを使ったSELECT
他のテーブルとVLOOKUP的に結合してデータを取得します。リレーショナルなクエリをアプリケーション側で再現するためのインターフェースです。
```javascript
/**
 * selectWithJoin(sheetName, query, joins)
 */
const tasksWithAssignee = selectWithJoin('tasks', {
    where: { is_done: ['=', false] }
}, [
    {
        targetTable: 'members',           // 結合先のテーブル名
        joinType: 'LEFT',                 // 結合タイプ
        columns: ['display_name'],        // 結合先から取得するカラム
        localKey: 'assigned_to',          // 結合元(tasks)のキー
        foreignKey: 'id',                 // 結合先(members)のキー
        alias: 'assignee_'                // 取得したカラム名のプレフィックス (例: assignee_display_name)
    }
]);
```

---

## データの挿入 (Insert)

Sheets APIを利用してデータをシートに書き込みます。関数内部でLockServiceによる排他制御が行われます。

### 単一レコードの挿入
```javascript
/**
 * insert(userId, sheetName, record)
 */
const newMember = {
    display_name: 'Yamada Taro',
    email: 'taro@example.com',
    grade: 1
};

const result = insert(userId, 'members', newMember);
```

### 複数レコードのバルク挿入
APIリクエスト回数を抑え、まとめて書き込む際に使用します。
```javascript
/**
 * bulkInsert(userId, sheetName, records)
 */
const members = [
    { display_name: 'A', email: 'a@example.com' },
    { display_name: 'B', email: 'b@example.com' }
];

const result = bulkInsert(userId, 'members', members);
```

---

## データの更新 (Update)

特定のデータを更新します。対象を `where` 句で指定し、新しい値を `set` 句で指定します。内部で複数の条件に合致した場合、全ての合致するレコードがバッチ更新されます。

```javascript
/**
 * update(userId, sheetName, query)
 */
const result = update(userId, 'tasks', {
    set: {
        is_done: true,
        completed_at: new Date()
    },
    where: {
        id: ['=', 'task_12345']
    }
});
```

---

## データの削除 (Remove)

指定した条件に合致するレコード（行）自体をシートからまとめて削除します。

```javascript
/**
 * remove(sheetName, query)
 */
const result = remove('temporary_records', {
    where: {
        created_at: ['<', new Date('2024-01-01')]
    }
});
```
※物理削除ではなく論理削除を採用する場合は、 `update`関数を用いて特定のフラグ（例: `is_deleted`）を変更することを推奨します。

---

## クエリ構文 (Query Object)

各関数に対して引数で渡す `query` オブジェクトの詳細な記述ルールです。

### 1. `where` (条件句)
キーにカラム名、値に操作を表す配列 `[operator, value]` を指定します。複数のキーを指定した場合は `AND` 条件として解釈されます。

```javascript
where: {
    columnName: [operator, value]
}
```

#### サポートされるOperator
- `'='` : 等しい
- `'!='` または `'<>'` : 等しくない
- `'>'`, `'>='`, `'<'`, `'<='` : 比較演算子
- `'in'` : 配列で渡された複数の値のいずれかに一致する (OR条件に展開されます)
  ```javascript
  where: {
      status: ['in', ['TODO', 'IN_PROGRESS']]
  }
  ```
- `'is null'`, `'is not null'` : 空(NULL)であるか／空でないかを判定する
  ```javascript
  where: {
      completed_at: ['is null'] // valueの指定は不要です（指定しても無視されます）
  }
  ```

#### 特殊なデータ型の処理
- **Boolean型**: `true`, `false` は内部的に `"'TRUE'"` / `"'FALSE'"` という文字列へのフォールバックとしても判定されるようになっているため、スプレッドシートの表現のブレに対して強力です。
- **Date型**: Dateオブジェクトを設定した場合、自動的にGVizの `datetime` 形式へエスケープされます。

### 2. `rawWhere` (生のGViz条件句指定)
`where` 句では表現しづらい複雑な条件式（例えば、異なるカラム同士のOR条件など）がある場合には `rawWhere` に生のクエリ文字列（Google Visualization APIクエリ言語の形式）を指定できます。
`where`と`rawWhere`が併用された場合、両者は `AND` で結合されます。

```javascript
query: {
    rawWhere: "(A = 'hoge' OR B = 'fuga')" // 実際の列ID(A, Bなど)を意識する必要がある場合がある点に注意
}
```

### 3. `orderBy` (並び替え)
データを取得する際の順序を指定します。カラム名と `'ASC'` または `'DESC'` を指定します。
```javascript
orderBy: {
    created_at: 'DESC',
    display_id: 'ASC'
}
```

### 4. `limit` (制限)
取得するレコードの最大件数を制限します。
```javascript
limit: 50
```
