// ============================================
// config_parser.js - ZARMS 同期設定（_configシート）解析パーサー
// ============================================

/**
 * _config シートからマッピング情報を読み取り、特定の操作に必要な情報を抽出するクラス
 */
class ConfigParser {
    /**
     * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet - 操作対象のスプレッドシート
     */
    constructor(spreadsheet) {
        this.spreadsheet = spreadsheet;
        this.configSheet = spreadsheet.getSheetByName('_config');

        if (!this.configSheet) {
            throw new Error('Configurator sheet "_config" is missing.');
        }

        // _configシートの全データをキャッシュ（1行目はヘッダー想定）
        const dataRange = this.configSheet.getDataRange();
        const data = dataRange.getValues();
        const formulas = dataRange.getFormulas();

        this.headers = data[0];
        this.rows = data.slice(1).map((row, index) => {
            // 基本的な列（table, key等）が空の場合は行としてカウントしない
            if (!row[0] || !row[1]) return null;

            const rowData = {};
            this.headers.forEach((header, cIndex) => {
                // range列の場合、もし数式が入っていればそれを優先する（=文字列として扱うため）
                if (header === 'range' && formulas[index + 1][cIndex]) {
                    rowData[header] = formulas[index + 1][cIndex];
                } else {
                    rowData[header] = row[cIndex];
                }
            });
            return rowData;
        }).filter(r => r !== null);
    }

    /**
     * `range` からシート名、列、行番号（または開始行）を抽出する
     * 単一セル参照の例: `='基本'!$C$8`
     * 列のみの参照例（ヘッダー用）: `='企画'!$C` => 行番号なし
     * @param {string} rangeStr - range 列の文字列
     * @returns {Object|null} { sheet: string, colStr: string, row: number|null }
     */
    static parseRange(rawRangeStr) {
        if (!rawRangeStr) return null;
        const rangeStr = rawRangeStr.toString().trim();

        let sheet = '';
        const sheetMatch = rangeStr.match(/(?:^=?)'*([^'!]*)'*!/);
        if (sheetMatch) {
            sheet = sheetMatch[1];
        } else {
            return null;
        }

        const cellPart = rangeStr.split('!')[1];
        if (!cellPart) return null;

        const cleanCell = cellPart.replace(/\$/g, '').trim();
        const cellMatch = cleanCell.match(/^([A-Za-z]+)(\d+)?$/);

