const PLAN_RANKING_CONFIG = {
    APP_TITLE: '特に良かった企画 | 来場者･運営者アンケート | 展軸祭2026',
    FAVICON_URL: 'https://i.gyazo.com/89db588b11cf08f2d14ee3ece99c22dd.png',
    SCRIPT_PROPERTY_SPREADSHEET_ID: 'PLAN_RANKING_SPREADSHEET_ID',
    DATA_START_ROW: 2,
    MEMBER_SHEET_NAME: '名簿_アンケ企画集計用',
    MEMBER_COLUMNS: {
        EMAIL: 1,
        DISPLAY_NAME: 2,
        ROLE: 3,
        PLAN_NUM: 4
    },
    PLAN_SHEET_NAME: 'アンケ_企画',
    PLAN_COLUMNS: {
        PLAN_TYPE: 1,
        PLAN_NUM: 2,
        PLAN_NAME: 3,
        DIRECTORY_NAME: 4,
        COUNT_NUM: 5,
        COUNT_RATIO: 6,
        RANKING_GENERAL_NUM: 7,
        RANKING_TYPE_NUM: 8
    },
    MESSAGE_THRESHOLDS: {
        TOP_RANK: 3,
        STRONG_COUNT: 30,
        LOW_COUNT: 10,
        HIGH_RATIO: 0.2
    }
};

function include(filename) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function doGet(e) {
    const template = HtmlService.createTemplateFromFile('index');
    const publicSpreadsheetId = PropertiesService.getScriptProperties().getProperty('PUBLIC_SPREADSHEET_ID');
    template.templateVariables = {
        APP_TITLE: PLAN_RANKING_CONFIG.APP_TITLE,
        PUBLIC_SHEET_URL: publicSpreadsheetId ? `https://docs.google.com/spreadsheets/d/${publicSpreadsheetId}/edit` : ''
    };

    return template.evaluate()
      .setTitle(PLAN_RANKING_CONFIG.APP_TITLE)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .addMetaTag('apple-mobile-web-app-capable', 'yes')
      .addMetaTag('mobile-web-app-capable', 'yes')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .setFaviconUrl(PLAN_RANKING_CONFIG.FAVICON_URL);
}

function getInitialPlanRankingData() {
    const activeUserEmail = String(Session.getActiveUser().getEmail() || '').trim();
    if (!activeUserEmail) {
        return createErrorResult_('メールアドレスを取得できませんでした。ドメインアカウントで再読み込みしてください。');
    }

    const spreadsheet = openPlanRankingSpreadsheet_();
    const memberSheet = spreadsheet.getSheetByName(PLAN_RANKING_CONFIG.MEMBER_SHEET_NAME);
    const planSheet = spreadsheet.getSheetByName(PLAN_RANKING_CONFIG.PLAN_SHEET_NAME);

    if (!memberSheet) {
        return createErrorResult_(`シート「${PLAN_RANKING_CONFIG.MEMBER_SHEET_NAME}」が見つかりません。`);
    }

    if (!planSheet) {
        return createErrorResult_(`シート「${PLAN_RANKING_CONFIG.PLAN_SHEET_NAME}」が見つかりません。`);
    }

    const member = findMemberByEmail_(memberSheet, activeUserEmail);
    if (!member) {
        return createErrorResult_(`メールアドレス「${activeUserEmail}」に一致する名簿データが見つかりません。`);
    }

    const planNum = String(member.plan_num || '').trim().toUpperCase();
    if (!planNum) {
        return createErrorResult_(`メールアドレス「${activeUserEmail}」に紐づく担当企画番号がありません。`);
    }

    const plan = findPlanByNum_(planSheet, planNum);
    if (!plan) {
        return createErrorResult_(`企画番号「${planNum}」に一致する集計データが見つかりません。`);
    }

    return {
        status: 'ok',
        member: member,
        plan: plan,
    };
}

function openPlanRankingSpreadsheet_() {
    const spreadsheetId = PropertiesService.getScriptProperties().getProperty(PLAN_RANKING_CONFIG.SCRIPT_PROPERTY_SPREADSHEET_ID);
    if (!spreadsheetId) {
        throw new Error(`スクリプトプロパティ「${PLAN_RANKING_CONFIG.SCRIPT_PROPERTY_SPREADSHEET_ID}」が未設定です。`);
    }

    return SpreadsheetApp.openById(spreadsheetId);
}

