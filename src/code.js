// ============================================
// code.gs - メインロジックとWebアプリのエントリーポイント
// ============================================

// Webアプリのエントリーポイント
function doGet(e) {
  const template = HtmlService.createTemplateFromFile('index');
  template.templateVariables = {
    urlParam: e.parameter,
    TABLE_NAMES: TABLE_NAMES,
    DIRECTORY_TYPES: DIRECTORY_TYPES,
    TASK_STATUS: TASK_STATUS,
    activeUser: getActiveUser()
  };

  return template.evaluate()
    .setTitle('ZEN Boards')
    .setFaviconUrl('https://drive.google.com/uc?id=1rnkYniTkiKnVk5jNbx7V1nRrmwP6altL' + '&.png')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width')
    .getContent();
}

// ============================================
// Caching Utility
// ============================================
const CacheManager = {
  get: function (key, isPublic) {
    const cache = isPublic ? CacheService.getScriptCache() : CacheService.getUserCache();
    const cached = cache.get(key);
    if (!cached) return null;
    return JSON.parse(cached);
  },
  put: function (key, value, isPublic, ttl = 21600) {
    const cache = isPublic ? CacheService.getScriptCache() : CacheService.getUserCache();
    cache.put(key, JSON.stringify(value), ttl);
  },
  invalidate: function (key, isPublic) {
    const cache = isPublic ? CacheService.getScriptCache() : CacheService.getUserCache();
    cache.remove(key);
  }
};

// ============================================
// 汎用データ操作関数 (Consolidated DB Operations)
// ============================================

/**
 * データを取得します（必要に応じてエンリッチメントを行います）
 * @param {string} tableName - テーブル名 ('works', 'projects', etc.)
 * @returns {Object[]} データ配列
 */
function getItems(tableName) {
  switch (tableName) {
    case TABLE_NAMES.BOARDS:
      return getBoards();
    case TABLE_NAMES.MEMBERS:
      return getMembers();
    case TABLE_NAMES.TASKS:
      return getTasks();
    case TABLE_NAMES.DIRECTORIES:
      return getDirectories();
    default:
      return select(tableName, {});
  }
}

/**
 * データを取得します（キャッシュ付きSWR対応）
 * @param {string} tableName - テーブル名
 * @param {boolean} forceRefresh - キャッシュを無視するかどうか
 * @returns {Object} { data: Object, isCached: boolean }
 */
function getItemsCached(tableName, forceRefresh = false) {
  const cacheKey = `user_items_${tableName}`;

  if (!forceRefresh) {
    const cached = CacheManager.get(cacheKey, false); // false = Private Cache
    if (cached) {
      return { data: cached, isCached: true };
    }
  }

  const data = getItems(tableName);

  // Cache the result
  CacheManager.put(cacheKey, data, false); // false = Private Cache

  return { data: data, isCached: false };
}

/**
 * データを新規作成します
 * @param {string} tableName - テーブル名
 * @param {Object} data - データ
 * @returns {string|boolean} 作成されたID または 成功フラグ
 */
function createItem(tableName, data) {
  switch (tableName) {
    case TABLE_NAMES.BOARDS:
      return createBoard(data);
    case TABLE_NAMES.MEMBERS:
      return createMember(data);
    case TABLE_NAMES.TASKS:
      return createTask(data);
    case TABLE_NAMES.DIRECTORIES:
      return createDirectory(data);
    default:
      return insert(tableName, data);
  }
}

/**
 * データを更新します
 * @param {string} tableName - テーブル名
 * @param {string} id - ID
 * @param {Object} data - 更新データ
 * @returns {boolean} 成功フラグ
 */
function updateItem(tableName, id, data) {
  switch (tableName) {
    case TABLE_NAMES.MEMBERS:
      return updateMember(id, data);
    default:
      const idCol = ID_COLUMNS[tableName];
      if (idCol) {
        const res = update(tableName, { set: data, where: { [idCol]: ["=", id] } });
        return res && res.length > 0;
      }
      return false;
  }
}

/**
 * データを削除します
 * @param {string} tableName - テーブル名
 * @param {Object} condition - 削除条件
 * @returns {boolean} 成功フラグ
 */
function deleteItem(tableName, condition) {
  const res = remove(tableName, { where: condition });
  return res && res.length > 0;
}

// ============================================
// 内部ロジック (Internal Logic)
// ============================================

// --- Boards ---
function getBoards() {
  const boards = select(TABLE_NAMES.BOARDS, {});
  // Enrichment is now done in frontend or here if needed.
  // For now, return raw data to let frontend handle joins, or minimal enrichment.
  return boards;
}

function getBoardById(id, forceRefresh = false) {
  const cacheKey = `board_detail_${id}`;

  if (!forceRefresh) {
    const cached = CacheManager.get(cacheKey, true); // Public Cache
    if (cached) return { data: cached, isCached: true };
  }

  const res = select(TABLE_NAMES.CREATIVES, { where: { id: ["=", id] } });
  const creative = res.length > 0 ? res[0] : null;
  if (!creative) return { data: null, isCached: false };

  // Enrichment
  creative.assignees = getCreativeAssignees(creative.id);

  CacheManager.put(cacheKey, creative, true);
  return { data: creative, isCached: false };
}

