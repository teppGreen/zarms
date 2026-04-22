#!/usr/bin/env node

/**
 * appsscript.json の ZARMS_DB ライブラリIDをプレースホルダへ戻すスクリプト
 * デプロイ後に実行し、構造は維持したまま libraryId が残らないようにする。
 */

const fs = require('fs');
const path = require('path');

const targetProject = process.argv[2] || 'frontend';
const appsscriptPath = path.resolve(__dirname, `../projects/${targetProject}/src/appsscript.json`);

if (!['frontend', 'mobile-app'].includes(targetProject)) {
  console.error('❌ project は "frontend" または "mobile-app" を指定してください。');
  process.exit(1);
}

try {
  const appsscript = JSON.parse(fs.readFileSync(appsscriptPath, 'utf8'));

  if (!appsscript.dependencies) appsscript.dependencies = {};
  if (!Array.isArray(appsscript.dependencies.libraries)) {
    appsscript.dependencies.libraries = [];
  }

  const dbLib = appsscript.dependencies.libraries.find((lib) => lib.userSymbol === 'ZARMS_DB');
  if (dbLib) {
    dbLib.version = dbLib.version || '0';
    dbLib.libraryId = '{LIBRARY_ID}';
    if (typeof dbLib.developmentMode !== 'boolean') {
      dbLib.developmentMode = true;
    }
  } else {
    appsscript.dependencies.libraries.push({
      userSymbol: 'ZARMS_DB',
      version: '0',
      libraryId: '{LIBRARY_ID}',
      developmentMode: true
    });
  }

  fs.writeFileSync(appsscriptPath, JSON.stringify(appsscript, null, 2) + '\n');
  console.log(`✓ projects/${targetProject}/src/appsscript.json の ZARMS_DB をプレースホルダへ戻しました。`);
} catch (error) {
  console.error('❌ ZARMS_DB ライブラリのプレースホルダ復元に失敗しました:');
  console.error(`   ${error.message}`);
  process.exit(1);
}
