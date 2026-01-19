/** @file ui_schedule_editor_handler.js @description スケジュールエディタの操作イベント（追加・削除・インポート）を管理 */

/**
 * テキストからスケジュールを解析して行を追加する
 */
function processTextImport() {
    const textArea = document.getElementById('import-text-input');
    if (!textArea) return;

    let text = textArea.value;
    // ANSIエスケープシーケンス（\x1b[...m）を削除
    text = text.replace(/\x1b\[[0-9;]*m/g, "");

    const lines = text.split('\n');
    let addCount = 0;
    const now = new Date();
    const currentYear = now.getFullYear();

    lines.forEach(line => {
        if (!line.trim() || !line.includes('月')) return;

        try {
            // 1. 日付の抽出: [12月 25日 ~ 29日]
            const dateMatch = line.match(/\[(\d+)月\s*(\d+)日\s*~\s*(\d+)日\]/);
            if (!dateMatch) return;

            const month = dateMatch[1].padStart(2, '0');
            const startDay = dateMatch[2].padStart(2, '0');
            const endDay = dateMatch[3].padStart(2, '0');

            let year = currentYear;
            if (now.getMonth() === 0 && month === "12") year--;
            if (now.getMonth() === 11 && month === "01") year++;

            const rawStart = `${year}${month}${startDay}`;
            const rawEnd = `${year}${month}${endDay}`;

            // 2. ガチャ名の抽出
            const afterDate = line.substring(line.indexOf(']') + 1).trim();
            let gachaName = afterDate.split(/[\[<]/)[0].trim();
            gachaName = gachaName.replace(/\(\+.+?\)/, "").trim();

            // 3. フラグの抽出: [G|L|N] など
            const flagsMatch = line.match(/\[([^\]]*[GLNPRSP][^\]]*)\]/);
            const isGuaranteed = flagsMatch ? flagsMatch[1].includes('G') : false;

            // 4. 特殊確率の抽出: UR = 7%
            let uberRate = "500";
            const rateMatch = line.match(/UR\s*=\s*(\d+)%/);
            if (rateMatch) {
                uberRate = parseInt(rateMatch[1]) * 100;
            } else if (gachaName.includes("超ネコ祭") || gachaName.includes("極ネコ祭")) {
                uberRate = "900";
            } else if (gachaName.includes("超極ネコ祭")) {
                uberRate = "1000";
            } else if (gachaName.includes("超国王祭")) {
                uberRate = "700";
            }

            // 5. マスターデータからIDを検索
            let foundId = "0";
            if (typeof getGachaSelectorOptions === 'function') {
                const options = getGachaSelectorOptions();
                
                // まずはテキストのガチャ名で検索
                const match = options.find(opt => opt.label.includes(gachaName)) || 
                              options.find(opt => gachaName.includes(opt.label.split(') ')[1]));
                
                if (match) {
                    foundId = match.value;
                } else {
                    // 見つからなかった場合は「ネコルガ族」をデフォルトにする
                    const fallback = options.find(opt => opt.label.includes("ネコルガ族"));
                    if (fallback) foundId = fallback.value;
                }
            }

            // 行を追加
            const item = {
                rawStart: rawStart, startTime: "1100",
                rawEnd: rawEnd, endTime: "1059",
                id: foundId, tsvName: gachaName,
                uber: uberRate, legend: "30",
                guaranteed: isGuaranteed
            };

            const tbody = document.querySelector('#schedule-editor-table tbody');
            if (tbody) {
                const tempTable = document.createElement('table');
                tempTable.innerHTML = createEditorRowHtml(item);
                tbody.appendChild(tempTable.querySelector('tr'));
                addCount++;
            }
        } catch (e) {
            console.warn("Line parse error:", line, e);
        }
    });

    if (addCount > 0) {
        alert(`${addCount}件のスケジュールを追加しました。`);
        textArea.value = "";
        toggleImportArea();
    } else {
        alert("解析可能な行が見つかりませんでした。");
    }
}

/**
 * 現在のエディタの内容を解析してTSV文字列を生成する
 */
function captureEditorDataToTsv() {
    const rows = document.querySelectorAll('#schedule-editor-table tbody tr');
    let tsvRows = [];

    rows.forEach(row => {
        const rawStartD = row.querySelector('.edit-start-date').value.replace(/-/g, '');
        const rawEndD = row.querySelector('.edit-end-date').value.replace(/-/g, '');
        const startH = row.querySelector('.edit-start-time').value;
        const endH = row.querySelector('.edit-end-time').value;
        const startT = startH + "00";
        const endT = endH + "59";

        const gId = row.querySelector('.edit-id').value.trim();
        const name = row.querySelector('.edit-name').value.trim();
        const uber = row.querySelector('.edit-uber').value.trim();
        const legend = row.querySelector('.edit-legend').value.trim();
        const isG = row.querySelector('.edit-guaranteed').checked ? "1" : "0";

        if (!rawStartD || !rawEndD || !gId) return;

        let cols = Array(25).fill("0");
        cols[0] = rawStartD; cols[1] = startT;
        cols[2] = rawEndD; cols[3] = endT;
        cols[8] = "1"; cols[10] = gId;
        cols[16] = "7000"; cols[18] = "2500"; 
        cols[20] = uber; cols[21] = isG;
        cols[22] = legend; cols[24] = name;

        tsvRows.push(cols.join('\t'));
    });
    return tsvRows.join('\n');
}

/**
 * 編集内容を一時的にアプリに反映させる
 */
function applyScheduleTemporarily() {
    const tsvContent = captureEditorDataToTsv();
    if (!tsvContent) {
        alert("有効な予定データがありません。");
        return;
    }

    loadedTsvContent = tsvContent;
    isScheduleAnalyzed = false;
    window.isScheduleEditMode = false;

    if (typeof renderScheduleTable === 'function') {
        renderScheduleTable(loadedTsvContent, 'schedule-container');
    }
    
    if (typeof generateRollsTable === 'function') generateRollsTable();
}

/**
 * エディタに新しい予定行を末尾に追加する
 */
function addNewScheduleRow() {
    const tbody = document.querySelector('#schedule-editor-table tbody');
    if (!tbody) return;
    
    if (typeof createEditorRowHtml === 'function') {
        const newRowHtml = createEditorRowHtml();
        const tempTable = document.createElement('table');
        tempTable.innerHTML = newRowHtml;
        const newRow = tempTable.querySelector('tr');
        tbody.appendChild(newRow);
        newRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

/**
 * 指定された行を削除する
 */
function deleteEditorRow(btn) {
    if (confirm("この予定を削除しますか？")) {
        const row = btn.closest('tr');
        if (row) {
            row.parentNode.removeChild(row);
        }
    }
}

/**
 * 現在のエディタの内容を gatya.tsv 形式でダウンロードする
 */
function generateAndDownloadTSV() {
    const tsvContent = captureEditorDataToTsv();
    if (!tsvContent) {
        alert("データがありません。");
        return;
    }

    const blob = new Blob([tsvContent], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gatya.tsv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    loadedTsvContent = tsvContent;
    alert("gatya.tsv を作成しました。\nGitHubの gatya.tsv をこのファイルで上書きしてください。");
}