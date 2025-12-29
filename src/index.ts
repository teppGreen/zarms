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

import { select, insert, bulkInsert, update, remove } from './database';
import './server';

// ============================================
// APIエンドポイント処理
// ============================================

declare const API_TOKEN: string;

/**
 * POSTリクエストを処理します。
 * フロントエンドからのデータベース変更リクエストを受け取ります。
 *
 * @param {Object} e - イベントオブジェクト
 * @returns {GoogleAppsScript.Content.TextOutput} JSONレスポンス
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function doPost(e: any) {
  let lock: GoogleAppsScript.Lock.Lock | null = null;
  try {
    if (!e) throw new Error('Event object is undefined');
    if (!e.postData) throw new Error('e.postData is undefined');

    lock = LockService.getScriptLock();

    try {
      // 同時書き込み対策: 最大60秒待機
      lock.waitLock(60000);

      // リクエストボディの解析
      const contents = JSON.parse(e.postData.contents);
      const { token, sheetNames, email, operation, targetSheetName, data } =
        contents;

      // トークン検証
      if (token !== API_TOKEN) {
        return createResponse({
          status: 'error',
          message: 'Invalid token',
        });
      }

      // 必須パラメータの簡易チェック
      if (!sheetNames || !email || !operation || !targetSheetName) {
        console.log(
          `Missing parameters: operation=${operation}, targetSheetName=${targetSheetName}, sheetNames=${sheetNames}, email=${email}`
        );
        return createResponse({
          status: 'error',
          message: 'Missing required parameters',
        });
      }

      // use request specific sheet names
      const requestSheetNames = sheetNames;

      const activeUserEmail = Session.getActiveUser().getEmail();
      const userId = activeUserEmail;

      if (activeUserEmail !== email) {
        console.log(
          `リクエスト元のユーザーがBackendWebAppをデプロイしたユーザーと同じ Google Workspace ドメインに属していない場合、本システムは使用できません。`
        );
        return createResponse({
          status: 'error',
          message:
            'リクエスト元のユーザーがBackendWebAppをデプロイしたユーザーと同じ Google Workspace ドメインに属していない場合、本システムは使用できません。',
        });
      }

      const activeUserPermission = getUserPermission(email, requestSheetNames);
      if (!activeUserPermission) {
        console.log(
          `User ${email} is not authorized to perform this operation`
        );
        return createResponse({
          status: 'error',
          message: 'User is not authorized to perform this operation',
        });
      }

      let result: any = false;

      // 操作の実行
      switch (operation) {
        case 'select':
          // data.query, data.options
          if (!data || !data.query)
            throw new Error('Query is required for select operation');
          result = select(targetSheetName, data.query, data.options);
          return createResponse({
            status: 'success',
            data: result,
          });

        case 'insert':
          // data.record
          if (!data || !data.record)
            throw new Error('Record is required for insert operation');
          result = insert(userId, targetSheetName, data.record);
          return createResponse({
            status: 'success',
            data: result,
          });

        case 'bulkinsert':
          // data.records
          if (!data || !data.records)
            throw new Error('Records are required for bulkinsert operation');
          result = bulkInsert(userId, targetSheetName, data.records);
          return createResponse({
            status: 'success',
            data: result,
          });

        case 'update':
          // data.query
          if (!data || !data.query)
            throw new Error('Query is required for update operation');
          result = update(userId, targetSheetName, data.query);
          return createResponse({
            status: 'success',
            data: result,
          });

        case 'remove':
          // data.query
          if (!data || !data.query)
            throw new Error('Query is required for remove operation');
          result = remove(userId, targetSheetName, data.query);
          return createResponse({
            status: 'success',
            data: result,
          });

        default:
          return createResponse({
            status: 'error',
            message: `Unknown operation: ${operation}`,
          });
      }
    } catch (error: any) {
      // ロック取得タイムアウトまたはその他のエラー
      console.log('API Error: ' + error.message);
      return createResponse({
        status: 'error',
        message: error.message,
      });
    } finally {
      // ロックの解放
      try {
        if (lock) lock.releaseLock();
      } catch (e: any) {
        console.log('Error releasing lock: ' + e.message);
      }
    }
  } catch (fatalError: any) {
    console.log('Fatal Error in doPost: ' + fatalError.toString());
    const output = ContentService.createTextOutput();
    output.setMimeType(ContentService.MimeType.JSON);
    output.setContent(
      JSON.stringify({
        status: 'error',
        message: 'Fatal Error: ' + fatalError.toString(),
      })
    );
    return output;
  } finally {
    // ロックの解放
    try {
      if (lock) lock.releaseLock();
    } catch (e: any) {
      console.log('Error releasing lock: ' + e.message);
    }
  }
}

/**
 * JSONレスポンスを作成します。
 * @param {Object} content - レスポンスの内容
 * @param {number} statusCode - HTTPステータスコード (デフォルト: 200)
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function createResponse(content: any) {
  // GASのdoPostはステータスコードを直接設定できないが、
  // レスポンスボディに含めることでクライアント側で判断可能にする慣習がある。
  // ここでは単純にJSONを返す。
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  output.setContent(JSON.stringify(content));
  return output;
}

/**
 * APIリクエスト送信元のユーザーの権限を取得します。
 * @param {string} email - ユーザーのメールアドレス
 * @param {any} sheetNames - シート名マップ
 * @returns {string} ユーザーの権限
 */
function getUserPermission(email: string, sheetNames: any) {
  const user = select(sheetNames.MEMBERS, { where: { email: ['=', email] } });
  return user.length > 0 ? user[0].system_role_key : null;
}
