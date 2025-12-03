// ============================================
// constants.gs - 定数管理
// ============================================

const scriptProperties = PropertiesService.getScriptProperties();
let SPREADSHEET_ID = scriptProperties.getProperty('SPREADSHEET_ID');

if (!SPREADSHEET_ID) {
    try {
        SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
    } catch (e) {
        console.warn('Failed to get active spreadsheet ID. Please set SPREADSHEET_ID in Script Properties.', e);
        // SPREADSHEET_ID remains null or undefined, which will be handled gracefully later or cause a proper error response
    }
}

// 固定トークン (本番環境ではScriptProperties推奨だが、要件に従い定数定義)
const API_TOKEN = scriptProperties.getProperty('API_TOKEN');