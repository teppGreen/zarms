// ============================================
// tasks.js - 特定機能（マイボード、ナビゲーション等）のデータベース操作
// ============================================

// ============================================
// Comment Navigation Data
// 責任: コメント通知用データの取得・加工
// ============================================

/**
 * コメント通知用のデータを取得します
 * ユーザーが関与するアクティブタスクに紐づくコメントを取得し、
 * 投稿者情報を付与して返します。
 *
 * @param {string} userId - 現在のユーザーID
 * @param {boolean} forceRefresh - キャッシュを無視して強制再取得するか
 * @returns {Object} { comments: Array, isCached: boolean }
 *   comments: コメントデータ（投稿者情報付き）
 */
function getCommentNavData(userId, forceRefresh = false) {
    const cacheKey = `comment_nav_data_${userId}`;
    const cachePublicRange = 'script';

    // selectかつforceRefreshがfalseの場合、キャッシュを使用
    if (!forceRefresh) {
        try {
            const cached = CacheManager.get(cacheKey, cachePublicRange);
            if (cached) {
                return { comments: cached, isCached: true };
            }
        } catch (cacheError) {
            console.warn('[getCommentNavData] Cache retrieval failed:', cacheError);
        }
    }

    try {
        if (!userId) {
            throw new ValidationError('userId is required', 'userId', userId);
        }

        // 1. アクティブなタスクを取得（task_status_key が DONE ではない）
        const tasksResult = select(TABLE_NAMES.TASKS, {
            where: { task_status_key: ['!=', 'DONE'] }
        });

        if (!tasksResult || tasksResult.length === 0) {
            return { comments: [], tasks: [] };
        }

        // 2. ユーザーが関与するタスクをフィルタリング
        //    created_by / processed_by / reviewed_by / received_by のいずれかが userId
        //    かつ task_status_key が NULL / 空欄でもないもの
        const userTasks = tasksResult.filter(task => {
            const status = task.task_status_key;
            if (!status || status === '' || status === 'DONE') return false;

            return task.created_by === userId ||
                task.processed_by === userId ||
                task.reviewed_by === userId ||
                task.received_by === userId;
        });

        if (userTasks.length === 0) {
            return { comments: [], tasks: [] };
        }

        // タスクIDのSetを作成（高速検索用）
        const userTaskIds = new Set(userTasks.map(t => t.id));

        // 3. commentsテーブルから related_table = 'tasks' のコメントを取得
        const commentsResult = select(TABLE_NAMES.COMMENTS, {
            where: {
                related_table: ['=', 'tasks'],
                created_by: ['!=', userId]
            }
        });

        if (!commentsResult || commentsResult.length === 0) {
            return { comments: [], tasks: [] };
        }

        // 4. ユーザーのタスクに関連するコメントのみフィルタ
        const relevantComments = commentsResult.filter(comment =>
            userTaskIds.has(comment.related_id)
        );

        if (relevantComments.length === 0) {
            return { comments: [], tasks: [] };
        }

        // 5. メンバー情報を取得（投稿者の display_name, profile_photo_url のため）
        const membersResult = select(TABLE_NAMES.MEMBERS, {});
        const membersMap = new Map();
        if (membersResult) {
            membersResult.forEach(m => {
                membersMap.set(m.id, {
                    display_name: m.display_name || m.name || '',
                    profile_photo_url: m.profile_photo_url || ''
                });
            });
        }

        // 6. タスク情報のMapを作成
        const tasksMap = new Map();
        userTasks.forEach(t => {
            tasksMap.set(t.id, {
                id: t.id,
                name: t.name,
                display_id: t.display_id,
                board_id: t.board_id,
                task_status_key: t.task_status_key
            });
        });

        // 7. コメントデータを加工（投稿者情報 + タスク情報を付与）
        const enrichedComments = relevantComments.map(comment => {
            const memberInfo = membersMap.get(comment.updated_by) || {
                display_name: '不明',
                profile_photo_url: ''
            };
            const taskInfo = tasksMap.get(comment.related_id) || {};

            return {
                id: comment.id,
                content: comment.content,
                updated_at: comment.updated_at,
                updated_by: comment.updated_by,
                display_name: memberInfo.display_name,
                profile_photo_url: memberInfo.profile_photo_url,
                task_id: comment.related_id,
                task_name: taskInfo.name || '',
                task_display_id: taskInfo.display_id || '',
                task_board_id: taskInfo.board_id || ''
            };
        });

        // 8. updated_at で降順ソート（新しい順）
        enrichedComments.sort((a, b) => {
            const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
            const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
            return dateB - dateA;
        });

        // 9. キャッシュに保存
        try {
            CacheManager.put(cacheKey, enrichedComments, cachePublicRange);
        } catch (cacheError) {
            console.warn('[getCommentNavData] Cache storage failed:', cacheError);
        }

        return sanitizeForClient({ comments: enrichedComments, isCached: false });
    } catch (error) {
        console.error('[getCommentNavData] Error:', error);
        throw error;
    }
}

