// ============================================
// Code.gs - メインロジックとWebアプリのエントリーポイント
// ============================================

// スプレッドシートIDを設定（★★★★★ 修正点 ★★★★★）
// データベースとして使用するスプレッドシートのIDをここに貼り付けてください
const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId(); 
console.log(`SPREADSHEET_ID: ${SPREADSHEET_ID}`);

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
  return HtmlService.createHtmlOutputFromFile('index')
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
  
  return sanitizeForClient(member); // ★ 修正
}

// ============================================
// Works関連
// ============================================

function getWorks() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('works');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0];
  const works = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const work = {};
    headers.forEach((header, index) => {
      work[header] = row[index];
    });
    // プロジェクトタイトルを取得
    work.project_title = getProjectTitle(work.project_id);
    
    // 依頼者名を取得
    work.client_name = getMemberName(work.work_client_email);
    // 担当者情報を取得
    work.assignees = getWorkAssignees(work.work_id);
    
    works.push(work);
  }
  
  return sanitizeForClient(works); // ★ 修正
}

function getWorkById(workId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('works');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return null;
  
  const headers = data[0];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[headers.indexOf('work_id')] === workId) {
      const work = {};
      headers.forEach((header, index) => {
        work[header] = row[index];
      });
      // 関連データを取得
      work.project_title = getProjectTitle(work.project_id);
      work.client_name = getMemberName(work.work_client_email);
      work.assignees = getWorkAssignees(work.work_id);
      work.tasks = getTasksByWorkId(work.work_id);
      work.apps = getWorkApps(work.work_id);
      
      return sanitizeForClient(work); // ★ 修正
    }
  }
  
  return null;
}

function createWork(workData) {
  const userEmail = Session.getActiveUser().getEmail();
  const workId = Utilities.getUuid();
  const now = new Date();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('works');
  
  // 新規フォルダを作成
  const folderId = createWorkFolder(workData.project_id, workData.work_title);
  
  // データを挿入
  sheet.appendRow([
    workId,
    workData.project_id,
    workData.work_title,
    workData.work_status_key || 'TODO',
    workData.work_type_key,
    workData.priority_key || 'MEDIUM',
    workData.due_datetime,
    workData.work_client_email,
    folderId,
    workData.work_detail_content || '',
    workData.work_detail_design || '',
    workData.work_detail_regulation || '',
    workData.work_detail_note || '',
    0, // work_delivery_count
    userEmail,
    now
  ]);
  
  // 通知メールを送信
  sendNewWorkNotification(workId);
  
  return workId;
}

function updateWork(workId, workData) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('works');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][headers.indexOf('work_id')] === workId) {
      // 更新可能なフィールドのみ更新
      Object.keys(workData).forEach(key => {
        const colIndex = headers.indexOf(key);
        if (colIndex !== -1) {
          sheet.getRange(i + 1, colIndex + 1).setValue(workData[key]);
        }
      });
      return true;
    }
  }
  
  return false;
}

// ============================================
// Projects関連
// ============================================

function getProjects() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('projects');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0];
  const projects = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const project = {};
    headers.forEach((header, index) => {
      project[header] = row[index];
    });
    // 作成者名を取得
    project.creator_name = getMemberName(project.created_by);
    
    // Work数とステータスを集計
    const workStats = getProjectWorkStats(project.project_id);
    project.works_count = workStats.count;
    project.works_status = workStats.status;
    
    projects.push(project);
  }
  
  return sanitizeForClient(projects); // ★ 修正
}

function getProjectById(projectId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('projects');
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) return null;
  
  const headers = data[0];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[headers.indexOf('project_id')] === projectId) {
      const project = {};
      headers.forEach((header, index) => {
        project[header] = row[index];
      });
      project.creator_name = getMemberName(project.created_by);
      project.works = getWorksByProjectId(project.project_id);
      
      return sanitizeForClient(project); // ★ 修正
    }
  }
  
  return null;
}

function createProject(projectTitle) {
  const userEmail = Session.getActiveUser().getEmail();
  const projectId = Utilities.getUuid();
  const now = new Date();
  
  // タイトル重複チェック
  if (isProjectTitleDuplicate(projectTitle)) {
    throw new Error('このプロジェクトタイトルは既に存在します');
  }
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('projects');
  
  sheet.appendRow([
    projectId,
    projectTitle,
    '', // project_detail
    userEmail,
    now
  ]);
  return projectId;
}

function updateProject(projectId, projectData) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('projects');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][headers.indexOf('project_id')] === projectId) {
      Object.keys(projectData).forEach(key => {
        const colIndex = headers.indexOf(key);
        if (colIndex !== -1) {
          sheet.getRange(i + 1, colIndex + 1).setValue(projectData[key]);
        }
      });
      return true;
    }
  }
  
  return false;
}

