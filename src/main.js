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
  // force_prod_db パラメータがある場合は UserProperties に保存（google.script.run での判定用）
  const userProperties = PropertiesService.getUserProperties();
  if (e.parameter.use_prod_db === 'true') {
    userProperties.setProperty('USE_PROD_DB', 'true');
  } else {
    // パラメータがない場合は、以前の設定が残らないように削除
    userProperties.deleteProperty('USE_PROD_DB');
  }

  // 現在のユーザーを取得
  const activeUserEmail = Session.getActiveUser().getEmail();

  const template = HtmlService.createTemplateFromFile('register');
  template.templateVariables = {
    scriptUrl: getScriptUrl(),
    urlParams: e.parameter,
    activeUserEmail: activeUserEmail,
    EVENT_CONFIG: EVENT_CONFIG,
    AUTH_CONFIG: AUTH_CONFIG,
    EXTERNAL_URLS: EXTERNAL_URLS
  };

  return template.evaluate()
    .setTitle('ZARMS')
    .setFaviconUrl(EXTERNAL_URLS.FAVICON_IMAGE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * メインアプリケーションをロードします
 * 認証済みユーザーに対してアプリケーション画面を返します
 * @param {Object} urlParams - URLパラメータ
 * @param {Object} activeUser - 現在のアクティブユーザー情報
 * @returns {string} HTMLコンテンツ
 */
function loadMainApp(activeUser, urlParams) {
  const template = HtmlService.createTemplateFromFile('index');
  template.templateVariables = {
    activeUser: activeUser,
    isDevelopment: isDevelopment(urlParams),
    TABLE_NAMES: TABLE_NAMES,
    DIRECTORY_TYPES: DIRECTORY_TYPES,
    TASK_STATUS: TASK_STATUS,
    UI_TEXT: UI_TEXT,
    userProperties: PropertiesService.getUserProperties().getProperties()
  };

  return template.evaluate().getContent();
}

/**
 * モバイル版アプリケーションをロードします
 * 認証済みユーザーに対してモバイル版アプリケーション画面を返します
 * @param {Object} urlParams - URLパラメータ
 * @returns {string} HTMLコンテンツ
 */
function loadMobileApp(urlParams) {
  // まず、現在のユーザーを取得
  const activeUserEmail = Session.getActiveUser().getEmail();
  
  try {
    // ユーザー情報を取得
    const activeUser = getMemberByEmail(activeUserEmail);
    
    // モバイル版のテンプレートをロード
    const template = HtmlService.createTemplateFromFile('mobile/index');
    template.templateVariables = {
      activeUser: activeUser,
      isDevelopment: isDevelopment(urlParams),
      TABLE_NAMES: TABLE_NAMES,
      DIRECTORY_TYPES: DIRECTORY_TYPES,
      TASK_STATUS: TASK_STATUS,
      UI_TEXT: UI_TEXT,
      userProperties: PropertiesService.getUserProperties().getProperties()
    };
    
    return template.evaluate().getContent();
  } catch (error) {
    console.error('[loadMobileApp] Error:', error);
    throw error;
  }
}

// ============================================
// 認証
// 認証時のデータベース取得関数だけバックエンドで定義
// ============================================

/**
 * メールアドレスからメンバー情報を取得します
 * キャッシュを利用し、見つからない場合は再試行します
 * @param {string} email - メールアドレス
 * @returns {Object} ユーザー情報（id, email, display_nameなど）
 * @throws {ValidationError} ユーザーが見つからない場合
 */
function getMemberByEmail(email) {
  try {
    console.log('[getMemberByEmail] email:', email);

    if (!email || typeof email !== 'string') {
      throw new ValidationError('Invalid email address', 'email', email);
    }

    let result = handleDatabaseProcess(null, TABLE_NAMES.MEMBERS, 'select', {
      where: { email: ["=", email] }
    }, null, false);

    let members = result?.data || result || [];

    if (members.length === 0) {
      // キャッシュなしで再試行
      result = handleDatabaseProcess(null, TABLE_NAMES.MEMBERS, 'select', {
        where: { email: ["=", email] }
      }, null, true);

      members = result?.data || result || [];

      if (members.length === 0) {
        throw new ValidationError('User not found', 'email', email);
      }
    }

    return members[0];
  } catch (error) {
    console.error('[getMemberByEmail] Error:', error);
    throw error;
  }
}

/**
 * Slack URLからユーザーを検索します（ユーザー登録用）
 * @param {string} slackProfileUrl - SlackプロフィールURL
 * @returns {Object|null} ユーザー情報、見つからない場合はnull
 */
function findUserBySlackUrl(slackProfileUrl) {
  try {
    const result = handleDatabaseProcess(null, TABLE_NAMES.MEMBERS, 'select', {
      where: { slack_profile_url: ["=", slackProfileUrl] }
    }, null, false);

    const members = result?.data || result || [];

    if (members.length === 0) {
      return null;
    }

    return members[0];
  } catch (error) {
    console.error('findUserBySlackUrl error:', error);
    return null;
  }
}

/**
 * ユーザーのemailを登録します（ユーザー登録用）
 * @param {string} userId - ユーザーのID（uuid）
 * @returns {boolean} 成功した場合true、失敗した場合false
 */
function registerUserEmail(userId) {
  try {
    const email = Session.getActiveUser().getEmail();
    if (!email) {
      console.error('No active user email found');
      return false;
    }

    // emailを更新
    const result = handleDatabaseProcess(userId, TABLE_NAMES.MEMBERS, 'update', {
      set: { email: email },
      where: { id: ["=", userId] }
    }, 'ユーザーのemailを登録');

    return result ? true : false;
  } catch (error) {
    console.error('registerUserEmail error:', error);
    return false;
  }
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

  // 3. URL自体に直接含まれている可能性も考慮
  if (url.indexOf('use_prod_db=true') !== -1) {
    return false;
  }

  const result = REGEX.test(url);
  console.log('[isDevelopment]', url, result, 'urlParams:', urlParams);
  return result;
}