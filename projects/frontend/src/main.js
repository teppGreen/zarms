// ============================================
// code.gs - メインロジックとWebアプリのエントリーポイント
// ============================================

/**
 * Webアプリのエントリーポイント
 * ユーザーの認証状態を確認し、適切な画面を表示します
 * @param {Object} e - イベントオブジェクト（URLパラメータなどを含む）
 * @returns {HtmlOutput} HTMLテンプレート
 */
function doGet(e) {
  // 現在のユーザーを取得
  const activeUserEmail = Session.getActiveUser().getEmail();

  const template = HtmlService.createTemplateFromFile('register');
  template.templateVariables = {
    scriptUrl: getScriptUrl(),
    urlParams: e.parameter,
    activeUserEmail: activeUserEmail,
    EVENT_CONFIG: EVENT_CONFIG,
    AUTH_CONFIG: AUTH_CONFIG,
    EXTERNAL_URLS: EXTERNAL_URLS,
    UI_TEXT: UI_TEXT,
    UI_CONFIG: UI_CONFIG
  };

  return template.evaluate()
    .setTitle('ZARMS')
    .setFaviconUrl(EXTERNAL_URLS.FAVICON_IMAGE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .addMetaTag('apple-mobile-web-app-capable', 'yes')
    .addMetaTag('mobile-web-app-capable', 'yes')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * メインアプリケーションをロードします
 * 認証済みユーザーに対してアプリケーション画面を返します
 * @param {Object} activeUser - 現在のアクティブユーザー情報
 * @param {Object} urlParams - URLパラメータ
 * @param {boolean} isMobile - モバイル版かどうか
 * @returns {string} HTMLコンテンツ
 */
function loadAppHtml(activeUser, urlParams, isMobile = false, useApiMode = false) {
  const templatePath = isMobile ? 'mobile/index' : 'index';
  const template = HtmlService.createTemplateFromFile(templatePath);

  // テンプレート変数の準備
  const templateVariables = {
    activeUser: activeUser,
    isDevelopment: isDevelopment(urlParams),
    TABLE_NAMES: TABLE_NAMES,
    KEY_LABELS: KEY_LABELS,
    useApiMode: useApiMode,
    userProperties: PropertiesService.getUserProperties().getProperties()
  };

  // デスクトップ版の場合のみ初期データを事前取得
  if (!isMobile) {
    templateVariables.initialData = _prefetchInitialData(activeUser.id, useApiMode);
  }

  template.templateVariables = templateVariables;
  return template.evaluate().getContent();
}

// ============================================
// 初期データ一括取得（register.html用）
// GAS呼び出し1回で 認証チェック + ユーザー取得 + 初期データ取得 を行う
// ============================================

/**
 * アプリ起動に必要な全情報を一括取得します（高速化）
 * register.htmlからの複数回のgoogle.script.run呼び出しを1回にまとめます。
 * @param {string} email - 現在のユーザーのメールアドレス
 * @param {Object} urlParams - URLパラメータ
 * @param {boolean} isMobile - モバイル版かどうか
 * @returns {Object} {
 *   status: 'ok' | 'unauthorized' | 'not_registered',
 *   activeUser: Object|null,     // 認証済みメンバー情報
 *   appHtml: string|null,        // アプリケーションHTML
 *   error: string|null
 * }
 */
function getInitialAppData(email, urlParams, isMobile = false) {
  let useApiMode = false;
  try {
    // 1. スプレッドシートへのアクセス権限確認（throws if no access）
    getSpreadsheet();
  } catch (e) {
    console.warn('Direct spreadsheet access failed, switching to API mode:', e.message);
    useApiMode = true;
    setApiMode(true); // db_bridge.js 内のモードを切り替え
  }

  try {
    // 2. メールアドレスからメンバー情報を取得（APIモードなら db_bridge が自動で API を呼ぶ）
    const activeUser = getMemberByEmail(email);

    if (!activeUser) {
      throw new Error('User info not found');
    }

    // 3. アプリのHTMLを生成
    const appHtml = loadAppHtml(activeUser, urlParams, isMobile, useApiMode);

    return { status: 'ok', activeUser: activeUser, appHtml: appHtml, error: null, useApiMode: useApiMode };
  } catch (e) {
    // ユーザーが見つからない場合はサインアップ画面へ
    const isNotFound = e.name === 'ValidationError' || (e.message && e.message.includes('not found'));
    if (isNotFound) {
      return { status: 'not_registered', activeUser: null, appHtml: null, error: null };
    }
    return { status: 'unauthorized', useApiMode: useApiMode, activeUser: null, appHtml: null, error: e.message };
  }
}

/**
 * アプリ起動に必要なマスタデータを一括事前取得（CacheService活用）
 * @param {string} userId - ユーザーID
 * @returns {Object} { boards, apps, members, directories, directoryAssignments, skills, skillAssignments, systemUpdates, isCached }
 */
function _prefetchInitialData(userId, useApiMode = false) {
  const queries = [
    {
      key: 'boards',
      tableName: TABLE_NAMES.BOARDS,
      operation: 'select',
      dataObject: { orderBy: { name: 'asc' } },
      forceRefresh: false
    },
    {
      key: 'apps',
      tableName: TABLE_NAMES.APPS,
      operation: 'select',
      dataObject: {},
      forceRefresh: false
    },
    {
      key: 'members',
      tableName: TABLE_NAMES.MEMBERS,
      operation: 'select',
      dataObject: {},
      forceRefresh: false
    },
    {
      key: 'directories',
      tableName: TABLE_NAMES.DIRECTORIES,
      operation: 'select',
      dataObject: {},
      forceRefresh: false
    },
    {
      key: 'directoryAssignments',
      tableName: TABLE_NAMES.DIRECTORY_ASSIGNMENTS,
      operation: 'select',
      dataObject: {},
      forceRefresh: false
    },
    {
      key: 'skills',
      tableName: TABLE_NAMES.SKILLS,
      operation: 'select',
      dataObject: {},
      forceRefresh: false
    },
    {
      key: 'skillAssignments',
      tableName: TABLE_NAMES.SKILL_ASSIGNMENTS,
      operation: 'select',
      dataObject: {},
      forceRefresh: false
    },
    {
      key: 'systemUpdates',
      tableName: TABLE_NAMES.SYSTEM_UPDATES,
      operation: 'select',
      dataObject: { orderBy: { created_at: 'desc' } },
      forceRefresh: true  // 常に最新を取得
    },
    {
      key: 'tasks',
      tableName: TABLE_NAMES.TASKS,
      operation: 'select',
      dataObject: {
        columns: ['id', 'display_id', 'name', 'board_id', 'task_status_key'],
        orderBy: { display_id: 'desc' }
      },
      forceRefresh: false
    }
  ];

  const batchResult = useApiMode
    ? handleBatchDatabaseProcessViaApi(queries)
    : handleBatchDatabaseProcess(userId, queries);
  const r = batchResult.results || {};

  return {
    boards: (r.boards?.data || r.boards || []),
    apps: (r.apps?.data || r.apps || []),
    members: (r.members?.data || r.members || []),
    directories: (r.directories?.data || r.directories || []),
    directoryAssignments: (r.directoryAssignments?.data || r.directoryAssignments || []),
    skills: (r.skills?.data || r.skills || []),
    skillAssignments: (r.skillAssignments?.data || r.skillAssignments || []),
    systemUpdates: (r.systemUpdates?.data || r.systemUpdates || []),
    tasks: (r.tasks?.data || r.tasks || []),
    // いずれかがキャッシュから取得された場合 true
    isCached: !batchResult.hasAnyUncached
  };
}


/**
 * ユーザープロパティを保存します
 * @param {string} key - プロパティキー
 * @param {string} value - プロパティ値
 */
function saveUserProperty(key, value) {
  try {
    PropertiesService.getUserProperties().setProperty(key, value);
    return true;
  } catch (error) {
    console.error('saveUserProperty error:', error);
    return false;
  }
}

// ============================================
// 内部ロジック (Internal Logic)
// ============================================


/**
 * HTMLファイルをインクルードします
 * @param {string} filename - ファイル名（拡張子なし）
 * @returns {string} HTMLコンテンツ
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * 現在のスクリプトのURLを取得します
 * @returns {string} スクリプトのWebアプリURL
 */
function getScriptUrl() {
  const url = ScriptApp.getService().getUrl();
  return url;
}

/**
 * 開発モードかどうかを判定します
 * @param {Object} [urlParams] - URLパラメータ（optional）
 * @returns {boolean} 開発モードの場合true
 */
function isDevelopment(urlParams) {
  try {
    // 1. 引数の urlParams に use_prod_db=true が含まれている場合は強制的に false を返す
    if (urlParams && urlParams.use_prod_db === 'true') {
      return false;
    }

    // 2. UserProperties (doGetで保存したもの) をチェック
    try {
      const useProdDb = PropertiesService.getUserProperties().getProperty('USE_PROD_DB');
      if (useProdDb === 'true') {
        return false;
      }
    } catch (e) {
      console.warn('[isDevelopment] Failed to access UserProperties', e);
    }

    const REGEX = /^https:\/\/script\.google\.com\/a\/.*\/dev.*$/;
    const url = ScriptApp.getService().getUrl();

    if (!url) {
      console.log('[isDevelopment] url is null (likely running as library or bound script)');
      return false; // または環境に応じたデフォルト値
    }

    // 3. URL自体に直接含まれている可能性も考慮
    if (url.indexOf('use_prod_db=true') !== -1) {
      return false;
    }

    const result = REGEX.test(url);
    console.log('[isDevelopment]', url, result, 'urlParams:', urlParams);
    return result;
  } catch (error) {
    console.error('[isDevelopment] Error:', error);
    return false;
  }
}

// ============================================
// 権限チェックロジック
// ============================================

/**
 * 現在のスコープのアクセス権限状態を確認します
 * @returns {Object} 権限状態と認証用URL
 */
function checkAppAuthorization() {
  const authInfo = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);
  return {
    status: authInfo.getAuthorizationStatus() === ScriptApp.AuthorizationStatus.REQUIRED ? 'REQUIRED' : 'OK',
    url: authInfo.getAuthorizationUrl()
  };
}

/**
 * Google Drive画像URLを data URL(base64) に変換します
 * @param {string} driveUrl - Google Drive上の画像URL
 * @returns {{dataUrl: string, mimeType: string}} 変換結果
 */
function getDriveImageDataUrl(driveUrl) {
  const url = String(driveUrl || '').trim();
  if (!url) {
    throw _createThumbnailPreviewError('empty_url', 'URLが指定されていません');
  }

  if (!_isGoogleDriveUrl(url)) {
    throw _createThumbnailPreviewError('invalid_drive_url', 'Google DriveのURLを指定してください');
  }

  const fileId = _extractDriveFileId(url);
  if (!fileId) {
    throw _createThumbnailPreviewError('invalid_drive_url', 'Google DriveファイルIDを抽出できませんでした');
  }

  let file;
  try {
    file = DriveApp.getFileById(fileId);
  } catch (error) {
    throw _mapDriveFileError(error);
  }

  let blob;
  try {
    blob = file.getBlob();
  } catch (error) {
    throw _mapDriveFileError(error);
  }

  const mimeType = blob.getContentType() || '';
  if (mimeType.indexOf('image/') !== 0) {
    throw _createThumbnailPreviewError('not_image', '指定されたファイルは画像ではありません（MIME: ' + (mimeType || 'unknown') + '）');
  }

  const bytes = blob.getBytes();
  const base64 = Utilities.base64Encode(bytes);
  return {
    dataUrl: 'data:' + mimeType + ';base64,' + base64,
    mimeType: mimeType
  };
}

/**
 * サムネイルプレビュー用の統一エラーを作成します
 * @param {string} code - エラーコード
 * @param {string} message - 表示メッセージ
 * @returns {Error} フロント解析しやすいError
 */
function _createThumbnailPreviewError(code, message) {
  const safeCode = String(code || 'unknown_error').trim() || 'unknown_error';
  const safeMessage = String(message || '不明なエラーが発生しました').trim() || '不明なエラーが発生しました';
  return new Error('THUMBNAIL_ERROR:' + safeCode + ':' + safeMessage);
}

/**
 * Drive関連の例外をサムネイル表示向けエラーへ正規化します
 * @param {Error|string} error - 例外情報
 * @returns {Error} 正規化済みエラー
 */
function _mapDriveFileError(error) {
  const text = String(error && error.message ? error.message : error || '');
  if (/No item with the given ID|指定されたファイル|見つかりません/i.test(text)) {
    return _createThumbnailPreviewError('file_not_found', '指定されたファイルが見つかりません');
  }
  if (/permission|権限|アクセス|authorized|許可/i.test(text)) {
    return _createThumbnailPreviewError('permission_denied', '指定されたファイルへのアクセス権限がありません');
  }
  return _createThumbnailPreviewError('fetch_failed', 'サムネイルの取得に失敗しました');
}

/**
 * Google Drive URLかを判定します
 * @param {string} url - URL文字列
 * @returns {boolean} Drive関連URLならtrue
 */
function _isGoogleDriveUrl(url) {
  const text = String(url || '').trim();
  if (!text) return false;
  if (/^[A-Za-z0-9_-]{25,}$/.test(text)) return true;
  try {
    const parsed = new URL(text);
    const host = String(parsed.hostname || '').toLowerCase();
    return host === 'drive.google.com' || host === 'docs.google.com';
  } catch (error) {
    return false;
  }
}

/**
 * Google Drive URLからファイルIDを抽出します
 * @param {string} url - Google Drive URL
 * @returns {string|null} ファイルID
 */
function _extractDriveFileId(url) {
  const text = String(url || '').trim();
  if (!text) return null;

  if (/^[A-Za-z0-9_-]{25,}$/.test(text)) {
    return text;
  }

  try {
    const parsed = new URL(text);
    const queryId = parsed.searchParams.get('id');
    if (queryId && /^[A-Za-z0-9_-]{25,}$/.test(queryId)) {
      return queryId;
    }

    const pathMatch = parsed.pathname.match(/\/d\/([A-Za-z0-9_-]{25,})/);
    if (pathMatch && pathMatch[1]) {
      return pathMatch[1];
    }
  } catch (error) {
    // URLとして解釈できない場合は最後の手段で抽出
  }

  const directMatch = text.match(/[-\w]{25,}/);
  if (directMatch && directMatch[0]) {
    return directMatch[0];
  }
  return null;
}
