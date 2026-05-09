/**
 * ============================================
 * db_bridge.gs - mobile-app 用ライブラリブリッジ
 * ============================================
 */

const MOBILE_USER_ID_CACHE_KEY_PREFIX = 'mobile_uid_by_email_';
const MOBILE_USER_ID_CACHE_TTL_SECONDS = 21600;

/**
 * 実アクセスユーザーを Session から解決し、email->userId をキャッシュします。
 * クライアントから渡された userId は認証情報として利用しません。
 * @param {boolean} [forceRefresh=false] - true の場合はキャッシュを使わず再取得
 * @returns {{ email: string, userId: string, member: Object }}
 */
function resolveAuthenticatedMobileUser(forceRefresh = false) {
  const email = Session.getActiveUser().getEmail();
  if (!email) {
    throw new Error('アクティブユーザーのメールアドレスを取得できません。');
  }

  const cacheKey = MOBILE_USER_ID_CACHE_KEY_PREFIX + email.toLowerCase();
  const userCache = CacheService.getUserCache();

  if (!forceRefresh) {
    const cachedJson = userCache.get(cacheKey);
    if (cachedJson) {
      try {
        const cached = JSON.parse(cachedJson);
        if (cached && cached.userId) {
          return {
            email: email,
            userId: cached.userId,
            member: cached.member || null
          };
        }
      } catch (e) {
        // キャッシュ破損時は再取得にフォールバック
      }
    }
  }

  const member = ZARMS_DB.getMemberByEmail(email);
  if (!member || !member.id) {
    throw new Error('メールアドレスに対応するユーザーが見つかりません。');
  }

  userCache.put(cacheKey, JSON.stringify({
    userId: member.id,
    member: member
  }), MOBILE_USER_ID_CACHE_TTL_SECONDS);

  return {
    email: email,
    userId: member.id,
    member: member
  };
}

/**
 * モバイル用: サーバー側で確定した現在ユーザー情報を返します。
 * @param {boolean} [forceRefresh=false]
 * @returns {Object}
 */
function getAuthenticatedMember(forceRefresh = false) {
  return resolveAuthenticatedMobileUser(forceRefresh).member;
}

function handleDatabaseProcess(userId, tableName, operation, dataObject, logRemark, forceRefresh = false) {
  const authUser = resolveAuthenticatedMobileUser(forceRefresh);
  return ZARMS_DB.handleDatabaseProcess(authUser.userId, tableName, operation, dataObject, logRemark, forceRefresh);
}

function getMyBoardTasks(userId, filters, forceRefresh = false) {
  const authUser = resolveAuthenticatedMobileUser(forceRefresh);
  return ZARMS_DB.getMyBoardTasks(authUser.userId, filters, forceRefresh);
}

function getMobileUserTasks(userId, filters, forceRefresh = false) {
  const authUser = resolveAuthenticatedMobileUser(forceRefresh);
  return ZARMS_DB.getMobileUserTasks(authUser.userId, filters, forceRefresh);
}

function getMemberByEmail(email) {
  try {
    return ZARMS_DB.getMemberByEmail(email);
  } catch (e) {
    if (e.message && e.message.includes('not found')) {
      return null;
    }
    throw e;
  }
}

function punchAttendance(userId, location, action) {
  const authUser = resolveAuthenticatedMobileUser(false);
  return ZARMS_DB.punchAttendance(authUser.userId, location, action);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
