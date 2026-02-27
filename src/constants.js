// ============================================
// constants.gs - 定数管理
// ============================================

const scriptProperties = PropertiesService.getScriptProperties();
const FAVICON_FILE_ID = scriptProperties.getProperty('FAVICON_FILE_ID');
const SPREADSHEET_ID = scriptProperties.getProperty('SPREADSHEET_ID');

const TABLE_NAMES = {
  LOGS: 'logs',
  BOARDS: 'boards',
  COMMENTS: 'comments',
  DIRECTORIES: 'directories',
  APPS: 'apps',
  LINKS: 'links',
  MEMBERS: 'members',
  MEMBER_ASSIGNMENTS: 'member_assignments',
  TASKS: 'tasks',
  LISTS: 'lists',
  FILES: 'files',
  SYSTEM_UPDATES: 'system_updates'
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
// Database Schema Headers
// ============================================

/**
 * データベーステーブルのヘッダー定義
 * database_schema.mmdから生成された定数
 * パフォーマンス向上のため、スプレッドシートへのAPIアクセスを削減
 */
const TABLE_HEADERS = {
  LOGS: ['id', 'operation_type_key', 'table_name', 'record_id', 'data', 'remark', 'created_by', 'created_at'],
  BOARDS: ['id', 'display_id', 'email', 'name', 'description', 'is_active', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  COMMENTS: ['id', 'display_id', 'content', 'mentioned_to', 'related_table', 'related_id', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  DIRECTORIES: ['id', 'display_id', 'parent_directory_id', 'directory_type_key', 'name', 'slack_channel_url', 'gfolder_id', 'is_active', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  APPS: ['id', 'name', 'url', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  MEMBERS: ['id', 'email', 'slack_profile_url', 'name', 'display_name', 'title', 'description', 'top_sns_url', 'profile_photo_file_url', 'profile_photo_url', 'is_active', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  MEMBER_ASSIGNMENTS: ['id', 'member_id', 'related_table', 'related_id', 'role', 'is_active', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  TASKS: ['id', 'display_id', 'parent_task_id', 'board_id', 'name', 'description', 'starts_at', 'ends_at', 'task_status_key', 'priority_key', 'processed_by', 'reviewed_by', 'received_by', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  LISTS: ['id', 'index', 'task_id', 'is_done', 'name', 'assign_to', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  LINKS: ['id', 'index', 'task_id', 'label', 'url', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  FILES: ['id', 'index', 'task_id', 'gfile_id', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  SYSTEM_UPDATES: ['id', 'version', 'title', 'description', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at']
};

// ============================================
// キャッシュ、再試行、UI設定
// ============================================

/**
 * キャッシュ設定
 */
const CACHE_CONFIG = {
  DEFAULT_TTL: 21600, // 6時間（秒）
  MAX_KEY_LENGTH: 250, // キャッシュキーの最大長
  PUBLIC_RANGE: {
    SCRIPT: 'script', // スクリプト全体で共有
    USER: 'user'      // ユーザーごと
  }
};

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

/**
 * 列ID定数（Excel形式）
 */
const COLUMN_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

// ============================================
// 外部URL設定とイベント設定
// ============================================

/**
 * 外部URL設定
 */
const EXTERNAL_URLS = {
  ADD_CALENDAR: "https://calendar.google.com/calendar/u/0?cid=Y182ODEyOWNkMjU3YWE4MDU4YTE3NjAwZjVlYmFlNTg1OWZlOGE3NzEwNGFlZDkxOWQyMWU1OGZjZDQ1NmQ4MTEzQGdyb3VwLmNhbGVuZGFyLmdvb2dsZS5jb20",
  CALENDAR: 'https://calendar.google.com/calendar/embed?wkst=2&ctz=Asia%2FTokyo&showPrint=0&mode=WEEK&showCalendars=0&showTitle=0&src=Y182ODEyOWNkMjU3YWE4MDU4YTE3NjAwZjVlYmFlNTg1OWZlOGE3NzEwNGFlZDkxOWQyMWU1OGZjZDQ1NmQ4MTEzQGdyb3VwLmNhbGVuZGFyLmdvb2dsZS5jb20&color=%23f09300',
  MEMBER_SPREADSHEET: 'https://docs.google.com/spreadsheets/d/1Jwq5klCWFMNqSURHk2JrbF43X4JTy5I7M5aBE3uDVNw/edit?gid=1456439787',
  CONTACT_FORM: 'https://forms.gle/afXzsGKxvm9qVG4G9',
  SOUMU_DOCUMENT: 'https://docs.google.com/document/d/1BXpWaVsyJChC-rSDgjEvH33s_5FvXiaimvHIYxBTxoY/preview?tab=t.ox00ab3wnxmq',
  LOGO_IMAGE: 'https://i.gyazo.com/5c4f146e5ec5efdf571670f6b318e309.png',
  FAVICON_IMAGE: 'https://i.gyazo.com/89db588b11cf08f2d14ee3ece99c22dd.png',
  HELP_SITE: 'https://sites.google.com/student.zen.ac.jp/zarms/help',
  TERMS_SITE: 'https://sites.google.com/student.zen.ac.jp/zarms/terms',
  GEMINI_GEMS_TASK_ADD: 'https://gemini.google.com/gem/1_GKJoSvkttvu4Nr1GnmX44OqKOZuWkwR'
};

/**
 * イベント設定
 */
const EVENT_CONFIG = {
  FESTIVAL_DATE: '2026-04-24', // リアル会場0日目（準備日）
  MAINTENANCE_HOURS: {
    START: 2,  // JST 2:00
    END: 5     // JST 5:00
  }
};

/**
 * 認証設定
 */
const AUTH_CONFIG = {
  ALLOWED_DOMAINS: ['student.zen.ac.jp', 'zen.ac.jp']
};

/**
 * UI表示テキスト
 */
const UI_TEXT = {
  APP_TITLE: 'ZARMS',
  APP_DESCRIPTION: '展軸祭実行委員会の業務システム「ZARMS」へようこそ！',
  SYSTEM_DESCRIPTION: 'ZARMS（ザームス）は、展軸祭実行委員会の業務を効率化するためのタスク管理システムです。ボードごとにタスクを管理し、メンバー間での進捗共有やコメントによるコミュニケーションをサポートします。',
  LOADING_MESSAGE: 'お待ちください',
  ERROR_USER_NOT_FOUND: 'ユーザーが見つかりませんでした',
  ERROR_ACCESS_DENIED: 'アクセス権限がありません',
  SUCCESS_SAVED: '保存しました',
  SUCCESS_DELETED: '削除しました',
  SUCCESS_CREATED: '作成しました'
};