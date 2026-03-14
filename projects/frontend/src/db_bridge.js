/**
 * ============================================
 * db_bridge.js - データベースライブラリのブリッジ
 * ============================================
 *
 * ZARMS_DBライブラリの関数をフロントエンドのグローバルスコープに公開します。
 * これにより、既存のコードを変更せずにライブラリ化したデータベース操作を利用できます。
 *
 * また、unauthorizedユーザー向けに UrlFetchApp 経由で
 * database API を呼び出す API モードの関数も提供します。
 */

// ============================================
// ライブラリブリッジ（通常モード & APIモード・自動フォールバック）
// ============================================

let _isApiModeInternal = false;

/**
 * 明示的にAPIモードを設定します
 * @param {boolean} enabled
 */
function setApiMode(enabled) {
  _isApiModeInternal = enabled;
}

function handleDatabaseProcess(userId, tableName, operation, dataObject, logRemark, forceRefresh = false) {
  if (_isApiModeInternal) {
    return handleDatabaseProcessViaApi(tableName, operation, dataObject, forceRefresh);
  }
  try {
    return ZARMS_DB.handleDatabaseProcess(userId, tableName, operation, dataObject, logRemark, forceRefresh);
  } catch (e) {
    console.warn(`[handleDatabaseProcess] Direct access failed for ${tableName}, falling back to API mode:`, e.message);
    _isApiModeInternal = true; // 以降のリクエストもAPIモードにする
    return handleDatabaseProcessViaApi(tableName, operation, dataObject, forceRefresh);
  }
}

function handleBatchDatabaseProcess(userId, queries) {
  if (_isApiModeInternal) {
    return handleBatchDatabaseProcessViaApi(queries);
  }
  try {
    return ZARMS_DB.handleBatchDatabaseProcess(userId, queries);
  } catch (e) {
    console.warn('[handleBatchDatabaseProcess] Direct access failed, falling back to API mode:', e.message);
    _isApiModeInternal = true;
    return handleBatchDatabaseProcessViaApi(queries);
  }
}

function getMemberByEmail(email) {
  if (_isApiModeInternal) {
    const data = callDatabaseApi(TABLE_NAMES.MEMBERS, 'select', { where: { email: ["=", email] } });
    return data && data.length > 0 ? data[0] : null;
  }
  try {
    return ZARMS_DB.getMemberByEmail(email);
  } catch (e) {
    if (e.message && e.message.includes('not found')) {
      return null;
    }
    console.warn('[getMemberByEmail] Direct access failed, falling back to API mode:', e.message);
    _isApiModeInternal = true;
    const data = callDatabaseApi(TABLE_NAMES.MEMBERS, 'select', { where: { email: ["=", email] } });
    return data && data.length > 0 ? data[0] : null;
  }
}

function findUserBySlackUrl(slackProfileUrl) {
  if (_isApiModeInternal) {
    const data = callDatabaseApi(TABLE_NAMES.MEMBERS, 'select', { where: { slack_profile_url: ["=", slackProfileUrl] } });
    return data && data.length > 0 ? data[0] : null;
  }
  try {
    return ZARMS_DB.findUserBySlackUrl(slackProfileUrl);
  } catch (e) {
    _isApiModeInternal = true;
    const data = callDatabaseApi(TABLE_NAMES.MEMBERS, 'select', { where: { slack_profile_url: ["=", slackProfileUrl] } });
    return data && data.length > 0 ? data[0] : null;
  }
}

function registerUserEmail(userId) {
  // email登録は Session.getActiveUser().getEmail() を使うため API側でも実装可能
  if (_isApiModeInternal) {
    const email = Session.getActiveUser().getEmail();
    return callDatabaseApi(TABLE_NAMES.MEMBERS, 'update', {
      set: { email: email },
      where: { id: ["=", userId], email: ["=", null] }
    });
  }
  try {
    return ZARMS_DB.registerUserEmail(userId);
  } catch (e) {
    _isApiModeInternal = true;
    const email = Session.getActiveUser().getEmail();
    return callDatabaseApi(TABLE_NAMES.MEMBERS, 'update', {
      set: { email: email },
      where: { id: ["=", userId], email: ["=", null] }
    });
  }
}

function getSpreadsheet(...args) {
  return ZARMS_DB.getSpreadsheet(...args);
}

function getCommentNavData(...args) {
  if (_isApiModeInternal) return { comments: [], unreadCount: 0 }; // APIモードでは未実装または制限付き
  return ZARMS_DB.getCommentNavData(...args);
}

function getMyBoardTasks(...args) {
  if (_isApiModeInternal) return [];
  return ZARMS_DB.getMyBoardTasks(...args);
}

// 必要に応じて他の外部公開関数を追加してください

