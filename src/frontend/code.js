// ============================================
// Code.gs - メインロジックとWebアプリのエントリーポイント
// ============================================

// Webアプリのエントリーポイント
function doGet(e) {
  const userEmail = Session.getActiveUser().getEmail();

  // 認証チェック
  if (!isAuthorizedUser(userEmail)) {
    const template = HtmlService.createTemplate(
      '<h1>アクセス権限がありません</h1><p>このシステムへのアクセスが許可されていません。管理者にお問い合わせください。</p>'
    );
    return HtmlService.createHtmlOutput(template.evaluate())
      .setTitle('CTMS - アクセス拒否');
  }

  // メインUIを返す
  const template = HtmlService.createTemplateFromFile("index");
  template.templateVariables = {
    urlParam: e.parameter,
    deployedUrl: ScriptApp.getService().getUrl(),
    SHEET_NAMES: SHEET_NAMES
  };

  return template.evaluate()
    .setTitle('CTMS v3.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ============================================
// ユーザー情報取得
// ============================================

function getCurrentUser() {
  const userEmail = Session.getActiveUser().getEmail();
  const members = findData(SHEET_NAMES.MEMBERS, { email: userEmail });
  const member = members.length > 0 ? members[0] : null;
  if (!member) {
    throw new Error('ユーザー情報が見つかりません');
  }

  return sanitizeForClient(member);
}

function getUserRole() {
  const user = getCurrentUser();
  return user ? user.role_key : null;
}

function isAdmin() {
  const role = getUserRole();
  return role === 'ADMIN';
}

function isAuthorizedUser(email) {
  // 簡易的なチェック。実際にはメンバーテーブルに存在するかなどで判定
  return true;
}

function canEdit() {
  // 編集権限のチェックロジック
  return true;
}

function getConfig() {
  return getConfigLogic();
}

function getMembers() {
  return getMembersLogic();
}

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
      return getCreativesLogic();
    case SHEET_NAMES.PLANS:
      return getPlansLogic();
    case SHEET_NAMES.MEMBERS:
      return getMembersLogic();
    case SHEET_NAMES.TASKS:
      return getTasksLogic();
    case SHEET_NAMES.KNOWLEDGES:
      return getKnowledgesLogic();
    case SHEET_NAMES.CONFIG:
      return getConfigLogic();
    default:
      return getAllData(tableName);
  }
}

/**
 * ID指定でデータを取得します（必要に応じてエンリッチメントを行います）
 * @param {string} tableName - テーブル名
 * @param {string} id - ID
 * @returns {Object|null} データ
 */
