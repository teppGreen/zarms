// ============================================
// constants.gs - 定数管理
// ============================================

const scriptProperties = PropertiesService.getScriptProperties();
const FAVICON_FILE_ID = scriptProperties.getProperty('FAVICON_FILE_ID');
let SPREADSHEET_ID;
if (isDevelopment()) {
  SPREADSHEET_ID = scriptProperties.getProperty('DEV_SPREADSHEET_ID');
} else {
  SPREADSHEET_ID = scriptProperties.getProperty('SPREADSHEET_ID');
}

const TABLE_NAMES = {
  LOGS: 'logs',
  BOARDS: 'boards',
  COMMENTS: 'comments',
  DIRECTORIES: 'directories',
  APPS: 'apps',
  LINKS: 'links',
  MEMBERS: 'members',
  MEMBER_DIRECTORY_ASSIGNMENTS: 'member_directory_assignments',
  TASKS: 'tasks',
};

const DIRECTORY_TYPES = {
  COMPANY: '法人・学校・団体',
  FACULTY: '学部・学科・専攻',
  COMMITTEE: '委員会',
  TEMPORARY: '企画出展専用',
  PROJECT: 'プロジェクト',
  GROUP: 'グループ',
  UNIT: 'ユニット',
  SECTION: 'セクション',
  TEAM: 'チーム',
  CIRCLE: 'サークル',
  CLUB: 'クラブ',
  OTHER: 'その他'
};

const TASK_STATUS = {
  TODO: '未着手',
  IN_PROGRESS: '進行中',
  IN_REVIEW: '確認中',
  DONE: '完了'
};