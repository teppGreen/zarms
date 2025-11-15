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
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex] === id) {
      Object.keys(updateDataObject).forEach(key => {
        const colIndex = headers.indexOf(key);
        if (colIndex !== -1) {
          sheet.getRange(i + 1, colIndex + 1).setValue(updateDataObject[key]);
        }
      });
      return true;
    }
  }
  
  return false;
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
      sheet.deleteRow(i + 1);
      deleted = true;
    }
  }
  
  return deleted;
}