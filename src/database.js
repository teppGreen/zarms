// ============================================
// database.gs - データベース操作の抽象化（高速化アーキテクチャ）
// ============================================

// ============================================
// Custom Error Classes
// ============================================

/**
 * データベース操作のエラー
 */
class DatabaseError extends Error {
  constructor(message, operation, tableName, details = null) {
    super(message);
    this.name = 'DatabaseError';
    this.operation = operation;
    this.tableName = tableName;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * バリデーションエラー
 */
class ValidationError extends Error {
  constructor(message, field = null, value = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * キャッシュ操作のエラー
 */
class CacheError extends Error {
  constructor(message, key = null) {
    super(message);
    this.name = 'CacheError';
    this.key = key;
    this.timestamp = new Date().toISOString();
  }
}

// ============================================
// Caching Utility
// 責任: キャッシュの取得・保存・無効化
// ============================================
const CacheManager = {
    /**
     * キャッシュから値を取得します
     * @param {string} key - キャッシュキー
     * @param {('script'|'user')} cachePublicRange - キャッシュの範囲
     * @returns {*|null} キャッシュされた値、存在しない場合はnull
     * @throws {CacheError} キャッシュ取得に失敗した場合
     */
    get: function (key, cachePublicRange) {
        try {
            let cache;
            if (cachePublicRange === CACHE_CONFIG.PUBLIC_RANGE.SCRIPT) {
                cache = CacheService.getScriptCache();
            } else if (cachePublicRange === CACHE_CONFIG.PUBLIC_RANGE.USER) {
                cache = CacheService.getUserCache();
            } else {
                throw new CacheError(`Invalid cachePublicRange: ${cachePublicRange}`, key);
            }
            const cached = cache.get(key);
            if (!cached) return null;
            return JSON.parse(cached);
        } catch (error) {
            if (error instanceof CacheError) throw error;
            throw new CacheError(`Failed to get cache: ${error.message}`, key);
        }
    },
    
    /**
     * キャッシュに値を保存します
     * @param {string} key - キャッシュキー
     * @param {*} value - 保存する値
     * @param {('script'|'user')} cachePublicRange - キャッシュの範囲
     * @param {number} ttl - 有効期限（秒）
     * @throws {CacheError} キャッシュ保存に失敗した場合
     */
    put: function (key, value, cachePublicRange, ttl = CACHE_CONFIG.DEFAULT_TTL) {
        try {
            let cache;
            if (cachePublicRange === CACHE_CONFIG.PUBLIC_RANGE.SCRIPT) {
                cache = CacheService.getScriptCache();
            } else if (cachePublicRange === CACHE_CONFIG.PUBLIC_RANGE.USER) {
                cache = CacheService.getUserCache();
            } else {
                throw new CacheError(`Invalid cachePublicRange: ${cachePublicRange}`, key);
            }
            cache.put(key, JSON.stringify(value), ttl);
        } catch (error) {
            if (error instanceof CacheError) throw error;
            throw new CacheError(`Failed to put cache: ${error.message}`, key);
        }
    },
    
    /**
     * キャッシュを無効化します
     * @param {string} key - キャッシュキー
     * @param {('script'|'user')} cachePublicRange - キャッシュの範囲
     * @throws {CacheError} キャッシュ無効化に失敗した場合
     */
    invalidate: function (key, cachePublicRange) {
        try {
            let cache;
            if (cachePublicRange === CACHE_CONFIG.PUBLIC_RANGE.SCRIPT) {
                cache = CacheService.getScriptCache();
            } else if (cachePublicRange === CACHE_CONFIG.PUBLIC_RANGE.USER) {
                cache = CacheService.getUserCache();
            } else {
                throw new CacheError(`Invalid cachePublicRange: ${cachePublicRange}`, key);
            }
            cache.remove(key);
        } catch (error) {
            if (error instanceof CacheError) throw error;
            throw new CacheError(`Failed to invalidate cache: ${error.message}`, key);
        }
    }
};

// ============================================
// Constants
// ============================================

// boolean型のカラム名リスト
const BOOLEAN_COLUMNS = ['is_active', 'is_done'];

// ============================================
// Header Mapping Utility for GViz & Sheets API
// ============================================

/**
 * 列インデックス（0始まり）を列ID（A, B, ..., Z, AA, AB, ...）に変換
 * @param {number} index - 列インデックス（0始まり）
 * @returns {string} 列ID（例: 0→'A', 25→'Z', 26→'AA', 27→'AB'）
 */
function columnIndexToId(index) {
    let id = '';
    let currentIndex = index;

    while (currentIndex >= 0) {
        id = COLUMN_IDS[currentIndex % 26] + id;
        currentIndex = Math.floor(currentIndex / 26) - 1;
    }

    return id;
}

/**
 * シート名からヘッダーマッピングを取得・キャッシュ
 * GViz APIでは列名ではなく列ID（A, B, C...）で指定する必要があるため
 * @param {string} sheetName - シート名
 * @returns {Object} { columnName: columnId, ... } のマッピングオブジェクト
 */
function getHeadersMap(sheetName) {
    try {
        const headers = getTableHeaders(sheetName);
        const headersMap = {};

        headers.forEach((header, index) => {
            headersMap[header] = columnIndexToId(index);
        });

        return headersMap;
    } catch (error) {
        console.error(`Error getting headers map for ${sheetName}:`, error);
        throw error;
    }
}

// ============================================
// Query Parsing for GViz API
// ============================================

/**
 * 値を安全にboolean型に変換します
 * @param {*} value - 変換する値
 * @returns {boolean} boolean値
 */
function toBooleanSafe(value) {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        const normalized = value.toLowerCase().trim();
        return normalized === 'true' || normalized === '1' || normalized === 'yes';
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    return false;
}

/**
 * SSSQL形式のWHERE句をGViz Query Languageに変換
 * @param {Object} whereClause - { field: [operator, value], ... }
 * @param {Object} headersMap - ヘッダーマッピング
 * @returns {string} GVizクエリ文字列
 */
function parseWhereClause(whereClause, headersMap) {
    if (!whereClause || Object.keys(whereClause).length === 0) {
        return '';
    }

    const conditions = [];

    for (const [field, condition] of Object.entries(whereClause)) {
        const [operator, value] = condition;
        const columnId = headersMap[field];

        if (!columnId) {
            throw new Error(`Field '${field}' not found in headers map`);
        }

        // 値のエスケープ処理
        let escapedValue = value;
        if (typeof value === 'string') {
            escapedValue = `'${value.replace(/'/g, "\\'")}'`;
        } else if (value instanceof Date) {
            escapedValue = `'${value.toISOString()}'`;
        }

        // boolean型かつ等価比較の場合、文字列(TRUE/FALSE)としても検索する（GVizの型推論対策）
        if (typeof value === 'boolean' && operator === '=') {
            const stringValue = value ? "'TRUE'" : "'FALSE'";
            conditions.push(`(${columnId} ${operator} ${value} OR ${columnId} ${operator} ${stringValue})`);
        } else {
            conditions.push(`${columnId} ${operator} ${escapedValue}`);
        }
    }

    return conditions.join(' AND ');
}

// ============================================
// Select Operation using Google Visualization API
// ============================================

/**
 * データを検索します（SELECT）
 * @param {string} sheetName - シート名
 * @param {Object} query - クエリオブジェクト
 * @param {Object} [query.where] - WHERE条件 {column: [operator, value]}
 * @param {Object} [query.orderBy] - ORDER BY条件 {column: 'asc'|'desc'}
 * @param {number} [query.limit] - 取得件数制限
 * @returns {Array<Object>} 検索結果の配列
 * @throws {DatabaseError} 検索に失敗した場合
 */
function select(sheetName, query = {}) {
    try {
        const headersMap = getHeadersMap(sheetName);

        // WHERE句の変換
        let whereClause = '';
        if (query.where) {
            whereClause = parseWhereClause(query.where, headersMap);
        }

        // GVizクエリの構築
        let gvizQuery = 'SELECT *';
        if (whereClause) {
            gvizQuery += ` WHERE ${whereClause}`;
        }

        // ORDER BYの処理
        if (query.orderBy) {
            const orderClauses = [];
            for (const [field, direction] of Object.entries(query.orderBy)) {
                console.log(`クエリ処理中: ${field}, ${direction}`);
                const columnId = headersMap[field];
                if (!columnId) {
                    throw new Error(`Field '${field}' not found in headers map`);
                }
                const dir = direction.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
                orderClauses.push(`${columnId} ${dir}`);
            }
            gvizQuery += ` ORDER BY ${orderClauses.join(', ')}`;
        }

        // LIMITの処理
        if (query.limit) {
            gvizQuery += ` LIMIT ${query.limit}`;
        }

        // URLの構築
        const baseUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq`;
        const params = {
            tq: gvizQuery,
            sheet: sheetName,
            headers: '1'
        };

        const queryString = Object.keys(params)
            .map(key => `${key}=${encodeURIComponent(params[key])}`)
            .join('&');

        const url = `${baseUrl}?${queryString}`;

        // APIリクエストの実行
        const options = {
            method: 'get',
            headers: {
                'Authorization': `Bearer ${ScriptApp.getOAuthToken()}`
            },
            muteHttpExceptions: true
        };

        const response = UrlFetchApp.fetch(url, options);
        const responseText = response.getContentText();

        // JSONPレスポンスの解析
        const jsonMatch = responseText.match(/google\.visualization\.Query\.setResponse\((.*)\);/);
        if (!jsonMatch) {
            throw new Error('Invalid GViz response format');
        }

        const gvizResponse = JSON.parse(jsonMatch[1]);

        if (gvizResponse.error) {
            throw new Error(`GViz query error: ${gvizResponse.error.message}`);
        }

        if (!gvizResponse.table || !gvizResponse.table.rows) {
            return [];
        }

        // ヘッダーの取得
        const headers = getTableHeaders(sheetName);

        // データの変換
        const results = gvizResponse.table.rows.map(row => {
            const record = {};
            row.c.forEach((cell, index) => {
                const header = headers[index];
                if (header && cell !== null) {
                    let value = cell.v;

                    // 日付データの処理
                    if (cell.f && cell.f.startsWith('Date(')) {
                        const dateMatch = cell.f.match(/Date\((\d+),\s*(\d+),\s*(\d+)\)/);
                        if (dateMatch) {
                            const [, year, month, day] = dateMatch;
                            value = new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).toISOString();
                        }
                    }

                    record[header] = value;
                }
            });
            return record;
        });

        // boolean型カラムの正規化
        results.forEach(row => {
            BOOLEAN_COLUMNS.forEach(col => {
                if (Object.prototype.hasOwnProperty.call(row, col)) {
                    row[col] = toBooleanSafe(row[col]);
                }
            });
        });

        return results;

    } catch (error) {
        console.error(`Error in select operation for ${sheetName}:`, error);
        throw error;
    }
}

// ============================================
// Select with JOIN Operation using Google Visualization API
// ============================================

/**
 * Google Visualization APIを使用してJOIN処理を含むデータを取得
 * VLOOKUPとARRAYFORMULAを使用したJOIN実装
 * 参考: https://qiita.com/sakaimo/items/b572b2e35a7f72fa710b
 * 
 * @param {string} sheetName - メインテーブルのシート名
 * @param {Object} query - SSSQL形式のクエリオブジェクト
 * @param {Array} joins - JOIN設定の配列
 *   例: [{
 *     targetTable: 'members',
 *     joinType: 'LEFT',
 *     columns: ['display_name', 'profile_photo_url'],
 *     localKey: 'processed_by',
 *     foreignKey: 'id',
 *     alias: 'processed_by_'
 *   }]
 * @returns {Array} JOIN済みデータ配列
 */
function selectWithJoin(sheetName, query = {}, joins = []) {
    try {
        // JOIN設定がない場合は通常のselectを使用
        if (!joins || joins.length === 0) {
            return select(sheetName, query);
        }

        // まず通常のselectでメインデータを取得
        const mainData = select(sheetName, query);

        if (mainData.length === 0) {
            return [];
        }

        // 各JOIN設定を処理
        joins.forEach(joinConfig => {
            const {
                targetTable,
                columns,
                localKey,
                foreignKey,
                alias
            } = joinConfig;

            // JOINターゲットテーブルの全データを取得（キャッシュから取得される可能性が高い）
            const targetData = select(targetTable, {});

            // ターゲットデータをMapに変換（高速検索用）
            const targetMap = new Map();
            targetData.forEach(row => {
                const key = row[foreignKey];
                if (key) {
                    targetMap.set(key, row);
                }
            });

            // メインデータにJOIN結果を追加
            mainData.forEach(mainRow => {
                const joinKey = mainRow[localKey];
                const targetRow = targetMap.get(joinKey);

                if (targetRow) {
                    // 指定されたカラムをエイリアス付きで追加
                    columns.forEach(col => {
                        const aliasedKey = alias ? `${alias}${col}` : `${targetTable}_${col}`;
                        mainRow[aliasedKey] = targetRow[col];
                    });
                } else {
                    // LEFT JOIN: マッチしない場合はnullを設定
                    columns.forEach(col => {
                        const aliasedKey = alias ? `${alias}${col}` : `${targetTable}_${col}`;
                        mainRow[aliasedKey] = null;
                    });
                }
            });
        });

        return mainData;

    } catch (error) {
        console.error(`Error in selectWithJoin operation for ${sheetName}:`, error);
        throw error;
    }
}


// ============================================
// Helper Functions for Sheets API Operations
// ============================================

/**
 * テーブル名からヘッダー配列を取得
 * パフォーマンス向上のため、定数から取得（スプレッドシートAPIへのアクセスを削減）
 * @param {string} tableName - テーブル名
 * @returns {Array} ヘッダー配列
 */
function getTableHeaders(tableName) {
    const tableKey = tableName.toUpperCase();
    if (!TABLE_HEADERS[tableKey]) {
        throw new Error(`Unknown table: ${tableName}`);
    }
    return TABLE_HEADERS[tableKey];
}

/**
 * オブジェクトをSheets APIのフォーマットに変換
 * @param {Object} record - データオブジェクト
 * @param {Array} headers - ヘッダー配列
 * @returns {Array} 配列形式のデータ
 */
function convertRecordToArray(record, headers) {
    return headers.map(header => {
        const value = record[header];
        if (value instanceof Date) {
            return value.toISOString();
        }
        return value !== undefined ? value : '';
    });
}

// ============================================
// Insert Operations using Sheets API
// ============================================

/**
 * データを挿入します（INSERT）
 * @param {string} userId - ユーザーID
 * @param {string} sheetName - シート名
 * @param {Object} record - 挿入するデータ
 * @returns {Object} 挿入されたレコード
 * @throws {DatabaseError} 挿入に失敗した場合
 */
function insert(userId, sheetName, record) {
    const lock = LockService.getScriptLock();
    lock.waitLock(60000);

    try {
        const headers = getTableHeaders(sheetName);
        const preparedData = prepareNewData(userId, sheetName, record);
        const rowData = convertRecordToArray(preparedData, headers);

        const request = {
            values: [rowData]
        };

        const response = Sheets.Spreadsheets.Values.append(request, SPREADSHEET_ID, sheetName, {
            valueInputOption: 'USER_ENTERED'
        });

        // キャッシュの無効化
        invalidateTableCache(sheetName);

        return { success: true, updatedRange: response.updates.updatedRange, data: preparedData };
    } finally {
        lock.releaseLock();
    }
}

/**
 * データを一括挿入します（BULK INSERT）
 * @param {string} userId - ユーザーID
 * @param {string} sheetName - シート名
 * @param {Array<Object>} records - 挿入するデータの配列
 * @returns {Array<Object>} 挿入されたレコードの配列
 * @throws {DatabaseError} 挿入に失敗した場合
 */
function bulkInsert(userId, sheetName, records) {
    const lock = LockService.getScriptLock();
    lock.waitLock(60000);

    try {
        const headers = getTableHeaders(sheetName);
        const preparedData = records.map(record => prepareNewData(userId, sheetName, record));
        const values = preparedData.map(record => convertRecordToArray(record, headers));

        const request = {
            values: values
        };

        const response = Sheets.Spreadsheets.Values.append(request, SPREADSHEET_ID, sheetName, {
            valueInputOption: 'USER_ENTERED'
        });

        // キャッシュの無効化
        invalidateTableCache(sheetName);

        return { success: true, updatedRange: response.updates.updatedRange };
    } finally {
        lock.releaseLock();
    }
}

// ============================================
// Update Operation using Sheets API
// ============================================

/**
 * データを更新します（UPDATE）
 * @param {string} userId - ユーザーID
 * @param {string} sheetName - シート名
 * @param {Object} query - 更新データ {set: {...}, where: {...}}
 * @returns {Array<Object>} 更新されたレコードの配列
 * @throws {DatabaseError} 更新に失敗した場合
 */
function update(userId, sheetName, query) {
    const lock = LockService.getScriptLock();
    lock.waitLock(60000);

    try {
        const headersMap = getHeadersMap(sheetName);
        const headers = getTableHeaders(sheetName);

        // 更新対象のレコードを検索
        const targetRecords = select(sheetName, { where: query.where });

        if (targetRecords.length === 0) {
            throw new Error('No records found matching the update criteria');
        }

        // 各レコードを更新
        const results = [];
        for (const record of targetRecords) {
            // IDで対象行を特定
            const idColumn = headersMap['id'];
            if (!idColumn) {
                throw new Error('ID column not found in headers map');
            }

            // 行番号の取得（全データを取得して検索）
            const allData = Sheets.Spreadsheets.Values.get(SPREADSHEET_ID, sheetName);
            let targetRowIndex = -1;

            for (let i = 1; i < allData.values.length; i++) {
                const row = allData.values[i];
                const idIndex = headers.indexOf('id');
                if (row[idIndex] === record.id) {
                    targetRowIndex = i + 1; // 1-indexed
                    break;
                }
            }

            if (targetRowIndex === -1) {
                continue; // レコードが見つからない場合はスキップ
            }

            // 更新データの準備
            const preparedData = prepareUpdateData(userId, sheetName, query.set);
            const updatedRecord = { ...record, ...preparedData };
            const rowData = convertRecordToArray(updatedRecord, headers);

            // 更新の実行
            const range = `${sheetName}!A${targetRowIndex}:${String.fromCharCode(65 + headers.length - 1)}${targetRowIndex}`;
            const request = {
                values: [rowData]
            };

            Sheets.Spreadsheets.Values.update(request, SPREADSHEET_ID, range, {
                valueInputOption: 'USER_ENTERED'
            });

            results.push({ id: record.id, success: true });
        }

        // キャッシュの無効化
        invalidateTableCache(sheetName);

        return { success: true, updatedCount: results.length, results };
    } finally {
        lock.releaseLock();
    }
}

// ============================================
// Remove Operation using Sheets API
// ============================================

/**
 * データを削除します（DELETE）
 * @param {string} sheetName - シート名
 * @param {Object} query - 削除条件 {where: {...}}
 * @returns {number} 削除された件数
 * @throws {DatabaseError} 削除に失敗した場合
 */
function remove(sheetName, query) {
    const lock = LockService.getScriptLock();
    lock.waitLock(60000);

    try {
        const headers = getTableHeaders(sheetName);

        // 削除対象のレコードを検索
        const targetRecords = select(sheetName, { where: query.where });

        if (targetRecords.length === 0) {
            return { success: true, deletedCount: 0 };
        }

        // IDで対象行を特定し、行番号を収集
        const allData = Sheets.Spreadsheets.Values.get(SPREADSHEET_ID, sheetName);
        const rowsToDelete = [];

        for (const record of targetRecords) {
            for (let i = 1; i < allData.values.length; i++) {
                const row = allData.values[i];
                const idIndex = headers.indexOf('id');
                if (row[idIndex] === record.id) {
                    rowsToDelete.push(i + 1); // 1-indexed
                    break;
                }
            }
        }

        if (rowsToDelete.length === 0) {
            return { success: true, deletedCount: 0 };
        }

        // 行番号を降順でソート（削除時のインデックスずれを防ぐ）
        rowsToDelete.sort((a, b) => b - a);

        // 各行を削除
        const requests = rowsToDelete.map(rowIndex => ({
            deleteDimension: {
                range: {
                    sheetId: getSheetIdByName(sheetName),
                    dimension: 'ROWS',
                    startIndex: rowIndex - 1, // 0-indexed
                    endIndex: rowIndex
                }
            }
        }));

        const batchUpdateRequest = {
            requests: requests
        };

        Sheets.Spreadsheets.batchUpdate(batchUpdateRequest, SPREADSHEET_ID);

        // キャッシュの無効化
        invalidateTableCache(sheetName);

        return { success: true, deletedCount: rowsToDelete.length };
    } finally {
        lock.releaseLock();
    }
}

/**
 * シート名からシートIDを取得
 * @param {string} sheetName - シート名
 * @returns {number} シートID
 */
function getSheetIdByName(sheetName) {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(sheetName);
    return sheet.getSheetId();
}

// ============================================
// Legacy API Compatibility Layer
// ============================================

/**
 * 汎用データ取得関数（キャッシュ機能付き）- レガシー互換用
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

    // 新しい高速APIを使用
    const result = handleDatabaseProcess(userId, tableName, 'select', {}, null, true);
    const data = result?.data || result || [];

    // Cache the result
    CacheManager.put(cacheKey, data, 'script');

    return { data: data, isCached: false };
}

// ============================================
// Cache Key Generation Utilities
// ============================================

/**
 * オブジェクトのキーを再帰的にソートします
 * @param {*} obj - ソート対象のオブジェクト
 * @returns {*} ソートされたオブジェクト
 */
function sortObjectKeys(obj) {
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
        return obj;
    }

    const sorted = {};
    Object.keys(obj).sort().forEach(key => {
        sorted[key] = sortObjectKeys(obj[key]);
    });

    return sorted;
}

/**
 * 文字列から簡易ハッシュ値を生成します
 * @param {string} str - ハッシュ化する文字列
 * @returns {string} ハッシュ値（16進数文字列）
 */
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // 32bit整数に変換
    }
    return Math.abs(hash).toString(16);
}

/**
 * 安全なキャッシュキーを生成します
 * @param {string} tableName - テーブル名
 * @param {Object} dataObject - データオブジェクト
 * @returns {string} キャッシュキー
 */
function generateCacheKey(tableName, dataObject) {
    const sortedData = sortObjectKeys(dataObject);
    const dataStr = JSON.stringify(sortedData);
    const hash = hashString(dataStr);

    const baseKey = `db_${tableName}_${hash}`;

    if (baseKey.length > CACHE_CONFIG.MAX_KEY_LENGTH) {
        // 長すぎる場合はテーブル名とハッシュのみ
        return `db_${tableName.substring(0, 50)}_${hash}`;
    }

    return baseKey;
}

// ============================================
// Main Database Process Function
// ============================================

/**
 * データベース処理を実行します（高速化アーキテクチャ）
 * @param {string} userId - ユーザーID
 * @param {string} tableName - テーブル名
 * @param {string} operation - 操作種別（select, insert, bulkinsert, update, remove）
 * @param {Object} dataObject - データオブジェクト（クエリまたはデータ）
 * @param {string} remark - ログ用の備考
 * @param {boolean} forceRefresh - キャッシュを無視して強制的に再取得するか（selectのみ）
 * @returns {Object|Array} 操作結果
 */
// ============================================
// Database Operations Handler
// 責任: データベース操作の統括、キャッシュ戦略の決定
// ============================================

/**
 * データベース操作を処理します
 * このメイン関数は以下を統括します:
 * - キャッシュ戦略の決定
 * - 適切な操作関数へのディスパッチ
 * - エラーハンドリング
 * - ログ記録とキャッシュ無効化のトリガー
 * 
 * @param {string|null} userId - ユーザーID
 * @param {string} tableName - テーブル名
 * @param {('select'|'insert'|'update'|'remove'|'bulkinsert')} operation - 操作タイプ
 * @param {Object} dataObject - データオブジェクト
 * @param {string|null} remark - 備考
 * @param {boolean} forceRefresh - キャッシュを無視するか
 * @returns {Object|Array} 操作結果
 * @throws {DatabaseError} データベース操作に失敗した場合
 * @throws {ValidationError} 入力値が不正な場合
 */
function handleDatabaseProcess(userId, tableName, operation, dataObject, remark, forceRefresh = false) {
    try {
        // キャッシュキーの生成
        const cacheKey = generateCacheKey(tableName, dataObject);
        const cachePublicRange = 'script';

        // selectかつforceRefreshがfalseの場合、キャッシュを使用
        if (operation === 'select' && !forceRefresh) {
            try {
                const cached = CacheManager.get(cacheKey, cachePublicRange);
                if (cached) {
                    return { data: cached, isCached: true };
                }
            } catch (cacheError) {
                // キャッシュ取得失敗はログのみ、処理は継続
                console.warn('[handleDatabaseProcess] Cache retrieval failed:', cacheError);
            }
        }

        let result;

        try {
            switch (operation) {
                case 'select':
                    result = select(tableName, dataObject);
                    // selectの場合は常にキャッシュを作成
                    try {
                        CacheManager.put(cacheKey, result, cachePublicRange);
                    } catch (cacheError) {
                        console.warn('[handleDatabaseProcess] Cache storage failed:', cacheError);
                    }
                    return { data: result, isCached: false };
                    
                case 'insert':
                    result = insert(userId, tableName, dataObject);
                    createLog(userId, tableName, dataObject, operation, remark);
                    invalidateTableCache(tableName);
                    break;
                    
                case 'bulkinsert':
                    result = bulkInsert(userId, tableName, dataObject);
                    createLog(userId, tableName, dataObject, operation, remark);
                    invalidateTableCache(tableName);
                    break;
                    
                case 'update':
                    result = update(userId, tableName, dataObject);
                    createLog(userId, tableName, dataObject, operation, remark);
                    invalidateTableCache(tableName);
                    break;
                    
                case 'remove':
                    result = remove(tableName, dataObject);
                    createLog(userId, tableName, dataObject, operation, remark);
                    invalidateTableCache(tableName);
                    break;
                    
                default:
                    throw new ValidationError(`Unsupported operation: ${operation}`, 'operation', operation);
            }

            console.log(`[handleDatabaseProcess] ${operation} on ${tableName} completed successfully`);
            return result;
            
        } catch (error) {
            // データベース操作のエラーをラップ
            throw new DatabaseError(
                `Database operation failed: ${error.message}`,
                operation,
                tableName,
                error
            );
        }
    } catch (error) {
        // エラーログを詳細に記録
        console.error(`[handleDatabaseProcess] Error:`, {
            name: error.name,
            message: error.message,
            operation: error.operation || operation,
            tableName: error.tableName || tableName,
            timestamp: error.timestamp || new Date().toISOString(),
            stack: error.stack
        });
        
        // エラーを再スロー
        throw error;
    }
}

// ============================================
// Helper Functions
// ============================================

/**
 * スプレッドシートオブジェクトを取得します（権限チェック用）
 * @returns {Spreadsheet} スプレッドシートオブジェクト
 */
function getSpreadsheet() { //ページ読み込み時の権限チェックに使用中。データベース操作時には使っていない。
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    return ss;
}

/**
 * シートオブジェクトを取得します
 * @param {Spreadsheet} ss - スプレッドシートオブジェクト
 * @param {string} sheetName - シート名
 * @returns {Sheet} シートオブジェクト
 */
function getSheet(ss, sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    return sheet;
}

/**
 * UUIDを生成します
 * @returns {string} 生成されたUUID
 */
function generateUuid() {
    const uuid = Utilities.getUuid();
    console.log('Generated UUID: ' + uuid);
    return uuid;
}

/**
 * 次のシリアル番号を取得します（display_id用）
 * @param {string} sheetName - シート名
 * @param {string} columnName - カラム名
 * @returns {number} 次のシリアル番号
 */
function getNextSerial(sheetName, columnName) {
    try {
        const records = select(sheetName, {
            orderBy: { [columnName]: 'DESC' },
            limit: 1
        });

        if (records.length > 0 && records[0][columnName]) {
            const maxVal = Number(records[0][columnName]);
            return isNaN(maxVal) ? 1 : maxVal + 1;
        }

        return 1;
    } catch (error) {
        console.error(`Error getting next serial for ${columnName} in ${sheetName}:`, error);
        return 1;
    }
}

function prepareNewData(userId, sheetName, dataObject) {
    const headers = getTableHeaders(sheetName);
    const newData = { ...dataObject };

    const now = new Date().toISOString();
    if (headers.includes(`created_by`)) newData[`created_by`] = userId;
    if (headers.includes(`created_at`)) newData[`created_at`] = now;
    if (headers.includes(`updated_by`)) newData[`updated_by`] = userId;
    if (headers.includes(`updated_at`)) newData[`updated_at`] = now;
    if (headers.includes(`id`) && !dataObject.id) newData[`id`] = generateUuid();
    if (headers.includes(`display_id`)) newData[`display_id`] = getNextSerial(sheetName, `display_id`);

    console.log(`[prepareNewData] newData: ${JSON.stringify(newData)}`);
    return newData;
}

function prepareUpdateData(userId, sheetName, dataObject) {
    const headers = getTableHeaders(sheetName);
    const newData = { ...dataObject };

    const now = new Date().toISOString();
    if (headers.includes(`updated_by`)) newData[`updated_by`] = userId;
    if (headers.includes(`updated_at`)) newData[`updated_at`] = now;

    return newData;
}

// ============================================
// Log Operations
// 責任: 操作ログの記録
// ============================================

/**
 * 操作ログを作成します
 * @param {string} userId - ユーザーID
 * @param {string} tableName - テーブル名
 * @param {Object} dataObject - データオブジェクト
 * @param {string} operation - 操作タイプ
 * @param {string|null} remark - 備考
 * @throws {DatabaseError} ログ記録に失敗した場合
 */
function createLog(userId, tableName, dataObject, operation, remark) {
    try {
        const logData = {
            id: generateUuid(),
            operation_type_key: operation.toUpperCase(),
            table_name: tableName,
            record_id: dataObject.id || ``,
            data: JSON.stringify(dataObject),
            remark: remark || ``,
            created_by: userId,
            created_at: new Date().toISOString()
        };

        insert(userId, TABLE_NAMES.LOGS, logData);
    } catch (error) {
        console.error('[createLog] Failed to create log:', error);
        // ログ記録の失敗は主処理には影響させない
    }
}

/**
 * テーブルキャッシュを無効化します
 * @param {string} tableName - テーブル名
 */
function invalidateTableCache(tableName) {
    const cachePublicRange = CACHE_CONFIG.PUBLIC_RANGE.SCRIPT;
    const generalCacheKey = `user_items_${tableName}`;
    CacheManager.invalidate(generalCacheKey, cachePublicRange);
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

// ============================================
// Google Drive API Helper Functions
// ============================================

/**
 * OAuthトークンを取得
 * @returns {string} OAuthトークン
 */
function getOAuthToken() {
    try {
        const token = ScriptApp.getOAuthToken();
        return sanitizeForClient(token);
    } catch (e) {
        Logger.log('OAuthトークン取得エラー: ' + e.message);
        throw new Error('OAuthトークンの取得に失敗しました: ' + e.message);
    }
}

/**
 * Google DriveのファイルIDからファイル情報を取得
 * @param {string} fileId - Google DriveのファイルID
 * @returns {Object} ファイル情報 { file_id, file_name, file_type, file_url, modified_time }
 */
function getDriveFileInfo(fileId) {
    try {
        const file = DriveApp.getFileById(fileId);

        const fileInfo = {
            file_id: fileId,
            file_name: file.getName(),
            file_type: file.getMimeType(),
            file_url: file.getUrl(),
            modified_time: file.getLastUpdated().toISOString()
        };

        return sanitizeForClient(fileInfo);
    } catch (e) {
        Logger.log('ファイル情報取得エラー: ' + e.message);
        throw new Error('ファイル情報の取得に失敗しました: ' + e.message);
    }
}