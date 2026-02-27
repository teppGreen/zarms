// ============================================
// sync_core.js - ZARMS 同期コアロジック (Upstream / Downstream)
// ============================================

/**
 * UI側の編集検知 (Upstream: UI -> Master DB)
 * 各UIスプレッドシートの onEdit() 等から委譲されて呼び出される
 * @param {GoogleAppsScript.Events.SheetsOnEdit} e
 */
function handleOnEdit(e) {
    const lock = LockService.getScriptLock();
    // 排他制御 (30秒待機)
    if (!lock.tryLock(30000)) {
        console.warn('Could not obtain lock for handleOnEdit. Exiting.');
        return;
    }

    try {
        const spreadsheetId = e.source.getId();
        const spreadsheetUrl = e.source.getUrl();

        // 再入ガード: PropertiesService にフラグがあるかチェック
        const props = PropertiesService.getScriptProperties();
        const lockKey = `sync_in_progress_${spreadsheetId}`;
        const inProgressStr = props.getProperty(lockKey);
        const now = new Date();

        // 一旦フォールバック閾値のチェックを無視する（デバッグ用）
        /*
        if (inProgressStr) {
            const inProgressDate = new Date(inProgressStr);
            // 120秒（フォールバック閾値）以内の場合は再入とみなして処理スキップ
            if (now.getTime() - inProgressDate.getTime() < 120 * 1000) {
                console.log('Sync currently in progress by another trigger. Skipping.');
                return;
            }
        }
        */

        // フラグ書き込み
        props.setProperty(lockKey, now.toISOString());

        try {
            console.log(`[Upstream] handleOnEdit started. range: ${e.range.getA1Notation()} on ${e.range.getSheet().getName()}`);

            // スプレッドシート側の数式（_configシート上のvalue列など）が最新値に再計算されるのを同期する
            SpreadsheetApp.flush();

            const parser = new ConfigParser(e.source);
            console.log(`[Upstream] ConfigParser loaded. rows: ${parser.rows.length}`);

            const targets = parser.findDbTargets(e.range);
            console.log(`[Upstream] DB Targets found: ${targets.length}`);

            if (targets.length === 0) {
                console.log(`[Upstream] No matching mapping found in _config for this range. Exiting.`);
                return; // マッピングがない場合は何もしない
            }

            for (let i = 0; i < targets.length; i++) {
                const target = targets[i];
                // target { table, key, id, value }
                let targetId = target.id;

                console.log(`[Upstream] Processing target #${i + 1}/${targets.length}: table=${target.table}, key=${target.key}, value=${target.value}`);

                // system の cell 等で ID が特定できなかった場合（個別シート等）で table = 'plans' ならURLベースで解決する
                if (!targetId && target.table === 'plans') {
                    console.log(`[Upstream] Searching for plan ID using exact sheet_url: ${spreadsheetUrl}`);
                    // 個別シートのURLと完全一致するか検索
                    const query = { where: { sheet_url: ['=', spreadsheetUrl] } };
                    const foundPlans = select('plans', query);
                    console.log(`[Upstream] foundPlans length: ${foundPlans ? foundPlans.length : 0}`);
                    if (foundPlans && foundPlans.length > 0) {
                        targetId = foundPlans[0].id;
                        console.log(`[Upstream] Target ID resolved dynamically by exact URL: ${targetId}`);
                    }
                }

                if (!targetId) {
                    console.log(`[Upstream] ID not found for table ${target.table}. Skipping...`);
                    continue;
                }

                console.log(`[Upstream] Executing syncRecordToMaster for ${target.table}, id: ${targetId}`);
                const result = syncRecordToMaster(target.table, {
                    id: targetId,
                    [target.key]: target.value
                });
                console.log(`[Upstream] syncRecordToMaster completed:`, result);
            }

        } finally {
            // 終了時にフラグを削除
            props.deleteProperty(lockKey);
        }

    } catch (error) {
        console.error('handleOnEdit failed:', error);
    } finally {
        lock.releaseLock();
    }
}


/**
 * Master DBからの変更伝播 (Downstream: Master DB -> UI)
 * 1時間ごとの定期トリガーで Master DB プロジェクト側で実行される
 */
function runDownstreamSync() {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) {
        console.warn('Could not obtain lock for runDownstreamSync. Exiting.');
        return;
    }

    try {
        const props = PropertiesService.getScriptProperties();
        const lastSyncStr = props.getProperty('last_sync_downstream');
        const processStartTime = new Date(); // 今回の処理開始時刻

        // 1. plans テーブルの変更分を取得
        // ISO8601文字列に変換してクエリ発行
        const query = lastSyncStr
            ? { where: { updated_at: ['>', new Date(lastSyncStr).toISOString()] } }
            : {};

        // database.js の select を利用
        const plans = select('plans', query);

        if (!plans || plans.length === 0) {
            console.log('No updated records found in runDownstreamSync.');
            props.setProperty('last_sync_downstream', processStartTime.toISOString());
            return;
        }

        console.log(`Found ${plans.length} updated plans.`);

        // 2. 一覧シートへの反映 (仕様書 Section 5.4 手順4)
        const listViewSpreadsheetId = props.getProperty('LIST_VIEW_SPREADSHEET_ID');

        if (listViewSpreadsheetId) {
            try {
                console.log(`[Downstream] Processing list view: ${listViewSpreadsheetId}`);
                const listViewSs = SpreadsheetApp.openById(listViewSpreadsheetId);
                const listLockKey = `sync_in_progress_${listViewSpreadsheetId}`;

                // 再入ガードフラグを設定
                props.setProperty(listLockKey, new Date().toISOString());
                try {
                    // syncPlansToListView（sheet_generator.js）に処理を委譲
                    syncPlansToListView(plans, listViewSs);
                    console.log(`[Downstream] List view sync completed.`);
                } finally {
                    props.deleteProperty(listLockKey);
                }
            } catch (err) {
                console.error('Error processing downstream for list view:', err);
                // 一覧シートの処理失敗は個別シートの処理に影響させない
            }
        }

        // 3. 個別シートへの反映 (仕様書 Section 5.4 手順5)
        for (const plan of plans) {
            if (!plan.sheet_url) continue;

            try {
                const individualSpreadsheet = SpreadsheetApp.openByUrl(plan.sheet_url);
                const targetSheetId = individualSpreadsheet.getId();
                const lockKey = `sync_in_progress_${targetSheetId}`;

                // 再入ガードフラグを設定
                props.setProperty(lockKey, new Date().toISOString());

                try {
                    // syncPlanToIndividualSheet（sheet_generator.js）に処理を委譲
                    syncPlanToIndividualSheet(plan, individualSpreadsheet);
                } finally {
                    props.deleteProperty(lockKey);
                }
            } catch (err) {
                console.error(`Error processing downstream for plan ${plan.id}:`, err);
                // 1件失敗しても後続は続ける
            }
        }

        // 4. 処理完了後、最終実行時刻をセット
        props.setProperty('last_sync_downstream', processStartTime.toISOString());

    } catch (error) {
        console.error('runDownstreamSync failed:', error);
    } finally {
        lock.releaseLock();
    }
}
