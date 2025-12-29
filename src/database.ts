/**
 * Copyright 2025 TEPPei
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

declare const SSSQL: any;

export const SHEET_NAMES = {
  CREATIVES: 'creatives',
  PLANS: 'plans',
  MEMBERS: 'members',
  TASKS: 'tasks',
  KNOWLEDGES: 'knowledges',
  MEMBER_ASSIGNMENTS: 'member_assignments',
  SKILLS: 'skills',
  PREFIX: 'prefix',
  LOGS: 'logs',
};
export const ID_COLUMNS: { [key: string]: string } = {
  creatives: 'id',
  plans: 'id',
  members: 'email',
  tasks: 'id',
};

// ============================================
// database.ts - データベース操作の抽象化 (Backend)
// SSSQLライブラリを使用したCRUD操作
// ============================================

/**
 * スプレッドシートオブジェクトを取得します。
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet} スプレッドシートオブジェクト
 */
function getSpreadsheet() {
  const SPREADSHEET_ID = '1';
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * シート名からシートオブジェクトを取得します。
 * @param {string} sheetName - シート名
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} シートオブジェクト
 */
function getSheet(sheetName: string) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`シートが見つかりません: ${sheetName}`);
  }
  return sheet;
}

/**
 * シートのヘッダー行を取得します。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - シートオブジェクト
 * @returns {string[]} ヘッダーの配列
 */
function getHeaders(sheet: GoogleAppsScript.Spreadsheet.Sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

/**
 * UUIDを生成します。
 * @returns {string} UUID
 */
function generateUuid() {
  return Utilities.getUuid();
}

/**
 * 指定されたカラムの次のシリアル番号を取得します。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - シートオブジェクト
 * @param {string} columnName - カラム名
 * @returns {number} 次のシリアル番号
 */
function getNextSerial(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  columnName: string
) {
  // SSSQLを使用して最大値を取得
  const result = SSSQL.select(sheet, {
    groupBy: [[], { maxSerial: [columnName, 'MAX'] }],
  });

  if (result.length > 0 && result[0].maxSerial) {
    const maxVal = Number(result[0].maxSerial);
    return isNaN(maxVal) ? 1 : maxVal + 1;
  }

  return 1;
}

/**
 * 新しいデータを追加する前の準備処理（ID生成、監査情報付与）
 * @param {string} userId - 操作ユーザーのID
 * @param {Object} dataObject - 追加するデータオブジェクト
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - シートオブジェクト
 * @returns {Object} 準備されたデータオブジェクト
 */
function prepareNewData(
  userId: string,
  sheetName: string,
  dataObject: any,
  sheet: GoogleAppsScript.Spreadsheet.Sheet
) {
  const headers = getHeaders(sheet);
  const newData = { ...dataObject };

  // 監査情報の付与
  const now = new Date().toISOString();
  newData['created_by'] = userId;
  newData['created_at'] = now;
  // ID生成ロジック
  // 1. UUID (PK) の生成
  // 'id'カラムが存在し、かつ値が未設定の場合
  if (headers.includes('id') && !newData['id']) {
    newData['id'] = generateUuid();
  }

  // 2. Serial ID (display_id) の生成
  // 'display_id' カラムが存在する場合
  if (headers.includes('display_id') && !newData['display_id']) {
    newData['display_id'] = getNextSerial(sheet, 'display_id');
  }

  return newData;
}

// ============================================
// SSSQL を使用した CRUD 操作
// ============================================

export function select(sheetName: string, query: any, options?: any) {
  const sheet = getSheet(sheetName);
  return SSSQL.select(sheet, query, options);
}

/**
 * シートに単一のデータを挿入します (SSSQL.insert wrapper)
 * @param {string} userId - 操作ユーザーID
 * @param {string} sheetName - シート名
 * @param {Object} record - 挿入するデータ
 * @returns {Object} 挿入されたデータ
 */
export function insert(userId: string, sheetName: string, record: any) {
  const sheet = getSheet(sheetName);

  // データの準備（ID生成、監査情報付与）
  const newData = prepareNewData(userId, sheetName, record, sheet);

  // SSSQLを使用してデータを挿入
  const result = SSSQL.insert(sheet, newData);

  return result;
}

/**
 * シートに複数のデータを一括挿入します (SSSQL.bulkInsert wrapper)
 * @param {string} userId - 操作ユーザーID
 * @param {string} sheetName - シート名
 * @param {Object[]} records - 挿入するデータの配列
 * @returns {Object[]} 挿入されたデータの配列
 */
export function bulkInsert(userId: string, sheetName: string, records: any[]) {
  const sheet = getSheet(sheetName);

  // 各データの準備（ID生成、監査情報付与）
  const preparedData = records.map(record =>
    prepareNewData(userId, sheetName, record, sheet)
  );

  // SSSQLを使用してデータを一括挿入
  const result = SSSQL.bulkInsert(sheet, preparedData);

  return result;
}

/**
 * 条件に一致するデータを更新します (SSSQL.update wrapper)
 * @param {string} userId - 操作ユーザーID
 * @param {string} sheetName - シート名
 * @param {Object} query - クエリオブジェクト (set, where)
 * @returns {Object[]} 更新結果 (before/after のペア)
 */
export function update(userId: string, sheetName: string, query: any) {
  const sheet = getSheet(sheetName);

  // 監査情報の付与 (query.set に追加)
  const now = new Date().toISOString();
  const updateSet = { ...query.set };
  updateSet['updated_by'] = userId;
  updateSet['updated_at'] = now;

  const newQuery = { ...query, set: updateSet };

  // SSSQLを使用してデータを更新
  const result = SSSQL.update(sheet, newQuery);

  return result;
}

/**
 * 条件に一致するデータを削除します (SSSQL.remove wrapper)
 * @param {string} userId - 操作ユーザーID
 * @param {string} sheetName - シート名
 * @param {Object} query - クエリオブジェクト (where)
 * @returns {Object[]} 削除されたデータ
 */
export function remove(userId: string, sheetName: string, query: any) {
  const sheet = getSheet(sheetName);

  // SSSQLを使用してデータを削除
  const deletedRecords = SSSQL.remove(sheet, query);

  return deletedRecords;
}
