const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const targetProject = args.length >= 2 ? args[0] : 'frontend';
const env = args.length >= 2 ? args[1] : (args[0] || 'dev');
const appsscriptPath = path.resolve(__dirname, `../projects/${targetProject}/src/appsscript.json`);
const vault = process.env.OP_VAULT || 'zarms';
const itemName = `clasp-database-${env}`;

if (!['frontend', 'mobile-app'].includes(targetProject)) {
    console.error('Error updating library ID: project は "frontend" または "mobile-app" を指定してください。');
    process.exit(1);
}

if (!['dev', 'prod'].includes(env)) {
    console.error('Error updating library ID: env は "dev" または "prod" を指定してください。');
    process.exit(1);
}

if (!fs.existsSync(appsscriptPath)) {
    console.error(`Error updating library ID: appsscript.json が見つかりません: ${appsscriptPath}`);
    process.exit(1);
}

try {
    const dbScriptId = execSync(
        `op item get "${itemName}" --vault "${vault}" --fields label=script-id --reveal`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();

    if (!dbScriptId) {
        throw new Error(`1Password から script-id を取得できませんでした (item: ${itemName})`);
    }

    const appsscript = JSON.parse(fs.readFileSync(appsscriptPath, 'utf8'));

    if (!appsscript.dependencies) appsscript.dependencies = {};
    if (!appsscript.dependencies.libraries) appsscript.dependencies.libraries = [];

    const dbLib = appsscript.dependencies.libraries.find(lib => lib.userSymbol === 'ZARMS_DB');
    if (dbLib) {
        dbLib.libraryId = dbScriptId;
    } else {
        appsscript.dependencies.libraries.push({
            userSymbol: 'ZARMS_DB',
            version: '0',
            libraryId: dbScriptId,
            developmentMode: env === 'dev'
        });
    }

    fs.writeFileSync(appsscriptPath, JSON.stringify(appsscript, null, 2));
    console.log(`Updated projects/${targetProject}/src/appsscript.json with database library ID (${env}): ${dbScriptId}`);
} catch (error) {
    console.error('Error updating library ID:', error.message);
    console.error(`Hint: 1Password の vault=${vault}, item=${itemName} に script-id が存在するか確認してください。`);
    process.exit(1);
}
