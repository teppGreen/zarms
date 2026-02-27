// ============================================
// sync_utils.js - ZARMS 同期用ユーティリティ
// ============================================

/**
 * Master DB のレコードを同期更新するためのヘルパー関数
 * @param {string} table - テーブル名
 * @param {Object} data - 更新データ。必ず `id` プロパティを含むこと。
 * @returns {Object} 更新結果
 */
function syncRecordToMaster(table, data) {
    if (!data.id) {
        throw new Error('syncRecordToMaster: data must contain "id" property.');
    }

    // id を set 句から除外
    const setId = data.id;
    const updateData = { ...data };
    delete updateData.id;

    if (Object.keys(updateData).length === 0) {
        return { success: true, updatedCount: 0 }; // 更新すべきデータがない
    }

    // database.js に定義されている update を呼び出す
    // 第1引数の userId は同期処理なので 'system_sync' 等を入れておく
    return update('system_sync', table, {
        set: updateData,
        where: { id: ['=', setId] }
    });
}