// ============================================
// APIモード（unauthorizedユーザー向け）
// ============================================

/**
 * HMAC-SHA256メッセージ認証コードを生成します
 * @param {string} secret - 秘密鍵
 * @param {string} message - 署名対象メッセージ
 * @returns {string} 16進数文字列の署名
 */
function _computeApiHmac(secret, message) {
  const sig = Utilities.computeHmacSha256Signature(message, secret);
  return sig
    .map(b => ('0' + (b & 0xff).toString(16)).slice(-2))
    .join('');
}

/**
 * database API への署名付きPOSTリクエストを実行する内部共通関数
 *
 * @param {string} tableName    - テーブル名
 * @param {string} operation    - 操作種別 (select/insert/update/remove/bulkinsert)
 * @param {Object} dataObject   - クエリまたはデータオブジェクト
 * @param {boolean} forceRefresh - キャッシュを無視するか
 * @returns {*} APIレスポンス - { status: 'ok', data: [...] }
 * @throws {Error} API呼び出し失敗時
 */
function callDatabaseApi(tableName, operation, dataObject, forceRefresh = false) {
  const dbApiUrl    = DB_API_CONFIG.URL;
  const dbApiSecret = DB_API_CONFIG.SECRET;

  if (!dbApiUrl || !dbApiSecret) {
    throw new Error('DB_API_URL または DB_API_SECRET が設定されていません');
  }

  const timestamp = new Date().toISOString();
  const dataStr   = JSON.stringify(dataObject || {});

  // 署名対象文字列（database側のverifySignatureと同一フォーマット）
  const message   = [
    timestamp,
    tableName,
    operation,
    dataStr,
    forceRefresh ? 'true' : 'false'
  ].join('|');
  const signature = _computeApiHmac(dbApiSecret, message);

  const payload = {
    timestamp:  timestamp,
    tableName:  tableName,
    operation:  operation,
    dataObject: dataObject || {},
    forceRefresh: forceRefresh,
    signature:  signature
  };

  const options = {
    method:             'post',
    contentType:        'application/json',
    payload:            JSON.stringify(payload),
    headers: {
      'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
    },
    muteHttpExceptions: true
  };

  const response     = UrlFetchApp.fetch(dbApiUrl, options);
  const responseText = response.getContentText();

  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch (e) {
    throw new Error('APIレスポンスのJSON解析に失敗しました: ' + responseText.slice(0, 200));
  }

  if (parsed.status !== 'ok') {
    throw new Error('API エラー: ' + (parsed.message || JSON.stringify(parsed)));
  }

  return parsed.data;
}

/**
 * database API を使って単一の DB 操作を実行します（APIモード版）
 * フロントエンドの handleDatabaseProcess と同じインターフェースを持ちます。
 * バックエンド（サーバー側）で実行されます。
 *
 * @param {string} tableName   - テーブル名
 * @param {string} operation   - 操作種別
 * @param {Object} dataObject  - クエリまたはデータオブジェクト
 * @param {boolean} forceRefresh - キャッシュを無視するか
 * @returns {{ data: Array, isCached: false }}
 */
function handleDatabaseProcessViaApi(tableName, operation, dataObject, forceRefresh = false) {
  try {
    const data = callDatabaseApi(tableName, operation, dataObject, forceRefresh);
    return { data: Array.isArray(data) ? data : (data ? [data] : []), isCached: false };
  } catch (e) {
    console.error('[handleDatabaseProcessViaApi] Error:', e);
    throw e;
  }
}

/**
 * database API を使って複数の DB 操作を一括実行します（APIモード版）
 * フロントエンドの handleBatchDatabaseProcess と同じインターフェースを持ちます。
 *
 * @param {Array<Object>} queries - クエリ配列 { key, tableName, operation, dataObject }
 * @returns {{ results: Object, hasAnyUncached: boolean }}
 */
function handleBatchDatabaseProcessViaApi(queries) {
  if (!queries || !Array.isArray(queries) || queries.length === 0) {
    return { results: {}, hasAnyUncached: false };
  }

  const results = {};
  queries.forEach(query => {
    const { key, tableName, operation, dataObject } = query;
    if (!key || !tableName || !operation) {
      console.warn('[handleBatchDatabaseProcessViaApi] 不正なクエリをスキップ:', query);
      return;
    }
    try {
      const data = callDatabaseApi(tableName, operation, dataObject || {}, query.forceRefresh || false);
      results[key] = { data: Array.isArray(data) ? data : (data ? [data] : []), isCached: false };
    } catch (e) {
      console.error(`[handleBatchDatabaseProcessViaApi] Error for key "${key}":`, e);
      results[key] = { data: [], isCached: false, error: e.message };
    }
  });

  return { results, hasAnyUncached: true };
}
