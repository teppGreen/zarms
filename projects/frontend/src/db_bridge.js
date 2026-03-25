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

function handleDatabaseProcess(userId, tableName, operation, dataObject, logRemark, forceRefresh = false, useApiMode = false) {
  if (useApiMode) {
    return handleDatabaseProcessViaApi(tableName, operation, dataObject, forceRefresh);
  }
  return ZARMS_DB.handleDatabaseProcess(userId, tableName, operation, dataObject, logRemark, forceRefresh);
}

function handleBatchDatabaseProcess(userId, queries, useApiMode = false) {
  if (useApiMode) {
    return handleBatchDatabaseProcessViaApi(queries);
  }
  return ZARMS_DB.handleBatchDatabaseProcess(userId, queries);
}

function getMemberByEmail(email, useApiMode = false) {
  if (useApiMode) {
    const data = callDatabaseApi(TABLE_NAMES.MEMBERS, 'select', { where: { email: ["=", email] } });
    return data && data.length > 0 ? data[0] : null;
  }
  try {
    return ZARMS_DB.getMemberByEmail(email);
  } catch (e) {
    if (e.message && e.message.includes('not found')) {
      return null;
    }
    throw e;
  }
}

function findUserBySlackUrl(slackProfileUrl, useApiMode = false) {
  if (useApiMode) {
    const data = callDatabaseApi(TABLE_NAMES.MEMBERS, 'select', { where: { slack_profile_url: ["=", slackProfileUrl] } });
    return data && data.length > 0 ? data[0] : null;
  }
  return ZARMS_DB.findUserBySlackUrl(slackProfileUrl);
}

function registerUserEmail(userId, useApiMode = false) {
  // email登録は Session.getActiveUser().getEmail() を使うため API側でも実装可能
  if (useApiMode) {
    const email = Session.getActiveUser().getEmail();
    return callDatabaseApi(TABLE_NAMES.MEMBERS, 'update', {
      set: { email: email },
      where: { id: ["=", userId], email: ['is null'] }
    });
  }
  return ZARMS_DB.registerUserEmail(userId);
}

function getSpreadsheet(...args) {
  return ZARMS_DB.getSpreadsheet(...args);
}

function getCommentNavData(...args) {
  // 想定シグネチャ: (userId, forceRefresh) = 2引数。第3引数が boolean の場合のみ useApiMode
  const lastArg = args.length > 0 ? args[args.length - 1] : undefined;
  const hasUseApiFlag = args.length === 3 && typeof lastArg === 'boolean';
  const useApiMode = hasUseApiFlag ? lastArg : false;
  const cleanArgs = hasUseApiFlag ? args.slice(0, -1) : args;
  if (useApiMode) return { comments: [], unreadCount: 0 }; // APIモードでは未実装または制限付き
  return ZARMS_DB.getCommentNavData(...cleanArgs);
}

function getMyBoardTasks(...args) {
  // 想定シグネチャ: (userId, filters, forceRefresh) = 3引数。第4引数が boolean の場合のみ useApiMode
  const lastArg = args.length > 0 ? args[args.length - 1] : undefined;
  const hasUseApiFlag = args.length === 4 && typeof lastArg === 'boolean';
  const useApiMode = hasUseApiFlag ? lastArg : false;
  const cleanArgs = hasUseApiFlag ? args.slice(0, -1) : args;
  if (useApiMode) return [];
  return ZARMS_DB.getMyBoardTasks(...cleanArgs);
}

function getInsightsTabData(...args) {
  // 想定シグネチャ: (userId, forceRefresh) = 2引数。第3引数が boolean の場合のみ useApiMode
  const hasUseApiFlag = args.length >= 3 && typeof args[2] === 'boolean';
  const useApiMode = hasUseApiFlag ? args[2] : false;
  const cleanArgs = hasUseApiFlag ? args.slice(0, 2) : args;

  if (useApiMode) {
    const userId = cleanArgs[0];
    const forceRefresh = !!cleanArgs[1];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const isoDate = sevenDaysAgo.toISOString();
    const escapedUserId = String(userId || '').replace(/'/g, "\\'");

    const logs = callDatabaseApi(TABLE_NAMES.LOGS, 'select', {
      where: {
        table_name: ['=', TABLE_NAMES.TASKS],
        operation_type_key: ['!=', 'REMOVE'],
        created_at: ['>', isoDate],
        created_by: ['!=', 'system']
      }
    }, forceRefresh) || [];

    const boardTasks = callDatabaseApi(TABLE_NAMES.TASKS, 'select', {
      where: { updated_at: ['>', isoDate] },
      columns: ['board_id', 'updated_at']
    }, forceRefresh) || [];

    const insightTasks = callDatabaseApi(TABLE_NAMES.TASKS, 'select', {
      columns: ['id', 'board_id', 'task_status_key', 'starts_at', 'ends_at', 'processed_by', 'created_by', 'reviewed_by', 'received_by'],
      rawWhere: `(O = '${escapedUserId}' OR K = '${escapedUserId}' OR L = '${escapedUserId}' OR M = '${escapedUserId}')`
    }, forceRefresh) || [];

    return {
      logs: logs,
      boardTasks: boardTasks,
      userInsightTasks: insightTasks,
      isCached: false
    };
  }

  return ZARMS_DB.getInsightsTabData(...cleanArgs);
}

/**
 * 指定テーブルのlogsテーブル最新レコードのcreated_atを返します（差分チェック用）
 * @param {string} userId - ユーザーID
 * @param {string} tableName - 対象テーブル名
 * @param {boolean} [useApiMode] - APIモードフラグ
 * @returns {{ timestamp: string|null }}
 */
function getLatestLogTimestamp(userId, tableName, useApiMode = false) {
  if (useApiMode) {
    // APIモード（未認証ユーザー）では差分チェックを行わない
    return { timestamp: null };
  }
  return ZARMS_DB.getLatestLogTimestamp(userId, tableName);
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
