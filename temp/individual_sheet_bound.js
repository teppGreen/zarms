// ============================================
// individual_sheet_bound.js
// 企画管理個別シートのコンテナバインドスクリプト
// ============================================

/**
 * 編集イベント（シンプルトリガー）
 * トリガーが未設定の場合はアラートで通知する
 * @param {GoogleAppsScript.Events.SheetsOnEdit} e
 */
function onEdit(e) {
    const hasTriggersSet = _getConstantValue('hasTriggers');
    const ui = SpreadsheetApp.getUi();
    if (hasTriggersSet !== true) {
        ui.alert(
            'トリガーが設定されていないため使用できません',
            'メニューの「⚠️トリガーの設定が必要です」→「トリガーを設定する」を実行してください。',
            ui.ButtonSet.OK
        );
    }
}

/**
 * 編集イベント（インストーラブルトリガー用）
 * @param {GoogleAppsScript.Events.SheetsOnEdit} e
 */
function onEditFunction(e) {
    if (typeof ZARMS !== 'undefined' && ZARMS.handleOnEdit) {
        ZARMS.handleOnEdit(e);
    }
}

/**
 * スプレッドシートを開いたときのイベント（シンプルトリガー）
 * _constants シートの hasTriggers キーを参照し、
 * FALSE の場合はトリガー設定を促すメニューを表示する
 */
function onOpen() {
    const ui = SpreadsheetApp.getUi();

    // _constants シートから hasTriggers の値を取得
    const hasTriggersSet = _getConstantValue('hasTriggers');

    if (hasTriggersSet !== true) {
        // hasTriggers が FALSE（または取得できない）場合、警告メニューを表示
        ui.createMenu('⚠️トリガーの設定が必要です')
            .addItem('トリガーを設定する', 'setupTriggers')
            .addToUi();
    }
}

/**
 * _constants シートから指定キーの value を取得する
 * カラム構成: key(A列), value(B列), remark(C列)  ／  1行目はヘッダー行
 *
 * @param {string} keyName - 検索するキー名
 * @returns {string|boolean|number|null} 見つかった場合はそのセルの値、見つからない場合は null
 */
function _getConstantValue(keyName) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('_constants');
    if (!sheet) return null;

    const data = sheet.getDataRange().getValues();
    // 1行目はヘッダー行としてスキップ
    for (let i = 1; i < data.length; i++) {
        if (data[i][0] === keyName) {
            return data[i][1]; // B列（value）を返す
        }
    }
    return null;
}

/**
 * スプレッドシートを開いたときのイベント（インストーラブルトリガー用）
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

    // _constants シートの hasTriggers を TRUE に更新し、次回以降の警告メニューを非表示にする
    _setConstantValue('hasTriggers', true);

    sheet.toast('このスプレッドシートが使用できるようになりました', 'トリガーを設定しました');
}

/**
 * _constants シートの指定キーの value を更新する
 * キーが存在しない場合は末尾に新規追加する
 *
 * @param {string} keyName - 更新するキー名
 * @param {*} value - 設定する値
 */
function _setConstantValue(keyName, value) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('_constants');
    if (!sheet) return;

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
        if (data[i][0] === keyName) {
            sheet.getRange(i + 1, 2).setValue(value); // B列（value）を更新
            return;
        }
    }
    // キーが存在しない場合は末尾に追加
    sheet.appendRow([keyName, value, '']);
}