// ============================================
// Members関連
// ============================================

function getMembers() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('members');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0];
  const members = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const member = {};
    headers.forEach((header, index) => {
      member[header] = row[index];
    });
    // 担当Works数を集計
    member.assigned_works_count = countAssignedWorks(member.member_email);
    
    members.push(member);
  }
  
  return sanitizeForClient(members); // ★ 修正
}

function createMember(memberData) {
  // 権限チェック
  if (!isAdmin()) {
    throw new Error('この操作にはADMIN権限が必要です');
  }
  
  const userEmail = Session.getActiveUser().getEmail();
  const now = new Date();
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('members');
  
  sheet.appendRow([
    memberData.member_email,
    memberData.slack_member_id || '',
    memberData.member_name,
    memberData.member_team_key,
    memberData.role_key,
    memberData.member_notes || '',
    memberData.member_icon || '',
    userEmail,
    now
  ]);
  return true;
}

function updateMember(memberEmail, memberData) {
  // 権限チェック
  if (!isAdmin()) {
    throw new Error('この操作にはADMIN権限が必要です');
  }
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('members');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][headers.indexOf('member_email')] === memberEmail) {
      Object.keys(memberData).forEach(key => {
        const colIndex = headers.indexOf(key);
        if (colIndex !== -1) {
          sheet.getRange(i + 1, colIndex + 1).setValue(memberData[key]);
        }
      });
      return true;
    }
  }
  
  return false;
}

// ============================================
// Tasks関連
// ============================================

function getTasksByWorkId(workId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('tasks');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0];
  const tasks = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[headers.indexOf('work_id')] === workId) {
      const task = {};
      headers.forEach((header, index) => {
        task[header] = row[index];
      });
      task.assignee_name = getMemberName(task.assign_to);
      tasks.push(task);
    }
  }
  
  return sanitizeForClient(tasks); // ★ 修正
}

function createTask(taskData) {
  const userEmail = Session.getActiveUser().getEmail();
  const taskId = Utilities.getUuid();
  const now = new Date();
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('tasks');
  
  sheet.appendRow([
    taskId,
    taskData.work_id,
    taskData.task_title,
    taskData.task_detail || '',
    taskData.status_key || 'TODO',
    taskData.priority_key || 'MEDIUM',
    taskData.assign_to || '',
    taskData.planned_start_datetime || '',
    taskData.planned_end_datetime || '',
    '', // actual_start_datetime
    '', // actual_end_datetime
    userEmail,
    now
  ]);
  return taskId;
}

function updateTask(taskId, taskData) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('tasks');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][headers.indexOf('task_id')] === taskId) {
      Object.keys(taskData).forEach(key => {
        const colIndex = headers.indexOf(key);
        if (colIndex !== -1) {
          sheet.getRange(i + 1, colIndex + 1).setValue(taskData[key]);
        }
      });
      return true;
    }
  }
  
  return false;
}

// ============================================
// Knowledge関連
// ============================================

function getKnowledge() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('knowledge');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0];
  const knowledge = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const item = {};
    headers.forEach((header, index) => {
      item[header] = row[index];
    });
    item.creator_name = getMemberName(item.created_by);
    item.work_title = getWorkTitle(item.work_id);
    
    knowledge.push(item);
  }
  
  // created_atの降順でソート
  knowledge.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  return sanitizeForClient(knowledge); // ★ 修正
}

function createKnowledge(knowledgeData) {
  const userEmail = Session.getActiveUser().getEmail();
  const knowledgeId = Utilities.getUuid();
  const now = new Date();
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('knowledge');
  
  sheet.appendRow([
    knowledgeId,
    knowledgeData.work_id,
    knowledgeData.knowledge_type_key,
    knowledgeData.knowledge_content,
    userEmail,
    now
  ]);
  return knowledgeId;
}

// ============================================
// Config関連
// ============================================

function getConfig(configType) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('config');
  if (!sheet) {
    Logger.log('configシートが見つかりません');
    return [];
  }
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0];
  const configs = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    // configTypeが指定されている場合はフィルタリング
    if (configType && row[headers.indexOf('config_type')] !== configType) {
      continue;
    }
    
    const config = {};
    headers.forEach((header, index) => {
      config[header] = row[index];
    });
    
    // is_activeがtrueのもののみ追加
    if (config.is_active === true || config.is_active === 'TRUE' || config.is_active === 'true') {
      configs.push(config);
    }
  }
  
  // sort_orderでソート
  configs.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  
  return sanitizeForClient(configs); // ★ 修正
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
  
  return sanitizeForClient(data); // ★ 修正
}

