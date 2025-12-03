// ============================================
// database.gs - データベース操作の抽象化
// ============================================

/**
 * シートからすべてのデータを取得します。
 * @param {string} sheetName - シート名
 * @returns {Object[]} データのオブジェクト配列
 */
function getAllData(sheetName) {
  return callBackendAPI('read_all', {
    sheetName: sheetName
  });
}

/**
 * IDに基づいてシートから単一のデータを取得します。
 * @param {string} sheetName - シート名
 * @param {any} id - 検索するID
 * @returns {Object|null} 見つかったデータオブジェクト、またはnull
 */
function getDataById(sheetName, id) {
  return callBackendAPI('read_by_id', {
    sheetName: sheetName,
    id: id,
    idColumnName: ID_COLUMNS[sheetName]
  });
}

/**
 * 条件に一致するデータをシートから検索します。
 * @param {string} sheetName - シート名
 * @param {Object} condition - 検索条件 (例: { key: 'value', ... })
 * @returns {Object[]} 条件に一致したデータのオブジェクト配列
 */
function findData(sheetName, condition) {
  return callBackendAPI('find', {
    sheetName: sheetName,
    condition: condition
  });
}

/**
 * 新しいIDを採番します。
 * @param {string} sheetName - シート名
 * @param {string} prefix - IDのプレフィックス (例: 'W', 'P', 'T')
 * @returns {string} 新しいID
 */
function generateNextId(sheetName, prefix) {
  return callBackendAPI('get_next_id', {
    sheetName: sheetName,
    prefix: prefix,
    idColumnName: ID_COLUMNS[sheetName]
  });
}

/**
 * シートに新しいデータを追加します。
 * @param {string} sheetName - シート名
 * @param {Object} dataObject - 追加するデータオブジェクト
 * @returns {boolean} 成功したかどうか
 */
function createData(sheetName, dataObject) {
  return callBackendAPI('create', {
    sheetName: sheetName,
    data: dataObject,
    idColumnName: ID_COLUMNS[sheetName]
  });
}

/**
 * IDに基づいてシートのデータを更新します。
 * @param {string} sheetName - シート名
 * @param {any} id - 更新するデータのID
 * @param {Object} updateDataObject - 更新するデータを含むオブジェクト
 * @returns {boolean} 成功したかどうか
 */
function updateData(sheetName, id, updateDataObject) {
  return callBackendAPI('update', {
    sheetName: sheetName,
    id: id,
    data: updateDataObject,
    idColumnName: ID_COLUMNS[sheetName]
  });
}

/**
 * 条件に一致する行を削除します。
 * @param {string} sheetName - シート名
 * @param {Object} condition - 削除する行の条件 (例: { work_id: '...', member_email: '...' })
 * @returns {boolean} 少なくとも1行削除されたかどうか
 */
function deleteData(sheetName, condition) {
  return callBackendAPI('delete', {
    sheetName: sheetName,
    condition: condition,
    idColumnName: ID_COLUMNS[sheetName]
  });
}

/**
 * バックエンドAPIを呼び出します。
 * @param {string} operation - 操作タイプ ('create', 'update', 'delete', 'read_all', 'read_by_id', 'find', 'get_next_id')
 * @param {Object} payload - 送信するデータ
 * @returns {any} 結果データ (read系) または 成功フラグ (write系)
 */
function callBackendAPI(operation, payload) {
  const userEmail = Session.getActiveUser().getEmail();
  const timestamp = new Date().toISOString();

  const requestPayload = {
    token: API_TOKEN,
    userEmail: userEmail,
    timestamp: timestamp,
    operation: operation,
    ...payload
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(requestPayload),
    muteHttpExceptions: true // エラーハンドリングのため例外をミュート
  };

  try {
    const response = UrlFetchApp.fetch(BACKEND_URL, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    let responseBody;

    try {
      responseBody = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse JSON response:', responseText.substring(0, 1000)); // Log first 1000 chars
      throw new Error(`Invalid JSON response from backend. Status: ${responseCode}`);
    }

    if (responseCode === 200 && responseBody.status === 'success') {
      // read系の場合はデータを返す
      if (responseBody.data !== undefined) {
        return responseBody.data;
      }
      // write系の場合はtrueを返す (APIはsuccessならtrue相当)
      return true;
    } else {
      console.error(`Backend API Error: ${responseCode}`, responseBody);
      throw new Error(responseBody.message || 'Database operation failed');
    }
  } catch (e) {
    console.error('API Call Failed:', e);
    throw e; // エラーを再スローして呼び出し元に通知
  }
}