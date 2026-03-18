// ============================================
// api_handler.gs - Database API エンドポイント
// ============================================

// ============================================
// HMAC署名ユーティリティ
// ============================================

/**
 * HMAC-SHA256署名を生成します
 * GASにはネイティブなHMAC実装がないため、
 * Utilities.computeHmacSha256Signature を使用します
 *
 * @param {string} secret - 秘密鍵
 * @param {string} message - 署名対象メッセージ
 * @returns {string} 16進数文字列の署名
 */
function computeHmac(secret, message) {
  const signature = Utilities.computeHmacSha256Signature(message, secret);
  // byte配列を16進数文字列に変換
  return signature
    .map(byte => ('0' + (byte & 0xff).toString(16)).slice(-2))
    .join('');
}

/**
 * 2つの文字列を定時間で比較します（タイミング攻撃を防止）
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function secureCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * リクエストのHMAC署名を検証します
 * @param {string} secret - HMAC秘密鍵
 * @param {Object} body - リクエストボディ
 * @returns {boolean} 検証結果
 */
function verifySignature(secret, body) {
  const { timestamp, tableName, operation, dataObject, forceRefresh, signature } = body;
  // 署名対象文字列をクライアントと同じ形式で生成
  const message = [
    timestamp || '',
    tableName || '',
    operation || '',
    JSON.stringify(dataObject || {}),
    forceRefresh ? 'true' : 'false'
  ].join('|');
  const expected = computeHmac(secret, message);
  return secureCompare(expected, signature || '');
}

// ============================================
// タイムスタンプ検証
// ============================================

/**
 * タイムスタンプが許容範囲内か検証します
 * @param {string} timestampStr - ISO 8601形式のタイムスタンプ
 * @returns {boolean}
 */
function verifyTimestamp(timestampStr) {
  try {
    const requestTime = new Date(timestampStr).getTime();
    const now = Date.now();
    return Math.abs(now - requestTime) <= API_AUTH_CONFIG.TIMESTAMP_TOLERANCE_MS;
  } catch (e) {
    return false;
  }
}

// ============================================
// アクセス権限チェック
// ============================================

/**
 * 指定メールアドレスが対象テーブル・レコードに閲覧権限を持つか確認します
 *
 *
 * 権限の評価ルールや優先度については、 /docs/api_reference.md を参照してください。
 *
 * @param {string} email - 対象メールアドレス
 * @param {string} tableName - テーブル名
 * @param {string|null} recordId - 対象レコードID
 * @param {('can_read'|'can_write')} permissionType - 確認する権限種別
 * @returns {boolean} 権限あり: true
 */
function checkPermission(email, tableName, recordId, permissionType) {
  try {
    // テーブル全体に対する権限をすべて取得
    const permResult = handleDatabaseProcess(
      null,
      TABLE_NAMES.PERMISSIONS,
      'select',
      { where: { table_name: ['=', tableName] } },
      null,
      false
    );
    const permissions = permResult?.data || permResult || [];

    for (const perm of permissions) {
      const emailMatch  = perm.email === null || perm.email === '' || perm.email === email;
      const recordMatch = perm.record_id === null || perm.record_id === '' || perm.record_id === recordId;
      if (emailMatch && recordMatch && perm[permissionType] === true) {
        return true;
      }
    }
    return false;
  } catch (e) {
    console.error('[checkPermission] Error:', e);
    return false;
  }
}

/**
 * テーブル内で指定メールアドレスが閲覧権限を持つ全レコードIDを返します
 * record_id が NULL のエントリがある場合は ['*'] を返します（全レコード許可）
 *
 * @param {string} email - 対象メールアドレス
 * @param {string} tableName - テーブル名
 * @param {('can_read'|'can_write')} permissionType - 確認する権限種別
 * @returns {{ allowAll: boolean, recordIds: string[] }}
 */
