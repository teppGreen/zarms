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
  return HtmlService.createTemplateFromFile("index").evaluate()
    .setTitle('CTMS v3.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ============================================
// ユーザー情報取得
// ============================================

function getCurrentUser() {
  const userEmail = Session.getActiveUser().getEmail();
  const member = getMemberByEmail(userEmail);
  if (!member) {
    throw new Error('ユーザー情報が見つかりません');
  }
  
  return sanitizeForClient(member);
}

// ============================================
// Works関連
// ============================================

function getWorks() {
  const works = getAllData(SHEET_NAMES.WORKS);
  
  const enrichedWorks = works.map(work => {
    work.project_title = getProjectTitle(work.project_id);
    work.client_name = getMemberName(work.work_client_email);
    work.assignees = getWorkAssignees(work.work_id);
    return work;
  });

  return sanitizeForClient(enrichedWorks);
}

function getWorkById(workId) {
  const work = getDataById(SHEET_NAMES.WORKS, workId);
  if (!work) return null;

  // 関連データを取得
  work.project_title = getProjectTitle(work.project_id);
  work.client_name = getMemberName(work.work_client_email);
  work.assignees = getWorkAssignees(work.work_id);
  work.tasks = getTasksByWorkId(work.work_id);
  work.apps = getWorkApps(work.work_id);
  
  return sanitizeForClient(work);
}

function createWork(workData) {
  const userEmail = Session.getActiveUser().getEmail();
  const workId = generateNextId(SHEET_NAMES.WORKS, 'W'); // ★★★★★ 変更 ★★★★★
  const now = new Date();

  // project_id を取得または新規作成
  const projectId = getOrCreateProjectId(workData.project_title, workData.project_id);
  if (!projectId) {
    throw new Error('案件の取得または作成に失敗しました。');
  }
  const projectTitle = getProjectTitle(projectId);

  // 新規フォルダを作成
  const folderId = createWorkFolder(projectTitle, workData.work_title);

  const newWork = {
    work_id: workId,
    project_id: projectId,
    work_title: workData.work_title,
    work_status_key: 'CREATE', // 仕様書では 'CREATE' が初期ステータス
    work_type_key: workData.work_type_key,
    priority_key: workData.priority_key || 'MEDIUM',
    due_datetime: workData.due_datetime || null,
    work_client_email: workData.work_client_email || userEmail, // 依頼者が空なら作成者を入れる
    work_folder_id: folderId,
    work_detail_content: workData.work_detail_content || '',
    work_detail_design: workData.work_detail_design || '',
    work_detail_regulation: workData.work_detail_regulation || '',
    work_detail_note: workData.work_detail_note || '',
    work_delivery_count: 0,
    created_by: userEmail,
    created_at: now,
  };

  createData(SHEET_NAMES.WORKS, newWork);
  
  // 通知メールを送信
  sendNewWorkNotification(workId);
  
  return workId;
}

function updateWork(workId, workData) {
  return updateData(SHEET_NAMES.WORKS, workId, workData);
}

function updateWorkField(workId, field, value) {
  if (!canEdit()) {
    throw new Error('この操作には編集権限が必要です。');
  }
  
  const updateObject = { [field]: value };
  return updateData(SHEET_NAMES.WORKS, workId, updateObject);
}

// ============================================
// Projects関連
// ============================================

function getProjects() {
  const projects = getAllData(SHEET_NAMES.PROJECTS);
  
  const enrichedProjects = projects.map(project => {
    project.creator_name = getMemberName(project.created_by);
    const workStats = getProjectWorkStats(project.project_id);
    project.works_count = workStats.count;
    project.works_status = workStats.status;
    return project;
  });
  
  return sanitizeForClient(enrichedProjects);
}

function getProjectById(projectId) {
  const project = getDataById(SHEET_NAMES.PROJECTS, projectId);
  if (!project) return null;

  project.creator_name = getMemberName(project.created_by);
  project.works = getWorksByProjectId(project.project_id);
  
  return sanitizeForClient(project);
}

function createProject(projectTitle) {
  const userEmail = Session.getActiveUser().getEmail();
  const projectId = generateNextId(SHEET_NAMES.PROJECTS, 'P'); // ★★★★★ 変更 ★★★★★
  const now = new Date();
  
  if (isProjectTitleDuplicate(projectTitle)) {
    throw new Error('このプロジェクトタイトルは既に存在します');
  }
  
  const newProject = {
    project_id: projectId,
    project_title: projectTitle,
    project_detail: '',
    created_by: userEmail,
    created_at: now,
  };

  createData(SHEET_NAMES.PROJECTS, newProject);
  return projectId;
}

function updateProject(projectId, projectData) {
  return updateData(SHEET_NAMES.PROJECTS, projectId, projectData);
}

// ============================================
// Members関連
// ============================================

function getMembers() {
  const members = getAllData(SHEET_NAMES.MEMBERS);
  
  const enrichedMembers = members.map(member => {
    member.assigned_works_count = countAssignedWorks(member.member_email);
    return member;
  });
  
  return sanitizeForClient(enrichedMembers);
}

function getMemberByEmail(memberEmail) {
  const member = getDataById(SHEET_NAMES.MEMBERS, memberEmail);
  if (!member) return null;
  
  // 担当しているWorksを取得
  const assignments = findData(SHEET_NAMES.WORK_ASSIGNMENTS, { member_email: memberEmail });
  const workIds = assignments.map(a => a.work_id);
  const allWorks = getAllData(SHEET_NAMES.WORKS);
  member.assigned_works = allWorks.filter(work => workIds.includes(work.work_id));
  
  return sanitizeForClient(member);
}

function createMember(memberData) {
  if (!isAdmin()) {
    throw new Error('この操作にはADMIN権限が必要です');
  }
  
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

  return createData(SHEET_NAMES.MEMBERS, newMember);
}

function updateMember(memberEmail, memberData) {
  if (!isAdmin()) {
    throw new Error('この操作にはADMIN権限が必要です');
  }
  
  return updateData(SHEET_NAMES.MEMBERS, memberEmail, memberData);
}

// ============================================
// Tasks関連
// ============================================

function getTasksByWorkId(workId) {
  const tasks = findData(SHEET_NAMES.TASKS, { work_id: workId });
  
  const enrichedTasks = tasks.map(task => {
    task.assignee_name = getMemberName(task.assign_to);
    return task;
  });

  return sanitizeForClient(enrichedTasks);
}

function createTask(taskData) {
  const userEmail = Session.getActiveUser().getEmail();
  const taskId = Utilities.getUuid();
  const now = new Date();
  
  const newTask = {
    task_id: taskId,
    work_id: taskData.work_id,
    task_title: taskData.task_title,
    task_detail: taskData.task_detail || '',
    status_key: taskData.status_key || 'TODO',
    priority_key: taskData.priority_key || 'MEDIUM',
    assign_to: taskData.assign_to || '',
    planned_start_datetime: taskData.planned_start_datetime || '',
    planned_end_datetime: taskData.planned_end_datetime || '',
    actual_start_datetime: '',
    actual_end_datetime: '',
    created_by: userEmail,
    created_at: now,
  };

  createData(SHEET_NAMES.TASKS, newTask);
  return taskId;
}

function updateTask(taskId, taskData) {
  return updateData(SHEET_NAMES.TASKS, taskId, taskData);
}

// ============================================
// Knowledge関連
// ============================================

function getKnowledge() {
  const knowledge = getAllData(SHEET_NAMES.KNOWLEDGE);
  
  const enrichedKnowledge = knowledge.map(item => {
    item.creator_name = getMemberName(item.created_by);
    item.work_title = getWorkTitle(item.work_id);
    return item;
  });
  
  enrichedKnowledge.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  return sanitizeForClient(enrichedKnowledge);
}

function createKnowledge(knowledgeData) {
  const userEmail = Session.getActiveUser().getEmail();
  const knowledgeId = Utilities.getUuid();
  const now = new Date();
  
  const newKnowledge = {
    knowledge_id: knowledgeId,
    work_id: knowledgeData.work_id,
    knowledge_type_key: knowledgeData.knowledge_type_key,
    knowledge_content: knowledgeData.knowledge_content,
    created_by: userEmail,
    created_at: now,
  };

  createData(SHEET_NAMES.KNOWLEDGE, newKnowledge);
  return knowledgeId;
}

// ============================================
// Config関連
// ============================================

function getConfig(configType) {
  let configs = getAllData(SHEET_NAMES.CONFIG);

  if (configType) {
    configs = configs.filter(config => config.config_type === configType);
  }

  configs = configs.filter(config => config.is_active === true || config.is_active === 'TRUE' || config.is_active === 'true');
  
  configs.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  
  return sanitizeForClient(configs);
}

// ============================================
// Summary (統計)
// ============================================

function getSummaryData() {
  const workStatusStats = getWorkStatusStats();
  const assigneeStats = getAssigneeStats();
  const workTypeStats = getWorkTypeStats();
  const monthlyStats = getMonthlyStats();
  
  const data = {
    workStatus: workStatusStats,
    assignee: assigneeStats,
    workType: workTypeStats,
    monthly: monthlyStats
  };
  
  return sanitizeForClient(data);
}

// ============================================
// インライン編集用
// ============================================
function updateSingleField(tableName, id, field, value) {
  if (!canEdit()) {
    throw new Error('この操作には編集権限が必要です。');
  }

  const sheetNameMap = {
    'works': SHEET_NAMES.WORKS,
    'projects': SHEET_NAMES.PROJECTS,
    'members': SHEET_NAMES.MEMBERS,
  };

  const sheetName = sheetNameMap[tableName];
  if (!sheetName) {
    throw new Error(`無効なテーブル名です: ${tableName}`);
  }

  // Membersシートでrole_keyを更新する場合、ADMIN権限が必要
  if (sheetName === SHEET_NAMES.MEMBERS && field === 'role_key' && !isAdmin()) {
    throw new Error('メンバーの権限変更にはADMIN権限が必要です。');
  }

  const updateObject = { [field]: value };

  return updateData(sheetName, id, updateObject);
}

// ============================================
// Home用データ
// ============================================

function getHomeData() {
  const userEmail = Session.getActiveUser().getEmail();
  const member = getMemberByEmail(userEmail);
  
  if (!member) {
    return sanitizeForClient({
      greeting: 'こんにちは',
      memberName: 'ゲスト',
      works: []
    });
  }
  
  const assignedWorks = getAssignedWorksInProgress(userEmail);
  
  const hour = new Date().getHours();
  let greeting = 'こんにちは';
  if (hour < 11) greeting = 'おはようございます';
  else if (hour >= 18) greeting = 'こんばんは';
  
  return sanitizeForClient({
    greeting: greeting,
    memberName: member.member_name,
    works: assignedWorks || []
  });
}

// ============================================
// ★★★★★ 追加 ★★★★★
// 新しいIDを採番する
// ============================================
function generateNextId(sheetName, prefix) {
  // 同時実行によるID重複を防ぐためにロックを取得
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // 最大30秒待機

  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
    const lastRow = sheet.getLastRow();
    
    // ヘッダー行のインデックスを取得 (1行目と仮定)
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const idColumnName = ID_COLUMNS[sheetName];
    const idColumnIndex = headers.indexOf(idColumnName) + 1;

    if (idColumnIndex === 0) {
      throw new Error(`ID列 '${idColumnName}' がシート '${sheetName}' に見つかりません。`);
    }

    let nextIdNumber = 1;

    // データ行が存在する場合のみ最終IDを読み取る (lastRow > 1)
    if (lastRow > 1) {
      // 最終行のIDを取得
      const lastId = sheet.getRange(lastRow, idColumnIndex).getValue();
      if (lastId && typeof lastId === 'string' && lastId.startsWith(prefix)) {
        const lastNumber = parseInt(lastId.substring(prefix.length), 10);
        if (!isNaN(lastNumber)) {
          nextIdNumber = lastNumber + 1;
        }
      }
    }
    
    // 4桁のゼロパディング
    const nextId = prefix + String(nextIdNumber).padStart(4, '0');
    
    return nextId;

  } finally {
    // 必ずロックを解放
    lock.releaseLock();
  }
}

