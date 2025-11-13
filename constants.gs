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
};

const ID_COLUMNS = {
  [SHEET_NAMES.WORKS]: 'work_id',
  [SHEET_NAMES.PROJECTS]: 'project_id',
  [SHEET_NAMES.MEMBERS]: 'member_email',
  [SHEET_NAMES.TASKS]: 'task_id',
  [SHEET_NAMES.KNOWLEDGE]: 'knowledge_id',
  [SHEET_NAMES.WORK_ASSIGNMENTS]: 'assignment_id',
  [SHEET_NAMES.APP_ASSIGNMENTS]: 'assignment_id',
};
