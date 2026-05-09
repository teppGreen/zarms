// ============================================
// constants.gs - mobile-app 定数管理
// ============================================

const scriptProperties = PropertiesService.getScriptProperties();

const TABLE_NAMES = {
  LOGS: 'logs',
  BOARDS: 'boards',
  COMMENTS: 'comments',
  APPS: 'apps',
  MEMBERS: 'members',
  TASKS: 'tasks',
  LISTS: 'lists',
  SYSTEM_UPDATES: 'system_updates',
  QUESTIONS: 'questions'
};

const KEY_LABELS = {
  TASK_STATUS: {
    TODO: '未着手',
    IN_PROGRESS: '進行中',
    IN_REVIEW: '確認中',
    DONE: '完了'
  },
  ASSIGNEE_TYPE: {
    CREATED_BY: '作成者',
    PROCESSED_BY: '進行者',
    REVIEWED_BY: '確認者',
    RECEIVED_BY: '受領者'
  },
  PRIORITY: {
    LOW: '低',
    MEDIUM: '中',
    HIGH: '高'
  }
};

const EVENT_CONFIG = {
  FESTIVAL_DATE: '2026-04-24',
  ATTENDANCE_GEOFENCE: {
    LATITUDE: 35.64,
    LONGITUDE: 140.03,
    RADIUS_METERS: 300
  }
};

const EXTERNAL_URLS = {
  FAVICON_IMAGE: scriptProperties.getProperty('EXTERNAL_URLS.FAVICON_IMAGE'),
  PORTAL_SITE: (scriptProperties.getProperty('EXTERNAL_URLS.PORTAL_SITE') || '').replace(/\/$/, ''),
  MASCOT_MAIN_IMAGE: scriptProperties.getProperty('EXTERNAL_URLS.MASCOT_MAIN_IMAGE'),
  HELP_SITE: scriptProperties.getProperty('EXTERNAL_URLS.HELP_SITE')
};

const UI_TEXT = {
  APP_TITLE: 'ZARMS Mobile',
  APP_COPYRIGHT: '© 2026 展軸祭実行委員会'
};
