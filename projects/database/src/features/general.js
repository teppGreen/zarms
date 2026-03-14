/**
 * メールアドレスからメンバー情報を取得します
 * @param {string} email - メールアドレス
 * @returns {Object} ユーザー情報
 */
function getMemberByEmail(email) {
    try {
        console.log('[getMemberByEmail] email:', email);
        if (!email || typeof email !== 'string') {
            throw new ValidationError('Invalid email address', 'email', email);
        }
        let result = handleDatabaseProcess(null, TABLE_NAMES.MEMBERS, 'select', {
            where: { email: ["=", email] }
        }, null, false);
        let members = result?.data || result || [];
        if (members.length === 0) {
            result = handleDatabaseProcess(null, TABLE_NAMES.MEMBERS, 'select', {
                where: { email: ["=", email] }
            }, null, true);
            members = result?.data || result || [];
            if (members.length === 0) {
                throw new ValidationError('User not found', 'email', email);
            }
        }
        return members[0];
    } catch (error) {
        console.error('[getMemberByEmail] Error:', error);
        throw error;
    }
}

/**
 * Slack URLからユーザーを検索します
 * @param {string} slackProfileUrl - SlackプロフィールURL
 * @returns {Object|null} ユーザー情報
 */
function findUserBySlackUrl(slackProfileUrl) {
    try {
        const result = handleDatabaseProcess(null, TABLE_NAMES.MEMBERS, 'select', {
            where: { slack_profile_url: ["=", slackProfileUrl] }
        }, null, false);
        const members = result?.data || result || [];
        return members.length === 0 ? null : members[0];
    } catch (error) {
        console.error('findUserBySlackUrl error:', error);
        return null;
    }
}

/**
 * ユーザーのemailを登録します
 * @param {string} userId - ユーザーのID
 * @returns {boolean}
 */
function registerUserEmail(userId) {
    try {
        const email = Session.getActiveUser().getEmail();
        if (!email) {
            console.error('No active user email found');
            return false;
        }
        const result = handleDatabaseProcess(userId, TABLE_NAMES.MEMBERS, 'update', {
            set: { email: email },
            where: { id: ["=", userId], email: ["is null"] }
        }, 'ユーザーのemailを登録');
        return !!result;
    } catch (error) {
        console.error('registerUserEmail error:', error);
        return false;
    }
}