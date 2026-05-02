// ============================================
// tasks.js - 特定機能（マイボード、ナビゲーション等）のデータベース操作
// ============================================

// ============================================
// Comment Navigation Data
// 責任: コメント通知用データの取得・加工
// ============================================

/**
 * コメント通知用のデータを取得します
 * @param {string} userId - 現在のユーザーID
 * @param {boolean} forceRefresh - キャッシュを無視して強制再取得するか
 * @returns {Object} { comments: Array, isCached: boolean }
 */
function getCommentNavData(userId, forceRefresh = false) {
    const cacheKey = `comment_nav_data_${userId}`;
    const cachePublicRange = 'script';

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

        const tasksResult = select(TABLE_NAMES.TASKS, {
            where: { task_status_key: ['!=', 'DONE'] }
        }) || [];
        const commentsResult = select(TABLE_NAMES.COMMENTS, {
            where: { created_by: ['!=', userId] }
        }) || [];

        if (commentsResult.length === 0) {
            return sanitizeForClient({ comments: [], isCached: false });
        }

        const membersResult = select(TABLE_NAMES.MEMBERS, {}) || [];
        const directoriesResult = select(TABLE_NAMES.DIRECTORIES, {}) || [];
        const skillsResult = select(TABLE_NAMES.SKILLS, {}) || [];
        const plansResult = select(TABLE_NAMES.PLANS, {}) || [];
        const directoryAssignments = select(TABLE_NAMES.DIRECTORY_ASSIGNMENTS, {
            where: { member_id: ['=', userId] }
        }) || [];
        const skillAssignments = select(TABLE_NAMES.SKILL_ASSIGNMENTS, {
            where: { member_id: ['=', userId] }
        }) || [];
        const planAssignments = select(TABLE_NAMES.PLAN_ASSIGNMENTS, {
            where: { member_id: ['=', userId] }
        }) || [];

        const userTasks = tasksResult.filter(function (task) {
            const status = task.task_status_key;
            if (!status || status === '' || status === 'DONE') return false;
            return task.created_by === userId ||
                task.processed_by === userId ||
                task.reviewed_by === userId ||
                task.received_by === userId;
        });

        const userTaskIds = new Set(userTasks.map(function (task) { return task.id; }));
        const userDirectoryIds = new Set(
            directoryAssignments
                .filter(function (assignment) { return assignment.is_active !== false; })
                .map(function (assignment) { return assignment.directory_id; })
        );
        const userSkillIds = new Set(skillAssignments.map(function (assignment) { return assignment.skill_id; }));
        const userPlanIds = new Set(
            planAssignments
                .filter(function (assignment) { return assignment.is_active !== false; })
                .map(function (assignment) { return assignment.plan_id; })
        );

        const membersMap = new Map();
        membersResult.forEach(function (member) {
            membersMap.set(member.id, {
                name: member.display_name || member.name || '',
                subtitle: member.email || '',
                profile_photo_url: member.profile_photo_url || ''
            });
        });

        const tasksMap = new Map();
        userTasks.forEach(function (task) {
            tasksMap.set(task.id, {
                name: task.name || '',
                subtitle: task.display_id ? `#${task.display_id}` : '',
                board_id: task.board_id || '',
                display_id: task.display_id || ''
            });
        });

        const directoriesMap = new Map();
        directoriesResult.forEach(function (directory) {
            directoriesMap.set(directory.id, {
                name: directory.name || '',
                subtitle: directory.directory_type_key || ''
            });
        });

        const skillsMap = new Map();
        skillsResult.forEach(function (skill) {
            skillsMap.set(skill.id, {
                name: skill.title || '',
                subtitle: skill.skill_type_key || ''
            });
        });

        const plansMap = new Map();
        plansResult.forEach(function (plan) {
            plansMap.set(plan.id, {
                name: plan.name || '',
                subtitle: plan.zarms_code || plan.plan_number || ''
            });
        });

        const tableLabelMap = {
            tasks: 'タスク',
            members: '人物',
            directories: '組織',
            skills: '技能',
            plans: '企画'
        };

        const relevantComments = commentsResult.filter(function (comment) {
            if (!comment || !comment.related_table || !comment.related_id) return false;

            if (comment.related_table === 'tasks') return userTaskIds.has(comment.related_id);
            if (comment.related_table === 'members') return comment.related_id === userId;
            if (comment.related_table === 'directories') return userDirectoryIds.has(comment.related_id);
            if (comment.related_table === 'skills') return userSkillIds.has(comment.related_id);
            if (comment.related_table === 'plans') return userPlanIds.has(comment.related_id);

            return false;
        });

        const enrichedComments = relevantComments.map(function (comment) {
            const memberInfo = membersMap.get(comment.updated_by) || {
                name: '不明',
                subtitle: '',
                profile_photo_url: ''
            };

            let targetName = '';
            let targetSubtitle = '';
            let taskBoardId = '';
            let taskDisplayId = '';
            let taskName = '';

            if (comment.related_table === 'tasks') {
                const taskInfo = tasksMap.get(comment.related_id) || {};
                targetName = taskInfo.name || '';
                targetSubtitle = taskInfo.subtitle || '';
                taskBoardId = taskInfo.board_id || '';
                taskDisplayId = taskInfo.display_id || '';
                taskName = taskInfo.name || '';
            } else if (comment.related_table === 'members') {
                const record = membersMap.get(comment.related_id) || {};
                targetName = record.name || '';
                targetSubtitle = record.subtitle || '';
            } else if (comment.related_table === 'directories') {
                const record = directoriesMap.get(comment.related_id) || {};
                targetName = record.name || '';
                targetSubtitle = record.subtitle || '';
            } else if (comment.related_table === 'skills') {
                const record = skillsMap.get(comment.related_id) || {};
                targetName = record.name || '';
                targetSubtitle = record.subtitle || '';
            } else if (comment.related_table === 'plans') {
                const record = plansMap.get(comment.related_id) || {};
                targetName = record.name || '';
                targetSubtitle = record.subtitle || '';
            }

            return {
                id: comment.id,
                content: comment.content,
                updated_at: comment.updated_at,
                updated_by: comment.updated_by,
                display_name: memberInfo.name,
                profile_photo_url: memberInfo.profile_photo_url,
                related_table: comment.related_table,
                related_id: comment.related_id,
                related_table_label: tableLabelMap[comment.related_table] || comment.related_table,
                target_name: targetName,
                target_subtitle: targetSubtitle,
                task_id: comment.related_table === 'tasks' ? comment.related_id : '',
                task_name: taskName,
                task_display_id: taskDisplayId,
                task_board_id: taskBoardId
            };
        });

        enrichedComments.sort(function (a, b) {
            const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
            const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
            return dateB - dateA;
        });

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

// ============================================
// Mobile-specific Secure Tasks
// 責任: モバイル専用のセキュアなタスク取得（userId由来条件を強制）
// ============================================

/**
 * モバイル専用: ユーザー本人が関連するタスクのみを返す（サーバー側でuserId由来条件を強制）
 * クライアント側からのmembers指定は無視し、userId をすべてのロール条件として自動設定
 * 
 * @param {string} userId - ユーザーID（Session.getActiveUser().getEmail()で取得済み）
 * @param {Object} filters - フィルタ条件（boards, dateRanges, isOverdue, ballHolderOnly, titleのみ許可）
 *   {
 *     boards: string[],              // ボードIDの配列（空の場合は全ボード）
 *     dateRanges: {                  // 日付範囲フィルタ
 *       starts_at: { from: string|null, to: string|null },
 *       ends_at:   { from: string|null, to: string|null }
 *     },
 *     isOverdue: boolean,            // 期限超過フィルタ
 *     ballHolderOnly: boolean,       // ボール保持者のみ表示
 *     title: string,                 // タイトル曖昧検索キーワード
 *     titleMatchMode: string         // 'contains' | 'starts_with' | 'ends_with' | 'not_contains'
 *   }
 * @param {boolean} forceRefresh - キャッシュを無視して強制再取得するか
 * @returns {Object} { data: Array, isCached: boolean }
 */
function getMobileUserTasks(userId, filters, forceRefresh) {
    forceRefresh = forceRefresh || false;

    // キャッシュキーを生成（安全なフィルタ要素のみで構成、membersフィルタは含めない）
    const safeCacheFilters = {
        boards: filters && filters.boards ? filters.boards : [],
        dateRanges: filters && filters.dateRanges ? filters.dateRanges : {},
        isOverdue: filters && filters.isOverdue ? true : false,
        ballHolderOnly: filters && filters.ballHolderOnly ? true : false,
        title: filters && filters.title ? filters.title : '',
        titleMatchMode: filters && filters.titleMatchMode ? filters.titleMatchMode : 'contains'
    };
    const cacheKey = 'mobile_user_tasks_' + userId + '_' + _hashFilters(safeCacheFilters);
    const cachePublicRange = 'script';

    if (!forceRefresh) {
        try {
            const cached = CacheManager.get(cacheKey, cachePublicRange);
            if (cached) {
                return { data: cached, isCached: true };
            }
        } catch (e) {
            console.warn('[getMobileUserTasks] Cache retrieval failed:', e);
        }
    }

    try {
        if (!userId) {
            throw new ValidationError('userId is required', 'userId', userId);
        }

        const tasksHeadersMap = getHeadersMap(TABLE_NAMES.TASKS);

        // ── Step 1: userId をすべてのロール条件として強制設定 ──────────────
        // クライアント側のmembers指定は無視し、userId のみをサーバー側で設定
        const roles = ['created_by', 'processed_by', 'reviewed_by', 'received_by'];
        const memberOrParts = [];

        for (const role of roles) {
            const colId = tasksHeadersMap[role];
            if (colId) {
                memberOrParts.push(`${colId} = '${userId.replace(/'/g, "\\'")}'`);
            }
        }

        // ── Step 2: tasks クエリの WHERE 句を組み立てる ──────────────────
        // 各条件の部品（AND で結合する）
        const andParts = [];

        // ユーザーOR条件（必須）
        if (memberOrParts.length > 0) {
            andParts.push(`(${memberOrParts.join(' OR ')})`);
        }

        // ボードフィルタ（クライアント指定可、安全）
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

        // ── Step 3: クエリを実行 ────────────────────────────────────────────
        const tasksQuery = {};
        if (andParts.length > 0) {
            tasksQuery.rawWhere = andParts.join(' AND ');
        }

        const tasksResult = select(TABLE_NAMES.TASKS, tasksQuery);
        let filteredTasks = tasksResult || [];

        // ── Step 4: JS側での追加フィルタリング（ボール保持者、タイトル検索） ──
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
                        return task[ballRole] === userId;
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
            console.warn('[getMobileUserTasks] Cache storage failed:', e);
        }

        return { data: filteredTasks, isCached: false };

    } catch (error) {
        console.error('[getMobileUserTasks] Error:', error);
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
