// ============================================
// constants.gs - 定数管理
// ============================================

const scriptProperties = PropertiesService.getScriptProperties();
const SPREADSHEET_ID = scriptProperties.getProperty('SPREADSHEET_ID');

const TABLE_NAMES = {
  LOGS: 'logs',
  BOARDS: 'boards',
  NOTICES: 'notices',
  COMMENTS: 'comments',
  DIRECTORIES: 'directories',
  APPS: 'apps',
  LINKS: 'links',
  MEMBERS: 'members',
  PLAN_ASSIGNMENTS: 'plan_assignments',
  DIRECTORY_ASSIGNMENTS: 'directory_assignments',
  SKILLS: 'skills',
  SKILL_ASSIGNMENTS: 'skill_assignments',
  TASKS: 'tasks',
  LISTS: 'lists',
  FILES: 'files',
  SYSTEM_UPDATES: 'system_updates',
  QUESTIONS: 'questions',
  PLANS: 'plans',
  PERMISSIONS: 'permissions',
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
  BOARDS: ['id', 'display_id', 'email', 'name', 'user_note', 'is_active', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  NOTICES: ['id', 'title', 'category', 'body', 'starts_at', 'ends_at', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  COMMENTS: ['id', 'display_id', 'content', 'mentioned_to', 'related_table', 'related_id', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  DIRECTORIES: ['id', 'display_id', 'parent_directory_id', 'directory_type_key', 'name', 'description', 'achievements', 'scale', 'slack_channel_url', 'website_url', 'folder_url', 'document_url', 'logo_image_url', 'is_active', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  APPS: ['id', 'name', 'url', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  MEMBERS: ['id', 'email', 'slack_profile_url', 'name', 'display_name', 'title', 'description', 'website_url', 'profile_photo_file_url', 'profile_photo_url', 'is_active', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at', 'name_yomi', 'display_name_yomi', 'phone_number', 'birthday', 'system_role_key', 'fri_planned_start_at', 'fri_planned_end_at', 'fri_actual_start_at', 'fri_actual_end_at', 'sat_planned_start_at', 'sat_planned_end_at', 'sat_actual_start_at', 'sat_actual_end_at', 'sun_planned_start_at', 'sun_planned_end_at', 'sun_actual_start_at', 'sun_actual_end_at', 'user_note', 'plan_id', 'attribute_type'],
  PLAN_ASSIGNMENTS: ['id', 'plan_id', 'member_id', 'role', 'is_active', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  DIRECTORY_ASSIGNMENTS: ['id', 'directory_id', 'member_id', 'role', 'is_active', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  SKILLS: ['id', 'skill_type_key', 'title', 'user_note', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  SKILL_ASSIGNMENTS: ['id', 'member_id', 'skill_id', 'skill_level_key', 'user_note', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  TASKS: ['id', 'display_id', 'parent_task_id', 'board_id', 'name', 'description', 'starts_at', 'ends_at', 'task_status_key', 'priority_key', 'processed_by', 'reviewed_by', 'received_by', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  LISTS: ['id', 'index', 'task_id', 'is_done', 'name', 'assign_to', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  LINKS: ['id', 'label', 'url', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  FILES: ['id', 'index', 'task_id', 'gfile_id', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  SYSTEM_UPDATES: ['id', 'version', 'title', 'user_note', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  QUESTIONS: ['id', 'question_number', 'created_at', 'question_category', 'question_content', 'remark', 'created_by', 'updated_by', 'updated_at'],
  PLANS: ['id', 'plan_number', 'zarms_code', 'parent_plan_id', 'plan_type_sequence_number', 'plan_status', 'plan_type', 'name', 'summary', 'description', 'plan_tags', 'plan_categories', 'selection_application_text', 'selection_presentation_url', 'first_selection_comment', 'second_selection_comment', 'estimated_staff_count', 'estimated_participant_count', 'estimated_total_cost', 'actual_staff_count', 'actual_participant_count', 'actual_total_cost', 'has_collaborators', 'has_guests', 'online_media_type', 'online_media_url', 'website_url', 'sheet_url', 'folder_url', 'document_url', 'slide_url', 'script_url', 'thumbnail_url', 'exhibitor_type', 'exhibitor_member', 'exhibitor_directory', 'manager_committee_student', 'manager_committee_staff', 'slack_channel_url', 'has_recruitments', 'has_live', 'remark', 'applied_by', 'applied_at', 'created_by', 'created_at', 'updated_by', 'updated_at', 'copyright_application_form1_submitted', 'copyright_application_form2_submitted', 'copyright_application_form3_submitted', 'copyright_application_form4_submitted', 'copyright_application_form5_submitted'],
  PERMISSIONS: ['id', 'table_name', 'record_id', 'email', 'can_read', 'can_write', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
};

// ============================================
// キャッシュ設定と再試行設定
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
 * 列ID定数（Excel形式）
 */
const COLUMN_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

// ============================================
// 外部URL設定（バックエンド用）
// ============================================

/**
 * 外部URL設定
 */
const EXTERNAL_URLS = {
  ZARMS_WEB: scriptProperties.getProperty('EXTERNAL_URLS.ZARMS_WEB'),
};

/**
 * 問い合わせ用のデフォルト値
 */
const TASK_BY_QUESTION_DEFAULT_VALUES = {
  board_id: scriptProperties.getProperty('BOARDS.QUESTION'),
  created_by: 'system',
  processed_by: scriptProperties.getProperty('MEMBERS.HELPDESK_UNIT_LEADER'),
  reviewed_by: scriptProperties.getProperty('MEMBERS.MANAGEMENT_GROUP_STAFF'),
  received_by: scriptProperties.getProperty('MEMBERS.MANAGEMENT_GROUP_STAFF'),
  task_status_key: 'TODO',
  remark: 'システムが自動作成',
  priority_key: 'MEDIUM',
}