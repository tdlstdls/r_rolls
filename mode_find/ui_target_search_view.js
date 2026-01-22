/** @file ui_target_search_view.js @description 検索結果のモーダル表示と操作 */

function displayOtherSearchResults(targetName, results) {
    let html = `<div style="padding: 10px;">
        <h3 style="margin-top: 0; border-bottom: 2px solid #00bbff;">「${targetName}」の出現場所</h3>
        <div style="max-height: 400px; overflow-y: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">
                <thead style="position: sticky; top: 0; background: #eee;">
                    <tr><th style="padding: 5px;">ガチャ名</th><th style="padding: 5px;">位置</th></tr>
                </thead>
                <tbody>`;

    if (results.length === 0) {
        html += `<tr><td colspan="2" style="padding: 10px; text-align: center;">10000ロール以内に見つかりませんでした。</td></tr>`;
    } else {
        results.forEach(r => {
            html += `
                <tr style="border-bottom: 1px solid #eee; cursor: pointer;" onclick="addColumnAndScroll('${r.gachaId}', ${r.distance})">
                    <td style="padding: 5px;">${r.gachaName}</td>
                    <td style="padding: 5px; text-align: center; font-weight: bold; color: #0056b3;">${r.track}${r.distance}</td>
                </tr>`;
        });
    }

    html += `</tbody></table></div>
        <button onclick="closeModal()" style="width: 100%; padding: 10px; margin-top: 10px;">閉じる</button>
    </div>`;
    showModal(html);
}

function addColumnAndScroll(gachaId, distance) {
    closeModal();
    if (!tableGachaIds.includes(gachaId)) {
        tableGachaIds.push(gachaId);
        uberAdditionCounts.push(0);
    }
    if (currentRolls < distance + 10) {
        currentRolls = Math.ceil((distance + 10) / 100) * 100;
    }
    generateRollsTable();
    
    setTimeout(() => {
        const rows = document.querySelectorAll('#rolls-table-container tr');
        const targetRow = rows[distance]; // NO.行ヘッダー等があるため近似
        if (targetRow) {
            targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetRow.style.backgroundColor = '#ffffcc';
            setTimeout(() => { targetRow.style.backgroundColor = ''; }, 2000);
        }
    }, 350);
}