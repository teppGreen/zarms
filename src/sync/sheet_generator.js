// ============================================
// sheet_generator.js - 個別シート一括生成 / 一覧シート一括同期
// ============================================

// ============================================
// 実行範囲の設定
// plansテーブルのレコードを何行目から何行目まで処理するか指定する
// （1始まりのインデックス。全レコード対象の場合はそのままで可）
// GASの実行時間制限（6分 / 30分）に応じてバッチ分割する際に変更する
// ============================================
const GENERATE_START_ROW = 1;
const GENERATE_END_ROW = 9999;

/**
 * テンプレートの個別シートを複製し、Master DBのplansデータを初期入力する一括生成関数
 *
 * 処理フロー（レコード単位のfor文）:
 *   1. テンプレートシートを複製
 *   2. ファイル名を {plan_number}_{name} に変更
 *   3. plans.folder_url で指定された Google Drive フォルダに移動
 *   4. 複製したシートのURLを plans.sheet_url に記録（Master DB更新）
 *   5. Downstream同期ロジックで plans データを個別シートに書き込み
 *
 * スキップ条件:
 *   - sheet_url が既に設定済み（＝個別シート生成済み）
 *   - folder_url が空（移動先フォルダ未指定）
 */
function generateIndividualSheets() {
    const templateId = INDIVIDUAL_SHEET_TEMPLATE_ID;
    if (!templateId) {
        console.error('[SheetGenerator] INDIVIDUAL_SHEET_TEMPLATE_ID が ScriptProperties に設定されていません。');
        return;
    }

    // plansテーブルから全レコードを取得（シート上の並び順）
    const allPlans = select('plans', {});
    if (!allPlans || allPlans.length === 0) {
        console.log('[SheetGenerator] plansテーブルにレコードがありません。');
        return;
    }

    // 処理範囲の算出（定数は1始まり → 配列インデックスは0始まり）
    const startIndex = Math.max(0, GENERATE_START_ROW - 1);
    const endIndex = Math.min(allPlans.length, GENERATE_END_ROW);

    console.log(`[SheetGenerator] 処理範囲: ${GENERATE_START_ROW}行目 〜 ${Math.min(allPlans.length, GENERATE_END_ROW)}行目 (全${allPlans.length}件中)`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (let i = startIndex; i < endIndex; i++) {
        const plan = allPlans[i];
        const planLabel = `[${i + 1}/${allPlans.length}] ${plan.plan_number || 'N/A'}_${plan.name || 'N/A'}`;

        try {
            // --- スキップ条件 ---

            // sheet_url が既に設定済み（生成済み）の場合はスキップ
            if (plan.sheet_url) {
                console.log(`${planLabel}: スキップ（sheet_url 設定済み）`);
                skipCount++;
                continue;
            }

            // folder_url が空の場合はスキップ
            if (!plan.folder_url) {
                console.log(`${planLabel}: スキップ（folder_url 未設定）`);
                skipCount++;
                continue;
            }

            // --- 生成処理 ---

            // 1. テンプレートを複製し、ファイル名を {plan_number}_{name} に変更
            const templateFile = DriveApp.getFileById(templateId);
            const newFileName = `${plan.plan_number}_${plan.name}`;
            const copiedFile = templateFile.makeCopy(newFileName);
            console.log(`${planLabel}: テンプレート複製完了 → "${newFileName}"`);

            // 2. folder_url からフォルダIDを抽出し、指定フォルダへ移動
            const folderId = extractFolderIdFromUrl(plan.folder_url);
            if (!folderId) {
                console.error(`${planLabel}: フォルダIDを抽出できません（URL: ${plan.folder_url}）`);
                copiedFile.setTrashed(true); // 複製をゴミ箱へ移動（クリーンアップ）
                errorCount++;
                continue;
            }

            const targetFolder = DriveApp.getFolderById(folderId);
            copiedFile.moveTo(targetFolder);
            console.log(`${planLabel}: フォルダへ移動完了（${folderId}）`);

            // 3. 複製したシートのURLを Master DB の plans.sheet_url に記録
            const newSpreadsheet = SpreadsheetApp.openById(copiedFile.getId());
            const newSheetUrl = newSpreadsheet.getUrl();

            syncRecordToMaster('plans', {
                id: plan.id,
                sheet_url: newSheetUrl
            });
            console.log(`${planLabel}: sheet_url を Master DB に記録完了`);

            // 4. Downstream同期ロジックで初期データを個別シートに書き込み
            //    plan オブジェクトに sheet_url を反映してから同期
            //    （_configにsheet_urlのマッピングがあれば書き込まれる）
            //    初期生成時は全セル空のため差分チェックをスキップ
            plan.sheet_url = newSheetUrl;
            syncPlanToIndividualSheet(plan, newSpreadsheet, { skipDiffCheck: true });
            console.log(`${planLabel}: 初期データ同期完了`);

            successCount++;

        } catch (error) {
            console.error(`${planLabel}: エラー - ${error.message}`);
            errorCount++;
        }
    }

    console.log('=== 個別シート生成完了 ===');
    console.log(`成功: ${successCount}件, スキップ: ${skipCount}件, エラー: ${errorCount}件`);
}

/**
 * 生成済みの個別シートを一括削除（ゴミ箱へ移動）し、Master DB の sheet_url をクリアする関数
 *
 * 処理フロー（レコード単位のfor文）:
 *   1. plans レコードの sheet_url からスプレッドシートを特定
 *   2. 該当ファイルをゴミ箱へ移動
 *   3. Master DB の plans.sheet_url を空文字にクリア
 *
 * スキップ条件:
 *   - sheet_url が空（個別シート未生成）
 *
 * 処理範囲は GENERATE_START_ROW / GENERATE_END_ROW で制御（generateIndividualSheets と共通）
 */
function removeIndividualSheets() {
    // plansテーブルから全レコードを取得（シート上の並び順）
    const allPlans = select('plans', {});
    if (!allPlans || allPlans.length === 0) {
        console.log('[removeIndividualSheets] plansテーブルにレコードがありません。');
        return;
    }

    // 処理範囲の算出
    const startIndex = Math.max(0, GENERATE_START_ROW - 1);
    const endIndex = Math.min(allPlans.length, GENERATE_END_ROW);

    console.log(`[removeIndividualSheets] 処理範囲: ${GENERATE_START_ROW}行目 〜 ${Math.min(allPlans.length, GENERATE_END_ROW)}行目 (全${allPlans.length}件中)`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (let i = startIndex; i < endIndex; i++) {
        const plan = allPlans[i];
        const planLabel = `[${i + 1}/${allPlans.length}] ${plan.plan_number || 'N/A'}_${plan.name || 'N/A'}`;

        try {
            // sheet_url が空の場合はスキップ
            if (!plan.sheet_url) {
                console.log(`${planLabel}: スキップ（sheet_url 未設定）`);
                skipCount++;
                continue;
            }

            // 1. sheet_url からスプレッドシートを開き、ファイルIDを取得
            const spreadsheet = SpreadsheetApp.openByUrl(plan.sheet_url);
            const fileId = spreadsheet.getId();

            // 2. ファイルをゴミ箱へ移動
            DriveApp.getFileById(fileId).setTrashed(true);
            console.log(`${planLabel}: ゴミ箱へ移動完了（fileId: ${fileId}）`);

            // 3. Master DB の sheet_url を空文字にクリア
            syncRecordToMaster('plans', {
                id: plan.id,
                sheet_url: ''
            });
            console.log(`${planLabel}: sheet_url をクリア完了`);

            successCount++;

        } catch (error) {
            console.error(`${planLabel}: エラー - ${error.message}`);
            errorCount++;
        }
    }

    console.log('=== 個別シート削除完了 ===');
    console.log(`成功: ${successCount}件, スキップ: ${skipCount}件, エラー: ${errorCount}件`);
}

/**
 * Google DriveのフォルダURLからフォルダIDを抽出する
 *
 * 対応URL形式:
 *   - https://drive.google.com/drive/folders/FOLDER_ID
 *   - https://drive.google.com/drive/u/0/folders/FOLDER_ID
 *   - https://drive.google.com/drive/folders/FOLDER_ID?resourcekey=...
 *
 * @param {string} folderUrl - Google DriveフォルダのURL
 * @returns {string|null} フォルダID。抽出できない場合はnull
 */
function extractFolderIdFromUrl(folderUrl) {
    if (!folderUrl) return null;
    const match = folderUrl.toString().match(/\/folders\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
}

/**
 * 単一のplanレコードのデータを個別シートに同期する
 *
 * ConfigParser の getAllInputMappings() を使用して、
 * field_type が two-way-sync または downstream-only のマッピングに従い
 * plan データを該当セルに書き込む。
 *
 * runDownstreamSync() の個別シート処理部分と同一のロジック。
 * 新規生成時の初期データ投入、および将来的な単一レコード同期に再利用可能。
 *
 * @param {Object} plan - plansテーブルのレコード（キーがカラム名のオブジェクト）
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet - 書き込み先の個別シート
 * @param {Object} [options] - オプション
 * @param {boolean} [options.skipDiffCheck=false] - trueの場合、現在値との差分チェックをスキップして全マッピングを書き込む（初期生成時用）
 * @returns {boolean} 書き込みが発生した場合はtrue
 */
function syncPlanToIndividualSheet(plan, spreadsheet, options = {}) {
    const skipDiffCheck = options.skipDiffCheck || false;
    const parser = new ConfigParser(spreadsheet);
    const mappings = parser.getAllInputMappings();
    let hasUpdates = false;

    for (const mapping of mappings) {
        if (mapping.table !== 'plans') continue;

        const newValue = plan[mapping.key];
        if (newValue === undefined) continue;

        let sheet, cell;
        if (mapping.range && mapping.range.sheet) {
            // range が設定されている場合: 該当シートの該当セルに書き込む
            sheet = spreadsheet.getSheetByName(mapping.range.sheet);
            if (!sheet) continue;
            cell = sheet.getRange(mapping.range.row, mapping.range.col);
        } else {
            // range が空欄の場合: _config シートの該当行の value 列に書き込む
            sheet = spreadsheet.getSheetByName('_config');
            if (!sheet || !mapping.valueColIndex || mapping.valueColIndex < 1) {
                console.warn(`[syncPlanToIndividualSheet] value列インデックス不明: key=${mapping.key}`);
                continue;
            }
            cell = sheet.getRange(mapping.rowNumber, mapping.valueColIndex);
        }

        // 差分チェック: 不要な書き込み（onEdit再発火の原因）を回避
        if (!skipDiffCheck) {
            const currentValue = cell.getValue();
            if (currentValue === newValue) continue;
        }

        cell.setValue(newValue);
        hasUpdates = true;
    }

    if (hasUpdates) {
        SpreadsheetApp.flush();
    }

    return hasUpdates;
}

// ============================================
// 一覧シート（List View）同期
// ============================================

/**
 * Master DB の plans レコードを一覧シートに同期する共通関数
 *
 * 処理フロー:
 *   1. _config から header マッピングと system ID列を解決
 *   2. 既存のID列をスキャンし { id → 行番号 } のマップを構築
 *   3. 各 plan レコードについて:
 *      - ID が既存行にある → 該当行のセルを更新
 *      - ID が既存行にない → 末尾に新規行を追加（ID列 + データ列）
 *
 * runDownstreamSync() の一覧シート処理、および初期一括投入で共通利用する。
 *
 * @param {Object[]} plans - plansテーブルのレコード配列
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} listViewSs - 一覧シートのスプレッドシート
 * @param {Object} [options] - オプション
 * @param {boolean} [options.skipDiffCheck=false] - trueの場合、差分チェックをスキップ（初期投入時用）
 * @returns {boolean} 書き込みが発生した場合はtrue
 */
function syncPlansToListView(plans, listViewSs, options = {}) {
    const skipDiffCheck = options.skipDiffCheck || false;
    const listParser = new ConfigParser(listViewSs);
    const headerResult = listParser.resolveHeaderMappings();
    const systemIdCol = listParser.getSystemIdColumn();

    if (!headerResult.sheetName || !systemIdCol) {
        console.warn('[syncPlansToListView] _config に header マッピングまたは system ID 列が未設定です。');
        return false;
    }

    const dataSheet = listViewSs.getSheetByName(headerResult.sheetName);
    if (!dataSheet) {
        console.warn(`[syncPlansToListView] データシート "${headerResult.sheetName}" が見つかりません。`);
        return false;
    }

    const lastRow = dataSheet.getLastRow();

    // ID列からデータ行の { id → 行番号 } マップを構築
    const idRowMap = {};
    if (lastRow >= headerResult.dataStartRow) {
        const idRange = dataSheet.getRange(
            headerResult.dataStartRow,
            systemIdCol.col,
            lastRow - headerResult.dataStartRow + 1,
            1
        );
        const idValues = idRange.getValues();
        idValues.forEach((row, i) => {
            if (row[0]) {
                idRowMap[row[0]] = headerResult.dataStartRow + i;
            }
        });
    }

    let hasUpdates = false;
    // 新規行の追加位置: 既存データ末尾の次、またはデータ開始行
    let nextNewRow = Math.max(lastRow + 1, headerResult.dataStartRow);

    for (const plan of plans) {
        const targetRow = idRowMap[plan.id];

        if (targetRow) {
            // --- 既存行の更新 ---
            for (const mapping of headerResult.mappings) {
                const newValue = plan[mapping.key];
                if (newValue === undefined) continue;

                const cell = dataSheet.getRange(targetRow, mapping.col);

                if (!skipDiffCheck) {
                    const currentValue = cell.getValue();
                    if (currentValue === newValue) continue;
                }

                cell.setValue(newValue);
                hasUpdates = true;
            }
        } else {
            // --- 新規行の追加 ---
            console.log(`[syncPlansToListView] 新規行追加: plan.id=${plan.id}, row=${nextNewRow}`);

            // system ID 列に plan.id を書き込む
            dataSheet.getRange(nextNewRow, systemIdCol.col).setValue(plan.id);

            // header マッピングに基づいて各データ列を設定
            for (const mapping of headerResult.mappings) {
                const newValue = plan[mapping.key];
                if (newValue === undefined) continue;
                dataSheet.getRange(nextNewRow, mapping.col).setValue(newValue);
            }

            hasUpdates = true;
            nextNewRow++;
        }
    }

    if (hasUpdates) {
        SpreadsheetApp.flush();
    }

    return hasUpdates;
}

/**
 * Master DB の全 plans レコードを一覧シートに一括同期するエントリポイント関数
 *
 * 用途: 一覧シートの初期構築時、または全データを強制的に再同期したい場合に使用
 * GASエディタから直接実行、またはカスタムメニューから呼び出す想定
 */
function syncAllPlansToListView() {
    const listViewSpreadsheetId = LIST_VIEW_SPREADSHEET_ID;
    if (!listViewSpreadsheetId) {
        console.error('[syncAllPlansToListView] LIST_VIEW_SPREADSHEET_ID が ScriptProperties に設定されていません。');
        return;
    }

    // plansテーブルから全レコード取得
    const allPlans = select('plans', {});
    if (!allPlans || allPlans.length === 0) {
        console.log('[syncAllPlansToListView] plansテーブルにレコードがありません。');
        return;
    }

    console.log(`[syncAllPlansToListView] 全${allPlans.length}件のplansを一覧シートに同期開始`);

    const listViewSs = SpreadsheetApp.openById(listViewSpreadsheetId);

    // 初期投入のため差分チェックをスキップ
    const result = syncPlansToListView(allPlans, listViewSs, { skipDiffCheck: true });

    if (result) {
        console.log('[syncAllPlansToListView] 一覧シートへの同期が完了しました。');
    } else {
        console.log('[syncAllPlansToListView] 書き込み対象のデータがありませんでした。');
    }
}
