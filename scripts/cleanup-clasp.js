#!/usr/bin/env node

/**
 * .clasp.json をプレースホルダへ戻すスクリプト
 * 
 * デプロイ後に実行して、.clasp.json の scriptId を {SCRIPT_ID} へ戻します。
 * 構造を保持しつつ、秘密情報がリポジトリに残らないようにするための処理です。
 * 
 * 用法:
 *   node scripts/cleanup-clasp.js <project>
 * 
 * 例:
 *   node scripts/cleanup-clasp.js database
 *   node scripts/cleanup-clasp.js frontend
 *   node scripts/cleanup-clasp.js mobile-app
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
const placeholderConfig = {
  scriptId: '{SCRIPT_ID}',
  rootDir: 'src',
  scriptExtensions: ['.js', '.gs'],
  htmlExtensions: ['.html'],
  jsonExtensions: ['.json']
};

try {
  fs.writeFileSync(claspJsonPath, JSON.stringify(placeholderConfig, null, 2) + '\n');
  console.log(`✓ .clasp.json をプレースホルダへ戻しました: ${path.relative(process.cwd(), claspJsonPath)}`);
} catch (error) {
  console.error(`❌ .clasp.json のプレースホルダ復元に失敗しました:`);
  console.error(`   ${error.message}`);
  process.exit(1);
}
