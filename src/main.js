// ============================================
// code.gs - メインロジックとWebアプリのエントリーポイント
// ============================================

// Webアプリのエントリーポイント
function doGet(e) {
  try {
    // Spreadsheetにアクセスできるか確認（これが権限チェック）
    getSpreadsheet();

    // 現在のユーザーを取得
    const activeUserEmail = Session.getActiveUser().getEmail();
    const activeUser = getMemberByEmail(activeUserEmail);

    // ユーザーが見つからない場合はユーザー登録画面を表示
    if (!activeUser) {
      return HtmlService.createHtmlOutputFromFile('register')
        .setTitle('ユーザー登録 | ZEN Boards')
        .setFaviconUrl('https://drive.google.com/uc?id=17EMQ6GE9Nu-P7xc2y32rHudx6vy86zi8' + '&.png')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    const template = HtmlService.createTemplateFromFile('index');
    template.templateVariables = {
      urlParam: e.parameter,
      TABLE_NAMES: TABLE_NAMES,
      DIRECTORY_TYPES: DIRECTORY_TYPES,
      TASK_STATUS: TASK_STATUS,
      activeUser: activeUser
    };

    return template.evaluate()
      .setTitle('ZEN Boards')
      .setFaviconUrl('https://drive.google.com/uc?id=17EMQ6GE9Nu-P7xc2y32rHudx6vy86zi8' + '&.png')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
  } catch (error) {
    console.error('doGet error:', error);
    return HtmlService.createHtmlOutputFromFile('error')
      .setTitle('エラー | ZEN Boards')
      .setFaviconUrl('https://drive.google.com/uc?id=17EMQ6GE9Nu-P7xc2y32rHudx6vy86zi8' + '&.png')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}

// ============================================
// 認証・ユーザー管理
// ============================================

/**
 * 現在ログイン中のユーザー情報を取得します
 * @returns {Object|null} ユーザー情報（id, email, display_nameなど）またはnull
 */
function getMemberByEmail(email) {
  try {
    // membersテーブルからemailが一致するレコードを検索
    const result = handleDatabaseProcess(null, TABLE_NAMES.MEMBERS, 'select', {
      where: { email: ["=", email] }
    }, null, true);

    const members = result?.data || result || [];

    if (members.length === 0) {
      console.warn(`User with email ${email} not found in members table`);
      return null;
    }

    return members[0];
  } catch (error) {
    console.error('getActiveUser error:', error);
    return null;
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
    }, null, true);

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