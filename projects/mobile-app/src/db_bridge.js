/**
 * ============================================
 * db_bridge.gs - mobile-app 用ライブラリブリッジ
 * ============================================
 */

function handleDatabaseProcess(userId, tableName, operation, dataObject, logRemark, forceRefresh = false) {
  return ZARMS_DB.handleDatabaseProcess(userId, tableName, operation, dataObject, logRemark, forceRefresh);
}

function getMyBoardTasks(...args) {
  return ZARMS_DB.getMyBoardTasks(...args);
}

function getMobileUserTasks(...args) {
  return ZARMS_DB.getMobileUserTasks(...args);
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
  return ZARMS_DB.punchAttendance(userId, location, action);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