// --- Plans ---
function getPlans() {
  const plans = select(TABLE_NAMES.PLANS, {});
  return plans.map(plan => {
    // plan.created_by_name = getMemberName(plan.created_by); // created_by is now member ID
    // const creativeStats = getPlanCreativeStats(plan.id);
    // plan.creatives_count = creativeStats.count;
    // plan.creatives_status = creativeStats.status;
    return plan;
  });
}

// --- Members ---
function getMembers() {
  return select('members', {});
}

function getMemberById(id) {
  const res = select(TABLE_NAMES.MEMBERS, { where: { email: ["=", id] } }); // Member ID is email
  const member = res.length > 0 ? res[0] : null;
  if (!member) return null;
  // const assignments = findData(TABLE_NAMES.MEMBER_ASSIGNMENTS, { member_id: id });
  // const creativeIds = assignments.map(a => a.creative_id);
  // const allCreatives = getAllData(TABLE_NAMES.CREATIVES);
  // member.assigned_creatives = allCreatives.filter(c => creativeIds.includes(c.id));
  return member;
}

function createMember(memberData) {
  const newMember = {
    email: memberData.email,
    slack_profile_url: memberData.slack_profile_url || '',
    display_name: memberData.display_name,
    display_name_yomi: memberData.display_name_yomi || '',
    last_name: memberData.last_name,
    last_name_yomi: memberData.last_name_yomi || '',
    first_name: memberData.first_name,
    first_name_yomi: memberData.first_name_yomi || '',
    icon_gfile_id: memberData.icon_gfile_id || ''
  };
  return insert('members', newMember);
}

function updateMember(memberEmail, memberData) {
  const res = update('members', { set: memberData, where: { email: ["=", memberEmail] } });
  return res && res.length > 0;
}

// --- Tasks ---
function getTasks() {
  const tasks = select(TABLE_NAMES.TASKS, {});
  return tasks.map(task => {
    task.assignee_name = getMemberName(task.assign_to);
    return task;
  });
}

function getTaskById(taskId) {
  const res = select(TABLE_NAMES.TASKS, { where: { id: ["=", taskId] } });
  return res.length > 0 ? res[0] : null;
}

function createTask(taskData) {
  const userEmail = Session.getActiveUser().getEmail();
  const now = new Date();
  const newTask = {
    // id: generated by backend
    // display_id: generated by backend
    parent_task_id: taskData.parent_task_id || '',
    creative_id: taskData.creative_id,
    title: taskData.title,
    description: taskData.description || '',
    task_status_key: taskData.task_status_key || 'TODO',
    priority_key: taskData.priority_key || 'MEDIUM',
    assign_to: taskData.assign_to || '',
    starts_at: taskData.starts_at || '',
    ends_at: taskData.ends_at || '',
    actual_starts_at: '',
    actual_ends_at: '',
    created_by: userEmail,
    created_at: now,
  };
  const created = insert(TABLE_NAMES.TASKS, newTask);
  return created;
}

// ============================================
// Helper Functions
// ============================================

function getPlanTitle(id) {
  if (!id) return '';
  const res = select(TABLE_NAMES.PLANS, { where: { id: ["=", id] } });
  return res.length > 0 ? res[0].title : '';
}

function getAssignees(related_table, related_id) {
  const assignments = select(TABLE_NAMES.MEMBER_ASSIGNMENTS, { where: { related_table: ["=", related_table], related_id: ["=", related_id] } });
  const assignees = assignments.map(assignment => {
    const res = select(TABLE_NAMES.MEMBERS, { where: { id: ["=", assignment.member_id] } });
    return res.length > 0 ? res[0] : null;
  });
  return assignees.filter(member => member !== null);
}

function getCreativesByPlanId(planId) {
  return select(TABLE_NAMES.CREATIVES, { where: toSssqlCond({ plan_id: planId }) });
}

function getTasksByCreativeId(creativeId) {
  const tasks = select(TABLE_NAMES.TASKS, { where: toSssqlCond({ creative_id: creativeId }) });
  return tasks.map(task => {
    task.assignee_name = getMemberName(task.assign_to);
    return task;
  });
}

function isProjectTitleDuplicate(projectTitle) {
  const projects = select(TABLE_NAMES.PLANS, { where: toSssqlCond({ title: projectTitle }) });
  return projects.length > 0;
}

