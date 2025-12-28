// ============================================
// database.gs - データベース操作の抽象化 (Backend)
// SSSQLライブラリを使用したCRUD操作
// ============================================

/**
 * スプレッドシートオブジェクトを取得します。
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet} スプレッドシートオブジェクト
 */
function getSpreadsheet() {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * シート名からシートオブジェクトを取得します。
 * @param {string} sheetName - シート名
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} シートオブジェクト
 */
function getSheet(sheetName) {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
        throw new Error(`シートが見つかりません: ${sheetName}`);
    }
    return sheet;
}

/**
 * シートのヘッダー行を取得します。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - シートオブジェクト
 * @returns {string[]} ヘッダーの配列
 */
function getHeaders(sheet) {
    return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

/**
 * シートからデータを条件に基づいて取得します (SSSQL.select wrapper)
 * @param {string} sheetName - シート名
 * @param {Object} query - クエリオブジェクト (columns, where, groupBy, orderBy)
 * @param {Object} [options] - オプション (withRowNum, asArray)
 * @returns {Object[]} データのオブジェクト配列
 */

/**
 * UUIDを生成します。
 * @returns {string} UUID
 */
function generateUuid() {
    return Utilities.getUuid();
}

/**
 * 指定されたカラムの次のシリアル番号を取得します。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - シートオブジェクト
 * @param {string} columnName - カラム名
 * @returns {number} 次のシリアル番号
 */
function getNextSerial(sheet, columnName) {
    // SSSQLを使用して最大値を取得
    const result = SSSQL.select(sheet, {
        groupBy: [
            [],
            { maxSerial: [columnName, "MAX"] }
        ]
    });

    if (result.length > 0 && result[0].maxSerial) {
        const maxVal = Number(result[0].maxSerial);
        return isNaN(maxVal) ? 1 : maxVal + 1;
    }

    return 1;
}

/**
 * 新しいデータを追加する前の準備処理（ID生成、監査情報付与）
 * @param {string} userId - 操作ユーザーのID
 * @param {Object} dataObject - 追加するデータオブジェクト
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - シートオブジェクト
 * @returns {Object} 準備されたデータオブジェクト
 */
function prepareNewData(userId, sheet, dataObject) {
    const headers = getHeaders(sheet);
    const newData = { ...dataObject };

    // 監査情報の付与
    const now = new Date().toISOString();
    newData['created_by'] = userId;
    newData['created_at'] = now;
    // ID生成ロジック
    // 1. UUID (PK) の生成
    // 'id'カラムが存在し、かつ値が未設定の場合
    if (headers.includes('id') && !newData['id']) {
        newData['id'] = generateUuid();
    }

    // 2. Serial ID (display_id) の生成
    // 'display_id' カラムが存在する場合
    if (headers.includes('display_id') && !newData['display_id']) {
        newData['display_id'] = getNextSerial(sheet, 'display_id');
    }

    return newData;
}

// ============================================
// SSSQL を使用した CRUD 操作
// ============================================

function select(sheetName, query, options) {
    const sheet = getSheet(sheetName);
    return SSSQL.select(sheet, query, options);
}

/**
 * シートに単一のデータを挿入します (SSSQL.insert wrapper)
 * @param {string} userId - 操作ユーザーID
 * @param {string} sheetName - シート名
 * @param {Object} record - 挿入するデータ
 * @returns {Object} 挿入されたデータ
 */
function insert(userId, sheetName, record) {
    const sheet = getSheet(sheetName);
    const headers = getHeaders(sheet);

    // データの準備（ID生成、監査情報付与）
    const newData = prepareNewData(userId, sheetName, record, sheet);

    // SSSQLを使用してデータを挿入
    const result = SSSQL.insert(sheet, newData);

    return result;
}

/**
 * シートに複数のデータを一括挿入します (SSSQL.bulkInsert wrapper)
 * @param {string} userId - 操作ユーザーID
 * @param {string} sheetName - シート名
 * @param {Object[]} records - 挿入するデータの配列
 * @returns {Object[]} 挿入されたデータの配列
 */
function bulkInsert(userId, sheetName, records) {
    const sheet = getSheet(sheetName);

    // 各データの準備（ID生成、監査情報付与）
    const preparedData = records.map(record =>
        prepareNewData(userId, sheetName, record, sheet)
    );

    // SSSQLを使用してデータを一括挿入
    const result = SSSQL.bulkInsert(sheet, preparedData);

    return result;
}

/**
 * 条件に一致するデータを更新します (SSSQL.update wrapper)
 * @param {string} userId - 操作ユーザーID
 * @param {string} sheetName - シート名
 * @param {Object} query - クエリオブジェクト (set, where)
 * @returns {Object[]} 更新結果 (before/after のペア)
 */
function update(userId, sheetName, query) {
    const sheet = getSheet(sheetName);

    // 監査情報の付与 (query.set に追加)
    const now = new Date().toISOString();
    const updateSet = { ...query.set };
    updateSet['updated_by'] = userId;
    updateSet['updated_at'] = now;

    const newQuery = { ...query, set: updateSet };

    // SSSQLを使用してデータを更新
    const result = SSSQL.update(sheet, newQuery);

    return result;
}

/**
 * 条件に一致するデータを削除します (SSSQL.remove wrapper)
 * @param {string} userId - 操作ユーザーID
 * @param {string} sheetName - シート名
 * @param {Object} query - クエリオブジェクト (where)
 * @returns {Object[]} 削除されたデータ
 */
function remove(userId, sheetName, query) {
    const sheet = getSheet(sheetName);

    // SSSQLを使用してデータを削除
    const deletedRecords = SSSQL.remove(sheet, query);

    return deletedRecords;
}

// ============================================
// ヘルパー関数: JSONシリアライズ対策
// (Dateオブジェクトを自動的にISO文字列に変換する)
// ============================================
function sanitizeForClient(data) {
    if (data === null || data === undefined) {
        return data;
    }

    // Dateオブジェクトの場合
    if (data instanceof Date) {
        return data.toISOString();
    }

    // 配列の場合は、各要素を再帰的に処理
    if (Array.isArray(data)) {
        return data.map(item => sanitizeForClient(item));
    }

    // プレーンなオブジェクトの場合は、各プロパティを再帰的に処理
    if (typeof data === 'object' && data.constructor === Object) {
        const sanitized = {};
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                sanitized[key] = sanitizeForClient(data[key]);
            }
        }
        return sanitized;
    }

    // それ以外（文字列、数値、ブール値）はそのまま返す
    return data;
}
