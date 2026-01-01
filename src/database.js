// ============================================
// database.gs - データベース操作の抽象化
// ============================================

// ============================================
// Caching Utility
// ============================================
const CacheManager = {
    get: function (key, cachePublicRange) {
        let cache;
        if (cachePublicRange === `script`) {
            cache = CacheService.getScriptCache();
        } else if (cachePublicRange === `user`) {
            cache = CacheService.getUserCache();
        } else {
            throw new Error(`Invalid cachePublicRange: ${cachePublicRange}`);
        }
        const cached = cache.get(key);
        if (!cached) return null;
        return JSON.parse(cached);
    },
    put: function (key, value, cachePublicRange, ttl = 21600) {
        let cache;
        if (cachePublicRange === `script`) {
            cache = CacheService.getScriptCache();
        } else if (cachePublicRange === `user`) {
            cache = CacheService.getUserCache();
        } else {
            throw new Error(`Invalid cachePublicRange: ${cachePublicRange}`);
        }
        cache.put(key, JSON.stringify(value), ttl);
    },
    invalidate: function (key, cachePublicRange) {
        let cache;
        if (cachePublicRange === `script`) {
            cache = CacheService.getScriptCache();
        } else if (cachePublicRange === `user`) {
            cache = CacheService.getUserCache();
        } else {
            throw new Error(`Invalid cachePublicRange: ${cachePublicRange}`);
        }
        cache.remove(key);
    }
};

// ============================================
// 汎用データ取得関数
// ============================================

/**
 * データを取得します（キャッシュ機能付き）
 * @param {string} userId - ユーザーID
 * @param {string} tableName - テーブル名
 * @param {boolean} forceRefresh - キャッシュを無視して強制的に再取得するか
 * @returns {Object} { data: データ配列, isCached: キャッシュから取得したか }
 */
function getItems(userId, tableName, forceRefresh = false) {
    const cacheKey = `user_items_${tableName}`;

    if (!forceRefresh) {
        const cachePublicRange = `script`;
        const cached = CacheManager.get(cacheKey, cachePublicRange);
        if (cached) {
            return { data: cached, isCached: true };
        }
    }

    // handleDatabaseProcessは { data: ..., isCached: ... } を返す
    const result = handleDatabaseProcess(userId, tableName, 'select', {}, null, true);

    // resultからdataを取得（後方互換性のため、resultが配列の場合も考慮）
    const data = result?.data || result || [];

    // Cache the result
    CacheManager.put(cacheKey, data, 'script');

    return { data: data, isCached: false };
}

// ============================================
// メインデータベース処理関数
// ============================================

/**
 * データベース処理を実行します（キャッシュ機能付き）
 * @param {string} userId - ユーザーID
 * @param {string} tableName - テーブル名
 * @param {string} operation - 操作種別（select, insert, bulkinsert, update, remove）
 * @param {Object} dataObject - データオブジェクト（クエリまたはデータ）
 * @param {string} remark - ログ用の備考
 * @param {boolean} forceRefresh - キャッシュを無視して強制的に再取得するか（selectのみ）
 * @returns {Object|Array} 操作結果（selectの場合はキャッシュ情報も含む）
 */
