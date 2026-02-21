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
                const listParser = new ConfigParser(listViewSs);
                const headerResult = listParser.resolveHeaderMappings();
                const systemIdCol = listParser.getSystemIdColumn();

                if (headerResult.sheetName && systemIdCol) {
                    const dataSheet = listViewSs.getSheetByName(headerResult.sheetName);
                    if (dataSheet) {
                        const lastRow = dataSheet.getLastRow();

                        // ID列からデータ行の行番号マップを構築
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

                        // 再入ガードフラグを設定
                        const listLockKey = `sync_in_progress_${listViewSpreadsheetId}`;
                        let hasUpdates = false;
                        // 新規行は既存データの末尾、またはデータ開始行から追加
                        let nextNewRow = Math.max(lastRow + 1, headerResult.dataStartRow);

                        for (const plan of plans) {
                            const targetRow = idRowMap[plan.id];

                            if (targetRow) {
                                // 既存行の更新
                                for (const mapping of headerResult.mappings) {
                                    const newValue = plan[mapping.key];
                                    if (newValue === undefined) continue;

                                    const cell = dataSheet.getRange(targetRow, mapping.col);
                                    const currentValue = cell.getValue();

                                    if (currentValue !== newValue) {
                                        if (!hasUpdates) {
                                            props.setProperty(listLockKey, new Date().toISOString());
                                            hasUpdates = true;
                                        }
                                        cell.setValue(newValue);
                                    }
                                }
                            } else {
                                // 新規行の追加: Master DB にレコードがあるが一覧シートに未登録の場合
                                if (!hasUpdates) {
                                    props.setProperty(listLockKey, new Date().toISOString());
                                    hasUpdates = true;
                                }

                                console.log(`[Downstream] Adding new row for plan ${plan.id} at row ${nextNewRow}`);

                                // system ID 列に plan.id を書き込む
                                dataSheet.getRange(nextNewRow, systemIdCol.col).setValue(plan.id);

                                // header マッピングに基づいて各データ列の値を設定
                                for (const mapping of headerResult.mappings) {
                                    const newValue = plan[mapping.key];
                                    if (newValue === undefined) continue;
                                    dataSheet.getRange(nextNewRow, mapping.col).setValue(newValue);
                                }

                                nextNewRow++;
                            }
                        }

                        // 書き込みがあった場合のみ flush とフラグ解除
                        if (hasUpdates) {
                            try {
                                SpreadsheetApp.flush();
                            } finally {
                                props.deleteProperty(listLockKey);
                            }
                        }

                        console.log(`[Downstream] List view sync completed.`);
                    } else {
                        console.warn(`[Downstream] Data sheet "${headerResult.sheetName}" not found in list view.`);
                    }
                } else {
                    console.warn('[Downstream] List view _config is missing header mappings or system id column.');
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
                // 個別シートを開く
                const individualSpreadsheet = SpreadsheetApp.openByUrl(plan.sheet_url);
                const parser = new ConfigParser(individualSpreadsheet);

                // ============================================
                // 3.1 `基本` タブ (単一セルマッピング) への反映
                // ============================================
                const mappings = parser.getAllInputMappings();

                let hasBasicUpdates = false;
                const targetSheetId = individualSpreadsheet.getId();
                const lockKey = `sync_in_progress_${targetSheetId}`;

                for (const mapping of mappings) {
                    if (mapping.table === 'plans') {
                        const targetKey = mapping.key;
                        const newValue = plan[targetKey];

                        // newValue が undefined (カラムに存在しない) の場合はスキップ
                        if (newValue === undefined) continue;

                        let sheet, cell;
                        if (mapping.range && mapping.range.sheet) {
                            sheet = individualSpreadsheet.getSheetByName(mapping.range.sheet);
                            if (!sheet) continue;
                            cell = sheet.getRange(mapping.range.row, mapping.range.col);
                        } else {
                            // range が空欄の場合は _config シートの value 列自身に書き込む
                            sheet = individualSpreadsheet.getSheetByName('_config');

                            // mapping.valueColIndex が正しく取得できているか、かつ1以上かを確認する
                            if (!sheet || !mapping.valueColIndex || mapping.valueColIndex < 1) {
                                console.warn(`Missing value column index for mapping key: ${mapping.key}`);
                                continue;
                            }
                            cell = sheet.getRange(mapping.rowNumber, mapping.valueColIndex);
                        }

                        const currentValue = cell.getValue();

                        // 値が異なる場合のみ上書き (不要な編集イベントのトリガー回避のため)
                        if (currentValue !== newValue) {
                            if (!hasBasicUpdates) {
                                props.setProperty(lockKey, new Date().toISOString());
                                hasBasicUpdates = true;
                            }
                            cell.setValue(newValue);
                        }
                    }
                }

                if (hasBasicUpdates) {
                    try {
                        SpreadsheetApp.flush();
                    } finally {
                        props.deleteProperty(lockKey); // 基本タブの更新終わったらロック解除
                    }
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
