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

/**
 * 打刻処理を行います
 * @param {string} userId - ユーザーID
 * @param {Object} location - 位置情報 ({ latitude, longitude })
 * @param {string} action - 'start', 'end', 'cancelStart', 'cancelEnd' のいずれか
 * @returns {Object} { success: true, updates: { [field]: value } }
 */
function punchAttendance(userId, location, action) {
    if (!userId) throw new Error('ユーザーIDが必要です。');

    const result = handleDatabaseProcess(userId, TABLE_NAMES.MEMBERS, 'select', { where: { id: ["=", userId] } }, null, true);
    const members = result?.data || result || [];
    if (members.length === 0) throw new Error('ユーザー情報が見つかりません。');
    const member = members[0];

    const getJstDateString = (date) => Utilities.formatDate(date || new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
    const todayStr = getJstDateString(new Date());
    const eventConfig = typeof EVENT_CONFIG !== 'undefined' ? EVENT_CONFIG : {};
    const dBase = new Date(`${eventConfig.FESTIVAL_DATE || '2026-04-24'}T00:00:00+09:00`);
    const dates = {
        fri: Utilities.formatDate(dBase, 'Asia/Tokyo', 'yyyy-MM-dd'),
        sat: Utilities.formatDate(new Date(dBase.getTime() + 86400000), 'Asia/Tokyo', 'yyyy-MM-dd'),
        sun: Utilities.formatDate(new Date(dBase.getTime() + 86400000 * 2), 'Asia/Tokyo', 'yyyy-MM-dd')
    };

    let dayKey = null;
    for (const [key, dateStr] of Object.entries(dates)) {
        if (dateStr === todayStr) {
            dayKey = key;
            break;
        }
    }

    if (!dayKey) {
        throw new Error('本日は打刻対象日ではありません。');
    }

    const isWorkingField = `${dayKey}_is_working`;
    if (String(member[isWorkingField]).toLowerCase() !== 'true') {
        throw new Error('本日は稼働日として設定されていないため、打刻できません。');
    }

    let targetField = '';
    let isPunching = false;
    let newValue = '';
    let remark = '';

    if (action === 'start') {
        if (member[`${dayKey}_actual_start_at`]) throw new Error('既に稼働開始の打刻が完了しています。');
        targetField = `${dayKey}_actual_start_at`;
        isPunching = true;
        newValue = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'HH:mm');
        remark = `${dayKey}曜日: 稼働開始を記録しました`;
    } else if (action === 'end') {
        if (!member[`${dayKey}_actual_start_at`]) throw new Error('最初に稼働開始の打刻を行ってください。');
        if (member[`${dayKey}_actual_end_at`]) throw new Error('既に稼働終了の打刻が完了しています。');
        targetField = `${dayKey}_actual_end_at`;
        isPunching = true;
        newValue = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'HH:mm');
        remark = `${dayKey}曜日: 稼働終了を記録しました`;
    } else if (action === 'cancelStart') {
        if (!member[`${dayKey}_actual_start_at`]) throw new Error('取消対象の稼働開始打刻がありません。');
        if (member[`${dayKey}_actual_end_at`]) throw new Error('稼働終了の打刻が残っているため、開始の取消はできません。');
        targetField = `${dayKey}_actual_start_at`;
        isPunching = false;
        newValue = '';
        remark = `${dayKey}曜日: 稼働開始を取消しました`;
    } else if (action === 'cancelEnd') {
        if (!member[`${dayKey}_actual_end_at`]) throw new Error('取消対象の稼働終了打刻がありません。');
        targetField = `${dayKey}_actual_end_at`;
        isPunching = false;
        newValue = '';
        remark = `${dayKey}曜日: 稼働終了を取消しました`;
    } else {
        throw new Error('無効なアクションです。');
    }

    if (isPunching) {
        if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
            throw new Error('位置情報が取得できないため、打刻できません。');
        }

        const geofence = eventConfig.ATTENDANCE_GEOFENCE || { LATITUDE: 35.64, LONGITUDE: 140.03, RADIUS_METERS: 300 };
        const toRad = function (deg) { return deg * Math.PI / 180; };
        const earthRadius = 6371000;
        const dLat = toRad(geofence.LATITUDE - location.latitude);
        const dLon = toRad(geofence.LONGITUDE - location.longitude);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
            + Math.cos(toRad(location.latitude)) * Math.cos(toRad(geofence.LATITUDE))
            * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = earthRadius * c;

        if (!isFinite(distance) || distance > (geofence.RADIUS_METERS || 300)) {
            throw new Error(`会場外では打刻できません（現在地は会場中心から約${Math.round(distance)}mです）`);
        }
    }

    const updates = {};
    updates[targetField] = newValue;

    handleDatabaseProcess(userId, TABLE_NAMES.MEMBERS, 'update', {
        set: updates,
        where: { id: ["=", userId] },
        _systemPass: 'allow_punch'
    }, remark);

    return {
        success: true,
        updates: updates
    };
}