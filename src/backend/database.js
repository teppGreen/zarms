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

// ============================================
// SSSQL を使用した CRUD 操作
// ============================================

/**
 * シートからデータを条件に基づいて取得します (SSSQL.select wrapper)
 * @param {string} sheetName - シート名
 * @param {Object} query - クエリオブジェクト (columns, where, groupBy, orderBy)
 * @param {Object} [options] - オプション (withRowNum, asArray)
 * @returns {Object[]} データのオブジェクト配列
 */
function select(sheetName, query, options) {
    const sheet = getSheet(sheetName);
    return SSSQL.select(sheet, query, options);
}

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

    if (result.length > 0 && result[0].maxSerial !== null && result[0].maxSerial !== undefined) {
        const maxVal = Number(result[0].maxSerial);
        return isNaN(maxVal) ? 1 : maxVal + 1;
    }

    return 1;
}

/**
 * 新しいデータを追加する前の準備処理（ID生成、監査情報付与）
 * @param {string} userId - 操作ユーザーのID
 * @param {string} sheetName - シート名
 * @param {Object} dataObject - 追加するデータオブジェクト
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - シートオブジェクト
 * @returns {Object} 準備されたデータオブジェクト
 */
function prepareNewData(userId, sheetName, dataObject, sheet) {
    const headers = getHeaders(sheet);
    const newData = { ...dataObject };

    // 監査情報の付与
    const now = new Date().toISOString();
    newData['created_by'] = userId;
    newData['created_at'] = now;
    newData['updated_by'] = userId;
    newData['updated_at'] = now;

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

    // ログ記録
    let recordId = '';
    if (newData['id']) recordId = newData['id'];
    else if (newData['display_id']) recordId = newData['display_id'];

    if (recordId) {
        logOperation('ADD', sheetName, recordId, null, null, newData, userId);
    }

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

    // ログ記録
    preparedData.forEach(newData => {
        let recordId = '';
        if (newData['id']) recordId = newData['id'];
        else if (newData['display_id']) recordId = newData['display_id'];

        if (recordId) {
            logOperation('ADD', sheetName, recordId, null, null, newData, userId);
        }
    });

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

    // ログ記録
    result.forEach(updateResult => {
        const oldRecord = updateResult.before;
        const newRecord = updateResult.after;

        let recordId = '';
        if (newRecord['id']) recordId = newRecord['id'];
        else if (newRecord['display_id']) recordId = newRecord['display_id'];

        Object.keys(newRecord).forEach(key => {
            const oldValue = oldRecord[key];
            const newValue = newRecord[key];
            if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                logOperation('MODIFIED', sheetName, recordId, key, oldValue, newValue, userId);
            }
        });
    });

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

    // ログ記録
    deletedRecords.forEach(record => {
        let recordId = '';
        if (record['id']) recordId = record['id'];
        else if (record['display_id']) recordId = record['display_id'];

        logOperation('DELETE', sheetName, recordId, null, record, null, userId);
    });

    return deletedRecords;
}


// ============================================
// ログ記録機能
// ============================================

/**
 * ログシートを初期化します
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} ログシート
 */
function initializeLogSheet() {
    const ss = getSpreadsheet();
    let logSheet = ss.getSheetByName('logs');

    return logSheet;
}

/**
 * 操作ログを記録します。
 * @param {string} log_type_key - 操作種別（'ADD', 'MODIFIED', 'DELETE'）
 * @param {string} tableName - テーブル名（シート名）
 * @param {any} recordId - レコードID（主キー値）
 * @param {string|null} columnId - カラムID（更新時のみ、変更されたカラム名）
 * @param {any|null} oldValue - 変更前の値
 * @param {any|null} newValue - 変更後の値
 * @param {string} userId - 操作ユーザーのID
 */
function logOperation(log_type_key, tableName, recordId, columnId, oldValue, newValue, userId) {
    try {
        const logId = Utilities.getUuid();
        const now = new Date();

        const logSheet = initializeLogSheet();
        if (!logSheet) {
            Logger.log('ログシートが見つかりません');
            return;
        }

        const headers = getHeaders(logSheet);

        // 値をJSON形式に変換（Dateオブジェクトも含む）
        let oldValueJson = '';
        let newValueJson = '';

        if (log_type_key === 'MODIFIED') {
            // 更新時は単一フィールドの値のみを保存
            oldValueJson = oldValue !== null && oldValue !== undefined ? JSON.stringify(sanitizeForClient(oldValue)) : '';
            newValueJson = newValue !== null && newValue !== undefined ? JSON.stringify(sanitizeForClient(newValue)) : '';
        } else {
            // ADD/DELETE時はレコード全体を保存
            oldValueJson = oldValue ? JSON.stringify(sanitizeForClient(oldValue)) : '';
            newValueJson = newValue ? JSON.stringify(sanitizeForClient(newValue)) : '';
        }

        // ログデータを作成
        const logData = {
            log_id: logId,
            created_by: userId,
            log_type_key: log_type_key,
            table_name: tableName,
            record_id: recordId,
            column_id: columnId || '',
            old_value: oldValueJson,
            new_value: newValueJson,
            created_at: now
        };

        // SSSQLを使用してログを挿入（ログテーブル自体は直接appendRowを使用して循環を避ける）
        const logRow = headers.map(header => {
            const val = logData[header];
            return (val === undefined || val === null) ? '' : val;
        });

        logSheet.appendRow(logRow);
    } catch (e) {
        // ログ記録の失敗は本処理を止めない
        Logger.log('ログ記録エラー: ' + e.message);
    }
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
