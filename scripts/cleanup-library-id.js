#!/usr/bin/env node

/**
 * frontend の appsscript.json の ZARMS_DB ライブラリIDをプレースホルダへ戻すスクリプト
 * デプロイ後に実行し、構造は維持したまま libraryId が残らないようにする。
 */

const fs = require('fs');
const path = require('path');

const frontendAppsscriptPath = path.resolve(__dirname, '../projects/frontend/src/appsscript.json');

try {
  const frontendAppsscript = JSON.parse(fs.readFileSync(frontendAppsscriptPath, 'utf8'));

  if (!frontendAppsscript.dependencies) frontendAppsscript.dependencies = {};
  if (!Array.isArray(frontendAppsscript.dependencies.libraries)) {
    frontendAppsscript.dependencies.libraries = [];
  }

  const dbLib = frontendAppsscript.dependencies.libraries.find((lib) => lib.userSymbol === 'ZARMS_DB');
  if (dbLib) {
    dbLib.version = dbLib.version || '0';
    dbLib.libraryId = '{LIBRARY_ID}';
    if (typeof dbLib.developmentMode !== 'boolean') {
      dbLib.developmentMode = true;
    }
  } else {
    frontendAppsscript.dependencies.libraries.push({
      userSymbol: 'ZARMS_DB',
      version: '0',
      libraryId: '{LIBRARY_ID}',
      developmentMode: true
    });
  }

  fs.writeFileSync(frontendAppsscriptPath, JSON.stringify(frontendAppsscript, null, 2) + '\n');
  console.log('✓ appsscript.json の ZARMS_DB をプレースホルダへ戻しました。');
} catch (error) {
  console.error('❌ ZARMS_DB ライブラリのプレースホルダ復元に失敗しました:');
  console.error(`   ${error.message}`);
  process.exit(1);
}