function getAllowedRecordIds(email, tableName, permissionType) {
  try {
    const permResult = handleDatabaseProcess(
      null,
      TABLE_NAMES.PERMISSIONS,
      'select',
      { where: { table_name: ['=', tableName] } },
      null,
      false
    );
    const permissions = permResult?.data || permResult || [];

    const allowedIds = [];
    for (const perm of permissions) {
      if (!perm[permissionType]) continue;
      const emailMatch = perm.email === null || perm.email === '' || perm.email === email;
      if (!emailMatch) continue;

      // record_id が NULL/空 → テーブル全体許可
      if (perm.record_id === null || perm.record_id === '') {
        return { allowAll: true, recordIds: [] };
      }
      allowedIds.push(perm.record_id);
    }
    return { allowAll: false, recordIds: allowedIds };
  } catch (e) {
    console.error('[getAllowedRecordIds] Error:', e);
    return { allowAll: false, recordIds: [] };
  }
}

// ============================================
// レスポンスビルダー
// ============================================

/**
 * 成功レスポンスを作成します
 * @param {*} data
 * @returns {TextOutput}
 */
function buildOkResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', data: sanitizeForClient(data) }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * エラーレスポンスを作成します
 * @param {string} message
 * @param {number} [code=400]
 * @returns {TextOutput}
 */
function buildErrorResponse(message, code = 400) {
  console.warn(`[API] Error response (${code}): ${message}`);
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'error', code: code, message: message }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// メインエントリーポイント
// ============================================

/**
 * WebアプリのPOSTエンドポイント
 * unauthorizedユーザー向けにdatabaseをAPIとして公開します
 *
 * @param {Object} e - GASイベントオブジェクト
 * @returns {TextOutput} JSONレスポンス
 */
function doPost(e) {
  try {
    // --- 1. リクエストボディのパース ---
    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (err) {
      return buildErrorResponse('リクエストボディのJSON形式が不正です', 400);
    }

    const { timestamp, tableName, operation, dataObject, forceRefresh, signature } = body;

    // --- 2. 必須パラメータの確認 ---
    if (!timestamp || !tableName || !operation || !signature) {
      return buildErrorResponse('必須パラメータが不足しています', 400);
    }

    // --- 3. 許可された操作かチェック ---
    if (!API_AUTH_CONFIG.ALLOWED_OPERATIONS.includes(operation)) {
      return buildErrorResponse(`不正な操作です: ${operation}`, 400);
    }

    // --- 4. タイムスタンプ検証（リプレイアタック防止）---
    if (!verifyTimestamp(timestamp)) {
      return buildErrorResponse('タイムスタンプが許容範囲外です', 403);
    }

    // --- 5. HMAC署名検証 ---
    const secret = scriptProperties.getProperty(API_AUTH_CONFIG.SECRET_PROPERTY_KEY);
    if (!secret) {
      console.error('[doPost] DB_API_SECRET が設定されていません');
      return buildErrorResponse('サーバー設定エラー', 500);
    }
    if (!verifySignature(secret, body)) {
      return buildErrorResponse('署名が不正です', 403);
    }

    // --- 6. メールアドレスからメンバー情報を取得 ---
    const email = Session.getActiveUser().getEmail();
    if (!email) {
      return buildErrorResponse('ユーザーを識別できません', 403);
    }

    let member;
    try {
      member = getMemberByEmail(email);
    } catch (err) {
      return buildErrorResponse('メンバー情報が見つかりません', 403);
    }
    if (!member || !member.id) {
      return buildErrorResponse('メンバー情報が見つかりません', 403);
    }

    // --- 7. アクセス権限チェック & DB操作 ---
    if (operation === 'select') {
      return _handleApiSelect(email, tableName, dataObject || {}, forceRefresh || false);
    } else {
      return _handleApiWrite(member.id, email, tableName, operation, dataObject || {});
    }

  } catch (err) {
    console.error('[doPost] 予期しないエラー:', err);
    return buildErrorResponse('サーバー内部エラー', 500);
  }
}

// ============================================
// 内部ハンドラ - SELECT
// ============================================

/**
 * SELECT操作を権限フィルタ付きで実行します
 * @param {string} email - リクエスト元メールアドレス
 * @param {string} tableName - テーブル名
 * @param {Object} dataObject - クエリオブジェクト
 * @param {boolean} forceRefresh - キャッシュを無視するか
 * @returns {TextOutput}
 */
