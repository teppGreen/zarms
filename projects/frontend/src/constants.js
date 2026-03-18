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
  SKILLS: 'skills',
  SKILL_ASSIGNMENTS: 'skill_assignments',
  TASKS: 'tasks',
  LISTS: 'lists',
  FILES: 'files',
  SYSTEM_UPDATES: 'system_updates',
  QUESTIONS: 'questions',
  PLANS: 'plans',
};

const KEY_LABELS = {
  TASK_STATUS: {
    TODO: '未着手',
    IN_PROGRESS: '進行中',
    IN_REVIEW: '確認中',
    DONE: '完了'
  },
  PLAN_TYPE: {
    STAGE: 'ステージ',
    BOOTH: 'ブース',
    NET: 'オンライン',
    RECEPTION: '懇親会',
    OTHER: 'その他'
  },
  ASIGNEE_TYPE: {
    CREATED_BY: '作成者',
    PROCESSED_BY: '進行者',
    REVIEWED_BY: '確認者',
    RECEIVED_BY: '受領者'
  },
  DIRECTORY_TYPE: {
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
  },
  PRIORITY: {
    LOW: '低',
    MEDIUM: '中',
    HIGH: '高'
  },
  SKILL_LEVEL: {
    BEGINNER: '初級',
    INTERMEDIATE: '中級',
    ADVANCED: '上級'
  },
  ATTENDANCE_TYPE: {
    PRESENT: '出席',
    ABSENT: '欠席',
    LEAVE: '中抜',
    LATE: '遅刻',
    EARLY: '早退',
    LATE_EARLY: '遅刻・早退'
  },
  KNOWLEDGE_TYPE: {
    TIP: '豆知識',
    IDEA: 'アイデア',
    ISSUE: '課題・問題',
    REFERENCE: '参考資料',
    OTHER: 'その他'
  },
  PLAN_STATUS: {
    SUBMITTED: '応募済み', //応募フォームからデータが送信された直後の状態。「受付」は完了しているが、審査は始まっていない。
    IN_REVIEW1: '一次審査中',
    IN_REVIEW2: '二次審査中（最終）',
    APPROVED: '審査通過', //企画が承認され、開催に向けて動き出す状態。
    RETURNED: '審査差戻', //審査の結果、修正が必要と判断された状態。応募者にボールがある状態。
    REJECTED: '審査落選', //残念ながら不採択となった状態。ここでフローは終了。
    IN_PREPARATION: '準備中', //通過後、Web掲載用の画像や紹介文を作成・準備している段階。
    READY: '準備完了', //全ての素材が揃い、Web公開待ちの状態。（または承認待ち）
    PUBLISHED: '公開中', //Webサイト上に情報が表示されている状態。
    CLOSED: '公開終了', //大学祭が終了そ非公開になった状態。
    MERGED: '統合済み', //複数の企画が統合され、個別の企画としては存在しない状態。
    DISCARDED: '取り下げ' //応募者が自ら企画を取り下げた状態。
  }
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
  APP_DESCRIPTION: 'ZARMS(ザームス)は、展軸祭運営者向けの業務システムです。企画・人員・タスク等の円滑な管理を支援します。',
  LOADING_MESSAGE: 'お待ちください',
  ERROR_USER_NOT_FOUND: 'ユーザーが見つかりませんでした',
  ERROR_ACCESS_DENIED: 'アクセス権限がありません',
  SUCCESS_SAVED: '保存しました',
  SUCCESS_DELETED: '削除しました',
  SUCCESS_CREATED: '作成しました'
};

// ============================================
// Database API設定（APIモード用）
// ============================================

/**
 * unauthorizedユーザー向けDatabase API設定
 * ScriptPropertiesに以下を設定してください:
 *   DB_API_URL    - databaseプロジェクトのWebアプリURL
 *   DB_API_SECRET - HMAC署名用シークレット（databaseと同じ値）
 */
const DB_API_CONFIG = {
  URL: scriptProperties.getProperty('DB_API_URL'),
  SECRET: scriptProperties.getProperty('DB_API_SECRET'),
};