// ============================================
// Home用データ
// ============================================

function getHomeData() {
  const userEmail = Session.getActiveUser().getEmail();
  const member = getMemberByEmail(userEmail);
  
  if (!member) {
    return sanitizeForClient({ // ★ 修正
      greeting: 'こんにちは',
      memberName: 'ゲスト',
      works: []
    });
  }
  
  // ユーザーが担当していて、かつステータスがCREATEのworksを取得
  const assignedWorks = getAssignedWorksInProgress(userEmail);
  
  const hour = new Date().getHours();
  let greeting = 'こんにちは';
  if (hour < 11) greeting = 'おはようございます';
  else if (hour >= 18) greeting = 'こんばんは';
  
  return sanitizeForClient({ // ★ 修正
    greeting: greeting,
    memberName: member.member_name,
    works: assignedWorks || []
  });
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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('projects');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][headers.indexOf('project_id')] === projectId) {
      return data[i][headers.indexOf('project_title')];
    }
  }
  
  return '';
}

function isProjectTitleDuplicate(projectTitle) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('projects');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const titleIndex = headers.indexOf('project_title');
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][titleIndex] === projectTitle) {
      return true;
    }
  }
  
  return false;
}

function getProjectWorkStats(projectId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('works');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  let count = 0;
  const statusCounts = {};
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][headers.indexOf('project_id')] === projectId) {
      count++;
      const status = data[i][headers.indexOf('work_status_key')];
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    }
  }
  
  return {
    count: count,
    status: statusCounts
  };
}

function getWorksByProjectId(projectId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('works');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const works = [];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][headers.indexOf('project_id')] === projectId) {
      const work = {};
      headers.forEach((header, index) => {
        work[header] = data[i][index];
      });
      works.push(work);
    }
  }
  
  return works;
}

// ============================================
// ヘルパー関数: Member関連
// ============================================

function getMemberByEmail(email) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('members');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][headers.indexOf('member_email')] === email) {
      const member = {};
      headers.forEach((header, index) => {
        member[header] = data[i][index];
      });
      return member;
    }
  }
  
  return null;
}

function getMemberName(email) {
  if (!email) return '';
  const member = getMemberByEmail(email);
  return member ? member.member_name : '';
}

function countAssignedWorks(memberEmail) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('work_assignments');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  let count = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i][headers.indexOf('member_email')] === memberEmail) {
      count++;
    }
  }
  
  return count;
}

// ============================================
// ヘルパー関数: Work関連
// ============================================

function getWorkTitle(workId) {
  if (!workId) return '';
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('works');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][headers.indexOf('work_id')] === workId) {
      return data[i][headers.indexOf('work_title')];
    }
  }
  
  return '';
}

function getWorkAssignees(workId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('work_assignments');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const assignees = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][headers.indexOf('work_id')] === workId) {
      const memberEmail = data[i][headers.indexOf('member_email')];
      const member = getMemberByEmail(memberEmail);
      if (member) {
        assignees.push(member);
      }
    }
  }
  
  return assignees;
}

function addWorkAssignee(workId, memberEmail) {
  const userEmail = Session.getActiveUser().getEmail();
  const assignmentId = Utilities.getUuid();
  const now = new Date();
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('work_assignments');
  
  sheet.appendRow([
    assignmentId,
    workId,
    memberEmail,
    userEmail,
    now
  ]);
  return true;
}

function removeWorkAssignee(workId, memberEmail) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('work_assignments');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][headers.indexOf('work_id')] === workId && 
        data[i][headers.indexOf('member_email')] === memberEmail) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  
  return false;
}

function getWorkApps(workId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('app_assignments');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const apps = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][headers.indexOf('work_id')] === workId) {
      const appKey = data[i][headers.indexOf('work_apps_key')];
      const appConfig = getConfigValue(appKey, 'APP');
      apps.push({
        key: appKey,
        value: appConfig
      });
    }
  }
  
  return apps;
}

function addWorkApp(workId, appKey) {
  const userEmail = Session.getActiveUser().getEmail();
  const assignmentId = Utilities.getUuid();
  const now = new Date();
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('app_assignments');
  
  sheet.appendRow([
    assignmentId,
    workId,
    appKey,
    userEmail,
    now
  ]);
  return true;
}

function removeWorkApp(workId, appKey) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('app_assignments');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][headers.indexOf('work_id')] === workId && 
        data[i][headers.indexOf('work_apps_key')] === appKey) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  
  return false;
}

