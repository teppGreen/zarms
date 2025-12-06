// ============================================
// api.gs - APIエンドポイント処理
// ============================================

/**
 * POSTリクエストを処理します。
 * フロントエンドからのデータベース変更リクエストを受け取ります。
 * 
 * @param {Object} e - イベントオブジェクト
 * @returns {GoogleAppsScript.Content.TextOutput} JSONレスポンス
 */
function doPost(e) {
    try {
        Logger.log('doPost started');

        if (!e) throw new Error('Event object is undefined');
        if (!e.postData) throw new Error('e.postData is undefined');

        const lock = LockService.getScriptLock();

        try {
            // 同時書き込み対策: 最大60秒待機
            lock.waitLock(60000);

            // リクエストボディの解析
            const contents = JSON.parse(e.postData.contents);
            const { token, userId, operation, sheetName, data, id, condition, idColumnName } = contents;

            // トークン検証
            if (token !== API_TOKEN) {
                return createResponse({
                    status: 'error',
                    message: 'Invalid token'
                }, 403);
            }

            // 必須パラメータの簡易チェック
            if (!userId || !operation || !sheetName) {
                Logger.log(`Missing parameters: operation=${operation}, sheetName=${sheetName}`);
                return createResponse({
                    status: 'error',
                    message: 'Missing required parameters'
                }, 400);
            }

            let result = false;

            // 操作の実行
            switch (operation) {
                case 'read_all':
                    result = getAllData(sheetName);
                    return createResponse({
                        status: 'success',
                        data: result
                    });

                case 'read_by_id':
                    if (!id) throw new Error('ID is required for read_by_id operation');
                    result = getDataById(sheetName, idColumnName, id);
                    return createResponse({
                        status: 'success',
                        data: result
                    });

                case 'find':
                    if (!condition) throw new Error('Condition is required for find operation');
                    result = findData(sheetName, condition);
                    return createResponse({
                        status: 'success',
                        data: result
                    });

                case 'create':
                    if (!data) throw new Error('Data is required for create operation');
                    result = createData(userId, sheetName, idColumnName, data);
                    return createResponse({
                        status: 'success',
                        data: result
                    });

                case 'update':
                    if (!id || !data) throw new Error('ID and Data are required for update operation');
                    result = updateData(userId, sheetName, idColumnName, id, data);
                    return createResponse({
                        status: 'success',
                        data: result
                    });

                case 'delete':
                    if (!condition) throw new Error('Condition is required for delete operation');
                    result = deleteData(userId, sheetName, idColumnName, condition);
                    return createResponse({
                        status: 'success',
                        data: result
                    });

                default:
                    return createResponse({
                        status: 'error',
                        message: `Unknown operation: ${operation}`
                    }, 400);
            }

            return result;

        } catch (error) {
            // ロック取得タイムアウトまたはその他のエラー
            Logger.log('API Error: ' + error.message);
            return createResponse({
                status: 'error',
                message: error.message
            }, 500);

        } finally {
            // ロックの解放
            try {
                lock.releaseLock();
            } catch (e) {
                Logger.log('Error releasing lock: ' + e.message);
            }
        }
    } catch (fatalError) {
        Logger.log('Fatal Error in doPost: ' + fatalError.toString());
        const output = ContentService.createTextOutput();
        output.setMimeType(ContentService.MimeType.JSON);
        output.setContent(JSON.stringify({
            status: 'error',
            message: 'Fatal Error: ' + fatalError.toString()
        }));
        return output;
    }
}

/**
 * JSONレスポンスを作成します。
 * @param {Object} content - レスポンスの内容
 * @param {number} statusCode - HTTPステータスコード (デフォルト: 200)
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function createResponse(content, statusCode = 200) {
    // GASのdoPostはステータスコードを直接設定できないが、
    // レスポンスボディに含めることでクライアント側で判断可能にする慣習がある。
    // ここでは単純にJSONを返す。
    const output = ContentService.createTextOutput();
    output.setMimeType(ContentService.MimeType.JSON);
    output.setContent(JSON.stringify(content));
    return output;
}
