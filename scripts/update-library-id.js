const fs = require('fs');
const path = require('path');

const env = process.argv[2] || 'dev';
const dbClaspPath = path.resolve(__dirname, `../projects/database/.clasp-${env}.json`);
const frontendAppsscriptPath = path.resolve(__dirname, '../projects/frontend/src/appsscript.json');

try {
    const dbClasp = JSON.parse(fs.readFileSync(dbClaspPath, 'utf8'));
    const dbScriptId = dbClasp.scriptId;

    if (!dbScriptId || dbScriptId.includes('YOUR_')) {
        console.warn(`Warning: Database Script ID for ${env} is not set correctly in ${dbClaspPath}`);
    }

    const frontendAppsscript = JSON.parse(fs.readFileSync(frontendAppsscriptPath, 'utf8'));

    if (!frontendAppsscript.dependencies) frontendAppsscript.dependencies = {};
    if (!frontendAppsscript.dependencies.libraries) frontendAppsscript.dependencies.libraries = [];

    const dbLib = frontendAppsscript.dependencies.libraries.find(lib => lib.userSymbol === 'ZARMS_DB');
    if (dbLib) {
        dbLib.libraryId = dbScriptId;
    } else {
        frontendAppsscript.dependencies.libraries.push({
            userSymbol: 'ZARMS_DB',
            version: '0',
            libraryId: dbScriptId,
            developmentMode: env === 'dev'
        });
    }

    fs.writeFileSync(frontendAppsscriptPath, JSON.stringify(frontendAppsscript, null, 2));
    console.log(`Updated projects/frontend/src/appsscript.json with database library ID (${env}): ${dbScriptId}`);
} catch (error) {
    console.error('Error updating library ID:', error.message);
    process.exit(1);
}