function getItemById(tableName, id) {
  switch (tableName) {
    case SHEET_NAMES.CREATIVES:
      return getCreativeByIdLogic(id);
    case SHEET_NAMES.PLANS:
      return getPlanByIdLogic(id);
    case SHEET_NAMES.TASKS:
      return getTaskByIdLogic(id);
    case SHEET_NAMES.MEMBERS:
      return getMemberByIdLogic(id);
    default:
      return getDataById(tableName, id);
  }
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
      return createCreativeLogic(data);
    case SHEET_NAMES.PLANS:
      return createPlanLogic(data);
    case SHEET_NAMES.MEMBERS:
      return createMemberLogic(data);
    case SHEET_NAMES.TASKS:
      return createTaskLogic(data);
    case SHEET_NAMES.KNOWLEDGES:
      return createKnowledgeLogic(data);
    case SHEET_NAMES.MEMBER_ASSIGNMENTS:
      return addMemberAssignmentLogic(data);
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
      return updateMemberLogic(id, data);
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
function getCreativesLogic() {
  const creatives = getAllData(SHEET_NAMES.CREATIVES);
  // Enrichment is now done in frontend or here if needed.
  // For now, return raw data to let frontend handle joins, or minimal enrichment.
  return sanitizeForClient(creatives);
}

function getCreativeByIdLogic(id) {
  const creative = getDataById(SHEET_NAMES.CREATIVES, id);
  if (!creative) return null;

  // Frontend handles joins now, but we can provide some helpers if needed.
  // For compatibility with updated frontend, we return the creative object.
  // We can add 'assignees' if we want to pre-fetch.
  creative.assignees = getCreativeAssignees(creative.id);
  return sanitizeForClient(creative);
}

function createCreativeLogic(data) {
  const userEmail = Session.getActiveUser().getEmail();
  const now = new Date();

  // Project (Plan) ID handling
  let planId = data.plan_id;
  if (!planId && data.plan_title) {
    planId = getOrCreatePlanId(data.plan_title);
  }

  const newCreative = {
    // id: generated by backend
    // display_id: generated by backend
    plan_id: planId,
    title: data.title,
    creative_status_key: 'CREATE',
    creative_type_key: data.creative_type_key,
    priority_key: data.priority_key || 'MEDIUM',
    deadline_at: data.deadline_at || null,
    client_member_id: data.client_member_id,
    // folder_id: ...
    created_by: userEmail,
    created_at: now,
  };

  const created = createData(SHEET_NAMES.CREATIVES, newCreative);
  // sendNewWorkNotification(created.id);
  return created;
}

// --- Projects ---
// --- Plans ---
function getPlansLogic() {
  const plans = getAllData(SHEET_NAMES.PLANS);
  return sanitizeForClient(plans.map(plan => {
    // plan.created_by_name = getMemberName(plan.created_by); // created_by is now member ID
    // const creativeStats = getPlanCreativeStats(plan.id);
    // plan.creatives_count = creativeStats.count;
    // plan.creatives_status = creativeStats.status;
    return plan;
  }));
}

function getPlanByIdLogic(id) {
  const plan = getDataById(SHEET_NAMES.PLANS, id);
  if (!plan) return null;
  // plan.creator_name = getMemberName(plan.created_by);
  plan.creatives = getCreativesByPlanId(plan.id);
  return sanitizeForClient(plan);
}

function createPlanLogic(data) {
  const planTitle = data.title || data; // Handle string or object

  const userEmail = Session.getActiveUser().getEmail();
  const now = new Date();

  // Check duplicate title?
  // if (isPlanTitleDuplicate(planTitle)) ...

  const newPlan = {
    // id: generated by backend
    // display_id: generated by backend
    title: planTitle,
    description: data.description || '',
    created_by: userEmail,
    created_at: now,
  };

  const created = createData(SHEET_NAMES.PLANS, newPlan);
  return created;
}

// --- Members ---
function getMembersLogic() {
  const members = getAllData('members');
  return sanitizeForClient(members.map(member => {
    member.assigned_works_count = countAssignedWorks(member.member_email);
    return member;
  }));
}

function getMemberByIdLogic(id) {
  const member = getDataById(SHEET_NAMES.MEMBERS, id);
  if (!member) return null;
  // const assignments = findData(SHEET_NAMES.MEMBER_ASSIGNMENTS, { member_id: id });
  // const creativeIds = assignments.map(a => a.creative_id);
  // const allCreatives = getAllData(SHEET_NAMES.CREATIVES);
  // member.assigned_creatives = allCreatives.filter(c => creativeIds.includes(c.id));
  return sanitizeForClient(member);
}

function createMemberLogic(memberData) {
  if (!isAdmin()) throw new Error('この操作にはADMIN権限が必要です');
  const userEmail = Session.getActiveUser().getEmail();
  const now = new Date();
  const newMember = {
    member_email: memberData.member_email,
    slack_member_id: memberData.slack_member_id || '',
    member_name: memberData.member_name,
    member_team_key: memberData.member_team_key,
    role_key: memberData.role_key,
    member_notes: memberData.member_notes || '',
    member_icon: memberData.member_icon || '',
    created_by: userEmail,
    created_at: now,
  };
  return createData('members', newMember);
}

function updateMemberLogic(memberEmail, memberData) {
  if (!isAdmin()) throw new Error('この操作にはADMIN権限が必要です');
  return updateData('members', memberEmail, memberData);
}

// --- Tasks ---
function getTasksLogic() {
  const tasks = getAllData(SHEET_NAMES.TASKS);
  return sanitizeForClient(tasks.map(task => {
    // task.assignee_name = getMemberName(task.assign_to);
    // task.creative_title = getCreativeTitle(task.creative_id);
    // const creative = getDataById(SHEET_NAMES.CREATIVES, task.creative_id);
    // if (creative) {
    //   task.plan_id = creative.plan_id;
    //   task.plan_title = getPlanTitle(creative.plan_id);
    // }
    return task;
  }));
}

function getTaskByIdLogic(taskId) {
  const task = getDataById(SHEET_NAMES.TASKS, taskId);
  return task ? sanitizeForClient(task) : null;
}

function createTaskLogic(taskData) {
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
function getKnowledgesLogic() {
  const knowledges = getAllData(SHEET_NAMES.KNOWLEDGES);
  // const enriched = knowledges.map(item => {
  //   const creator = getItemById(SHEET_NAMES.MEMBERS, item.created_by);
  //   item.creator_name = creator ? creator.member_name : '';
  //   item.creator_icon = creator ? creator.member_icon : '';
  //   item.creative_title = getCreativeTitle(item.creative_id);
  //   return item;
  // });
  // enriched.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return sanitizeForClient(knowledges);
}

function createKnowledgeLogic(knowledgeData) {
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

// --- Config ---
function getConfigLogic() {
  let configs = getAllData(SHEET_NAMES.CONFIG);
  configs = configs.filter(config => config.is_active === true || config.is_active === 'TRUE' || config.is_active === 'true');
  configs.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  return sanitizeForClient(configs);
}

// --- Assignments ---
function addMemberAssignmentLogic(data) {
  const userEmail = Session.getActiveUser().getEmail();
  const now = new Date();
  const newAssignment = {
    // id: generated by backend
    creative_id: data.creative_id,
    member_id: data.member_id, // Changed from member_email
    role_key: data.role_key || 'MEMBER',
    created_by: userEmail,
    created_at: now,
  };
  return createData(SHEET_NAMES.MEMBER_ASSIGNMENTS, newAssignment);
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
  return member ? (member.nickname || member.member_name) : '';
}

function getCreativeTitle(id) {
  if (!id) return '';
  const creative = getDataById(SHEET_NAMES.CREATIVES, id);
  return creative ? creative.title : '';
}

function getCreativeAssignees(creativeId) {
  const assignments = findData(SHEET_NAMES.MEMBER_ASSIGNMENTS, { creative_id: creativeId });
  const assignees = assignments.map(assignment => getDataById(SHEET_NAMES.MEMBERS, assignment.member_id));
  return assignees.filter(member => member !== null);
}

function getCreativesByPlanId(planId) {
  const creatives = findData(SHEET_NAMES.CREATIVES, { plan_id: planId });
  return creatives;
}

function getTasksByWorkId(workId) {
  const tasks = findData('tasks', { work_id: workId });
  return sanitizeForClient(tasks.map(task => {
    task.assignee_name = getMemberName(task.assign_to);
    return task;
  }));
}

function getWorkApps(workId) {
  const assignments = findData('app_assignments', { work_id: workId });
  return assignments.map(assignment => {
    const appConfig = getConfigValue(assignment.work_apps_key, 'APP');
    return { key: assignment.work_apps_key, value: appConfig };
  });
}

function getReviewRequestsByWorkId(workId) {
  // Assuming review requests logic is similar
  return findData('review_requests', { work_id: workId });
}

function getConfigValue(key, type) {
  // Simplified config lookup
  const configs = getItems(SHEET_NAMES.CONFIG);
  const config = configs.find(c => c.config_key === key && c.config_type === type);
  return config ? config.config_value : key;
}

function isProjectTitleDuplicate(projectTitle) {
  const projects = findData('projects', { project_title: projectTitle });
  return projects.length > 0;
}

function getProjectWorkStats(projectId) {
  const works = findData('works', { project_id: projectId });
  const statusCounts = {};
  works.forEach(work => {
    const status = work.work_status_key;
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  return { count: works.length, status: statusCounts };
}

function getWorksByProjectId(projectId) {
  return findData('works', { project_id: projectId });
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

function countAssignedWorks(memberEmail) {
  const assignments = findData('work_assignments', { member_email: memberEmail });
  return assignments.length;
}

// ============================================
// Other Specific Functions (kept as is or refactored)
// ============================================

function getHomeData() {
  const userEmail = Session.getActiveUser().getEmail();
  const members = findData(SHEET_NAMES.MEMBERS, { email: userEmail });
  const member = members.length > 0 ? members[0] : null;

  if (!member) {
    return sanitizeForClient({
      greeting: 'こんにちは',
      memberName: 'ゲスト',
      new_requests: [],
      works: [],
      review_requests: [],
      knowledge: []
    });
  }

  const newRequests = getAvailableCreatives(member.id);
  const assignedWorks = getAssignedCreatives(member.id);
  const knowledge = getAllData(SHEET_NAMES.KNOWLEDGES);

  const hour = new Date().getHours();
  let greeting = 'こんにちは';
  if (hour < 11) greeting = 'おはようございます';
  else if (hour >= 18) greeting = 'こんばんは';

  return sanitizeForClient({
    greeting: greeting,
    memberName: member.nickname || member.member_name,
    new_requests: newRequests || [],
    works: assignedWorks || [],
    review_requests: [],
    knowledge: knowledge || []
  });
}

function getAvailableCreatives(memberId) {
  const creatives = getAllData(SHEET_NAMES.CREATIVES);
  return creatives.filter(c => c.creative_status_key === 'CREATE');
}

function getAssignedCreatives(memberId) {
  const assignments = findData(SHEET_NAMES.MEMBER_ASSIGNMENTS, { member_id: memberId });
  const creativeIds = assignments.map(a => a.creative_id);
  const allCreatives = getAllData(SHEET_NAMES.CREATIVES);
  return allCreatives.filter(c => creativeIds.includes(c.id));
}

// Removed legacy functions: getAvailableWorks, getAssignedWorksWithTasks, getReviewRequestsForUser

function updateSingleField(tableName, id, field, value) {
  if (!canEdit()) throw new Error('この操作には編集権限が必要です。');
  if (tableName === 'members' && field === 'role_key' && !isAdmin()) {
    throw new Error('メンバーの権限変更にはADMIN権限が必要です。');
  }
  const updateObject = { [field]: value };
  return updateItem(tableName, id, updateObject);
}

function sendNewWorkNotification(workId) {
  // Placeholder
}

function createWorkFolder(workId, workTitle) {
  // Placeholder
  return 'folder_id_placeholder';
}

function createWorkDocument(workId, workTitle, content, design, regulation, note, folderId) {
  // Placeholder
  return { documentId: 'doc_id', tabId: 'tab_id' };
}

function getWorkflowTimestamps(workId) {
  // Keep as is, but use string literals
  const work = getDataById('works', workId);
  if (!work) return null;
  const logs = getAllData('logs');
  // ... logic ...
  return {};
}

function acceptWork(workId) {
  const userEmail = Session.getActiveUser().getEmail();
  const existing = findData('work_assignments', { work_id: workId, member_email: userEmail });
  if (existing.length > 0) return { success: true, message: '既に承諾済みです' };
  createItem('work_assignments', { work_id: workId, member_email: userEmail });
  return { success: true, message: '承諾しました' };
}

function getSummaryData() {
  // Placeholder
  return {};
}

// --- Review Requests ---
function createReviewRequestLogic(data) {
  const userEmail = Session.getActiveUser().getEmail();
  const id = Utilities.getUuid();
  const now = new Date();
  const newItem = {
    review_request_id: id,
    work_id: data.work_id,
    review_title: data.review_title,
    review_comment: data.review_comment,
    created_by: userEmail,
    created_at: now,
    files: (data.file_ids || []).map(fid => ({ file_id: fid }))
  };
  createData('review_requests', newItem);
  return id;
}

function getReviewRequestByIdLogic(id) {
  return getDataById('review_requests', id);
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

function uploadFileToWorkFolder(workId, base64Data, fileName, mimeType) {
  const work = getItemById('works', workId);
  if (!work || !work.work_folder_id) throw new Error('Work folder not found');
  const folder = DriveApp.getFolderById(work.work_folder_id);
  const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, fileName);
  const file = folder.createFile(blob);
  return {
    file_id: file.getId(),
    file_name: file.getName(),
    file_url: file.getUrl()
  };
}

function createGithubIssue(issueData) {
  // Placeholder for GitHub Issue creation
  // In a real implementation, this would call GitHub API
  console.log('Creating GitHub Issue:', issueData);
  return { number: 999, url: 'https://github.com/example/repo/issues/999' };
}

// ============================================
// ヘルパー関数: JSONシリアライズ対策
// (Dateオブジェクトを自動的にISO文字列に変換する)
// ============================================
function sanitizeForClient(data) {
  if (data === null || data === undefined) {
    return data;
  }

  // Dateオブジェクトの場合
  if (data instanceof Date) {
    return data.toISOString();
  }

  // 配列の場合は、各要素を再帰的に処理
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForClient(item));
  }

  // プレーンなオブジェクトの場合は、各プロパティを再帰的に処理
  if (typeof data === 'object' && data.constructor === Object) {
    const sanitized = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        sanitized[key] = sanitizeForClient(data[key]);
      }
    }
    return sanitized;
  }

  // それ以外（文字列、数値、ブール値）はそのまま返す
  return data;
}