function createWorkFolder(projectId, workTitle) {
  try {
    // 親フォルダIDをconfigから取得
    const parentFolderId = getConfigValue('WORK_FOLDER_PARENT', 'FOLDER');
    if (!parentFolderId) {
      Logger.log('親フォルダIDが設定されていません');
      return '';
    }
    
    const parentFolder = DriveApp.getFolderById(parentFolderId);
    const projectTitle = getProjectTitle(projectId);
    const folderName = `${projectTitle}_${workTitle}`;
    
    const newFolder = parentFolder.createFolder(folderName);
    return newFolder.getId();
  } catch (e) {
    Logger.log('フォルダ作成エラー: ' + e.message);
    return '';
  }
}

function getAssignedWorksInProgress(memberEmail) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const assignSheet = ss.getSheetByName('work_assignments');
    if (!assignSheet) {
      Logger.log('work_assignmentsシートが見つかりません');
      return [];
    }
    
    const assignData = assignSheet.getDataRange().getValues();
    
    if (assignData.length <= 1) return [];
    
    const assignHeaders = assignData[0];
    
    const workIds = [];
    for (let i = 1; i < assignData.length; i++) {
      if (assignData[i][assignHeaders.indexOf('member_email')] === memberEmail) {
        workIds.push(assignData[i][assignHeaders.indexOf('work_id')]);
      }
    }
    
    if (workIds.length === 0) return [];
    
    const workSheet = ss.getSheetByName('works');
    
    if (!workSheet) {
      Logger.log('worksシートが見つかりません');
      return [];
    }
    
    const workData = workSheet.getDataRange().getValues();
    
    if (workData.length <= 1) return [];
    
    const workHeaders = workData[0];
    
    const works = [];
    for (let i = 1; i < workData.length; i++) {
      const workId = workData[i][workHeaders.indexOf('work_id')];
      const status = workData[i][workHeaders.indexOf('work_status_key')];
      
      if (workIds.includes(workId) && status === 'CREATE') {
        const work = {};
        workHeaders.forEach((header, index) => {
          work[header] = workData[i][index];
        });
        work.project_title = getProjectTitle(work.project_id);
        works.push(work);
      }
    }
    
    return works;
  } catch (e) {
    Logger.log('getAssignedWorksInProgressエラー: ' + e.message);
    return [];
  }
}

// ============================================
// ヘルパー関数: Config関連
// ============================================

function getConfigValue(configKey, configType) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('config');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][headers.indexOf('config_key')] === configKey && 
        data[i][headers.indexOf('config_type')] === configType) {
      return data[i][headers.indexOf('config_value')];
    }
  }
  
  return '';
}

function getConfigPresetValue(workTypeKey) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('config');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][headers.indexOf('config_key')] === workTypeKey && 
        data[i][headers.indexOf('config_type')] === 'WORK_TYPE') {
      return data[i][headers.indexOf('config_preset_value')] || '';
    }
  }
  
  return '';
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
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('works');
    
    if (!sheet) {
      Logger.log('worksシートが見つかりません');
      return {};
    }
    
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) return {};
    
    const headers = data[0];
    const stats = {};
    
    for (let i = 1; i < data.length; i++) {
      const status = data[i][headers.indexOf('work_status_key')];
      
      // 納品済み(DELIVERED)を除く
      if (status && status !== 'DELIVERED') {
        stats[status] = (stats[status] || 0) + 1;
      }
    }
    
    return stats;
  } catch (e) {
    Logger.log('getWorkStatusStatsエラー: ' + e.message);
    return {};
  }
}

function getAssigneeStats() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('work_assignments');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const stats = {};
  
  for (let i = 1; i < data.length; i++) {
    const email = data[i][headers.indexOf('member_email')];
    const name = getMemberName(email);
    stats[name] = (stats[name] || 0) + 1;
  }
  
  return stats;
}

function getWorkTypeStats() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('works');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const stats = {};
  
  for (let i = 1; i < data.length; i++) {
    const typeKey = data[i][headers.indexOf('work_type_key')];
    const typeValue = getConfigValue(typeKey, 'WORK_TYPE');
    stats[typeValue || typeKey] = (stats[typeValue || typeKey] || 0) + 1;
  }
  
  return stats;
}

function getMonthlyStats() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('works');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const stats = {};
  for (let i = 1; i < data.length; i++) {
    const createdAt = new Date(data[i][headers.indexOf('created_at')]);
    const monthKey = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
    stats[monthKey] = (stats[monthKey] || 0) + 1;
  }
  
  // 月順にソート
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
  
  if (!member) return sanitizeForClient('NONE'); // ★ 修正
  
  return sanitizeForClient(member.role_key); // ★ 修正
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
