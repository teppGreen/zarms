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

  if (!BACKEND_URL || !BACKEND_URL.includes('/exec')) {
    throw new Error('Invalid BACKEND_URL. Please check Script Properties. The URL must end with "/exec". Current value: ' + BACKEND_URL);
  }

  const requestPayload = {
    token: API_TOKEN,
    userId: userEmail,
    operation: operation,
    ...payload
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
    },
    payload: JSON.stringify(requestPayload),
    muteHttpExceptions: true // エラーハンドリングのため例外をミュート
  };

  Logger.log(`[Backend API] Requesting: ${BACKEND_URL}`);
  Logger.log(`[Backend API] Payload: ${JSON.stringify({ ...requestPayload, token: '***' })}`); // Token masked

  try {
    const response = UrlFetchApp.fetch(BACKEND_URL, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    const responseHeaders = response.getHeaders();

    Logger.log(`[Backend API] Response Code: ${responseCode}`);
    Logger.log(`[Backend API] Response Headers: ${JSON.stringify(responseHeaders)}`);
    Logger.log(`[Backend API] Response Body (first 1000 chars): ${responseText.substring(0, 1000)}`);
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