/** @file view_schedule_editor.js @description スケジュール予定の編集用UIレンダリング */

/**
 * 編集モードのテーブルを描画する
 */
function renderScheduleEditor(tsvContent, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const data = parseGachaTSV(tsvContent);

    let html = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; flex-wrap: wrap; gap: 10px;">
            <h3 style="margin:0;">スケジュール編集モード</h3>
            <div style="display: flex; gap: 5px;">
                <button onclick="addNewScheduleRow()" class="add-gacha-btn" style="padding: 5px 10px;">＋ 予定を追加</button>
                <button onclick="applyScheduleTemporarily()" style="background-color: #007bff; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 11px;">一時反映</button>
                <button onclick="generateAndDownloadTSV()" style="background-color: #28a745; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 11px;">TSV保存 (DL)</button>
                <button onclick="toggleSchedule()" class="secondary" style="padding: 5px 10px;">キャンセル</button>
            </div>
        </div>
        <div style="background: #fff3cd; color: #856404; padding: 8px; border-radius: 4px; font-size: 0.8em; margin-bottom: 10px; border: 1px solid #ffeeba;">
            ※<strong>「一時反映」</strong>を押すと、現在の編集内容がガントチャート等に反映されます（再読み込みで戻ります）。画像保存を行いたい場合に使用してください。
        </div>
        <div class="schedule-scroll-wrapper">
        <table class="schedule-table" id="schedule-editor-table" style="font-size: 11px;">
            <thead>
                <tr>
                    <th style="min-width:75px;">開始日/時</th>
                    <th style="min-width:75px;">終了日/時</th>
                    <th style="min-width:100px;">ID / ガチャ名選択</th>
                    <th>ガチャ詳細(TSV表示名)</th>
                    <th style="min-width:45px;">超激%</th>
                    <th style="min-width:45px;">伝説%</th>
                    <th style="min-width:30px;">確定</th>
                    <th style="min-width:30px;">操作</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.forEach((item) => {
        html += createEditorRowHtml(item);
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

/**
 * 行のHTML生成ヘルパー
 */
function createEditorRowHtml(item = null) {
    const d = item || {
        rawStart: "20250101", startTime: "1100",
        rawEnd: "20250104", endTime: "1059",
        id: "0", tsvName: "新規予定",
        uber: "500", legend: "30",
        guaranteed: false
    };

    const options = typeof getGachaSelectorOptions === 'function' ? getGachaSelectorOptions(d.id) : [];
    
    let idOptionsHtml = "";
    options.forEach(opt => {
        const selected = (opt.value == d.id) ? 'selected' : '';
        idOptionsHtml += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
    });

    const isGuaranteedChecked = d.guaranteed ? 'checked' : '';
    
    return `
        <tr>
            <td>
                <input type="text" value="${d.rawStart}" class="edit-start-date" style="width:68px; display:block; margin-bottom:2px;" placeholder="YYYYMMDD">
                <input type="text" value="${d.startTime}" class="edit-start-time" style="width:40px;" placeholder="HHMM">
            </td>
            <td>
                <input type="text" value="${d.rawEnd}" class="edit-end-date" style="width:68px; display:block; margin-bottom:2px;" placeholder="YYYYMMDD">
                <input type="text" value="${d.endTime}" class="edit-end-time" style="width:40px;" placeholder="HHMM">
            </td>
            <td>
                <select class="edit-id" style="width:100%; max-width:150px;" onchange="updateEditorNameFromId(this)">
                    ${idOptionsHtml}
                </select>
            </td>
            <td><input type="text" value="${d.tsvName}" class="edit-name" style="width:95%; min-width:140px;"></td>
            <td><input type="number" value="${d.uber}" class="edit-uber" style="width:45px;"></td>
            <td><input type="number" value="${d.legend}" class="edit-legend" style="width:40px;"></td>
            <td><input type="checkbox" ${isGuaranteedChecked} class="edit-guaranteed"></td>
            <td><button onclick="deleteEditorRow(this)" class="remove-btn" style="padding: 2px 6px;">×</button></td>
        </tr>
    `;
}

/**
 * IDプルダウン変更時にガチャ名を自動セットする補助関数
 */
function updateEditorNameFromId(selectEl) {
    const row = selectEl.closest('tr');
    const nameInput = row.querySelector('.edit-name');
    if (!nameInput) return;

    const selectedText = selectEl.options[selectEl.selectedIndex].text;
    const match = selectedText.match(/\)\s*(.+)$/);
    if (match && match[1]) {
        nameInput.value = match[1].replace(/\[確定\]$/, "").trim();
    }
}