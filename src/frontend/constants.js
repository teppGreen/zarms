// ============================================
// constants.gs - 定数管理
// ============================================

const scriptProperties = PropertiesService.getScriptProperties();

// バックエンドのWebアプリURL (デプロイ後に書き換えてください)
const BACKEND_URL = scriptProperties.getProperty('BACKEND_URL');

// 固定トークン
const API_TOKEN = scriptProperties.getProperty('API_TOKEN');

// シート名（テーブル名）の定義
const SHEET_NAMES = {
  CONFIG: 'CONFIG',
  ENUMS: 'ENUMS',
  LOGS: 'logs',
  ASSIGNMENTS: 'assignments',
  ADVERTISEMENTS: 'advertisements',
  ATTENDANCES: 'attendances',
  BUDGETS: 'budgets',
  CREATIVES: 'creatives',
  DIRECTORIES: 'directories',
  EVENTS: 'events',
  EXPENSES: 'expenses',
  FORMS: 'forms',
  HARDWARES: 'hardwares',
  JOBS: 'jobs',
  KNOWLEDGES: 'knowledges',
  LICENSES: 'licenses',
  MEDIUMS: 'mediums',
  MEMBERS: 'members',
  MEMBER_ASSIGNMENTS: 'member_assignments',
  MERCHANDISES: 'merchandises',
  MUSICS: 'musics',
  NOTES: 'notes',
  PLANS: 'plans',
  QUESTIONS: 'questions',
  RESOURCES: 'resources',
  SHIFTS: 'shifts',
  SKILLS: 'skills',
  TASKS: 'tasks',
  TIMETRACKS: 'timetracks',
  WIKIS: 'wikis',
  PREFIX: 'PREFIX'
};

// IDカラム名の定義
const ID_COLUMNS = {
  [SHEET_NAMES.CONFIG]: 'id',
  [SHEET_NAMES.ENUM]: 'key',
  [SHEET_NAMES.LOGS]: 'id',
  [SHEET_NAMES.ASSIGNMENTS]: 'id',
  [SHEET_NAMES.ADVERTISEMENTS]: 'id',
  [SHEET_NAMES.ATTENDANCES]: 'id',
  [SHEET_NAMES.BUDGETS]: 'id',
  [SHEET_NAMES.CREATIVES]: 'id',
  [SHEET_NAMES.DIRECTORIES]: 'id',
  [SHEET_NAMES.EVENTS]: 'id',
  [SHEET_NAMES.EXPENSES]: 'id',
  [SHEET_NAMES.FORMS]: 'id',
  [SHEET_NAMES.HARDWARES]: 'id',
  [SHEET_NAMES.JOBS]: 'id',
  [SHEET_NAMES.KNOWLEDGES]: 'id',
  [SHEET_NAMES.LICENSES]: 'id',
  [SHEET_NAMES.MEDIUMS]: 'id',
  [SHEET_NAMES.MEMBERS]: 'email',
  [SHEET_NAMES.MEMBER_ASSIGNMENTS]: 'id',
  [SHEET_NAMES.MERCHANDISES]: 'id',
  [SHEET_NAMES.MUSICS]: 'id',
  [SHEET_NAMES.NOTES]: 'id',
  [SHEET_NAMES.PLANS]: 'id',
  [SHEET_NAMES.QUESTIONS]: 'id',
  [SHEET_NAMES.RESOURCES]: 'id',
  [SHEET_NAMES.SHIFTS]: 'id',
  [SHEET_NAMES.SKILLS]: 'id',
  [SHEET_NAMES.TASKS]: 'id',
  [SHEET_NAMES.TIMETRACKS]: 'id',
  [SHEET_NAMES.WIKIS]: 'id'
};