// ============================================
// individual_sheet_bound.js
// 企画管理個別シートのコンテナバインドスクリプト
// ============================================

/**
 * 編集イベント
 * @param {GoogleAppsScript.Events.SheetsOnEdit} e
 */
function onEdit(e) {
    if (typeof ZARMS !== 'undefined' && ZARMS.handleOnEdit) {
        ZARMS.handleOnEdit(e);
    }
}

/**
 * スプレッドシートを開いたときのイベント
 * @param {GoogleAppsScript.Events.SheetsOnOpen} e
 */
function onOpen(e) {
    if (typeof ZARMS !== 'undefined' && ZARMS.handleOnOpen) {
        ZARMS.handleOnOpen(e);
    }
}

/**
 * シートの構造が変更されたときのイベント
 * @param {GoogleAppsScript.Events.SheetsOnChange} e
 */
function onChange(e) {
    if (typeof ZARMS !== 'undefined' && ZARMS.handleOnChange) {
        ZARMS.handleOnChange(e);
    }
}

/**
 * トリガーを設定する関数
 * 初期セットアップ時に一度だけ実行します
 */
function setupTriggers() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet();

    // 既存のトリガーをすべて削除
    const triggers = ScriptApp.getProjectTriggers();
    for (let i = 0; i < triggers.length; i++) {
        ScriptApp.deleteTrigger(triggers[i]);
    }

    // onOpenトリガーの設定
    ScriptApp.newTrigger('onOpen')
        .forSpreadsheet(sheet)
        .onOpen()
        .create();

    // onEditトリガーの設定
    ScriptApp.newTrigger('onEdit')
        .forSpreadsheet(sheet)
        .onEdit()
        .create();

    // onChangeトリガーの設定
    ScriptApp.newTrigger('onChange')
        .forSpreadsheet(sheet)
        .onChange()
        .create();
}
