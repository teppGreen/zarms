// ============================================
// database.gs - データベース操作の抽象化（高速化アーキテクチャ）
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
// Header Mapping Utility for GViz & Sheets API
// ============================================

/**
 * シート名からヘッダーマッピングを取得・キャッシュ
 * GViz APIでは列名ではなく列ID（A, B, C...）で指定する必要があるため
 * @param {string} sheetName - シート名
 * @returns {Object} { columnName: columnId, ... } のマッピングオブジェクト
 */
function getHeadersMap(sheetName) {

    try {
        const headers = getHeadersFromSheetsAPI(sheetName);

        // ヘッダー名を列IDにマッピング
        const headersMap = {};
        const columnIds = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

        headers.forEach((header, index) => {
            if (index < 26) {
                headersMap[header] = columnIds[index];
            } else {
                // 26列目以降はAA, AB, AC...形式
                const firstLetter = columnIds[Math.floor((index - 26) / 26)];
                const secondLetter = columnIds[(index - 26) % 26];
                headersMap[header] = firstLetter + secondLetter;
            }
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

        conditions.push(`${columnId} ${operator} ${escapedValue}`);
    }

    return conditions.join(' AND ');
}

// ============================================
// Select Operation using Google Visualization API
// ============================================

/**
 * Google Visualization APIを使用してデータを取得
 * @param {string} sheetName - シート名
 * @param {Object} query - SSSQL形式のクエリオブジェクト
 * @returns {Array} 取得したデータ配列
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
        const headers = getHeadersFromSheetsAPI(sheetName);

        // データの変換
        return gvizResponse.table.rows.map(row => {
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
 * Sheets APIからヘッダー情報を取得
 * @param {string} sheetName - シート名
 * @returns {Array} ヘッダー配列
 */
function getHeadersFromSheetsAPI(sheetName) {
    try {
        const response = Sheets.Spreadsheets.Values.get(SPREADSHEET_ID, `${sheetName}!1:1`);
        const headers = response.values ? response.values[0] : [];

        return headers;
    } catch (error) {
        console.error(`Error getting headers for ${sheetName}:`, error);
        throw error;
    }
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
 * 新しいレコードを挿入
 * @param {string} userId - ユーザーID
 * @param {string} sheetName - シート名
 * @param {Object} record - 挿入するレコード
 * @returns {Object} 挿入結果
 */
function insert(userId, sheetName, record) {
    const lock = LockService.getScriptLock();
    lock.waitLock(60000);

    try {
        const headers = getHeadersFromSheetsAPI(sheetName);
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

        return { success: true, updatedRange: response.updates.updatedRange };
    } finally {
        lock.releaseLock();
    }
}

/**
 * 複数のレコードを一括挿入
 * @param {string} userId - ユーザーID
 * @param {string} sheetName - シート名
 * @param {Array} records - 挿入するレコード配列
 * @returns {Object} 挿入結果
 */
function bulkInsert(userId, sheetName, records) {
    const lock = LockService.getScriptLock();
    lock.waitLock(60000);

    try {
        const headers = getHeadersFromSheetsAPI(sheetName);
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
 * レコードを更新
 * @param {string} userId - ユーザーID
 * @param {string} sheetName - シート名
 * @param {Object} query - 更新クエリ { set: {...}, where: {...} }
 * @returns {Object} 更新結果
 */
function update(userId, sheetName, query) {
    const lock = LockService.getScriptLock();
    lock.waitLock(60000);

    try {
        const headersMap = getHeadersMap(sheetName);
        const headers = getHeadersFromSheetsAPI(sheetName);

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
 * レコードを削除
 * @param {string} sheetName - シート名
 * @param {Object} query - 削除クエリ { where: {...} }
 * @returns {Object} 削除結果
 */
function remove(sheetName, query) {
    const lock = LockService.getScriptLock();
    lock.waitLock(60000);

    try {
        const headersMap = getHeadersMap(sheetName);

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
function handleDatabaseProcess(userId, tableName, operation, dataObject, remark, forceRefresh = false) {
    // キャッシュキーの生成
    const cacheKey = `db_${tableName}_${JSON.stringify(dataObject)}`;
    const cachePublicRange = 'script';

    // selectかつforceRefreshがfalseの場合、キャッシュを使用
    if (operation === 'select' && !forceRefresh) {
        const cached = CacheManager.get(cacheKey, cachePublicRange);
        if (cached) {
            return { data: cached, isCached: true };
        }
    }

    let result;

    try {
        switch (operation) {
            case 'select':
                result = select(tableName, dataObject);
                // selectの場合は常にキャッシュを作成
                CacheManager.put(cacheKey, result, cachePublicRange);
                return { data: result, isCached: false };
            case 'insert':
                result = insert(userId, tableName, dataObject);
                createLog(userId, tableName, dataObject, operation, remark);
                // insert時は関連するselectキャッシュを無効化
                invalidateTableCache(tableName);
                break;
            case 'bulkinsert':
                result = bulkInsert(userId, tableName, dataObject);
                createLog(userId, tableName, dataObject, operation, remark);
                // bulkinsert時は関連するselectキャッシュを無効化
                invalidateTableCache(tableName);
                break;
            case 'update':
                result = update(userId, tableName, dataObject);
                createLog(userId, tableName, dataObject, operation, remark);
                // update時は関連するselectキャッシュを無効化
                invalidateTableCache(tableName);
                break;
            case 'remove':
                result = remove(tableName, dataObject);
                createLog(userId, tableName, dataObject, operation, remark);
                // remove時は関連するselectキャッシュを無効化
                invalidateTableCache(tableName);
                break;
            default:
                throw new Error(`Unsupported operation: ${operation}`);
        }

        return result;
    } catch (error) {
        console.error(`Database operation error (${operation} on ${tableName}):`, error);
        throw error;
    }
}

// ============================================
// Helper Functions
// ============================================

function getSpreadsheet() { //ページ読み込み時の権限チェックに使用中。データベース操作時には使っていない。
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    return ss;
}

function getSheet(ss, sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    return sheet;
}

function generateUuid() {
    const uuid = Utilities.getUuid();
    console.log('Generated UUID: ' + uuid);
    return uuid;
}

/**
 * 次のシリアル番号を取得（display_id用）
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
    const headers = getHeadersFromSheetsAPI(sheetName);
    const newData = { ...dataObject };

    const now = new Date().toISOString();
    if (headers.includes(`created_by`)) newData[`created_by`] = userId;
    if (headers.includes(`created_at`)) newData[`created_at`] = now;
    if (headers.includes(`updated_by`)) newData[`updated_by`] = userId;
    if (headers.includes(`updated_at`)) newData[`updated_at`] = now;
    if (headers.includes(`id`)) newData[`id`] = generateUuid();
    if (headers.includes(`display_id`)) newData[`display_id`] = getNextSerial(sheetName, `display_id`);

    return newData;
}

function prepareUpdateData(userId, sheetName, dataObject) {
    const headers = getHeadersFromSheetsAPI(sheetName);
    const newData = { ...dataObject };

    const now = new Date().toISOString();
    if (headers.includes(`updated_by`)) newData[`updated_by`] = userId;
    if (headers.includes(`updated_at`)) newData[`updated_at`] = now;

    return newData;
}

function createLog(userId, tableName, dataObject, operation, remark) {
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

    try {
        insert(userId, TABLE_NAMES.LOGS, logData);
    } catch (error) {
        console.error('Error creating log:', error);
        // ログ作成の失敗はメイン処理をブロックしない
    }
}

/**
 * 指定されたテーブルに関連するすべてのキャッシュを無効化
 * @param {string} tableName - テーブル名
 */
function invalidateTableCache(tableName) {
    const cachePublicRange = 'script';
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