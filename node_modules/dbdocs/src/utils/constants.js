const PROJECT_GENERAL_ACCESS_TYPE = {
  public: 'public',
  protected: 'protected',
  restricted: 'restricted',
};

const PROJECT_SHARING_TEXT = {
  public: 'Public',
  protected: 'Password-protected',
  restricted: 'Private',
};

const FLAG_HELP_GROUP = {
  sharing: 'sharing',
};

const LOGIN_METHODS = {
  EMAIL: 'Email',
  GITHUB_GOOGLE: 'GitHub/Google',
};

const SUPPORTED_DATABASE_CONNECTORS = ['postgres', 'mysql', 'mssql', 'snowflake', 'bigquery'];

/**
 * Match window path
 * Eg:
 * - C:\Documents\code\credential.json
 * - C:/Documents/code/credential.json
 */
const WINDOW_FILE_PATH_REGEX = /^[a-zA-Z]:[\\/](?:[^<>:"/\\|?*\n\r]+[\\/])*[^<>:"/\\|?*\n\r]*$/;

/**
 * Match unix system path
 * Eg:
 * - /Users/dev/code/credential.json
 * - ~/code/credential.json
 * - ./code/credential.json
 */
const UNIX_FILE_PATH_REGEX = /^(\/|\.\/|~\/|\.\.\/)([^<>:"|?*\n\r]*\/?)*[^<>:"|?*\n\r]*$/;

const HOST_CONFIG_STATUS = {
  active: 'active',
  inactive: 'inactive',
};

module.exports = {
  PROJECT_GENERAL_ACCESS_TYPE,
  PROJECT_SHARING_TEXT,
  FLAG_HELP_GROUP,
  LOGIN_METHODS,
  SUPPORTED_DATABASE_CONNECTORS,
  WINDOW_FILE_PATH_REGEX,
  UNIX_FILE_PATH_REGEX,
  HOST_CONFIG_STATUS,
};
