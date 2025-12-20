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
 * シートからすべてのデータを取得します。
 * @param {string} sheetName - シート名
 * @returns {Object[]} データのオブジェクト配列
 */
function getAllData(sheetName) {
    const sheet = getSheet(sheetName);
    return SSSQL.select(sheet, {});
}

/**
 * IDに基づいてシートから単一のデータを取得します。
 * @param {string} sheetName - シート名
 * @param {string} idColumnName - ID列名
 * @param {any} id - 検索するID
 * @returns {Object|null} 見つかったデータオブジェクト、またはnull
 */
function getDataById(sheetName, idColumnName, id) {
    if (!idColumnName) {
        throw new Error(`ID列が定義されていません: ${sheetName}`);
    }

    const sheet = getSheet(sheetName);
    const result = SSSQL.select(sheet, {
        where: { [idColumnName]: ["=", id] }
    });

    return result.length > 0 ? result[0] : null;
}

/**
 * 条件に一致するデータをシートから検索します。
 * @param {string} sheetName - シート名
 * @param {Object} condition - 検索条件 (例: { key: 'value', ... })
 * @returns {Object[]} 条件に一致したデータのオブジェクト配列
 */
function findData(sheetName, condition) {
    const sheet = getSheet(sheetName);

    // 条件オブジェクトをSSSQLのwhere形式に変換
    const whereClause = {};
    Object.keys(condition).forEach(key => {
        whereClause[key] = ["=", condition[key]];
    });

    return SSSQL.select(sheet, { where: whereClause });
}

/**
 * 高度な条件でデータを検索します（SSSQLのwhere句を直接使用）。
 * @param {string} sheetName - シート名
 * @param {Object} whereConditions - SSSQL形式の検索条件
 * @param {Object} options - 追加オプション（orderBy, columns など）
 * @returns {Object[]} 条件に一致したデータのオブジェクト配列
 */
function findDataAdvanced(sheetName, whereConditions, options = {}) {
    const sheet = getSheet(sheetName);

    const query = { where: whereConditions };

    // オプションをマージ
    if (options.orderBy) query.orderBy = options.orderBy;
    if (options.columns) query.columns = options.columns;
    if (options.groupBy) query.groupBy = options.groupBy;

    return SSSQL.select(sheet, query);
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
    // CONFIGテーブル以外で、'id'カラムが存在し、かつ値が未設定の場合
    if (sheetName !== 'CONFIG' && headers.includes('id') && !newData['id']) {
        newData['id'] = generateUuid();
    }
    // logsテーブルの特例: PKは 'log'
    if (sheetName === 'logs' && headers.includes('log') && !newData['log']) {
        newData['log'] = generateUuid();
    }

    // 2. Serial ID (display_id) の生成
    // 'display_id' カラムが存在する場合
    if (headers.includes('display_id') && !newData['display_id']) {
        newData['display_id'] = getNextSerial(sheet, 'display_id');
    }
    // CONFIGテーブルの特例: PK 'id' がシリアル
    if (sheetName === 'CONFIG' && headers.includes('id') && !newData['id']) {
        newData['id'] = getNextSerial(sheet, 'id');
    }

    return newData;
}

/**
 * シートに新しいデータを追加します。
 * @param {string} userId - 操作ユーザーのID
 * @param {string} sheetName - シート名
 * @param {string} idColumnName - IDカラム名 (Optional)
 * @param {Object} dataObject - 追加するデータオブジェクト
 * @returns {Object} 作成されたデータオブジェクト
 */
function createData(userId, sheetName, idColumnName, dataObject) {
    const sheet = getSheet(sheetName);
    const headers = getHeaders(sheet);

    // データの準備（ID生成、監査情報付与）
    const newData = prepareNewData(userId, sheetName, dataObject, sheet);

    // SSSQLを使用してデータを挿入
    const result = SSSQL.insert(sheet, newData);

    // ログ記録
    const idColumn = idColumnName || (headers.includes('id') ? 'id' : null);
    const recordId = idColumn ? newData[idColumn] : '';

    if (recordId) {
        logOperation('ADD', sheetName, recordId, null, null, newData, userId);
    }

    return result;
}

