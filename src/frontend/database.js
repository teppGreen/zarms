// ============================================
// database.gs - データベース操作の抽象化
// ============================================

/**
 * シートからデータを条件に基づいて取得します (SSSQL.select like)
 * @param {string} sheetName - シート名
 * @param {Object} query - クエリオブジェクト (columns, where, groupBy, orderBy)
 * @param {Object} [options] - オプション (withRowNum, asArray)
 * @returns {Object[]} データのオブジェクト配列
 */
function select(sheetName, query, options) {
  return callBackendAPI('select', {
    sheetName: sheetName,
    data: {
      query: query || {},
      options: options
    }
  });
}

/**
 * シートに単一のデータを挿入します (SSSQL.insert like)
 * @param {string} sheetName - シート名
 * @param {Object} record - 挿入するデータ
 * @returns {Object} 挿入されたデータ
 */
function insert(sheetName, record) {
  return callBackendAPI('insert', {
    sheetName: sheetName,
    data: {
      record: record
    }
  });
}

/**
 * シートに複数のデータを一括挿入します (SSSQL.bulkInsert like)
 * @param {string} sheetName - シート名
 * @param {Object[]} records - 挿入するデータの配列
 * @returns {Object[]} 挿入されたデータの配列
 */
function bulkInsert(sheetName, records) {
  return callBackendAPI('bulkinsert', {
    sheetName: sheetName,
    data: {
      records: records
    }
  });
}

/**
 * 条件に一致するデータを更新します (SSSQL.update like)
 * @param {string} sheetName - シート名
 * @param {Object} query - クエリオブジェクト (set, where)
 * @returns {Object[]} 更新結果 (before/after のペア)
 */
function update(sheetName, query) {
  return callBackendAPI('update', {
    sheetName: sheetName,
    data: {
      query: query
    }
  });
}

/**
 * 条件に一致するデータを削除します (SSSQL.remove like)
 * @param {string} sheetName - シート名
 * @param {Object} query - クエリオブジェクト (where)
 * @returns {Object[]} 削除されたデータ
 */
function remove(sheetName, query) {
  return callBackendAPI('remove', {
    sheetName: sheetName,
    data: {
      query: query
    }
  });
}

/**
 * バックエンドAPIを呼び出します。
 * @param {string} operation - 操作タイプ ('create', 'update', 'delete', 'read_all', 'read_by_id', 'find', 'get_next_id')
 * @param {Object} payload - 送信するデータ
 * @returns {any} 結果データ (read系) または 成功フラグ (write系)
 */
function callBackendAPI(operation, payload) {
  if (!BACKEND_URL || !BACKEND_URL.includes('/exec')) {
    throw new Error('Invalid BACKEND_URL. Please check Script Properties. The URL must end with "/exec". Current value: ' + BACKEND_URL);
  }

  const requestPayload = {
    token: API_TOKEN,
    email: activeUserEmail,
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