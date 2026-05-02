// ============================================
// main.gs - mobile-app エントリーポイント
// ============================================

/**
 * mobile-app のWebアプリエントリーポイント
 * 実アクセス者メールを検証し、モバイル画面を返します。
 * @param {Object} e - URLパラメータ
 * @returns {HtmlOutput}
 */
function doGet(e) {
  const urlParams = (e && e.parameter) ? e.parameter : {};
  const activeUserEmail = Session.getActiveUser().getEmail();

  if (!activeUserEmail) {
    return renderAccessDeniedPage('大学アカウントでのサインインを確認してください。');
  }

  const activeUser = getMemberByEmail(activeUserEmail);
  if (!activeUser) {
    return renderAccessDeniedPage('ZARMSの利用権限が確認できませんでした。');
  }

  const template = HtmlService.createTemplateFromFile('mobile/index');
  template.templateVariables = {
    activeUser: activeUser,
    isDevelopment: isDevelopment(urlParams),
    TABLE_NAMES: TABLE_NAMES,
    KEY_LABELS: KEY_LABELS,
    EVENT_CONFIG: EVENT_CONFIG,
    EXTERNAL_URLS: EXTERNAL_URLS,
    userProperties: PropertiesService.getUserProperties().getProperties()
  };

  return template.evaluate()
    .setTitle(UI_TEXT.APP_TITLE)
    .setFaviconUrl(EXTERNAL_URLS.FAVICON_IMAGE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .addMetaTag('apple-mobile-web-app-capable', 'yes')
    .addMetaTag('mobile-web-app-capable', 'yes')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * 開発モード判定（frontend と同じ基準）
 * @param {Object} [urlParams] - URLパラメータ
 * @returns {boolean}
 */
function isDevelopment(urlParams) {
  try {
    if (urlParams && urlParams.use_prod_db === 'true') {
      return false;
    }

    const useProdDb = PropertiesService.getUserProperties().getProperty('USE_PROD_DB');
    if (useProdDb === 'true') {
      return false;
    }

    const url = ScriptApp.getService().getUrl();
    if (!url) {
      return false;
    }

    if (url.indexOf('use_prod_db=true') !== -1) {
      return false;
    }

    return /^https:\/\/script\.google\.com\/a\/.*\/dev.*$/.test(url);
  } catch (error) {
    console.error('[isDevelopment] Error:', error);
    return false;
  }
}

/**
 * アクセス拒否ページを生成します。
 * @param {string} message - 表示メッセージ
 * @returns {HtmlOutput}
 */
function renderAccessDeniedPage(message) {
  const helpUrl = EXTERNAL_URLS.PORTAL_SITE ? `${EXTERNAL_URLS.PORTAL_SITE}/help` : '#';
  const safeMessage = String(message || 'アクセスできません。')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ZARMS Mobile</title>
</head>
<body>
  <div>
    <h1>ZARMS Mobile にアクセスできません</h1>
    <p>${safeMessage}</p>
    <p>大学アカウントでサインインした状態で再度お試しください。</p>
    <p><a target="_blank" href="${helpUrl}">ヘルプサイト</a></p>
  </div>
</body>
</html>`;

  return HtmlService.createHtmlOutput(html)
    .setTitle('ZARMS Mobile')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
