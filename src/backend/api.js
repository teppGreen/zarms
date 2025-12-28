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
        console.log('doPost started');

        if (!e) throw new Error('Event object is undefined');
        if (!e.postData) throw new Error('e.postData is undefined');

        const lock = LockService.getScriptLock();

        try {
            // 同時書き込み対策: 最大60秒待機
            lock.waitLock(60000);

            // リクエストボディの解析
            const contents = JSON.parse(e.postData.contents);
            const { token, sheetnames, email, operation, targetSheetName, data } = contents;

            // トークン検証
            if (token !== API_TOKEN) {
                return createResponse({
                    status: 'error',
                    message: 'Invalid token'
                }, 403);
            }

            // 必須パラメータの簡易チェック
            if (!sheetnames || !email || !operation || !targetSheetName) {
                console.log(`Missing parameters: operation=${operation}, targetSheetName=${targetSheetName}`);
                return createResponse({
                    status: 'error',
                    message: 'Missing required parameters'
                }, 400);
            }

            SHEET_NAMES = sheetnames;

            const activeUserEmail = Session.getActiveUser().getEmail();
            if (activeUserEmail !== email) {
                console.log(`リクエスト元のユーザーがBackendWebAppをデプロイしたユーザーと同じ Google Workspace ドメインに属していない場合、本システムは使用できません。`);
                return createResponse({
                    status: 'error',
                    message: 'リクエスト元のユーザーがBackendWebAppをデプロイしたユーザーと同じ Google Workspace ドメインに属していない場合、本システムは使用できません。'
                }, 401);
            }

            const activeUserPermission = getUserPermission(email);
            if (!activeUserPermission) {
                console.log(`User ${email} is not authorized to perform this operation`);
                return createResponse({
                    status: 'error',
                    message: 'User is not authorized to perform this operation'
                }, 403);
            }

            let result = false;

            // 操作の実行
            switch (operation) {
                case 'select':
                    // data.query, data.options
                    if (!data || !data.query) throw new Error('Query is required for select operation');
                    result = select(targetSheetName, data.query, data.options);
                    return createResponse({
                        status: 'success',
                        data: result
                    });

                case 'insert':
                    // data.record
                    if (!data || !data.record) throw new Error('Record is required for insert operation');
                    result = insert(userId, targetSheetName, data.record);
                    return createResponse({
                        status: 'success',
                        data: result
                    });

                case 'bulkinsert':
                    // data.records
                    if (!data || !data.records) throw new Error('Records are required for bulkinsert operation');
                    result = bulkInsert(userId, targetSheetName, data.records);
                    return createResponse({
                        status: 'success',
                        data: result
                    });

                case 'update':
                    // data.query
                    if (!data || !data.query) throw new Error('Query is required for update operation');
                    result = update(userId, targetSheetName, data.query);
                    return createResponse({
                        status: 'success',
                        data: result
                    });

                case 'remove':
                    // data.query
                    if (!data || !data.query) throw new Error('Query is required for remove operation');
                    result = remove(userId, targetSheetName, data.query);
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
            console.log('API Error: ' + error.message);
            return createResponse({
                status: 'error',
                message: error.message
            }, 500);

        } finally {
            // ロックの解放
            try {
                lock.releaseLock();
            } catch (e) {
                console.log('Error releasing lock: ' + e.message);
            }
        }
    } catch (fatalError) {
        console.log('Fatal Error in doPost: ' + fatalError.toString());
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

/**
 * APIリクエスト送信元のユーザーの権限を取得します。
 * @param {string} email - ユーザーのメールアドレス
 * @returns {string} ユーザーの権限
 */
function getUserPermission(email) {
    const user = select(sheetnames.MEMBERS, { where: { email: email } });
    if (!user) return 'guest';
    return user.permission;