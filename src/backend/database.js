// ============================================
// database.gs - データベース操作の抽象化 (Backend)
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
 * 2次元配列のデータをオブジェクトの配列に変換します。
 * @param {string[]} headers - ヘッダーの配列
 * @param {any[][]} datas - データの2次元配列
 * @returns {Object[]} オブジェクトの配列
 */
function mapData(headers, datas) {
    return datas.map(row => {
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = row[index];
        });
        return obj;
    });
}

/**
 * シートからすべてのデータを取得します。
 * @param {string} sheetName - シート名
 * @returns {Object[]} データのオブジェクト配列
 */
function getAllData(sheetName) {
    const sheet = getSheet(sheetName);
    const datas = sheet.getDataRange().getValues();

    if (datas.length <= 1) return [];

    const headers = datas.shift();
    return mapData(headers, datas);
}

/**
 * IDに基づいてシートから単一のデータを取得します。
 * @param {string} sheetName - シート名
 * @param {any} id - 検索するID
 * @returns {Object|null} 見つかったデータオブジェクト、またはnull
 */
function getDataById(sheetName, idColumnName, id) {
    const idColumn = idColumnName;
    if (!idColumn) {
        throw new Error(`ID列が定義されていません: ${sheetName}`);
    }

    const sheet = getSheet(sheetName);
    const datas = sheet.getDataRange().getValues();
    if (datas.length <= 1) return null;

    const headers = datas[0];
    const idIndex = headers.indexOf(idColumn);

    for (let i = 1; i < datas.length; i++) {
        if (datas[i][idIndex] === id) {
            const row = datas[i];
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = row[index];
            });
            return obj;
        }
    }

    return null;
}

/**
 * 条件に一致するデータをシートから検索します。
 * @param {string} sheetName - シート名
 * @param {Object} condition - 検索条件 (例: { key: 'value', ... })
 * @returns {Object[]} 条件に一致したデータのオブジェクト配列
 */
function findData(sheetName, condition) {
    const sheet = getSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    const headers = data[0];
    const results = [];

    const conditionKeys = Object.keys(condition);
    const conditionIndexes = conditionKeys.map(key => headers.indexOf(key));

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        let match = true;
        for (let j = 0; j < conditionKeys.length; j++) {
            const keyIndex = conditionIndexes[j];
            if (keyIndex === -1 || row[keyIndex] !== condition[conditionKeys[j]]) {
                match = false;
                break;
            }
        }
        if (match) {
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = row[index];
            });
            results.push(obj);
        }
    }

    return results;
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
    const headers = getHeaders(sheet);
    const colIndex = headers.indexOf(columnName);

    if (colIndex === -1) {
        throw new Error(`Column not found: ${columnName}`);
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return 1;

    let maxVal = 0;
    // 1行目はヘッダーなのでスキップ
    for (let i = 1; i < data.length; i++) {
        const val = data[i][colIndex];
        if (typeof val === 'number' && !isNaN(val)) {
            if (val > maxVal) {
                maxVal = val;
            }
        }
    }

    return maxVal + 1;
}

/**
 * シートに新しいデータを追加します。
 * @param {string} sheetName - シート名
 * @param {Object} dataObject - 追加するデータオブジェクト
 * @param {string} userId - 操作ユーザーのID
 * @param {string} idColumnName - IDカラム名 (Optional)
 * @returns {Object} 作成されたデータオブジェクト
 */
function createData(userId, sheetName, idColumnName, dataObject) {
    const sheet = getSheet(sheetName);
    const headers = getHeaders(sheet);
    const newData = { ...dataObject }; // コピーを作成

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

    const newRow = headers.map(header => {
        const val = newData[header];
        return (val === undefined || val === null) ? '' : val;
    });

    sheet.appendRow(newRow);

    // ログ記録
    const idColumn = idColumnName || (headers.includes('id') ? 'id' : null);
    const recordId = idColumn ? newData[idColumn] : '';

    if (recordId) {
        logOperation('ADD', sheetName, recordId, null, null, newData, userId);
    }

    return newData;
}

/**
 * IDに基づいてシートのデータを更新します。
 * @param {string} sheetName - シート名
 * @param {any} id - 更新するデータのID
 * @param {Object} updateDataObject - 更新するデータを含むオブジェクト
 * @param {string} userEmail - 操作ユーザーのEmail
 * @returns {boolean} 成功したかどうか
 */
