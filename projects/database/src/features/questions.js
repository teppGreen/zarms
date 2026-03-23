// ============================================
// questions.gs - 問い合わせ同期処理
// 毎時トリガーで実行: 未処理の問い合わせからタスクを自動作成し、メール通知を送信
// ============================================

/**
 * 問い合わせ同期処理のエントリーポイント（毎時トリガーで呼び出し）
 * questionsテーブルのid未設定レコードを処理し、タスク作成・メール通知を行う
 */
function syncQuestions() {
    const userId = TASK_BY_QUESTION_DEFAULT_VALUES.created_by;
    const now = new Date();

    // 1. 前回同期日時を取得
    const lastSyncStr = scriptProperties.getProperty('last_sync_questions');

    // 2. questionsテーブルからcreated_atが前回同期以降のレコードを取得
    const query = lastSyncStr
        ? { where: { created_at: ['>', new Date(lastSyncStr)] } }
        : {};

    const result = handleDatabaseProcess(userId, TABLE_NAMES.QUESTIONS, 'select', query, null, true);
    const questions = result?.data || result || [];
    scriptProperties.setProperty('last_sync_questions', now.toISOString());

    // 3. 該当データがなければ同期日時のみ更新して終了
    if (questions.length === 0) {
        console.log('[syncQuestions] 未処理の問い合わせはありません');
        return;
    }

    console.log(`[syncQuestions] ${questions.length}件の未処理問い合わせを検出`);

    // ボードのメールアドレスを事前取得（全レコードで共通）
    const boardEmail = getBoardEmail_(TASK_BY_QUESTION_DEFAULT_VALUES.board_id);

    // 4-7. 各レコードを順番に処理
    for (const question of questions) {
        try {
            processQuestion_(userId, question, boardEmail);
        } catch (error) {
            console.error(`[syncQuestions] 問い合わせ処理エラー (question_number: ${question.question_number}):`, error);
            // エラーが発生しても次のレコードの処理を継続
        }
    }

    console.log('[syncQuestions] 処理完了');
}

// ============================================
// 個別レコード処理
// ============================================

/**
 * 問い合わせレコード1件を処理する
 * @param {string} userId - システムユーザーID
 * @param {Object} question - 問い合わせレコード
 * @param {string} boardEmail - 通知先メールアドレス
 */
function processQuestion_(userId, question, boardEmail) {
    // tasksテーブルにタスクを作成
    const taskId = generateUuid();
    const createdAtDate = parseDateSafe_(question.created_at);
    const taskData = {
        id: taskId,
        name: buildTaskName_(question),
        description: buildTaskDescription_(question),
        starts_at: createdAtDate.toISOString(),
        ends_at: calculateEndDate_(createdAtDate).toISOString(),
        ...TASK_BY_QUESTION_DEFAULT_VALUES
    };

    const insertResult = handleDatabaseProcess(userId, TABLE_NAMES.TASKS, 'insert', taskData, '問い合わせからタスクを自動作成');
    // insertResult.data が配列の場合は先頭を取り出して正規化
    const rawData = insertResult?.data;
    const createdTask = (Array.isArray(rawData) ? rawData[0] : rawData) || taskData;

    // 5. 共有URLを構築
    const shareUrl = buildTaskShareUrl_(createdTask.id || taskId);

    // 7. メールを作成・送信
    const email = buildNotificationEmail_(createdTask, question, shareUrl, boardEmail);
    MailApp.sendEmail(email);

    console.log(`[syncQuestions] タスク作成・メール送信完了 (question_number: ${question.question_number}, task_id: ${createdTask.id || taskId})`);
}

// ============================================
// ヘルパー関数
// ============================================

/**
 * タスク名を構築する
 * @param {Object} question - 問い合わせレコード
 * @returns {string} タスク名
 */
function buildTaskName_(question) {
    const maxLength = 20;
    let contentPreview = question.question_content || '';

    if (contentPreview.length > maxLength) {
        contentPreview = contentPreview.substring(0, maxLength - 1) + '…';
    }

    return `[大学祭問合せ] [${question.question_number}] ${contentPreview}`;
}

