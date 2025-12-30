// ============================================
// constants.gs - 定数管理
// ============================================

const scriptProperties = PropertiesService.getScriptProperties();
let SPREADSHEET_ID = scriptProperties.getProperty('SPREADSHEET_ID');
if (!SPREADSHEET_ID) {
    try {
        SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
    } catch (e) {
        console.warn('Failed to get active spreadsheet ID. Please set SPREADSHEET_ID in Script Properties.', e);
    }
}

const TABLE_NAMES = {
  LOGS: 'logs',
  BOARDS: 'boards',
  DIRECTORIES: 'directories',
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
  DRAFT: '下書き',
  TODO: '未着手',
  IN_PROGRESS: '進行中',
  IN_REVIEW: '確認中',
  DONE: '完了'
};