// ============================================
// code.gs - メインロジックとWebアプリのエントリーポイント
// ============================================

let activeUser;

// Webアプリのエントリーポイント
function doGet(e) {
  // starting.html をテンプレートとして作成
  const template = HtmlService.createTemplateFromFile('starting');
  // URLパラメータをテンプレート変数として渡す（JSON文字列化して渡すことでJS内で扱いやすくする）
  template.initialParams = JSON.stringify(e.parameter || {});

  return template.evaluate()
    .setTitle('ZARMS')
    .setFaviconUrl('https://drive.google.com/uc?id=1rnkYniTkiKnVk5jNbx7V1nRrmwP6altL' + '&.png')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width');
}

/**
 * クライアントサイドから呼ばれ、認証チェック後にメインアプリのHTMLを返す
 * @param {Object} params - URLパラメータ
 * @returns {string} HTMLコンテンツ
 */
function loadMainApplication(params) {
  // 認証チェック
  const userEmail = Session.getActiveUser().getEmail();
  activeUser = getActiveUser();
  if (!checkPermission(activeUser, 'view')) {
    const template = HtmlService.createTemplate(
      `<h1>アクセス権限がありません</h1>` +
      `<p>ZARMSへのアクセスが許可されていません。間違いだと思われる場合は、総務ユニットまでお問い合わせください。</p>` +
      `<p>ログイン中のアカウント: ${userEmail}</p>`
    );
    return template.evaluate().getContent();
  }

  // メインUIを返す
  const template = HtmlService.createTemplateFromFile("index");
  template.templateVariables = {
    urlParam: params || {},
    SHEET_NAMES: SHEET_NAMES,
    activeUser: activeUser
  };

  return template.evaluate().getContent();
}

// ============================================
// ユーザー情報取得
// ============================================

function getActiveUser() {
  const userEmail = Session.getActiveUser().getEmail();
  const members = findData(SHEET_NAMES.MEMBERS, { email: userEmail });
  return members.length > 0 ? members[0] : null;
}

// ============================================
// ユーザー認証・認可処理
// ============================================

function getRoleLevel(roleKey) {
  const roleLevels = {
    'ADMIN': 3,
    'EDITOR': 2,
    'VIEWER': 1,
    'NONE': 0
  };
  return roleLevels[roleKey] || 0;
}

// 特定の操作が許可されているかチェック
function checkPermission(member, operation) {

  const permissions = {
    'view': 1,           // VIEWER以上
    'edit': 2,           // EDITOR以上
    'delete': 3          // ADMIN
  };

  const requiredLevel = permissions[operation] || 1;
  return getRoleLevel(member.system_role_key) >= requiredLevel;
}