/**
 * タスク説明HTMLを構築する
 * @param {Object} question - 問い合わせレコード
 * @returns {string} 説明HTML文字列
 */
function buildTaskDescription_(question, forEmail = false) {
    const contentHtml = (question.question_content || '').replace(/\n/g, '<br>');
    const answerField = !forEmail ? `<h2><strong>回答内容</strong></h2><p><br></p>` : '';

    return `<h2><strong>カテゴリ</strong></h2><p>${question.question_category || ''}</p><h2><strong>問い合わせ内容</strong></h2><p>${contentHtml}</p>${answerField}`;
}

/**
 * 日付値を安全にDateオブジェクトに変換する
 * GViz APIが返す "Date(year,month,day,hour,min,sec)" 形式にも対応
 * @param {string|Date} dateValue - 日付値
 * @returns {Date} Dateオブジェクト
 */
function parseDateSafe_(dateValue) {
    if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
        return dateValue;
    }

    if (typeof dateValue === 'string') {
        // GViz "Date(year,month,day,...)" 形式のパース
        const gvizMatch = dateValue.match(/Date\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+),\s*(\d+),\s*(\d+))?\)/);
        if (gvizMatch) {
            const [, year, month, day, hour = '0', minute = '0', second = '0'] = gvizMatch;
            return new Date(parseInt(year), parseInt(month), parseInt(day), parseInt(hour), parseInt(minute), parseInt(second));
        }

        // ISO文字列やその他の標準形式
        const parsed = new Date(dateValue);
        if (!isNaN(parsed.getTime())) {
            return parsed;
        }
    }

    throw new RangeError(`日付の解析に失敗しました: ${dateValue}`);
}

/**
 * 終了日時を計算する（created_at + 3日、時刻は18:00 JST固定）
 * @param {Date} createdAtDate - 作成日時Dateオブジェクト
 * @returns {Date} 終了日時
 */
function calculateEndDate_(createdAtDate) {
    const date = new Date(createdAtDate.getTime());
    date.setDate(date.getDate() + 3);

    // JST 18:00 = UTC 09:00
    date.setUTCHours(9, 0, 0, 0);

    return date;
}

/**
 * タスク詳細の共有URLを構築する
 * @param {string} taskId - タスクID
 * @returns {string} 共有URL
 */
function buildTaskShareUrl_(taskId) {
    return `${EXTERNAL_URLS.ZARMS_WEB}?tab=board&board_id=${TASK_BY_QUESTION_DEFAULT_VALUES.board_id}&modal=task-detail&task_id=${taskId}`;
}

/**
 * ボードIDからメールアドレスを取得する
 * @param {string} boardId - ボードID
 * @returns {string} メールアドレス
 */
function getBoardEmail_(boardId) {
    const result = handleDatabaseProcess(null, TABLE_NAMES.BOARDS, 'select', {
        where: { id: ['=', boardId] }
    }, null, true);

    const boards = result?.data || result || [];

    if (boards.length === 0) {
        throw new Error(`ボードが見つかりません (board_id: ${boardId})`);
    }

    return boards[0].email;
}

/**
 * 通知メールオブジェクトを構築する
 * @param {Object} task - タスクデータ
 * @param {Object} question - 問い合わせレコード
 * @param {string} shareUrl - 共有URL
 * @param {string} boardEmail - 送信先メールアドレス
 * @returns {Object} MailApp.sendEmail用のオプションオブジェクト
 */
function buildNotificationEmail_(task, question, shareUrl, boardEmail) {
    const datetime = Utilities.formatDate(new Date(parseDateSafe_(question.created_at)), 'JST', 'yyyy-MM-dd(E) HH:mm:ss');
    const description = buildTaskDescription_(question, true);
    const bodyHtml = `${description}<hr><p>この問い合わせは ${datetime} に送信されました。ZARMSに<a href="${shareUrl}" target="_blank" rel="noopener noreferrer"> タスク#${task.display_id}</a> として起票済です。</p>`;

    return {
        to: boardEmail,
        name: 'ZARMS',
        subject: task.name,
        htmlBody: bodyHtml,
        replyTo: boardEmail
    };
}