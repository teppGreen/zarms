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
 * @param {any[][]} data - データの2次元配列
 * @returns {Object[]} オブジェクトの配列
 */
function mapData(headers, data) {
    return data.map(row => {
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
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();

    if (values.length <= 1) return [];

    const headers = values.shift();
    return mapData(headers, values);
}

/**
 * IDに基づいてシートから単一のデータを取得します。
 * @param {string} sheetName - シート名
 * @param {any} id - 検索するID
 * @returns {Object|null} 見つかったデータオブジェクト、またはnull
 */
function getDataById(sheetName, id, idColumnName) {
    const idColumn = idColumnName;
    if (!idColumn) {
        throw new Error(`ID列が定義されていません: ${sheetName}`);
    }

    const sheet = getSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return null;

    const headers = data[0];
    const idIndex = headers.indexOf(idColumn);

    for (let i = 1; i < data.length; i++) {
        if (data[i][idIndex] === id) {
            const row = data[i];
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
 * シートに新しいデータを追加します。
 * @param {string} sheetName - シート名
 * @param {Object} dataObject - 追加するデータオブジェクト
 * @param {string} userEmail - 操作ユーザーのEmail
 * @returns {boolean} 成功したかどうか
 */
function createData(sheetName, dataObject, userEmail, idColumnName) {
    const sheet = getSheet(sheetName);
    const headers = getHeaders(sheet);

    const newRow = headers.map(header => dataObject[header] || '');

    sheet.appendRow(newRow);

    // ログ記録
    const idColumn = idColumnName;
    const recordId = idColumn ? dataObject[idColumn] : '';
    if (recordId) {
        logOperation('add', sheetName, recordId, null, null, dataObject, userEmail);
    }

    return true;
}

/**
 * IDに基づいてシートのデータを更新します。
 * @param {string} sheetName - シート名
 * @param {any} id - 更新するデータのID
 * @param {Object} updateDataObject - 更新するデータを含むオブジェクト
 * @param {string} userEmail - 操作ユーザーのEmail
 * @returns {boolean} 成功したかどうか
 */
function updateData(sheetName, id, updateDataObject, userEmail, idColumnName) {
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
            logOperation('modified', sheetName, id, key, oldValue, newValue, userEmail);
        }
    });

    return true;
}

/**
 * 条件に一致する行を削除します。
 * @param {string} sheetName - シート名
 * @param {Object} condition - 削除する行の条件 (例: { work_id: '...', member_email: '...' })
 * @param {string} userEmail - 操作ユーザーのEmail
 * @returns {boolean} 少なくとも1行削除されたかどうか
 */
function deleteData(sheetName, condition, userEmail, idColumnName) {
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
            logOperation('delete', sheetName, recordId, null, record, null, userEmail);
        });
    }

    return deleted;
}

/**
 * 新しいIDを採番します。
 * @param {string} sheetName - シート名
 * @param {string} prefix - IDのプレフィックス (例: 'W', 'P', 'T')
 * @returns {string} 新しいID
 */
function generateNextId(sheetName, prefix, idColumnName) {
    // 同時実行によるID重複を防ぐためにロックを取得
    // 注: API側でもロックしているが、念のためここでも（あるいはAPI側のロックで十分かもだが、ロジックとして独立させる）
    // API側で全体をロックしているので、ここでは不要かもしれないが、安全のため残すか、
    // APIのロックは `doPost` 全体にかかるので、ここで `LockService` を使うと二重ロックになる？
    // 同一スクリプト内の二重ロックはOKだが、`waitLock`で待つことになる。
    // API側ですでにロックしているので、ここはロックなしで実行する形にする（APIのロックに依存）。

    const sheet = getSheet(sheetName);
    const lastRow = sheet.getLastRow();

    // ヘッダー行のインデックスを取得 (1行目と仮定)
    const headers = getHeaders(sheet);
    const idColumnIndex = headers.indexOf(idColumnName) + 1;

    if (idColumnIndex === 0) {
        throw new Error(`ID列 '${idColumnName}' がシート '${sheetName}' に見つかりません。`);
    }

    let nextIdNumber = 1;

    // データ行が存在する場合のみ最終IDを読み取る (lastRow > 1)
    if (lastRow > 1) {
        // 最終行のIDを取得
        const lastId = sheet.getRange(lastRow, idColumnIndex).getValue();
        if (lastId && typeof lastId === 'string' && lastId.startsWith(prefix)) {
            const lastNumber = parseInt(lastId.substring(prefix.length), 10);
            if (!isNaN(lastNumber)) {
                nextIdNumber = lastNumber + 1;
            }
        }
    }

    // 4桁のゼロパディング
    const nextId = prefix + String(nextIdNumber).padStart(4, '0');

    return nextId;
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
 * @param {string} userEmail - 操作ユーザーのEmail
 */
function logOperation(operationType, tableName, recordId, columnId, oldValue, newValue, userEmail) {
    // ログシートへの操作はログを記録しない（循環記録回避）
    if (tableName === 'logs') {
        return;
    }

    try {
        // 引数で受け取ったuserEmailを使用
        const logId = Utilities.getUuid();
        const now = new Date();

        const logSheet = initializeLogSheet();
        const headers = getHeaders(logSheet);

        // 値をJSON形式に変換（Dateオブジェクトも含む）
        // modifiedの場合は単一フィールドの値、add/deleteの場合はレコード全体
        let oldValueJson = '';
        let newValueJson = '';

        if (operationType === 'modified') {
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
                case 'user_email':
                    return userEmail;
                case 'operation_type':
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