// ============================================
// Database.gs - データベース操作ヘルパー関数
// (以下は内部関数なので sanitizeForClient は不要)
// ============================================

// ============================================
// ヘルパー関数: Project関連
// ============================================

function getProjectTitle(projectId) {
  if (!projectId) return '';
  const project = getDataById(SHEET_NAMES.PROJECTS, projectId);
  return project ? project.project_title : '';
}

function isProjectTitleDuplicate(projectTitle) {
  const projects = findData(SHEET_NAMES.PROJECTS, { project_title: projectTitle });
  return projects.length > 0;
}

function getProjectWorkStats(projectId) {
  const works = findData(SHEET_NAMES.WORKS, { project_id: projectId });
  const statusCounts = {};
  
  works.forEach(work => {
    const status = work.work_status_key;
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  
  return {
    count: works.length,
    status: statusCounts
  };
}

function getWorksByProjectId(projectId) {
  return findData(SHEET_NAMES.WORKS, { project_id: projectId });
}

function getOrCreateProjectId(projectTitle, projectId) {
  if (projectId) {
    return projectId;
  }
  if (!projectTitle) {
    return null;
  }

  const projects = findData(SHEET_NAMES.PROJECTS, { project_title: projectTitle });
  if (projects.length > 0) {
    return projects[0].project_id;
  }

  // プロジェクトが存在しない場合は新規作成
  try {
    return createProject(projectTitle);
  } catch (e) {
    // createProject が重複エラーを投げた場合、再度検索を試みる
    if (e.message.includes('既に存在します')) {
      const projects = findData(SHEET_NAMES.PROJECTS, { project_title: projectTitle });
      if (projects.length > 0) {
        return projects[0].project_id;
      }
    }
    throw e; // その他のエラーは再スロー
  }
}

// ============================================
// ヘルパー関数: Member関連
// ============================================

function getMemberByEmail(email) {
  if (!email) return null;
  return getDataById(SHEET_NAMES.MEMBERS, email);
}

function getMemberName(email) {
  if (!email) return '';
  const member = getMemberByEmail(email);
  return member ? member.member_name : '';
}

function countAssignedWorks(memberEmail) {
  const assignments = findData(SHEET_NAMES.WORK_ASSIGNMENTS, { member_email: memberEmail });
  return assignments.length;
}

// ============================================
// ヘルパー関数: Work関連
// ============================================

function getWorkTitle(workId) {
  if (!workId) return '';
  const work = getDataById(SHEET_NAMES.WORKS, workId);
  return work ? work.work_title : '';
}

function getWorkAssignees(workId) {
  const assignments = findData(SHEET_NAMES.WORK_ASSIGNMENTS, { work_id: workId });
  const assignees = assignments.map(assignment => {
    return getMemberByEmail(assignment.member_email);
  });
  return assignees.filter(member => member !== null); // nullを除外
}

function addWorkAssignee(workId, memberEmail) {
  const userEmail = Session.getActiveUser().getEmail();
  const assignmentId = Utilities.getUuid();
  const now = new Date();
  
  const newAssignment = {
    assignment_id: assignmentId,
    work_id: workId,
    member_email: memberEmail,
    created_by: userEmail,
    created_at: now,
  };

  return createData(SHEET_NAMES.WORK_ASSIGNMENTS, newAssignment);
}

function removeWorkAssignee(workId, memberEmail) {
  return deleteData(SHEET_NAMES.WORK_ASSIGNMENTS, { work_id: workId, member_email: memberEmail });
}

function getWorkApps(workId) {
  const assignments = findData(SHEET_NAMES.APP_ASSIGNMENTS, { work_id: workId });
  const apps = assignments.map(assignment => {
    const appConfig = getConfigValue(assignment.work_apps_key, 'APP');
    return {
      key: assignment.work_apps_key,
      value: appConfig,
    };
  });
  return apps;
}

function addWorkApp(workId, appKey) {
  const userEmail = Session.getActiveUser().getEmail();
  const assignmentId = Utilities.getUuid();
  const now = new Date();
  
  const newAssignment = {
    assignment_id: assignmentId,
    work_id: workId,
    work_apps_key: appKey,
    created_by: userEmail,
    created_at: now,
  };

  return createData(SHEET_NAMES.APP_ASSIGNMENTS, newAssignment);
}

function removeWorkApp(workId, appKey) {
  return deleteData(SHEET_NAMES.APP_ASSIGNMENTS, { work_id: workId, work_apps_key: appKey });
}

function createWorkFolder(projectTitle, workTitle) {
  try {
    const parentFolderId = getConfigValue('WORK_FOLDER_PARENT', 'FOLDER');
    if (!parentFolderId) {
      Logger.log('親フォルダIDが設定されていません');
      return '';
    }
    
    const parentFolder = DriveApp.getFolderById(parentFolderId);
    const folderName = `${projectTitle}_${workTitle}`;
    
    const newFolder = parentFolder.createFolder(folderName);
    return newFolder.getId();
  } catch (e) {
    Logger.log('フォルダ作成エラー: ' + e.message);
    return '';
  }
}

function getAssignedWorksInProgress(memberEmail) {
  const assignments = findData(SHEET_NAMES.WORK_ASSIGNMENTS, { member_email: memberEmail });
  const workIds = assignments.map(a => a.work_id);
  if (workIds.length === 0) return [];

  const allWorks = getAllData(SHEET_NAMES.WORKS);
  
  const works = allWorks.filter(work => 
    workIds.includes(work.work_id) && work.work_status_key === 'CREATE'
  );

  const enrichedWorks = works.map(work => {
    work.project_title = getProjectTitle(work.project_id);
    return work;
  });

  return enrichedWorks;
}

// ============================================
// ヘルパー関数: Config関連
// ============================================

function getConfigValue(configKey, configType) {
  const configs = findData(SHEET_NAMES.CONFIG, { config_key: configKey, config_type: configType });
  return configs.length > 0 ? configs[0].config_value : '';
}

function getConfigPresetValue(workTypeKey) {
  const configs = findData(SHEET_NAMES.CONFIG, { config_key: workTypeKey, config_type: 'WORK_TYPE' });
  return configs.length > 0 ? configs[0].config_preset_value || '' : '';
}

// ============================================
// ヘルパー関数: 通知
// ============================================

function sendNewWorkNotification(workId) {
  try {
    const work = getWorkById(workId);
    const notificationEmails = getConfig('NOTIFICATION_EMAIL');
    
    if (notificationEmails.length === 0) {
      Logger.log('通知先メールアドレスが設定されていません');
      return;
    }
    
    const subject = `【新規依頼】${work.project_title} - ${work.work_title}`;
    const body = `
新規の制作依頼が登録されました。

案件: ${work.project_title}
制作: ${work.work_title}
依頼者: ${work.client_name}
納期: ${work.due_datetime}

詳細はCTMSでご確認ください。
    `.trim();
    
    notificationEmails.forEach(config => {
      GmailApp.sendEmail(config.config_value, subject, body);
    });
  } catch (e) {
    Logger.log('通知メール送信エラー: ' + e.message);
  }
}

// ============================================
// ヘルパー関数: 統計データ
// ============================================

function getWorkStatusStats() {
  const works = getAllData(SHEET_NAMES.WORKS);
  const stats = {};
  
  works.forEach(work => {
    const status = work.work_status_key;
    if (status && status !== 'DELIVERED') {
      stats[status] = (stats[status] || 0) + 1;
    }
  });
  
  return stats;
}

function getAssigneeStats() {
  const assignments = getAllData(SHEET_NAMES.WORK_ASSIGNMENTS);
  const stats = {};
  
  assignments.forEach(assignment => {
    const name = getMemberName(assignment.member_email);
    if (name) {
      stats[name] = (stats[name] || 0) + 1;
    }
  });
  
  return stats;
}

function getWorkTypeStats() {
  const works = getAllData(SHEET_NAMES.WORKS);
  const stats = {};
  
  works.forEach(work => {
    const typeKey = work.work_type_key;
    const typeValue = getConfigValue(typeKey, 'WORK_TYPE');
    const key = typeValue || typeKey;
    if (key) {
      stats[key] = (stats[key] || 0) + 1;
    }
  });
  
  return stats;
}

function getMonthlyStats() {
  const works = getAllData(SHEET_NAMES.WORKS);
  const stats = {};

  works.forEach(work => {
    if (work.created_at) {
      const createdAt = new Date(work.created_at);
      const monthKey = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
      stats[monthKey] = (stats[monthKey] || 0) + 1;
    }
  });
  
  const sortedStats = {};
  Object.keys(stats).sort().forEach(key => {
    sortedStats[key] = stats[key];
  });
  
  return sortedStats;
}

// ============================================
// Auth.gs - 認証・認可処理
// ============================================

// ユーザーが認証されているかチェック
function isAuthorizedUser(email) {
  const member = getMemberByEmail(email);
  return member !== null;
}

// 現在のユーザーがADMIN権限を持っているかチェック
function isAdmin() {
  const userEmail = Session.getActiveUser().getEmail();
  const member = getMemberByEmail(userEmail);
  
  if (!member) return false;
  return member.role_key === 'ADMIN';
}

// 現在のユーザーがEDITOR以上の権限を持っているかチェック
function canEdit() {
  const userEmail = Session.getActiveUser().getEmail();
  const member = getMemberByEmail(userEmail);
  
  if (!member) return false;
  
  return member.role_key === 'ADMIN' || member.role_key === 'EDITOR';
}

// 現在のユーザーの権限を取得
function getUserRole() {
  const userEmail = Session.getActiveUser().getEmail();
  const member = getMemberByEmail(userEmail);
  
  if (!member) return sanitizeForClient('NONE');
  
  return sanitizeForClient(member.role_key);
}

// 権限レベルを数値で取得（比較用）
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
function checkPermission(operation) {
  const userRole = getUserRole();
  const roleLevel = getRoleLevel(userRole);
  
  const permissions = {
    'view': 1,           // VIEWER以上
    'edit': 2,           // EDITOR以上
    'manage_members': 3, // ADMIN
    'delete': 3          // ADMIN
  };
  
  const requiredLevel = permissions[operation] || 0;
  
  return roleLevel >= requiredLevel;
}


// ============================================
// ★★★★★ 追加 ★★★★★
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