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
        }, null, true);
        const members = result?.data || result || [];
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
        return members[0];
    } catch (error) {
        console.error('findUserBySlackUrl error:', error);
        return null;
    }
}

/**
 * ユーザーのemailを登録します
 * 同時に、利用規約・プライバシーポリシーの同意日時をユーザープロパティに記録します
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

        // ユーザープロパティに利用規約・プライバシーポリシーの同意日時を記録
        if (result) {
            const now = new Date().toISOString();
            const userProperties = PropertiesService.getUserProperties();
            userProperties.setProperty('termsAgreedAt', now);
            userProperties.setProperty('privacyAgreedAt', now);
        }

        return !!result;
    } catch (error) {
        console.error('registerUserEmail error:', error);
        return false;
    }
}