// ============================================
// Caching Utility
// ============================================
const CacheManager = {
  get: function (key, isPublic) {
    const cache = isPublic ? CacheService.getScriptCache() : CacheService.getUserCache();
    const cached = cache.get(key);
    if (!cached) return null;
    try {
      return JSON.parse(cached);
    } catch (e) {
      console.warn("Cache parse failed:", e);
      return null;
    }
  },
  put: function (key, value, isPublic, ttl = 21600) {
    const cache = isPublic ? CacheService.getScriptCache() : CacheService.getUserCache();
    try {
      cache.put(key, JSON.stringify(value), ttl);
    } catch (e) {
      console.warn("Cache put failed:", e);
    }
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
    case SHEET_NAMES.CREATIVES:
      return getCreatives();
    case SHEET_NAMES.PLANS:
      return getPlans();
    case SHEET_NAMES.MEMBERS:
      return getMembers();
    case SHEET_NAMES.TASKS:
      return getTasks();
    case SHEET_NAMES.KNOWLEDGES:
      return getKnowledges();
    default:
      return getAllData(tableName);
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
 * ID指定でデータを取得します（必要に応じてエンリッチメントを行います）
 * @param {string} tableName - テーブル名
 * @param {string} id - ID
 * @param {boolean} forceRefresh - キャッシュを無視するかどうか
 * @returns {Object} { data: Object, isCached: boolean }
 */
function getItemById(tableName, id, forceRefresh = false) {
  let data = null;

  switch (tableName) {
    case SHEET_NAMES.CREATIVES:
      return getCreativeById(id, forceRefresh);
    case SHEET_NAMES.PLANS:
      data = getPlanById(id);
      break;
    case SHEET_NAMES.TASKS:
      data = getTaskById(id);
      break;
    case SHEET_NAMES.MEMBERS:
      data = getMemberById(id);
      break;
    default:
      data = getDataById(tableName, id);
      break;
  }
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
    case SHEET_NAMES.CREATIVES:
      return createCreative(data);
    case SHEET_NAMES.PLANS:
      return createPlan(data);
    case SHEET_NAMES.MEMBERS:
      return createMember(data);
    case SHEET_NAMES.TASKS:
      return createTask(data);
    case SHEET_NAMES.KNOWLEDGES:
      return createKnowledge(data);
    default:
      return createData(tableName, data);
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
    case SHEET_NAMES.MEMBERS:
      return updateMember(id, data);
    default:
      return updateData(tableName, id, data);
  }
}

/**
 * データを削除します
 * @param {string} tableName - テーブル名
 * @param {Object} condition - 削除条件
 * @returns {boolean} 成功フラグ
 */
function deleteItem(tableName, condition) {
  return deleteData(tableName, condition);
}

// ============================================
// 内部ロジック (Internal Logic)
// ============================================

// --- Creatives ---
function getCreatives() {
  const creatives = getAllData(SHEET_NAMES.CREATIVES);
  // Enrichment is now done in frontend or here if needed.
  // For now, return raw data to let frontend handle joins, or minimal enrichment.
  return creatives;
}

function getCreativeById(id, forceRefresh = false) {
  const cacheKey = `creative_detail_${id}`;

  if (!forceRefresh) {
    const cached = CacheManager.get(cacheKey, true); // Public Cache
    if (cached) return { data: cached, isCached: true };
  }

  const creative = getDataById(SHEET_NAMES.CREATIVES, id);
  if (!creative) return { data: null, isCached: false };

  // Enrichment
  creative.assignees = getCreativeAssignees(creative.id);

  CacheManager.put(cacheKey, creative, true);
  return { data: creative, isCached: false };
}

function createCreative(data) {
  const userEmail = Session.getActiveUser().getEmail();
  const now = new Date();

  const newCreative = {
    // id: generated by backend
    // display_id: generated by backend
    plan_id: data.plan_id,
    advertisement_id: data.advertisement_id,
    title: data.title,
    creative_status_key: 'TODO',
    creative_type_key: data.creative_type_key,
    priority_key: data.priority_key || 'MEDIUM',
    deadline_at: data.deadline_at || null,
    document_gfile_id: data.document_gfile_id,
    document_gtab_id: data.document_gtab_id,
    client_directory_id: data.client_directory_id,
  };

  return createData(SHEET_NAMES.CREATIVES, newCreative);
}

// --- Plans ---
function getPlans() {
  const plans = getAllData(SHEET_NAMES.PLANS);
  return plans.map(plan => {
    // plan.created_by_name = getMemberName(plan.created_by); // created_by is now member ID
    // const creativeStats = getPlanCreativeStats(plan.id);
    // plan.creatives_count = creativeStats.count;
    // plan.creatives_status = creativeStats.status;
    return plan;
  });
}

function getPlanById(id) {
  const plan = getDataById(SHEET_NAMES.PLANS, id);
  if (!plan) return null;
  // plan.creator_name = getMemberName(plan.created_by);
  plan.creatives = getCreativesByPlanId(plan.id);
  return plan;
}

function createPlan(data) {
  const planTitle = data.title || data; // Handle string or object

  // Check duplicate title?
  // if (isPlanTitleDuplicate(planTitle)) ...

  const newPlan = {
    // id: generated by backend
    // display_id: generated by backend
    title: planTitle,
    description: data.description || ''
  };

  const created = createData(SHEET_NAMES.PLANS, newPlan);
  return created;
}

// --- Members ---
function getMembers() {
  return getAllData('members');
}

function getMemberById(id) {
  const member = getDataById(SHEET_NAMES.MEMBERS, id);
  if (!member) return null;
  // const assignments = findData(SHEET_NAMES.MEMBER_ASSIGNMENTS, { member_id: id });
  // const creativeIds = assignments.map(a => a.creative_id);
  // const allCreatives = getAllData(SHEET_NAMES.CREATIVES);
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
  return createData('members', newMember);
}

function updateMember(memberEmail, memberData) {
  return updateData('members', memberEmail, memberData);
}

// --- Tasks ---
function getTasks() {
  const tasks = getAllData(SHEET_NAMES.TASKS);
  return tasks.map(task => {
    task.assignee_name = getMemberName(task.assign_to);
    return task;
  });
}

function getTaskById(taskId) {
  const task = getDataById(SHEET_NAMES.TASKS, taskId);
  return task ? task : null;
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
  const created = createData(SHEET_NAMES.TASKS, newTask);
  return created;
}

// --- Knowledges ---
function getKnowledges() {
  const knowledges = getAllData(SHEET_NAMES.KNOWLEDGES);
  // const enriched = knowledges.map(item => {
  //   const creator = getItemById(SHEET_NAMES.MEMBERS, item.created_by);
  //   item.creator_name = creator ? creator.member_name : '';
  //   item.creator_icon = creator ? creator.member_icon : '';
  //   item.creative_title = getCreativeTitle(item.creative_id);
  //   return item;
  // });
  // enriched.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return knowledges;
}

function createKnowledge(knowledgeData) {
  const userEmail = Session.getActiveUser().getEmail();
  const now = new Date();
  const newKnowledge = {
    // id: generated by backend
    creative_id: knowledgeData.creative_id,
    knowledge_type_key: knowledgeData.knowledge_type_key,
    content: knowledgeData.content,
    created_by: userEmail,
    created_at: now,
  };
  const created = createData(SHEET_NAMES.KNOWLEDGES, newKnowledge);
  return created;
}

// --- Skills (Assignments) ---
function addMemberSkill(memberId, skillId) {
  const userEmail = Session.getActiveUser().getEmail();
  const now = new Date();
  const newAssignment = {
    // id: generated by backend
    member_id: memberId,
    related_table: SHEET_NAMES.SKILLS,
    related_id: skillId,
    is_active: true,
    created_by: userEmail,
    created_at: now,
  };
  return createData(SHEET_NAMES.MEMBER_ASSIGNMENTS, newAssignment);
}

function getMemberSkills(memberId) {
  const assignments = findData(SHEET_NAMES.MEMBER_ASSIGNMENTS, { member_id: memberId, related_table: SHEET_NAMES.SKILLS, is_active: true });
  const skillIds = assignments.map(a => a.related_id);
  const allSkills = getAllData(SHEET_NAMES.SKILLS);
  return allSkills.filter(s => skillIds.includes(s.id));
}

// ============================================
// Helper Functions
// ============================================

function getPlanTitle(id) {
  if (!id) return '';
  const plan = getDataById(SHEET_NAMES.PLANS, id);
  return plan ? plan.title : '';
}

function getMemberName(id) {
  if (!id) return '';
  const member = getDataById(SHEET_NAMES.MEMBERS, id);
  return member ? (member.display_name || member.member_name) : '';
}

function getCreativeTitle(id) {
  if (!id) return '';
  const creative = getDataById(SHEET_NAMES.CREATIVES, id);
  return creative ? creative.title : '';
}

function getCreativeAssignees(creativeId) {
  const assignments = findData(SHEET_NAMES.MEMBER_ASSIGNMENTS, { related_table: SHEET_NAMES.CREATIVES, related_id: creativeId });
  const assignees = assignments.map(assignment => getDataById(SHEET_NAMES.MEMBERS, assignment.member_id));
  return assignees.filter(member => member !== null);
}

function getCreativesByPlanId(planId) {
  const creatives = findData(SHEET_NAMES.CREATIVES, { plan_id: planId });
  return creatives;
}

function getTasksByCreativeId(creativeId) {
  const tasks = findData(SHEET_NAMES.TASKS, { creative_id: creativeId });
  return tasks.map(task => {
    task.assignee_name = getMemberName(task.assign_to);
    return task;
  });
}

function isProjectTitleDuplicate(projectTitle) {
  const projects = findData(SHEET_NAMES.PLANS, { title: projectTitle });
  return projects.length > 0;
}

function getProjectCreativeStats(projectId) {
  const creatives = findData(SHEET_NAMES.CREATIVES, { plan_id: projectId });
  const statusCounts = {};
  creatives.forEach(creative => {
    const status = creative.creative_status_key;
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  return { count: creatives.length, status: statusCounts };
}

function getCreativesByPlanId(planId) {
  return findData(SHEET_NAMES.CREATIVES, { plan_id: planId });
}

function getOrCreatePlanId(planTitle) {
  if (!planTitle) return null;
  const plans = findData(SHEET_NAMES.PLANS, { title: planTitle });
  if (plans.length > 0) return plans[0].id;

  try {
    const created = createItem(SHEET_NAMES.PLANS, { title: planTitle });
    return created.id || created; // Handle object or string (fallback)
  } catch (e) {
    if (e.message.includes('既に存在します')) {
      const plans = findData(SHEET_NAMES.PLANS, { title: planTitle });
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

  // フロントエンドのAPI wrapper関数を使用（callBackendAPIを呼び出す）
  const result = getFilteredData(SHEET_NAMES.CREATIVES, whereConditions, {
    orderBy: { created_at: "DESC" }
  });
  return result.slice(0, 10); // 最新10件のみ
}

/**
 * 自分に割り当てられた制作物を取得
 * @param {string} memberId - メンバーID
 * @returns {Object[]} 割り当てられた制作物
 */
function getAssignedCreatives(memberId) {
  // メンバーアサインメントをフィルタリング
  // findData は frontend/database.js で定義されている（callBackendAPIを使用）
  const assignments = findData(SHEET_NAMES.MEMBER_ASSIGNMENTS, {
    member_id: memberId,
    related_table: SHEET_NAMES.CREATIVES
  });

  if (assignments.length === 0) {
    return [];
  }

  const creativeIds = assignments.map(a => a.related_id);

  // 制作物を取得（IDリストでフィルタリング）
  // getFilteredData は frontend/database.js で定義されている（callBackendAPIを使用）
  const whereConditions = {
    id: ["IN", creativeIds]
  };

  return getFilteredData(SHEET_NAMES.CREATIVES, whereConditions);
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
  // Keep as is, but use string literals
  const creative = getDataById(SHEET_NAMES.CREATIVES, creativeId);
  if (!creative) return null;
  const logs = getAllData(SHEET_NAMES.LOGS);
  // ... logic ...
  return {};
}

function acceptCreative(creativeId) {
  const userEmail = Session.getActiveUser().getEmail();
  const members = findData(SHEET_NAMES.MEMBERS, { email: userEmail });
  if (members.length === 0) throw new Error('Member not found');
  const memberId = members[0].id;

  const existing = findData(SHEET_NAMES.MEMBER_ASSIGNMENTS, { related_table: SHEET_NAMES.CREATIVES, related_id: creativeId, member_id: memberId });
  if (existing.length > 0) return { success: true, message: '既に承諾済みです' };

  const newAssignment = {
    related_table: SHEET_NAMES.CREATIVES,
    related_id: creativeId,
    member_id: memberId,
    role_key: 'MEMBER' // Default role
  };
  createData(SHEET_NAMES.MEMBER_ASSIGNMENTS, newAssignment);
  return { success: true, message: '承諾しました' };
}

function getAnalyticsData() {
  // Placeholder
  return {};
}

// --- External Services & Utilities ---
function getOAuthToken() {
  return ScriptApp.getOAuthToken();
}

function getDriveFileInfo(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    return {
      file_id: file.getId(),
      file_name: file.getName(),
      file_url: file.getUrl()
    };
  } catch (e) {
    console.error('Drive file not found:', fileId);
    return { file_id: fileId, file_name: 'Unknown File', file_url: '#' };
  }
}

/**
 * コード（例：W0001）から対象のレコードを検索します
 * @param {string} code - 検索コード
 * @returns {Object|null} 検索結果 { item: Object, tableName: string }
 */
function searchByCode(code) {
  if (!code) return null;

  // 1. アルファベットと数字を分ける
  const match = code.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;

  const prefix = match[1];
  const serialId = parseInt(match[2], 10);

  // 2. PREFIXテーブルからテーブル名を特定
  // PREFIXテーブルの構造: id_prefix, table_name
  const prefixes = getAllData(SHEET_NAMES.PREFIX);
  const prefixRecord = prefixes.find(p => p.id_prefix === prefix);

  if (!prefixRecord) {
    return null;
  }

  const tableName = prefixRecord.table_name;

  // 3. 特定したテーブルの該当レコードを検索 (id_serial列)
  const items = findData(tableName, { id_serial: serialId });

  if (items.length === 0) {
    return null;
  }

  return {
    item: items[0],
    tableName: tableName
  };
}

/**
 * HTMLファイルの内容をインクルードするための関数
 * @param {string} filename - インクルードするファイルの拡張子を除いた名前
 * @returns {string} ファイルの内容
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getKnowledge() {
  return getAllData(SHEET_NAMES.KNOWLEDGES);
}