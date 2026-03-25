#!/usr/bin/env node

/**
 * .clasp.json をクリーンアップするスクリプト
 * 
 * デプロイ後に実行して、生成された .clasp.json を削除します。
 * リポジトリに秘密情報が残らないようにするための処理です。
 * 
 * 用法:
 *   node scripts/cleanup-clasp.js <project>
 * 
 * 例:
 *   node scripts/cleanup-clasp.js database
 *   node scripts/cleanup-clasp.js frontend
 */

const fs = require('fs');
const path = require('path');

const [project] = process.argv.slice(2);

// 引数検証
if (!project) {
  console.error('Usage: node cleanup-clasp.js <project>');
  console.error('Example: node cleanup-clasp.js database');
  process.exit(1);
}

const projectDir = path.join(__dirname, '..', 'projects', project);
if (!fs.existsSync(projectDir)) {
  console.error(`❌ プロジェクトディレクトリが見つかりません: ${projectDir}`);
  process.exit(1);
}

const claspJsonPath = path.join(projectDir, '.clasp.json');

try {
  if (fs.existsSync(claspJsonPath)) {
    fs.unlinkSync(claspJsonPath);
    console.log(`✓ .clasp.json を削除しました: ${path.relative(process.cwd(), claspJsonPath)}`);
  } else {
    console.log(`ℹ .clasp.json は既に存在しません: ${path.relative(process.cwd(), claspJsonPath)}`);
  }
} catch (error) {
  console.error(`❌ .clasp.json の削除に失敗しました:`);
  console.error(`   ${error.message}`);
  process.exit(1);
}