function findMemberByEmail_(sheet, email) {
    const values = readSheetValues_(sheet, PLAN_RANKING_CONFIG.MEMBER_COLUMNS);
    const targetEmail = normalizeText_(email).toLowerCase();

    for (let index = 0; index < values.length; index += 1) {
        const row = values[index];
        const rowEmail = normalizeText_(row[PLAN_RANKING_CONFIG.MEMBER_COLUMNS.EMAIL - 1]).toLowerCase();
        if (!rowEmail || rowEmail !== targetEmail) {
            continue;
        }

        return {
            email: rowEmail,
            display_name: normalizeText_(row[PLAN_RANKING_CONFIG.MEMBER_COLUMNS.DISPLAY_NAME - 1]),
            role: normalizeText_(row[PLAN_RANKING_CONFIG.MEMBER_COLUMNS.ROLE - 1]),
            plan_num: normalizeText_(row[PLAN_RANKING_CONFIG.MEMBER_COLUMNS.PLAN_NUM - 1]).toUpperCase()
        };
    }

    return null;
}

function findPlanByNum_(sheet, planNum) {
    const values = readSheetValues_(sheet, PLAN_RANKING_CONFIG.PLAN_COLUMNS);
    const targetPlanNum = normalizeText_(planNum).toUpperCase();

    for (let index = 0; index < values.length; index += 1) {
        const row = values[index];
        const rowPlanNum = normalizeText_(row[PLAN_RANKING_CONFIG.PLAN_COLUMNS.PLAN_NUM - 1]).toUpperCase();
        if (!rowPlanNum || rowPlanNum !== targetPlanNum) {
            continue;
        }

        return {
            plan_type: normalizeText_(row[PLAN_RANKING_CONFIG.PLAN_COLUMNS.PLAN_TYPE - 1]),
            plan_num: rowPlanNum,
            plan_name: normalizeText_(row[PLAN_RANKING_CONFIG.PLAN_COLUMNS.PLAN_NAME - 1]),
            directory_name: normalizeText_(row[PLAN_RANKING_CONFIG.PLAN_COLUMNS.DIRECTORY_NAME - 1]),
            count_num: toNumber_(row[PLAN_RANKING_CONFIG.PLAN_COLUMNS.COUNT_NUM - 1]),
            count_ratio: toRatio_(row[PLAN_RANKING_CONFIG.PLAN_COLUMNS.COUNT_RATIO - 1]),
            ranking_general_num: toNumber_(row[PLAN_RANKING_CONFIG.PLAN_COLUMNS.RANKING_GENERAL_NUM - 1]),
            ranking_type_num: toNumber_(row[PLAN_RANKING_CONFIG.PLAN_COLUMNS.RANKING_TYPE_NUM - 1])
        };
    }

    return null;
}

function readSheetValues_(sheet, columnsConfig) {
    const lastRow = sheet.getLastRow();
    const columnCount = getMaxColumn_(columnsConfig);
    if (lastRow < PLAN_RANKING_CONFIG.DATA_START_ROW) {
        return [];
    }

    return sheet
        .getRange(PLAN_RANKING_CONFIG.DATA_START_ROW, 1, lastRow - PLAN_RANKING_CONFIG.DATA_START_ROW + 1, columnCount)
        .getValues();
}

function getMaxColumn_(columnsConfig) {
    return Math.max.apply(null, Object.keys(columnsConfig).map(function (key) {
        return columnsConfig[key];
    }));
}

function normalizeText_(value) {
    return String(value == null ? '' : value).trim();
}

function toNumber_(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function toRatio_(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        return value > 1 ? value / 100 : value;
    }

    const text = String(value).trim().replace(/%$/, '');
    const number = Number(text);
    if (!Number.isFinite(number)) {
        return null;
    }

    return number > 1 ? number / 100 : number;
}

function createErrorResult_(message) {
    return {
        status: 'error',
        error: String(message || '不明なエラーが発生しました。')
    };
}