function handleDatabaseProcess(userId, tableName, operation, dataObject, remark, forceRefresh = false) {
    // キャッシュキーの生成（tableName + dataObject を結合）
    const cacheKey = `db_${tableName}_${JSON.stringify(dataObject)}`;
    const cachePublicRange = 'script';

    // selectかつforceRefreshがfalseの場合、キャッシュを使用
    if (operation === 'select' && !forceRefresh) {
        const cached = CacheManager.get(cacheKey, cachePublicRange);
        if (cached) {
            return { data: cached, isCached: true };
        }
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(60000);

    try {
        const ss = getSpreadsheet();
        const targetSheet = getSheet(ss, tableName);
        const logSheet = getSheet(ss, TABLE_NAMES.LOGS);
        let result;

        // 操作の実行
        switch (operation) {
            case 'select':
                result = select(targetSheet, dataObject);
                // selectの場合は常にキャッシュを作成
                CacheManager.put(cacheKey, result, cachePublicRange);
                return { data: result, isCached: false };
            case 'insert':
                result = insert(userId, targetSheet, dataObject);
                createLog(userId, tableName, logSheet, operation, dataObject, remark);
                // insert時は関連するselectキャッシュを無効化
                invalidateTableCache(tableName);
                break;
            case 'bulkinsert':
                result = bulkInsert(userId, targetSheet, dataObject);
                createLog(userId, tableName, logSheet, operation, dataObject, remark);
                // bulkinsert時は関連するselectキャッシュを無効化
                invalidateTableCache(tableName);
                break;
            case 'update':
                result = update(userId, targetSheet, dataObject);
                createLog(userId, tableName, logSheet, operation, dataObject, remark);
                // update時は関連するselectキャッシュを無効化
                invalidateTableCache(tableName);
                break;
            case 'remove':
                result = remove(targetSheet, dataObject);
                createLog(userId, tableName, logSheet, operation, dataObject, remark);
                // remove時は関連するselectキャッシュを無効化
                invalidateTableCache(tableName);
                break;
        }

        return result;
    } finally {
        lock.releaseLock();
    }
}

/**
 * 指定されたテーブルに関連するすべてのキャッシュを無効化
 * @param {string} tableName - テーブル名
 */
function invalidateTableCache(tableName) {
    // 注意: CacheServiceには特定のプレフィックスで始まるキーを検索する機能がないため
    // ここでは個別に無効化する必要があります
    // より高度な実装が必要な場合は、キャッシュキーのリストを別途管理する必要があります
    const cachePublicRange = 'script';
    const generalCacheKey = `user_items_${tableName}`;
    CacheManager.invalidate(generalCacheKey, cachePublicRange);
}

// ============================================
// データベース処理の前工程で使用するヘルパー関数
// ============================================

function getSpreadsheet() {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    return ss;
}

function getSheet(ss, sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    return sheet;
}

function getHeaders(sheet) {
    return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function generateUuid() {
    const uuid = Utilities.getUuid();
    console.log('Generated UUID: ' + uuid);
    return uuid;
}

function getNextSerial(sheet, columnName) {
    const result = SSSQL.select(sheet, {
        groupBy: [
            [],
            { maxSerial: [columnName, "MAX"] }
        ]
    });

    if (result.length > 0 && result[0].maxSerial) {
        const maxVal = Number(result[0].maxSerial);
        return isNaN(maxVal) ? 1 : maxVal + 1;
    }

    return 1;
}

function prepareNewData(userId, sheet, dataObject) {
    const headers = getHeaders(sheet);
    const newData = { ...dataObject };

    const now = new Date().toISOString();
    if (headers.includes(`created_by`)) newData[`created_by`] = userId;
    if (headers.includes(`created_at`)) newData[`created_at`] = now;
    if (headers.includes(`updated_by`)) newData[`updated_by`] = userId;
    if (headers.includes(`updated_at`)) newData[`updated_at`] = now;
    if (headers.includes(`id`)) newData[`id`] = generateUuid();
    if (headers.includes(`display_id`)) newData[`display_id`] = getNextSerial(sheet, `display_id`);

    return newData;
}

function prepareUpdateData(userId, sheet, dataObject) {
    const headers = getHeaders(sheet);
    const newData = { ...dataObject };

    const now = new Date().toISOString();
    if (headers.includes(`updated_by`)) newData[`updated_by`] = userId;
    if (headers.includes(`updated_at`)) newData[`updated_at`] = now;

    return newData;
}

function createLog(userId, tableName, sheet, operation, dataObject, remark) {
    const newData = {
        id: generateUuid(),
        operation_type_key: operation.toUpperCase(),
        table_name: tableName,
        record_id: dataObject.id || ``,
        data: JSON.stringify(dataObject),
        remark: remark || ``,
    };
    const result = insert(userId, sheet, newData);
    return result;
}

// ============================================
// CRUD操作
// ============================================

function select(sheet, query) {
    const result = SSSQL.select(sheet, query);
    return result;
}

function insert(userId, sheet, record) {
    const preparedData = prepareNewData(userId, sheet, record);
    const result = SSSQL.insert(sheet, preparedData);
    return result;
}

function bulkInsert(userId, sheet, records) {
    const preparedData = records.map(record =>
        prepareNewData(userId, sheet, record)
    );
    const result = SSSQL.bulkInsert(sheet, preparedData);
    return result;
}

function update(userId, sheet, query) {
    let newSet = { ...query.set };
    newSet = prepareUpdateData(userId, sheet, query.set);
    const newQuery = { ...query, set: newSet };
    const result = SSSQL.update(sheet, newQuery);
    return result;
}

function remove(sheet, query) {
    const result = SSSQL.remove(sheet, query);
    return result;
}

// ============================================
// JSONシリアライズ対策
// ============================================
function sanitizeForClient(data) {
    if (data === null || data === undefined) {
        return data;
    }

    // Dateオブジェクトの場合
    if (data instanceof Date) {
        return data.toISOString();
    }

    // 配列の場合は、各要素を再帰的に処理
    if (Array.isArray(data)) {
        return data.map(item => sanitizeForClient(item));
    }

    // プレーンなオブジェクトの場合は、各プロパティを再帰的に処理
    if (typeof data === 'object' && data.constructor === Object) {
        const sanitized = {};
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                sanitized[key] = sanitizeForClient(data[key]);
            }
        }
        return sanitized;
    }

    // それ以外（文字列、数値、ブール値）はそのまま返す
    return data;
}
