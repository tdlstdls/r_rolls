/** @file ui_schedule_editor_handler.js @description スケジュールエディタの操作イベント（追加・削除・保存）を管理 */

/**
 * 現在のエディタの内容を解析してTSV文字列を生成する（共通処理）
 */
function captureEditorDataToTsv() {
    const rows = document.querySelectorAll('#schedule-editor-table tbody tr');
    let tsvRows = [];

    rows.forEach(row => {
        const startD = row.querySelector('.edit-start-date').value.trim();
        const startT = row.querySelector('.edit-start-time').value.trim();
        const endD = row.querySelector('.edit-end-date').value.trim();
        const endT = row.querySelector('.edit-end-time').value.trim();
        const gId = row.querySelector('.edit-id').value.trim();
        const name = row.querySelector('.edit-name').value.trim();
        const uber = row.querySelector('.edit-uber').value.trim();
        const legend = row.querySelector('.edit-legend').value.trim();
        const isG = row.querySelector('.edit-guaranteed').checked ? "1" : "0";

        if (!startD || !endD || !gId) return;

        let cols = Array(25).fill("0");
        cols[0] = startD;
        cols[1] = startT;
        cols[2] = endD;
        cols[3] = endT;
        cols[8] = "1"; 
        cols[10] = gId;
        cols[16] = "7000"; 
        cols[18] = "2500"; 
        cols[20] = uber;
        cols[21] = isG;
        cols[22] = legend;
        cols[24] = name;

        tsvRows.push(cols.join('\t'));
    });
    return tsvRows.join('\n');
}

/**
 * 編集内容を一時的にアプリに反映させる（リロードで消える）
 */
function applyScheduleTemporarily() {
    const tsvContent = captureEditorDataToTsv();
    if (!tsvContent) {
        alert("有効な予定データがありません。");
        return;
    }

    // グローバル変数を更新
    loadedTsvContent = tsvContent;
    // 解析フラグを落として、次回の表示時に再計算させる
    isScheduleAnalyzed = false;

    // 編集モードを終了してリスト表示に戻す
    window.isScheduleEditMode = false;
    if (typeof renderScheduleTable === 'function') {
        renderScheduleTable(loadedTsvContent, 'schedule-container');
    }
    
    // ガチャ選択用プルダウンも更新されるようにする
    if (typeof generateRollsTable === 'function') generateRollsTable();

    console.log("Schedule temporarily applied.");
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