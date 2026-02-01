function initSheets() {
    const REPO_OWNER = 'teppgreen';
    const REPO_NAME = 'zarms';
    const FILE_PATH = 'docs/database_schema.mmd';
    const BRANCH = 'main';

    // GitHub API URL
    const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}?ref=${BRANCH}`;

    try {
        // Get token from Script Properties
        const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');

        if (!token) {
            throw new Error('Script property GITHUB_TOKEN is not set. Please set it in Project Settings > Script Properties.');
        }

        const options = {
            headers: {
                'Authorization': 'Bearer ' + token,
                'Accept': 'application/vnd.github.v3.raw'
            }
        };

        const response = UrlFetchApp.fetch(API_URL, options);
        const schemaText = response.getContentText();
        const schema = parseMermaidSchema(schemaText);

        const ss = SpreadsheetApp.getActiveSpreadsheet();

        for (const [tableName, columns] of Object.entries(schema)) {
            let sheet = ss.getSheetByName(tableName);
            if (!sheet) {
                sheet = ss.insertSheet(tableName);
            }

            // Always update header
            if (columns.length > 0) {
                sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
            }
        }

        Logger.log('Initialization completed successfully.');
    } catch (e) {
        Logger.log('Error initializing sheets: ' + e.toString());
        throw e;
    }
}

/**
 * Parses Mermaid ER diagram text to extract table names and columns.
 * @param {string} text The Mermaid schema content.
 * @returns {Object} An object where keys are table names and values are arrays of column names.
 */
function parseMermaidSchema(text) {
    const lines = text.split('\n');
    const schema = {};
    let currentTable = null;

    for (let line of lines) {
        line = line.trim();

        // Skip empty lines, comments, title, or diagram declaration
        if (!line || line.startsWith('---') || line.startsWith('title:') || line.startsWith('erDiagram')) {
            continue;
        }

        // Check for table start: "TABLE_NAME {"
        const tableMatch = line.match(/^(\w+)\s*\{$/);
        if (tableMatch) {
            currentTable = tableMatch[1];
            schema[currentTable] = [];
            continue;
        }

        // Check for table end: "}"
        if (line === '}') {
            currentTable = null;
            continue;
        }

        // Parse columns if inside a table block
        // Format: type name [PK] ["comment"] ...
        // We assume the second word is always the column name.
        if (currentTable) {
            // Regex to capture the second word (column name)
            // ^\s* (start)
            // \S+ (type - non-whitespace)
            // \s+ (separator)
            // (\w+) (column name - word characters)
            const columnMatch = line.match(/^\S+\s+(\w+)/);
            if (columnMatch) {
                schema[currentTable].push(columnMatch[1]);
            }
        }
    }

    return schema;
}
