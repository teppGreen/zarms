// ============================================
// database.gs - データベース操作の抽象化
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
function getDataById(sheetName, id) {
  const idColumn = ID_COLUMNS[sheetName];
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
 * @returns {boolean} 成功したかどうか
 */
function createData(sheetName, dataObject) {
  const sheet = getSheet(sheetName);
  const headers = getHeaders(sheet);
  
  const newRow = headers.map(header => dataObject[header] || '');
  
  sheet.appendRow(newRow);
  
  // ログ記録
  const idColumn = ID_COLUMNS[sheetName];
  const recordId = idColumn ? dataObject[idColumn] : '';
  if (recordId) {
    logOperation('add', sheetName, recordId, null, null, dataObject);
  }
  
  return true;
}

/**
 * IDに基づいてシートのデータを更新します。
 * @param {string} sheetName - シート名
 * @param {any} id - 更新するデータのID
 * @param {Object} updateDataObject - 更新するデータを含むオブジェクト
 * @returns {boolean} 成功したかどうか
 */
function updateData(sheetName, id, updateDataObject) {
  const idColumn = ID_COLUMNS[sheetName];
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
  
  // 更新を実行
  Object.keys(updateDataObject).forEach(key => {
    const colIndex = headers.indexOf(key);
    if (colIndex !== -1) {
      sheet.getRange(rowIndex + 1, colIndex + 1).setValue(updateDataObject[key]);
    }
  });
  
  // 更新後のデータを取得
  const updatedData = sheet.getDataRange().getValues();
  const newRecord = {};
  headers.forEach((header, index) => {
    newRecord[header] = updatedData[rowIndex][index];
  });
  
  // ログ記録
  const changedColumns = Object.keys(updateDataObject);
  const columnId = changedColumns.join(',');
  logOperation('modified', sheetName, id, columnId, oldRecord, newRecord);
  
  return true;
}

/**
 * 条件に一致する行を削除します。
 * @param {string} sheetName - シート名
 * @param {Object} condition - 削除する行の条件 (例: { work_id: '...', member_email: '...' })
 * @returns {boolean} 少なくとも1行削除されたかどうか
 */
function deleteData(sheetName, condition) {
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
    const idColumn = ID_COLUMNS[sheetName];
    deletedRecords.forEach(record => {
      const recordId = idColumn ? record[idColumn] : JSON.stringify(condition);
      logOperation('delete', sheetName, recordId, null, record, null);
    });
  }
  
  return deleted;
}

// ============================================
// ログ記録機能
// ============================================

/**
 * ログシートを初期化します（存在しない場合に作成）。
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} ログシート
 */
function initializeLogSheet() {
  const ss = getSpreadsheet();
  let logSheet = ss.getSheetByName(SHEET_NAMES.LOGS);
  
  if (!logSheet) {
    logSheet = ss.insertSheet(SHEET_NAMES.LOGS);
    const headers = [
      'log_id',
      'user_email',
      'operation_type',
      'table_name',
      'record_id',
      'column_id',
      'old_value',
      'new_value',
      'created_at'
    ];
    logSheet.appendRow(headers);
    
    // ヘッダー行を固定
    logSheet.setFrozenRows(1);
    
    // ヘッダー行のスタイル設定
    const headerRange = logSheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#f0f0f0');
  }
  
  return logSheet;
}

/**
 * 操作ログを記録します。
 * @param {string} operationType - 操作種別（'add', 'modified', 'delete'）
 * @param {string} tableName - テーブル名（シート名）
 * @param {any} recordId - レコードID（主キー値）
 * @param {string|null} columnId - カラムID（更新時のみ、変更されたカラム名。複数カラム更新時はカンマ区切り）
 * @param {Object|null} oldValue - 変更前の値（更新・削除時のみ、JSON形式で保存）
 * @param {Object|null} newValue - 変更後の値（追加・更新時のみ、JSON形式で保存）
 */
function logOperation(operationType, tableName, recordId, columnId, oldValue, newValue) {
  // ログシートへの操作はログを記録しない（循環記録回避）
  if (tableName === SHEET_NAMES.LOGS) {
    return;
  }
  
  try {
    const userEmail = Session.getActiveUser().getEmail();
    const logId = Utilities.getUuid();
    const now = new Date();
    
    const logSheet = initializeLogSheet();
    const headers = getHeaders(logSheet);
    
    // 値をJSON形式に変換（Dateオブジェクトも含む）
    const oldValueJson = oldValue ? JSON.stringify(sanitizeForClient(oldValue)) : '';
    const newValueJson = newValue ? JSON.stringify(sanitizeForClient(newValue)) : '';
    
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