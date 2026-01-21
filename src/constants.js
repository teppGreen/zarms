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
  MEMBER_ASSIGNMENTS: 'member_assignments',
  TASKS: 'tasks',
  LISTS: 'lists',
  FILES: 'files'
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
  LOGS: ['log', 'operation_type_key', 'table_name', 'record_id', 'data', 'remark', 'created_by', 'created_at'],
  BOARDS: ['id', 'display_id', 'email', 'name', 'description', 'is_active', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  COMMENTS: ['id', 'display_id', 'content', 'mentioned_to', 'related_table', 'related_id', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  DIRECTORIES: ['id', 'display_id', 'parent_directory_id', 'directory_type_key', 'name', 'slack_channel_url', 'gfolder_id', 'is_active', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  APPS: ['id', 'name', 'url', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  MEMBERS: ['id', 'email', 'slack_profile_url', 'name', 'display_name', 'profile_photo_url', 'is_active', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  MEMBER_ASSIGNMENTS: ['id', 'member_id', 'related_table', 'related_id', 'role', 'is_active', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  TASKS: ['id', 'display_id', 'parent_task_id', 'board_id', 'name', 'description', 'starts_at', 'ends_at', 'task_status_key', 'priority_key', 'processed_by', 'reviewed_by', 'received_by', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  LISTS: ['id', 'index', 'task_id', 'is_done', 'name', 'assign_to', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  LINKS: ['id', 'index', 'task_id', 'label', 'url', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  FILES: ['id', 'index', 'task_id', 'gfile_id', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at']
};