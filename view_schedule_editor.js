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
                <button onclick="toggleImportArea()" class="secondary" style="padding: 5px 10px;">テキストから読み取り</button>
                <button onclick="addNewScheduleRow()" class="add-gacha-btn" style="padding: 5px 10px;">＋ 予定を追加</button>
                <button onclick="applyScheduleTemporarily()" style="background-color: #007bff; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 11px;">一時反映</button>
                <button onclick="generateAndDownloadTSV()" style="background-color: #28a745; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 11px;">TSV保存 (DL)</button>
                <button onclick="toggleSchedule()" class="secondary" style="padding: 5px 10px;">キャンセル</button>
            </div>
        </div>

        <div id="import-area" style="display:none; background: #f8f9fa; padding: 10px; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 10px;">
            <p style="margin: 0 0 5px 0; font-size: 0.8em; font-weight: bold;">解析テキストをここに貼り付けてください:</p>
            <textarea id="import-text-input" style="width: 100%; height: 80px; font-size: 10px; font-family: monospace;" placeholder="[12月 25日 ~ 29日] クリスマスギャルズ ..."></textarea>
            <div style="text-align: right; margin-top: 5px;">
                <button onclick="processTextImport()" style="background-color: #17a2b8; color: white; font-size: 11px;">解析して追加</button>
                <button onclick="toggleImportArea()" style="font-size: 11px;" class="secondary">閉じる</button>
            </div>
        </div>

        <div style="background: #fff3cd; color: #856404; padding: 8px; border-radius: 4px; font-size: 0.8em; margin-bottom: 10px; border: 1px solid #ffeeba;">
            ※カレンダーと時刻(時)を選択して編集してください。保存時に分は自動補完されます（開始:00分、終了:59分）。
        </div>
        <div class="schedule-scroll-wrapper">
        <table class="schedule-table" id="schedule-editor-table" style="font-size: 11px;">
            <thead>
                <tr>
                    <th style="min-width:120px;">開始日 / 時</th>
                    <th style="min-width:120px;">終了日 / 時</th>
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
 * インポートエリアの表示・非表示切り替え
 */
function toggleImportArea() {
    const area = document.getElementById('import-area');
    if (area) {
        area.style.display = (area.style.display === 'none') ? 'block' : 'none';
    }
}

/**
 * 行のHTML生成ヘルパー
 */
function createEditorRowHtml(item = null) {
    let d;
    if (item) {
        d = item;
    } else {
        // デフォルト値
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const aft = new Date();
        aft.setDate(now.getDate() + 2);
        const ay = aft.getFullYear();
        const am = String(aft.getMonth() + 1).padStart(2, '0');
        const ad = String(aft.getDate()).padStart(2, '0');

        let defaultId = "0";
        let defaultName = "新規予定";
        if (typeof getGachaSelectorOptions === 'function') {
            const options = getGachaSelectorOptions();
            const targetGacha = options.find(opt => opt.label.includes("ネコルガ族"));
            if (targetGacha) {
                defaultId = targetGacha.value;
                const match = targetGacha.label.match(/\)\s*(.+)$/);
                defaultName = match ? match[1].replace(/\[確定\]$/, "").trim() : targetGacha.label;
            }
        }

        d = {
            rawStart: `${y}${m}${day}`, startTime: "1100", 
            rawEnd: `${ay}${am}${ad}`, endTime: "1059",
            id: defaultId, tsvName: defaultName,
            uber: "500", legend: "30", guaranteed: false
        };
    }

    const isoStart = `${d.rawStart.substring(0,4)}-${d.rawStart.substring(4,6)}-${d.rawStart.substring(6,8)}`;
    const isoEnd = `${d.rawEnd.substring(0,4)}-${d.rawEnd.substring(4,6)}-${d.rawEnd.substring(6,8)}`;
    const startHour = d.startTime.toString().padStart(4, '0').substring(0, 2);
    const endHour = d.endTime.toString().padStart(4, '0').substring(0, 2);

    const getHourOptions = (selected) => {
        let options = "";
        for (let i = 0; i < 24; i++) {
            const h = i.toString().padStart(2, '0');
            options += `<option value="${h}" ${h === selected ? 'selected' : ''}>${h}時</option>`;
        }
        return options;
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
                <input type="date" value="${isoStart}" class="edit-start-date" style="width:115px; display:block; margin-bottom:2px;">
                <select class="edit-start-time" style="width:60px;">${getHourOptions(startHour)}</select>
            </td>
            <td>
                <input type="date" value="${isoEnd}" class="edit-end-date" style="width:115px; display:block; margin-bottom:2px;">
                <select class="edit-end-time" style="width:60px;">${getHourOptions(endHour)}</select>
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
    const uberInput = row.querySelector('.edit-uber');
    if (!nameInput) return;

    const selectedText = selectEl.options[selectEl.selectedIndex].text;
    const match = selectedText.match(/\)\s*(.+)$/);
    if (match && match[1]) {
        const name = match[1].replace(/\[確定\]$/, "").trim();
        nameInput.value = name;
        if (uberInput) {
            if (name.includes("超ネコ祭") || name.includes("極ネコ祭")) uberInput.value = "900";
            else if (name.includes("超極ネコ祭")) uberInput.value = "1000";
            else if (name.includes("超国王祭")) uberInput.value = "700";
            else uberInput.value = "500";
        }
    }
}