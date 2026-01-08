// ============================================
// code.gs - メインロジックとWebアプリのエントリーポイント
// ============================================

// Webアプリのエントリーポイント
function doGet(e) {
  // 現在のユーザーを取得
  const activeUserEmail = Session.getActiveUser().getEmail();

  // テスト用
  // const activeUser = getMemberByEmail(activeUserEmail);
  // const template = HtmlService.createTemplateFromFile('index');
  // template.templateVariables = {
  //   urlParams: e.parameter,
  //   activeUser: activeUser,
  //   TABLE_NAMES: TABLE_NAMES,
  //   DIRECTORY_TYPES: DIRECTORY_TYPES,
  //   TASK_STATUS: TASK_STATUS
  // };

  const template = HtmlService.createTemplateFromFile('register');
  template.templateVariables = {
    scriptUrl: getScriptUrl(),
    urlParams: e.parameter,
    activeUserEmail: activeUserEmail
  };

  return template.evaluate()
    .setTitle('ZEN Boards')
    .setFaviconUrl('https://drive.google.com/uc?id=' + FAVICON_FILE_ID + '&.png')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function loadMainApp(urlParams, activeUser) {
  const template = HtmlService.createTemplateFromFile('index');
  template.templateVariables = {
    urlParams: urlParams,
    activeUser: activeUser,
    TABLE_NAMES: TABLE_NAMES,
    DIRECTORY_TYPES: DIRECTORY_TYPES,
    TASK_STATUS: TASK_STATUS,
    userProperties: PropertiesService.getUserProperties().getProperties()
  };

  return template.evaluate().getContent();
}

// ============================================
// 認証
// 認証時のデータベース取得関数だけバックエンドで定義
// ============================================

/**
 * 現在ログイン中のユーザー情報を取得します
 * @returns {Object|null} ユーザー情報（id, email, display_nameなど）またはnull
 */
function getMemberByEmail(email) {
  // membersテーブルからemailが一致するレコードを検索
  const result = handleDatabaseProcess(null, TABLE_NAMES.MEMBERS, 'select', {
    where: { email: ["=", email] }
  }, null, false);

  const members = result?.data || result || [];

  if (members.length === 0) {
    throw new Error('User not found');
  } else {
    return members[0];
  }
}

/**
 * Slack URLからユーザーを検索します（ユーザー登録用）
 * @param {string} slackProfileUrl - SlackプロフィールURL
 * @returns {Object|null} ユーザー情報またはnull
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
 * @returns {boolean} 成功フラグ
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
 * @returns {boolean} 成功フラグ
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
 * 指定されたファイルをインクルードします
 * @param {string} filename - インクルードするファイルの拡張子を除いた名前
 * @returns {string} ファイルの内容
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getScriptUrl() {
  var url = ScriptApp.getService().getUrl();
  return url;
}