/**
 * 複数のデータを一括で追加します。
 * @param {string} userId - 操作ユーザーのID
 * @param {string} sheetName - シート名
 * @param {string} idColumnName - IDカラム名 (Optional)
 * @param {Object[]} dataObjects - 追加するデータオブジェクトの配列
 * @returns {Object[]} 作成されたデータオブジェクトの配列
 */
function bulkCreateData(userId, sheetName, idColumnName, dataObjects) {
    const sheet = getSheet(sheetName);
    const headers = getHeaders(sheet);

    // 各データの準備（ID生成、監査情報付与）
    const preparedData = dataObjects.map(dataObject =>
        prepareNewData(userId, sheetName, dataObject, sheet)
    );

    // SSSQLを使用してデータを一括挿入
    const result = SSSQL.bulkInsert(sheet, preparedData);

    // ログ記録
    const idColumn = idColumnName || (headers.includes('id') ? 'id' : null);
    preparedData.forEach(newData => {
        const recordId = idColumn ? newData[idColumn] : '';
        if (recordId) {
            logOperation('ADD', sheetName, recordId, null, null, newData, userId);
        }
    });

    return result;
}

/**
 * IDに基づいてシートのデータを更新します。
 * @param {string} userId - 操作ユーザーのID
 * @param {string} sheetName - シート名
 * @param {string} idColumnName - ID列名
 * @param {any} id - 更新するデータのID
 * @param {Object} updateDataObject - 更新するデータを含むオブジェクト
 * @returns {boolean} 成功したかどうか
 */
function updateData(userId, sheetName, idColumnName, id, updateDataObject) {
    if (!idColumnName) {
        throw new Error(`ID列が定義されていません: ${sheetName}`);
    }

    const sheet = getSheet(sheetName);

    // 更新前のデータを取得
    const oldRecords = SSSQL.select(sheet, {
        where: { [idColumnName]: ["=", id] }
    });

    if (oldRecords.length === 0) {
        return false;
    }

    const oldRecord = oldRecords[0];

    // 監査情報の付与
    const now = new Date().toISOString();
    const updateData = { ...updateDataObject };
    updateData['updated_by'] = userId;
    updateData['updated_at'] = now;

    // SSSQLを使用してデータを更新
    const result = SSSQL.update(sheet, {
        set: updateData,
        where: { [idColumnName]: ["=", id] }
    });

    // 各フィールドごとにログを記録
    Object.keys(updateDataObject).forEach(key => {
        const oldValue = oldRecord[key];
        const newValue = updateDataObject[key];
        logOperation('MODIFIED', sheetName, id, key, oldValue, newValue, userId);
    });

    return result.length > 0;
}

/**
 * 条件に一致する行を削除します。
 * @param {string} userId - 操作ユーザーのID
 * @param {string} sheetName - シート名
 * @param {string} idColumnName - ID列名
 * @param {Object} condition - 削除する行の条件 (例: { work_id: '...', member_email: '...' })
 * @returns {boolean} 少なくとも1行削除されたかどうか
 */
function deleteData(userId, sheetName, idColumnName, condition) {
    const sheet = getSheet(sheetName);

    // 条件オブジェクトをSSSQLのwhere形式に変換
    const whereClause = {};
    Object.keys(condition).forEach(key => {
        whereClause[key] = ["=", condition[key]];
    });

    // SSSQLを使用してデータを削除
    const deletedRecords = SSSQL.remove(sheet, { where: whereClause });

    // ログ記録（削除された各レコードに対して）
    if (deletedRecords.length > 0) {
        deletedRecords.forEach(record => {
            const recordId = idColumnName ? record[idColumnName] : JSON.stringify(condition);
            logOperation('DELETE', sheetName, recordId, null, record, null, userId);
        });
    }

    return deletedRecords.length > 0;
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