        if (cellMatch) {
            return {
                sheet: sheet,
                colStr: cellMatch[1].toUpperCase(),
                row: cellMatch[2] ? parseInt(cellMatch[2], 10) : null
            };
        }
        return null;
    }

    /**
     * 列文字列（A, B, C...）をインデックス（1始まり）に変換
     * @param {string} colStr 
     * @returns {number}
     */
    static colStrToNum(colStr) {
        let num = 0;
        for (let i = 0; i < colStr.length; i++) {
            num = num * 26 + (colStr.charCodeAt(i) - 64);
        }
        return num;
    }

    /**
     * 指定された編集範囲(editedRange)に合致するDBターゲット（更新対象）を列挙する
     * 個別シート（単一セルマッピング）および一覧シート（行ベースマッピング）の両方に対応
     * 
     * @param {GoogleAppsScript.Spreadsheet.Range} editedRange
     * @returns {Array<{ table: string, key: string, id: string, value: string }>}
     */
    findDbTargets(editedRange) {
        const editedSheetName = editedRange.getSheet().getName();
        const startRow = editedRange.getRow();
        const endRow = editedRange.getLastRow();
        const startCol = editedRange.getColumn();
        const endCol = editedRange.getLastColumn();

        const targets = [];
        const systemIds = this._getSystemIds();

        // 1. _config シート自身が編集された場合 (rangeが空の場合のvalue列直接編集など)
        if (editedSheetName === '_config') {
            for (let r = startRow; r <= endRow; r++) {
                const rowIndex = r - 2; // ヘッダーが1行目のため、データ行インデックスは -2
                if (rowIndex >= 0 && rowIndex < this.rows.length) {
                    const row = this.rows[rowIndex];
                    if (row['field_type'] === 'two-way-sync' || row['field_type'] === 'upstream-only') {
                        targets.push({
                            table: row['table'],
                            key: row['key'],
                            id: systemIds[row['table']] || null,
                            value: row['value'] // 最新の _configのvalue
                        });
                    }
                }
            }
            return targets;
        }

        // 2. 一覧シート（行ベース：header マッピング）が編集された場合
        //    header マッピングが存在し、編集シート名が一致する場合は行ベースで処理する
        const headerResult = this.resolveHeaderMappings();
        const systemIdCol = this.getSystemIdColumn();

        if (headerResult.sheetName && headerResult.sheetName === editedSheetName && systemIdCol) {
            const sheet = editedRange.getSheet();
            for (let r = startRow; r <= endRow; r++) {
                // データ開始行より前（ヘッダー行等）の編集はスキップ
                if (headerResult.dataStartRow !== null && r < headerResult.dataStartRow) continue;

                // ID列から現在行のレコードIDを取得
                const recordId = sheet.getRange(r, systemIdCol.col).getValue();
                if (!recordId) continue;

                // 編集された列と header マッピングの照合
                for (const mapping of headerResult.mappings) {
                    if (mapping.col >= startCol && mapping.col <= endCol) {
                        const cellValue = sheet.getRange(r, mapping.col).getValue();
                        targets.push({
                            table: mapping.table,
                            key: mapping.key,
                            id: recordId,
                            value: cellValue
                        });
                    }
                }
            }
            return targets;
        }

        // 3. 個別シート（単一セルマッピング）が編集された場合
        for (const row of this.rows) {
            const fieldType = (row['field_type'] || '').toString().toLowerCase().trim();
            if (fieldType === 'two-way-sync' || fieldType === 'upstream-only') {
                const rangeData = ConfigParser.parseRange(row['range']);
                if (!rangeData || rangeData.sheet !== editedSheetName || rangeData.row === null) continue;

                const targetColNum = ConfigParser.colStrToNum(rangeData.colStr);
                const targetRow = rangeData.row;

                // このセルが editedRange 内に含まれるか判定
                if (targetColNum >= startCol && targetColNum <= endCol &&
                    targetRow >= startRow && targetRow <= endRow) {

                    targets.push({
                        table: row['table'],
                        key: row['key'],
                        id: systemIds[row['table']] || null,
                        value: row['value'] // ★ ユーザー指示: その行のvalue列に入っている値を同期する (=変換や参照が実行済み)
                    });
                }
            }
        }

        return targets;
    }

    /**
     * すべての `field_type: two-way-sync` または `downstream-only` のマッピングを取得する (Downstream用)
     * 
     * @returns {Array<{ table: string, key: string, range: { sheet: string, col: number, row: number } | null, rowNumber: number, valueColIndex: number }>}
     */
    getAllInputMappings() {
        const mappings = [];
        const valueColIndex = this.headers.indexOf('value') + 1; // 1-based index

        this.rows.forEach((row, index) => {
            if (row['field_type'] === 'two-way-sync' || row['field_type'] === 'downstream-only') {
                const rangeData = ConfigParser.parseRange(row['range']);
                mappings.push({
                    table: row['table'],
                    key: row['key'],
                    range: rangeData ? {
                        sheet: rangeData.sheet,
                        col: ConfigParser.colStrToNum(rangeData.colStr),
                        row: rangeData.row
                    } : null,
                    rowNumber: index + 2, // ヘッダーが1行目なので +2
                    valueColIndex: valueColIndex
                });
            }
        });

        return mappings;
    }

    /**
     * 一覧シート用: field_type = 'header' の行から列位置とデータ開始行を解決して返す
     * ヘッダー行の次の行をデータ開始行として算出する（仕様書 Section 4.2 の解釈ルール準拠）
     * 
     * @returns {{ mappings: Array<{ table: string, key: string, col: number }>, dataStartRow: number|null, sheetName: string|null }}
     */
    resolveHeaderMappings() {
        const mappings = [];
        let dataStartRow = null;
        let sheetName = null;

        for (const row of this.rows) {
            if (row['field_type'] === 'header') {
                const rangeData = ConfigParser.parseRange(row['range']);
                if (!rangeData) continue;

                // 最初の header 行からデータ開始行（ヘッダー行 + 1）とシート名を算出
                if (dataStartRow === null && rangeData.row !== null) {
                    dataStartRow = rangeData.row + 1;
                    sheetName = rangeData.sheet;
                }

                mappings.push({
                    table: row['table'],
                    key: row['key'],
                    col: ConfigParser.colStrToNum(rangeData.colStr)
                });
            }
        }
        return { mappings, dataStartRow, sheetName };
    }

    /**
     * 一覧シート用: field_type = 'system' かつ key = 'id' の行から
     * ID列の列位置とシート名を返す（仕様書 Section 4.3 の行特定ロジック準拠）
     * 
     * @returns {{ table: string, col: number, sheetName: string } | null}
     */
    getSystemIdColumn() {
        for (const row of this.rows) {
            if (row['field_type'] === 'system' && row['key'] === 'id') {
                const rangeData = ConfigParser.parseRange(row['range']);
                if (!rangeData) continue;
                return {
                    table: row['table'],
                    col: ConfigParser.colStrToNum(rangeData.colStr),
                    sheetName: rangeData.sheet
                };
            }
        }
        return null;
    }

    /**
     * 内部関数: テーブル名ごとの System ID (`field_type: system` かつ `key: id`) を取得する
     * @returns {Object.<string, string>} { 'plans': 'p20261001', ... }
     */
    _getSystemIds() {
        const ids = {};
        for (const row of this.rows) {
            if (row['field_type'] === 'system' && row['key'] === 'id') {
                ids[row['table']] = row['value'];
            }
        }
        return ids;
    }
}
