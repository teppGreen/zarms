/**
 * ============================================
 * db_bridge.js - データベースライブラリのブリッジ
 * ============================================
 *
 * ZARMS_DBライブラリの関数をフロントエンドのグローバルスコープに公開します。
 */

function handleDatabaseProcess(userId, tableName, operation, dataObject, logRemark, forceRefresh = false) {
  return ZARMS_DB.handleDatabaseProcess(userId, tableName, operation, dataObject, logRemark, forceRefresh);
}

function handleBatchDatabaseProcess(userId, queries) {
  return ZARMS_DB.handleBatchDatabaseProcess(userId, queries);
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

function findUserBySlackUrl(slackProfileUrl) {
  return ZARMS_DB.findUserBySlackUrl(slackProfileUrl);
}

function registerUserEmail(userId) {
  return ZARMS_DB.registerUserEmail(userId);
}

function getSpreadsheet(...args) {
  return ZARMS_DB.getSpreadsheet(...args);
}

function getCommentNavData(...args) {
  return ZARMS_DB.getCommentNavData(...args);
}

function getMyBoardTasks(...args) {
  return ZARMS_DB.getMyBoardTasks(...args);
}

function getInsightsTabData(...args) {
  return ZARMS_DB.getInsightsTabData(...args);
}
