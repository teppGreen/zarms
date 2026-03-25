# ZARMS セットアップガイド

本ドキュメントは、ZARMS の開発環境を初期構築する際のステップバイステップガイドです。

## 前提条件

- macOS / Linux / Windows (WSL2)
- Google Account (ZARMS の開発権限を持つアカウント)
- Node.js 18 以上
- npm または yarn

## ステップ 1: リポジトリのクローン

```bash
git clone https://github.com/teppGreen/zarms.git
cd zarms
npm install
```

## ステップ 2: 1PasswordCLI のセットアップ

### 2-1. 1PasswordCLI のインストール

#### macOS (Homebrew)
```bash
brew install 1password-cli
```

#### Linux / Windows (WSL2)
詳細は [1Password CLI インストール手順](https://developer.1password.com/docs/cli/get-started) を参照してください。

### 2-2. 1Password にサインイン

```bash
op account add
```

プロンプトに従って、以下を入力してください:
- **Email address**: 1Password アカウントのメールアドレス
- **Signing-in address**: 1Password のサブドメイン (例: `my.1password.com`)
- **Secret Key**: 1Password アカウントの Secret Key

サインイン完了:
```bash
op account list
```

## ステップ 3: GAS プロジェクト ID の取得

本プロジェクトでは、Google Apps Script (GAS) の **scriptId** を 1Password Vault で管理します。

### 3-1. GAS プロジェクト ID を確認

1. [Google Apps Script dashboard](https://script.google.com) にアクセス
2. 開発環境用の Database プロジェクトを選択
3. **プロジェクト設定 > IDs > Script ID** を確認し、コピー

### 3-2. 1Password Vault にアイテムを作成

**Vault**: `zarms` という名前を使用 (カスタム名を使う場合は、デプロイ時に `OP_VAULT` 環境変数で指定)

**必要なアイテムと format**:

#### Database 開発環境用アイテム
- **Item name**: `clasp-database-dev`
- **Custom field**: `script-id` = `{GAS Database Dev Project ID}`

#### Database 本番環境用アイテム
- **Item name**: `clasp-database-prod`
- **Custom field**: `script-id` = `{GAS Database Prod Project ID}`

#### Frontend 開発環境用アイテム
- **Item name**: `clasp-frontend-dev`
- **Custom field**: `script-id` = `{GAS Frontend Dev Project ID}`

#### Frontend 本番環境用アイテム
- **Item name**: `clasp-frontend-prod`
- **Custom field**: `script-id` = `{GAS Frontend Prod Project ID}`

### 3-3. 1Password にアイテムを追加するコマンド例

```bash
op item create --vault zarms \
  --title "{Item name}" \
  --category "Software License" \
  "script-id={SCRIPT_ID}"
```

または、1Password Web/Desktop App から直接アイテムを作成することもできます。

## ステップ 4: 1PasswordCLI 設定を確認

```bash
# scriptId が正しく取得できることを確認
op item get "clasp-database-dev" --vault "zarms" --fields label=script-id
```

エラーが出た場合は、以下を確認してください:
- 1Password でサインインしているか (`op account list`)
- Vault 名が正しいか
- アイテムが存在するか (`op item list --vault zarms`)

## ステップ 5: デプロイテスト

デプロイができることを確認:

```bash
# Database 開発環境へのデプロイ
npm run deploy:database:dev

# 期待される動作:
# 1. generate-clasp-from-1password.js が 1Password から scriptId を取得
# 2. .clasp.json が一時生成される
# 3. clasp push でデプロイ
# 4. cleanup-clasp.js で .clasp.json が削除される
```

成功時のメッセージ:
```
✓ .clasp.json を生成しました
Pushing...
...
✓ .clasp.json を削除しました
```

## ステップ 6: Git 設定

`.gitignore` に以下が含まれていることを確認:

```
.clasp.json
node_modules/
.DS_Store
.env
appsscript.json
temp/
```

これにより、秘密情報がリポジトリに含まれることはありません。

## トラブルシューティング

### エラー: `op: command not found`

1PasswordCLI がインストール/PATHに設定されていません。[ステップ 2-1](#2-1-1passwordcli-のインストール) を確認してください。

### エラー: `denied: access denied`

1Password セッションが失効しています:

```bash
op account list
# 出力に "authorized" と表示されない場合
op account add
```

### エラー: `Item not found`

1Password Vault に作成したアイテムが見つかりません。以下を確認:

```bash
# Vault 一覧を確認
op vault list

# zarms Vault 内のアイテム一覧
op item list --vault zarms
```

### エラー: `scriptId が取得できませんでした (空の値)`

1Password アイテムの `script-id` フィールドが空です。アイテムを編集して、正しい GAS Script ID を入力してください。

## よくある質問

### Q: ローカル開発時は毎回デプロイが必要ですか?

開発環境では `npm run watch:frontend:dev` を使用し、ファイル変更時に自動デプロイされます:

```bash
npm run watch:frontend:dev
```

このコマンドを実行すると:
1. `generate-clasp-from-1password.js` で .clasp.json を生成
2. `clasp push --watch` で監視モードを開始
3. ファイル変更時に自動デプロイ
4. **注意**: 監視モードを終了する際は、手動で `.clasp.json` を削除してください:
   ```bash
  npm run cleanup-clasp -w projects/frontend
   ```

### Q: カスタム Vault 名を使いたいです

デプロイ実行時に環境変数で指定:

```bash
OP_VAULT="my-custom-vault" npm run deploy:frontend:dev
```

### Q: CI/CD パイプラインでデプロイする場合はどうしますか?

GitHub Actions などの CI/CD システムでは、1Password Service Account を使用します:

```yaml
# .github/workflows/deploy.yml
- name: Generate .clasp.json
  env:
    OP_SERVICE_ACCOUNT_TOKEN: ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}
  run: npm run deploy:frontend:prod
```

詳細は [1Password CLI ドキュメント](https://developer.1password.com/docs/cli/service-accounts) を参照。

### Q: リポジトリの既存の `.clasp*.json` ファイルはどうするのですか?

既に存在する場合は削除してください:

```bash
rm projects/database/.clasp.json
rm projects/frontend/.clasp.json
git add -A
git commit -m "chore: remove static .clasp config files, use 1Password CLI instead"
git push
```

### Q: 開発チーム全体で同じ 1Password Vault を共有するのですか?

はい、推奨されます。チームメンバー全員が `zarms` Vault へのアクセス権を持つことで、誰でもデプロイが可能になります。

個別アカウントを使い分けたい場合は、開発/本番環境ごとに異なるアカウントでサインインして、別の Vault を使用することもできます。

---

セットアップ完了後は、通常のデプロイコマンドを使用できます:

```bash
# 全プロジェクトを開発環境へデプロイ
npm run deploy:all:dev

# 全プロジェクトを本番環境へデプロイ
npm run deploy:all:prod

# データベースのみデプロイ
npm run deploy:database:dev

# フロントエンドのみデプロイ
npm run deploy:frontend:dev
```
