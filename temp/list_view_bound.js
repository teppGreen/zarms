// ============================================
// list_view_bound.js
// 企画管理一覧シートのコンテナバインドスクリプト
// ============================================

/**
 * 編集イベント
 * @param {GoogleAppsScript.Events.SheetsOnEdit} e
 */
function onEditFunction(e) {
    if (typeof ZARMS !== 'undefined' && ZARMS.handleOnEdit) {
        ZARMS.handleOnEdit(e);
    }
}

/**
 * スプレッドシートを開いたときのイベント
 * @param {GoogleAppsScript.Events.SheetsOnOpen} e
 */
function onOpenFunction(e) {
    if (typeof ZARMS !== 'undefined' && ZARMS.handleOnOpen) {
        ZARMS.handleOnOpen(e);
    }
}

/**
 * シートの構造が変更されたときのイベント
 * @param {GoogleAppsScript.Events.SheetsOnChange} e
 */
function onChangeFunction(e) {
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
    ScriptApp.newTrigger('onOpenFunction')
        .forSpreadsheet(sheet)
        .onOpen()
        .create();

    // onEditトリガーの設定
    ScriptApp.newTrigger('onEditFunction')
        .forSpreadsheet(sheet)
        .onEdit()
        .create();

    // onChangeトリガーの設定
    ScriptApp.newTrigger('onChangeFunction')
        .forSpreadsheet(sheet)
        .onChange()
        .create();
}