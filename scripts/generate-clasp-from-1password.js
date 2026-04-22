#!/usr/bin/env node

/**
 * 1PasswordCLI から scriptId を取得し、.clasp.json を生成するスクリプト
 * 
 * 用法:
 *   node scripts/generate-clasp-from-1password.js <project> <env>
 * 
 * 例:
 *   node scripts/generate-clasp-from-1password.js database dev
 *   node scripts/generate-clasp-from-1password.js frontend prod
 *   node scripts/generate-clasp-from-1password.js mobile-app dev
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const [project, env] = process.argv.slice(2);

// 引数検証
if (!project || !env) {
  console.error('Usage: node generate-clasp-from-1password.js <project> <env>');
  console.error('Example: node generate-clasp-from-1password.js database dev');
  process.exit(1);
}

if (!['dev', 'prod'].includes(env)) {
  console.error('❌ env は "dev" または "prod" である必要があります');
  process.exit(1);
}

if (!['database', 'frontend', 'mobile-app'].includes(project)) {
  console.error('❌ project は "database"、"frontend"、または "mobile-app" である必要があります');
  process.exit(1);
}

// 実行ディレクトリを projects/<project> に変更
const projectDir = path.join(__dirname, '..', 'projects', project);
if (!fs.existsSync(projectDir)) {
  console.error(`❌ プロジェクトディレクトリが見つかりません: ${projectDir}`);
  process.exit(1);
}

const claspJsonPath = path.join(projectDir, '.clasp.json');
const vault = process.env.OP_VAULT || 'zarms';
const itemName = `clasp-${project}-${env}`;

try {
  console.log(`⏳ 1Password から scriptId を取得中... (vault: ${vault}, item: ${itemName})`);
  
  // 1Password から scriptId を取得
  const scriptId = execSync(
    `op item get "${itemName}" --vault "${vault}" --fields label=script-id --reveal`,
    { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
  ).trim();

  if (!scriptId) {
    throw new Error('scriptId が取得できませんでした (空の値)');
  }

  // .clasp.json テンプレート
  const claspConfig = {
    scriptId: scriptId,
    rootDir: 'src',
    scriptExtensions: ['.js', '.gs'],
    htmlExtensions: ['.html'],
    jsonExtensions: ['.json']
  };

  // .clasp.json を生成
  fs.writeFileSync(
    claspJsonPath,
    JSON.stringify(claspConfig, null, 2) + '\n'
  );

  console.log(`✓ .clasp.json を生成しました: ${path.relative(process.cwd(), claspJsonPath)}`);
} catch (error) {
  console.error('❌ scriptId の取得に失敗しました:');
  
  if (error.message.includes('denied')) {
    console.error('   1Password へのアクセスが拒否されました。');
    console.error('   以下を確認してください:');
    console.error('   - 1PasswordCLI がインストール済みか (op コマンド)');
    console.error('   - op account list で接続しているアカウントが正しいか');
  } else if (error.message.includes('not found')) {
    console.error(`   Vault: "${vault}", Item: "${itemName}" が見つかりません。`);
    console.error('   1Password で正しい Vault/Item を作成していることを確認してください。');
  } else {
    console.error(`   ${error.message}`);
  }
  
  process.exit(1);
}
