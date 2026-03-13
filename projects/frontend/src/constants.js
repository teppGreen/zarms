// ============================================
// constants.gs - 定数管理
// ============================================

const scriptProperties = PropertiesService.getScriptProperties();

const TABLE_NAMES = {
  LOGS: 'logs',
  BOARDS: 'boards',
  COMMENTS: 'comments',
  DIRECTORIES: 'directories',
  APPS: 'apps',
  LINKS: 'links',
  MEMBERS: 'members',
  PLAN_ASSIGNMENTS: 'plan_assignments',
  DIRECTORY_ASSIGNMENTS: 'directory_assignments',
  TASKS: 'tasks',
  LISTS: 'lists',
  FILES: 'files',
  SYSTEM_UPDATES: 'system_updates',
  QUESTIONS: 'questions',
  PLANS: 'plans',
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

// ============================================
// 再試行設定とUI設定
// ============================================

/**
 * 再試行設定
 */
const RETRY_CONFIG = {
  DELAY_MS: 10000,        // 再試行までの待機時間（ミリ秒）
  PROGRESS_INTERVAL_MS: 100, // 進捗更新間隔（ミリ秒）
  MAX_RETRIES: 3          // 最大再試行回数
};

/**
 * UI設定
 */
const UI_CONFIG = {
  SNACKBAR_DURATION: 3000,  // スナックバー表示時間（ミリ秒）
  MODAL_FOCUS_DELAY: 50,     // モーダルフォーカスの再試行間隔（ミリ秒）
  MODAL_FOCUS_MAX_RETRIES: 10 // モーダルフォーカスの最大再試行回数
};

// ============================================
// 外部URL設定とイベント設定
// ============================================

/**
 * 外部URL設定
 */
const EXTERNAL_URLS = {
  ADD_CALENDAR: scriptProperties.getProperty('EXTERNAL_URLS.ADD_CALENDAR'),
  CALENDAR: scriptProperties.getProperty('EXTERNAL_URLS.CALENDAR'),
  MEMBER_SPREADSHEET: scriptProperties.getProperty('EXTERNAL_URLS.MEMBER_SPREADSHEET'),
  CONTACT_FORM: scriptProperties.getProperty('EXTERNAL_URLS.CONTACT_FORM'),
  LOGO_IMAGE: scriptProperties.getProperty('EXTERNAL_URLS.LOGO_IMAGE'),
  FAVICON_IMAGE: scriptProperties.getProperty('EXTERNAL_URLS.FAVICON_IMAGE'),
  PORTAL_SITE: (scriptProperties.getProperty('EXTERNAL_URLS.PORTAL_SITE') || '').replace(/\/$/, ''),
  GEMINI_GEMS_TASK_ADD: scriptProperties.getProperty('EXTERNAL_URLS.GEMINI_GEMS_TASK_ADD'),
  ZARMS_WEB: scriptProperties.getProperty('EXTERNAL_URLS.ZARMS_WEB'),
  MASCOT_MAIN_IMAGE: scriptProperties.getProperty('EXTERNAL_URLS.MASCOT_MAIN_IMAGE'),
};

/**
 * イベント設定
 */
const EVENT_CONFIG = {
  FESTIVAL_DATE: '2026-04-24', // リアル会場0日目（準備日）
  TEMPORARILY_MAINTENANCE: false,
  MAINTENANCE_HOURS: {
    START: 2,  // JST 2:00
    END: 5     // JST 5:00
  }
};

/**
 * 認証設定
 */
const AUTH_CONFIG = {
  ALLOWED_DOMAINS: ['student.zen.ac.jp', 'zen.ac.jp'],
  SLACK_DOMAIN: 'zen-student.slack.com'
};

/**
 * UI表示テキスト
 */
const UI_TEXT = {
  APP_TITLE: 'ZARMS',
  APP_COPYRIGHT: '© 2026 展軸祭実行委員会',
  APP_DESCRIPTION: '展軸祭実行委員会の業務システム「ZARMS」へようこそ！',
  SYSTEM_DESCRIPTION: 'ZARMS（ザームス）は、展軸祭実行委員会の業務を効率化するためのタスク管理システムです。ボードごとにタスクを管理し、メンバー間での進捗共有やコメントによるコミュニケーションをサポートします。',
  LOADING_MESSAGE: 'お待ちください',
  ERROR_USER_NOT_FOUND: 'ユーザーが見つかりませんでした',
  ERROR_ACCESS_DENIED: 'アクセス権限がありません',
  SUCCESS_SAVED: '保存しました',
  SUCCESS_DELETED: '削除しました',
  SUCCESS_CREATED: '作成しました'
};