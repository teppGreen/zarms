const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const env = process.argv[2] || 'dev';
const frontendAppsscriptPath = path.resolve(__dirname, '../projects/frontend/src/appsscript.json');
const vault = process.env.OP_VAULT || 'zarms';
const itemName = `clasp-database-${env}`;

try {
    const dbScriptId = execSync(
        `op item get "${itemName}" --vault "${vault}" --fields label=script-id --reveal`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();

    if (!dbScriptId) {
        throw new Error(`1Password から script-id を取得できませんでした (item: ${itemName})`);
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
    console.error(`Hint: 1Password の vault=${vault}, item=${itemName} に script-id が存在するか確認してください。`);
    process.exit(1);
}