function updateData(userId, sheetName, idColumnName, id, updateDataObject) {
    const idColumn = idColumnName;
    if (!idColumn) {
        throw new Error(`ID列が定義されていません: ${sheetName}`);
    }

    const sheet = getSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIndex = headers.indexOf(idColumn);

    // 更新前のデータを取得
    let oldRecord = null;
    let rowIndex = -1;

    for (let i = 1; i < data.length; i++) {
        if (data[i][idIndex] === id) {
            rowIndex = i;
            // 更新前のレコード全体を保存
            oldRecord = {};
            headers.forEach((header, index) => {
                oldRecord[header] = data[i][index];
            });
            break;
        }
    }

    if (rowIndex === -1) {
        return false;
    }

    // 更新を実行し、各フィールドごとにログを記録
    Object.keys(updateDataObject).forEach(key => {
        const colIndex = headers.indexOf(key);
        if (colIndex !== -1) {
            // 更新前の値を取得
            const oldValue = oldRecord[key];

            // 更新を実行
            sheet.getRange(rowIndex + 1, colIndex + 1).setValue(updateDataObject[key]);

            // 更新後の値を取得
            const newValue = updateDataObject[key];

            // 各フィールドごとに個別のログを記録
            logOperation('MODIFIED', sheetName, id, key, oldValue, newValue, userId);
        }
    });

    return true;
}

/**
 * 条件に一致する行を削除します。
 * @param {string} sheetName - シート名
 * @param {Object} condition - 削除する行の条件 (例: { work_id: '...', member_email: '...' })
 * @param {string} userId - 操作ユーザーのID
 * @returns {boolean} 少なくとも1行削除されたかどうか
 */
function deleteData(userId, sheetName, idColumnName, condition) {
    const sheet = getSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const conditionKeys = Object.keys(condition);
    const conditionIndexes = conditionKeys.map(key => headers.indexOf(key));

    let deleted = false;
    const deletedRecords = []; // 削除されたレコードを保存

    // 下からループして行のインデックスのずれを防ぐ
    for (let i = data.length - 1; i >= 1; i--) {
        const row = data[i];
        let match = true;
        for (let j = 0; j < conditionKeys.length; j++) {
            const keyIndex = conditionIndexes[j];
            if (keyIndex === -1 || row[keyIndex] !== condition[conditionKeys[j]]) {
                match = false;
                break;
            }
        }
        if (match) {
            // 削除前にレコードを保存
            const record = {};
            headers.forEach((header, index) => {
                record[header] = row[index];
            });
            deletedRecords.push(record);

            sheet.deleteRow(i + 1);
            deleted = true;
        }
    }

    // ログ記録（削除された各レコードに対して）
    if (deleted && deletedRecords.length > 0) {
        const idColumn = idColumnName;
        deletedRecords.forEach(record => {
            const recordId = idColumn ? record[idColumn] : JSON.stringify(condition);
            logOperation('DELETE', sheetName, recordId, null, record, null, userId);
        });
    }

    return deleted;
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
 * @param {string} operationType - 操作種別（'add', 'modified', 'delete'）
 * @param {string} tableName - テーブル名（シート名）
 * @param {any} recordId - レコードID（主キー値）
 * @param {string|null} columnId - カラムID（更新時のみ、変更されたカラム名）
 * @param {any|null} oldValue - 変更前の値（更新・削除時のみ。更新時は単一フィールドの値、削除時はレコード全体のJSON）
 * @param {any|null} newValue - 変更後の値（追加・更新時のみ。更新時は単一フィールドの値、追加時はレコード全体のJSON）
 * @param {string} userId - 操作ユーザーのID
 */
function logOperation(operationType, tableName, recordId, columnId, oldValue, newValue, userId) {
    try {
        const logId = Utilities.getUuid();
        const now = new Date();

        const logSheet = initializeLogSheet();
        const headers = getHeaders(logSheet);

        // 値をJSON形式に変換（Dateオブジェクトも含む）
        // modifiedの場合は単一フィールドの値、add/deleteの場合はレコード全体
        let oldValueJson = '';
        let newValueJson = '';

        if (log_type_key === 'MODIFIED') {
            // 更新時は単一フィールドの値のみを保存
            oldValueJson = oldValue !== null && oldValue !== undefined ? JSON.stringify(sanitizeForClient(oldValue)) : '';
            newValueJson = newValue !== null && newValue !== undefined ? JSON.stringify(sanitizeForClient(newValue)) : '';
        } else {
            // add/delete時はレコード全体を保存
            oldValueJson = oldValue ? JSON.stringify(sanitizeForClient(oldValue)) : '';
            newValueJson = newValue ? JSON.stringify(sanitizeForClient(newValue)) : '';
        }

        const logRow = headers.map(header => {
            switch (header) {
                case 'log_id':
                    return logId;
                case 'user_id':
                    return userId;
                case 'log_type_key':
                    return operationType;
                case 'table_name':
                    return tableName;
                case 'record_id':
                    return recordId;
                case 'column_id':
                    return columnId || '';
                case 'old_value':
                    return oldValueJson;
                case 'new_value':
                    return newValueJson;
                case 'created_at':
                    return now;
                default:
                    return '';
            }
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