function _handleApiSelect(email, tableName, dataObject, forceRefresh) {
  const { allowAll, recordIds } = getAllowedRecordIds(email, tableName, 'can_read');

  // 権限なし: 空配列を返す
  if (!allowAll && recordIds.length === 0) {
    return buildOkResponse([]);
  }

  // 権限フィルタをWHERE条件に追加
  let filteredDataObject = { ...dataObject };
  if (!allowAll) {
    // 元のWHERE条件と組み合わせ（IN演算子で許可レコードのみ）
    filteredDataObject.where = Object.assign({}, dataObject.where || {}, {
      id: ['in', recordIds]
    });
  }

  const result = handleDatabaseProcess(null, tableName, 'select', filteredDataObject, null, forceRefresh);
  const data = result?.data || result || [];
  return buildOkResponse(data);
}

// ============================================
// 内部ハンドラ - WRITE (insert/update/remove/bulkinsert)
// ============================================

/**
 * 書き込み操作を権限チェック付きで実行します
 * @param {string} memberId - メンバーID（操作者）
 * @param {string} email - リクエスト元メールアドレス
 * @param {string} tableName - テーブル名
 * @param {string} operation - 操作種別
 * @param {Object} dataObject - データオブジェクト
 * @returns {TextOutput}
 */
function _handleApiWrite(memberId, email, tableName, operation, dataObject) {
  if (operation === 'remove') {
    return buildErrorResponse('APIモードでは削除操作は許可されていません', 403);
  }

  const { allowAll, recordIds } = getAllowedRecordIds(email, tableName, 'can_write');

  if (operation === 'insert' || operation === 'bulkinsert') {
    // INSERT: テーブル全体に書き込み権限がある場合のみ許可
    if (!allowAll) {
      return buildErrorResponse('この操作の権限がありません', 403);
    }
    const result = handleDatabaseProcess(memberId, tableName, operation, dataObject, 'APIからの操作', false);
    return buildOkResponse(result);
  }

  if (operation === 'update') {
    // UPDATE: WHERE条件で対象レコードを事前確認し権限チェック
    const targetResult = handleDatabaseProcess(null, tableName, 'select', { where: dataObject.where }, null, true);
    const targets = targetResult?.data || targetResult || [];

    if (targets.length === 0) {
      return buildOkResponse({ success: true, message: '対象レコードなし' });
    }

    // 全対象レコードに権限があるか確認
    if (!allowAll) {
      const unauthorized = targets.some(r => !recordIds.includes(r.id));
      if (unauthorized) {
        return buildErrorResponse('一部のレコードへの操作権限がありません', 403);
      }
    }

    const result = handleDatabaseProcess(memberId, tableName, operation, dataObject, 'APIからの操作', false);
    return buildOkResponse(result);
  }

  return buildErrorResponse(`未対応の操作です: ${operation}`, 400);
}

// ============================================
// テスト用ユーティリティ（GASエディタから手動実行）
// ============================================

/**
 * HMAC署名検証のテスト
 * GASエディタで実行して動作確認します
 */
function testHmacVerification() {
  const secret = 'test_secret_key';
  const body = {
    timestamp: new Date().toISOString(),
    tableName: 'tasks',
    operation: 'select',
    dataObject: { where: { id: ['=', 'testid'] } }
  };
  const message = [
    body.timestamp,
    body.tableName,
    body.operation,
    JSON.stringify(body.dataObject)
  ].join('|');
  body.signature = computeHmac(secret, message);

  const result = verifySignature(secret, body);
  console.log('HMAC verification test:', result ? 'PASS' : 'FAIL');

  // 改ざんテスト
  const tamperedBody = { ...body, tableName: 'members' };
  const tamperedResult = verifySignature(secret, tamperedBody);
  console.log('Tampered request test (should be false):', !tamperedResult ? 'PASS' : 'FAIL');
}

/**
 * タイムスタンプ検証のテスト
 */
function testTimestampVerification() {
  // 正常なタイムスタンプ
  const ok = verifyTimestamp(new Date().toISOString());
  console.log('Valid timestamp test:', ok ? 'PASS' : 'FAIL');

  // 古すぎるタイムスタンプ（10分前）
  const old = verifyTimestamp(new Date(Date.now() - 10 * 60 * 1000).toISOString());
  console.log('Old timestamp test (should be false):', !old ? 'PASS' : 'FAIL');
}
