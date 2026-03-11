/**
 * ============================================
 * db_bridge.js - データベースライブラリのブリッジ
 * ============================================
 * 
 * ZARMS_DBライブラリの関数をフロントエンドのグローバルスコープに公開します。
 * これにより、既存のコードを変更せずにライブラリ化したデータベース操作を利用できます。
 */

function handleDatabaseProcess(...args) {
    return ZARMS_DB.handleDatabaseProcess(...args);
}

function handleBatchDatabaseProcess(...args) {
    return ZARMS_DB.handleBatchDatabaseProcess(...args);
}

function getMemberByEmail(...args) {
    return ZARMS_DB.getMemberByEmail(...args);
}

function findUserBySlackUrl(...args) {
    return ZARMS_DB.findUserBySlackUrl(...args);
}

function registerUserEmail(...args) {
    return ZARMS_DB.registerUserEmail(...args);
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

// 必要に応じて他の外部公開関数を追加してください
