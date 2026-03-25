// ============================================
// insights.js - insightsタブ専用の集約データ取得
// ============================================

/**
 * insightsタブで必要なデータをサーバーサイドで一括取得します。
 * @param {string} userId - 現在のユーザーID
 * @param {boolean} forceRefresh - キャッシュを無視して強制再取得するか
 * @returns {{logs: Array, boardTasks: Array, userInsightTasks: Array, isCached: boolean}}
 */
function getInsightsTabData(userId, forceRefresh = false) {
    const cacheKey = `insights_tab_data_${userId}`;
    const cachePublicRange = CACHE_CONFIG.PUBLIC_RANGE.SCRIPT;

    if (!forceRefresh) {
        try {
            const cached = CacheManager.get(cacheKey, cachePublicRange);
            if (cached) {
                return sanitizeForClient({
                    logs: cached.logs || [],
                    boardTasks: cached.boardTasks || [],
                    userInsightTasks: cached.userInsightTasks || [],
                    isCached: true
                });
            }
        } catch (cacheError) {
            console.warn('[getInsightsTabData] Cache retrieval failed:', cacheError);
        }
    }

    try {
        if (!userId) {
            throw new ValidationError('userId is required', 'userId', userId);
        }

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const isoDate = sevenDaysAgo.toISOString();

        const tasksHeadersMap = getHeadersMap(TABLE_NAMES.TASKS);
        const createdByCol = tasksHeadersMap.created_by;
        const processedByCol = tasksHeadersMap.processed_by;
        const reviewedByCol = tasksHeadersMap.reviewed_by;
        const receivedByCol = tasksHeadersMap.received_by;
        const escapedUserId = String(userId || '').replace(/'/g, "\\'");

        const logsQuery = {
            where: {
                table_name: ['=', TABLE_NAMES.TASKS],
                operation_type_key: ['!=', 'REMOVE'],
                created_at: ['>', isoDate],
                created_by: ['!=', 'system']
            },
            columns: ['created_at', 'created_by']
        };

        const boardTasksQuery = {
            where: { updated_at: ['>', isoDate] },
            columns: ['board_id', 'updated_at']
        };

        const userInsightTasksQuery = {
            columns: ['board_id', 'task_status_key', 'starts_at', 'ends_at', 'processed_by', 'created_by', 'reviewed_by', 'received_by'],
            rawWhere: `(${createdByCol} = '${escapedUserId}' OR ${processedByCol} = '${escapedUserId}' OR ${reviewedByCol} = '${escapedUserId}' OR ${receivedByCol} = '${escapedUserId}')`
        };

        const logsResult = select(TABLE_NAMES.LOGS, logsQuery) || [];
        const boardTasksResult = select(TABLE_NAMES.TASKS, boardTasksQuery) || [];
        const userInsightTasksResult = select(TABLE_NAMES.TASKS, userInsightTasksQuery) || [];

        const payload = {
            logs: logsResult,
            boardTasks: boardTasksResult,
            userInsightTasks: userInsightTasksResult
        };

        try {
            CacheManager.put(cacheKey, payload, cachePublicRange);
        } catch (cacheError) {
            console.warn('[getInsightsTabData] Cache storage failed:', cacheError);
        }

        return sanitizeForClient({
            logs: logsResult,
            boardTasks: boardTasksResult,
            userInsightTasks: userInsightTasksResult,
            isCached: false
        });
    } catch (error) {
        console.error('[getInsightsTabData] Error:', error);
        throw error;
    }
}