function getProjectCreativeStats(projectId) {
  const creatives = select(TABLE_NAMES.CREATIVES, { where: toSssqlCond({ plan_id: projectId }) });
  const statusCounts = {};
  creatives.forEach(creative => {
    const status = creative.creative_status_key;
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  return { count: creatives.length, status: statusCounts };
}

// Duplicate function definition removed (getCreativesByPlanId was defined twice)

function getOrCreatePlanId(planTitle) {
  if (!planTitle) return null;
  const plans = select(TABLE_NAMES.PLANS, { where: toSssqlCond({ title: planTitle }) });
  if (plans.length > 0) return plans[0].id;

  try {
    const created = createItem(TABLE_NAMES.PLANS, { title: planTitle });
    return created.id || created;
  } catch (e) {
    if (e.message.includes('既に存在します')) {
      const plans = select(TABLE_NAMES.PLANS, { where: toSssqlCond({ title: planTitle }) });
      if (plans.length > 0) return plans[0].id;
    }
    throw e;
  }
}

// ============================================
// Other Specific Functions (kept as is or refactored)
// ============================================

function getHomeData(forceRefresh = false) {
  const member = getActiveUser();

  if (!member) {
    return {
      data: {
        greeting: 'こんにちは',
        memberName: 'ゲスト',
        new_requests: [],
        assigned_creatives: [],
        knowledge: []
      },
      isCached: false
    };
  }

  const cacheKey = `home_data_${member.id}`;
  if (!forceRefresh) {
    const cached = CacheManager.get(cacheKey, false); // Private Cache
    if (cached) return { data: cached, isCached: true };
  }

  // バックエンドでフィルタリングしたデータを取得（セキュリティ向上）
  const newRequests = getAvailableCreatives(member.id);
  const assignedCreatives = getAssignedCreatives(member.id);

  const hour = new Date().getHours();
  let greeting = 'こんにちは';
  if (hour < 11) greeting = 'おはようございます';
  else if (hour >= 18) greeting = 'こんばんは';

  const result = {
    greeting: greeting,
    memberName: member.display_name || member.member_name,
    new_requests: newRequests || [],
    assigned_creatives: assignedCreatives || []
  };

  CacheManager.put(cacheKey, result, false);
  return { data: result, isCached: false };
}

/**
 * 新規依頼として表示可能な制作物を取得（バックエンドでフィルタリング）
 * @param {string} memberId - メンバーID
 * @returns {Object[]} 条件に一致する制作物
 */
function getAvailableCreatives(memberId) {
  // SSSQLのwhere句を使用してバックエンドでフィルタリング
  // TODO/APPROVED ステータスの制作物のみを取得
  const whereConditions = {
    creative_status_key: ["IN", ["TODO", "APPROVED"]]
  };

  const result = select(TABLE_NAMES.CREATIVES, {
    where: whereConditions,
    orderBy: { created_at: "DESC" }
  });
  return result.slice(0, 10);
}

/**
 * 自分に割り当てられた制作物を取得
 * @param {string} memberId - メンバーID
 * @returns {Object[]} 割り当てられた制作物
 */
function getAssignedCreatives(memberId) {
  const assignments = select(TABLE_NAMES.MEMBER_ASSIGNMENTS, {
    where: {
      member_id: ["=", memberId],
      related_table: ["=", TABLE_NAMES.CREATIVES]
    }
  });

  if (assignments.length === 0) {
    return [];
  }

  const creativeIds = assignments.map(a => a.related_id);

  const whereConditions = {
    id: ["IN", creativeIds]
  };

  return select(TABLE_NAMES.CREATIVES, { where: whereConditions });
}

function updateSingleField(tableName, id, field, value) {
  if (!checkPermission('edit')) throw new Error('この操作には編集権限が必要です。');
  const updateObject = { [field]: value };
  return updateItem(tableName, id, updateObject);
}

function createCreativeFolder(creativeId, creativeTitle) {
  // Placeholder
  return 'folder_id_placeholder';
}

function createCreativeDocument(creativeId, creativeTitle, content, design, regulation, note, folderId) {
  // Placeholder
  return { documentId: 'doc_id', tabId: 'tab_id' };
}

function getCreativeflowTimestamps(creativeId) {
  const res = select(TABLE_NAMES.CREATIVES, { where: { id: ["=", creativeId] } });
  const creative = res.length > 0 ? res[0] : null;
  if (!creative) return null;
  const logs = select(TABLE_NAMES.LOGS, {});
  // ... logic ...
  return {};
}

function acceptCreative(creativeId) {
  const userEmail = Session.getActiveUser().getEmail();
  const members = select(TABLE_NAMES.MEMBERS, { where: { email: ["=", userEmail] } });
  if (members.length === 0) throw new Error('Member not found');
  const memberId = members[0].id;

  const existing = select(TABLE_NAMES.MEMBER_ASSIGNMENTS, { where: toSssqlCond({ related_table: TABLE_NAMES.CREATIVES, related_id: creativeId, member_id: memberId }) });
  if (existing.length > 0) return { success: true, message: '既に承諾済みです' };

  const newAssignment = {
    related_table: TABLE_NAMES.CREATIVES,
    related_id: creativeId,
    member_id: memberId,
    role_key: 'MEMBER' // Default role
  };
  insert(TABLE_NAMES.MEMBER_ASSIGNMENTS, newAssignment);
  return { success: true, message: '承諾しました' };
}