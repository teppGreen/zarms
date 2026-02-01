// ============================================
// constants.gs - 定数管理
// ============================================

let SHEET_NAMES; // フロントエンドから定義を受け取る
const scriptProperties = PropertiesService.getScriptProperties();
const API_TOKEN = scriptProperties.getProperty('API_TOKEN');
let SPREADSHEET_ID = scriptProperties.getProperty('SPREADSHEET_ID');

if (!SPREADSHEET_ID) {
    try {
        SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
    } catch (e) {
        console.warn('Failed to get active spreadsheet ID. Please set SPREADSHEET_ID in Script Properties.', e);
        // SPREADSHEET_ID remains null or undefined, which will be handled gracefully later or cause a proper error response
    }
}