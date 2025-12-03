// ============================================
// constants.gs - 定数管理
// ============================================

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

const SHEET_NAMES = {
  WORKS: 'works',
  PROJECTS: 'projects',
  MEMBERS: 'members',
  TASKS: 'tasks',
  KNOWLEDGE: 'knowledge',
  CONFIG: 'config',
  WORK_ASSIGNMENTS: 'work_assignments',
  APP_ASSIGNMENTS: 'app_assignments',
  REVIEW_REQUESTS: 'review_requests',
  REVIEW_REQUEST_FILES: 'review_request_files',
  LOGS: 'logs',
};

const ID_COLUMNS = {
  [SHEET_NAMES.WORKS]: 'work_id',
  [SHEET_NAMES.PROJECTS]: 'project_id',
  [SHEET_NAMES.MEMBERS]: 'member_email',
  [SHEET_NAMES.TASKS]: 'task_id',
  [SHEET_NAMES.KNOWLEDGE]: 'knowledge_id',
  [SHEET_NAMES.WORK_ASSIGNMENTS]: 'assignment_id',
  [SHEET_NAMES.APP_ASSIGNMENTS]: 'assignment_id',
  [SHEET_NAMES.REVIEW_REQUESTS]: 'review_request_id',
  [SHEET_NAMES.REVIEW_REQUEST_FILES]: 'file_id',
};

// バックエンドのWebアプリURL (デプロイ後に書き換えてください)
const BACKEND_URL = 'YOUR_BACKEND_SCRIPT_URL_HERE';

// 固定トークン
const API_TOKEN = 'zarms-secure-token-2025';