// ============================================
// My Board Tasks
// 責任: マイボード用タスクのフィルタリング取得
// ============================================

/**
 * マイボード用のタスクをサーバーサイドでフィルタリングして返します。
 * 全件取得後にサーバーサイドでフィルタリングすることで、
 * フロントエンドへのデータ転送量を削減します。
 *
 * @param {string} userId - ユーザーID
 * @param {Object} filters - フィルタ条件
 *   {
 *     title: string,                          // タイトルキーワード
 *     titleMatchMode: string,                 // 'contains' | 'not_contains' | 'starts_with' | 'ends_with'
 *     members: {
 *       created_by: string[],
 *       processed_by: string[],
 *       reviewed_by: string[],
 *       received_by: string[]
 *     },
 *     dateRanges: {
 *       starts_at: { from: string|null, to: string|null },
 *       ends_at:   { from: string|null, to: string|null }
 *     },
 *     boards: string[],                       // ボードIDの配列（空の場合は全ボード）
 *     isOverdue: boolean,
 *     includeListMembers: boolean             // trueの場合、listsのassign_toも検索対象にする
 *   }
 * @param {boolean} forceRefresh - キャッシュを無視して強制的に再取得するか
 * @returns {Object} { data: Array, isCached: boolean }
 */
function getMyBoardTasks(userId, filters, forceRefresh) {
    forceRefresh = forceRefresh || false;

    // キャッシュキーを生成（filtersの内容でユニーク化）
    const cacheKey = 'my_board_tasks_' + userId + '_' + _hashFilters(filters);
    const cachePublicRange = 'script';

    if (!forceRefresh) {
        try {
            const cached = CacheManager.get(cacheKey, cachePublicRange);
            if (cached) {
                return { data: cached, isCached: true };
            }
        } catch (e) {
            console.warn('[getMyBoardTasks] Cache retrieval failed:', e);
        }
    }

    try {
        const tasksHeadersMap = getHeadersMap(TABLE_NAMES.TASKS);

        // ── Step 1: tasks テーブルへのクエリを構築 ──────────────────────────────
        // メンバーフィルタ（OR 条件）を rawWhere で表現する
        // 例: (J = 'id1' OR J = 'id2') OR (K = 'id1') OR ...
        const memberOrParts = [];
        const roles = ['created_by', 'processed_by', 'reviewed_by', 'received_by'];

        if (filters && filters.members) {
            for (const role of roles) {
                const ids = filters.members[role] || [];
                if (ids.length > 0) {
                    const colId = tasksHeadersMap[role];
                    if (!colId) continue;
                    const orParts = ids.map(id => `${colId} = '${id.replace(/'/g, "\\'")}'`);
                    memberOrParts.push(`(${orParts.join(' OR ')})`);
                }
            }
        }

        // ── Step 2: includeListMembers が有効かつ processed_by フィルタがある場合
        //           lists テーブルを取得し、該当する task_id を収集 ────────────
        const processedByFilter = (filters && filters.members && filters.members.processed_by) || [];
        const extraTaskIds = [];

        if (filters && filters.includeListMembers && processedByFilter.length > 0) {
            try {
                // lists テーブルを assign_to の IN クエリで取得
                const listsResult = select(TABLE_NAMES.LISTS, {
                    where: {
                        assign_to: ['in', processedByFilter]
                    }
                });
                const lists = listsResult || [];
                lists.forEach(function (list) {
                    if (list.task_id) extraTaskIds.push(list.task_id);
                });
            } catch (e) {
                console.error('[getMyBoardTasks] Error loading lists:', e);
            }
        }

        // lists 経由で見つかったタスクIDも OR 条件に追加
        if (extraTaskIds.length > 0) {
            const idColId = tasksHeadersMap['id'];
            if (idColId) {
                const listOrParts = extraTaskIds.map(id => `${idColId} = '${id.replace(/'/g, "\\'")}'`);
                memberOrParts.push(`(${listOrParts.join(' OR ')})`);
            }
        }

        // ── Step 3: tasks クエリの WHERE 句を組み立てる ──────────────────────
        // 各条件の部品（AND で結合する）
        const andParts = [];

        // メンバーOR条件（いずれかのロールに一致するタスク）
        if (memberOrParts.length > 0) {
            andParts.push(`(${memberOrParts.join(' OR ')})`);
        }

        // ボードフィルタ（IN 条件）
        if (filters && filters.boards && filters.boards.length > 0) {
            const boardColId = tasksHeadersMap['board_id'];
            if (boardColId) {
                const boardParts = filters.boards.map(id => `${boardColId} = '${id.replace(/'/g, "\\'")}'`);
                andParts.push(`(${boardParts.join(' OR ')})`);
            }
        }

        // 日付範囲フィルタ
        if (filters && filters.dateRanges) {
            const dr = filters.dateRanges;
            const startsColId = tasksHeadersMap['starts_at'];
            const endsColId = tasksHeadersMap['ends_at'];

            if (startsColId && dr.starts_at && dr.starts_at.from) {
                andParts.push(`${startsColId} >= '${dr.starts_at.from.replace(/'/g, "\\'")}'`);
            }
            if (startsColId && dr.starts_at && dr.starts_at.to) {
                andParts.push(`${startsColId} <= '${dr.starts_at.to.replace(/'/g, "\\'")}'`);
            }
            if (endsColId && dr.ends_at && dr.ends_at.from) {
                andParts.push(`${endsColId} >= '${dr.ends_at.from.replace(/'/g, "\\'")}'`);
            }
            if (endsColId && dr.ends_at && dr.ends_at.to) {
                andParts.push(`${endsColId} <= '${dr.ends_at.to.replace(/'/g, "\\'")}'`);
            }
        }

        // 期限超過フィルタ
        // isOverdue: ends_at が現在より過去 かつ task_status_key != 'DONE'
        if (filters && filters.isOverdue) {
            const endsColId = tasksHeadersMap['ends_at'];
            const statusColId = tasksHeadersMap['task_status_key'];
            const nowIso = new Date().toISOString().replace(/'/g, '');
            if (endsColId && statusColId) {
                andParts.push(`${endsColId} IS NOT NULL`);
                andParts.push(`${endsColId} < '${nowIso}'`);
                andParts.push(`${statusColId} != 'DONE'`);
            }
        }

        // ── Step 4: クエリを実行 ────────────────────────────────────────────
        const tasksQuery = {};
        if (andParts.length > 0) {
            tasksQuery.rawWhere = andParts.join(' AND ');
        }

        const tasksResult = select(TABLE_NAMES.TASKS, tasksQuery);
        let filteredTasks = tasksResult || [];

        // ── Step 5: さらなるフィルタリングをJSで適用（真の曖昧検索、ボール保持者など） ──
        if (filters) {
            // ボール保持者フィルタ
            if (filters.ballHolderOnly) {
                filteredTasks = filteredTasks.filter(function (task) {
                    let ballRole;
                    const status = task.task_status_key;
                    if (status === 'TODO' || status === 'IN_PROGRESS') {
                        ballRole = 'processed_by';
                    } else if (status === 'IN_REVIEW') {
                        ballRole = 'reviewed_by';
                    } else if (status === 'DONE') {
                        ballRole = 'received_by';
                    }

                    if (ballRole) {
                        const ballRoleMembers = filters.members ? (filters.members[ballRole] || []) : [];
                        if (ballRoleMembers.length === 0) return false;
                        return ballRoleMembers.indexOf(task[ballRole]) !== -1;
                    }
                    return false;
                });
            }

            // タイトル曖昧検索
            if (filters.title) {
                const normalizedKeyword = normalizeText(filters.title);
                const mode = filters.titleMatchMode || 'contains';

                filteredTasks = filteredTasks.filter(function (task) {
                    const normalizedTitle = normalizeText(task.name);
                    if (mode === 'starts_with') {
                        return normalizedTitle.indexOf(normalizedKeyword) === 0;
                    } else if (mode === 'ends_with') {
                        return normalizedTitle.length >= normalizedKeyword.length &&
                            normalizedTitle.lastIndexOf(normalizedKeyword) === (normalizedTitle.length - normalizedKeyword.length);
                    } else if (mode === 'not_contains') {
                        return normalizedTitle.indexOf(normalizedKeyword) === -1;
                    } else {
                        // contains (default)
                        return normalizedTitle.indexOf(normalizedKeyword) !== -1;
                    }
                });
            }
        }

        // キャッシュに保存
        try {
            CacheManager.put(cacheKey, filteredTasks, cachePublicRange);
        } catch (e) {
            console.warn('[getMyBoardTasks] Cache storage failed:', e);
        }

        return { data: filteredTasks, isCached: false };

    } catch (error) {
        console.error('[getMyBoardTasks] Error:', error);
        throw error;
    }
}

/**
 * フィルタオブジェクトを簡易ハッシュ化（キャッシュキー用）
 * @param {Object} filters
 * @returns {string}
 */
function _hashFilters(filters) {
    try {
        return hashString(JSON.stringify(filters || {}));
    } catch (e) {
        return 'nohash';
    }
}