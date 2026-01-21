/** @file view_table_debug.js @description 確定枠算出過程の詳細表示（デバッグログ）を担当 */

/**
 * 確定11連などの計算過程をモーダルで表示する
 */
function showDebugLog(seedIdx, colIdx, isAlt = false) {
    const rowData = tableData[seedIdx];
    const cell = rowData?.cells?.[colIdx];
    if (!cell || !cell.sequential) return;

    const seq = cell.sequential;
    const config = gachaMasterData.gachas[tableGachaIds[colIdx].replace(/[gfs]$/, '')];

    let html = `<div style="font-family:monospace; font-size:11px; max-width:600px;">
        <h3 style="margin-top:0; border-bottom:1px solid #ccc; padding-bottom:5px;">確定枠算出過程 [${isAlt ? 'Alt Route' : 'Main Route'}]</h3>
        <p>開始SEED: ${seq.debugLog[0]?.startIndex || '不明'}</p>
        <div style="max-height:400px; overflow-y:auto; background:#f9f9f9; padding:8px; border:1px solid #ddd; border-radius:4px;">
            <table style="width:100%; border-collapse:collapse;">
                <thead style="background:#eee; position:sticky; top:0;">
                    <tr>
                        <th style="padding:4px; border:1px solid #ccc;">回</th>
                        <th style="padding:4px; border:1px solid #ccc;">INDEX</th>
                        <th style="padding:4px; border:1px solid #ccc;">判定値</th>
                        <th style="padding:4px; border:1px solid #ccc;">キャラ[ID, SLOT]</th>
                    </tr>
                </thead>
                <tbody>`;

    seq.debugLog.forEach((log, i) => {
        const isGuaranteed = log.step.includes('Guaranteed');
        const bgColor = isGuaranteed ? '#fff3cd' : '#fff';
        
        // キャラクター情報の取得を強化
        let charName = "不明";
        let charId = "?";
        let slotInfo = log.charIndex !== undefined ? log.charIndex : "?";

        if (log.finalChar) {
            charName = log.finalChar.name || "不明";
            charId = log.finalChar.id || "?";
        }

        // マスターデータからの名前補完（IDがわかっている場合）
        if (charName === "不明" && charId !== "?") {
            const masterCat = gachaMasterData.cats[charId];
            if (masterCat) charName = masterCat.name;
        }

        const stepLabel = isGuaranteed ? "確定" : (i + 1);
        const seedValue = log.seedValue !== undefined ? log.seedValue : (log.s0 || "-");
        const rarityDisp = log.rarity ? `(${log.rarity})` : "";

        html += `<tr style="background:${bgColor};">
            <td style="padding:4px; border:1px solid #ccc; text-align:center;">${stepLabel}</td>
            <td style="padding:4px; border:1px solid #ccc; text-align:center;">${log.startIndex}</td>
            <td style="padding:4px; border:1px solid #ccc; text-align:center;">${seedValue}${rarityDisp}</td>
            <td style="padding:4px; border:1px solid #ccc;">
                ${charName} <span style="color:#666; font-size:10px;">[ID:${charId}, SLOT:${slotInfo}]</span>
            </td>
        </tr>`;
    });

    html += `</tbody></table></div>
        <div style="margin-top:10px; padding:8px; background:#e2f3ff; border-radius:4px; font-weight:bold;">
            最終排出: ${seq.name} (ID: ${seq.charId})
        </div>
        <button onclick="closeModal()" style="width:100%; margin-top:10px; padding:8px;">閉じる</button>
    </div>`;

    showModal(html);
}

/**
 * 連続算出結果（sequential）のサマリーテキストを生成する
 * ツールチップ表示等で使用
 */
function getSequentialSummary(seq) {
    if (!seq || !seq.normalRollsResults) return "";
    
    let summary = "1-10回目内容:\n";
    seq.normalRollsResults.forEach((r, i) => {
        const name = r.finalChar?.name || "データ不足";
        summary += `${i+1}: ${name}\n`;
    });
    summary += `\n確定枠: ${seq.name}`;
    return summary;
}

/**
 * モーダル内でのスクロール追跡などの補助機能が必要な場合はここに追加
 */
window.addEventListener('resize', () => {
    const modal = document.getElementById('common-modal');
    if (modal && modal.style.display === 'block') {
        // 必要に応じてリサイズ処理
    }
});