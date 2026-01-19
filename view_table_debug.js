/** @file view_table_debug.js @description デバッグログ表示機能 */

let gLongPressTimer = null;

/**
 * [cite_start]デバッグモーダルの初期化 [cite: 1026-1029]
 */
function initDebugModal() {
    if (document.getElementById('debug-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'debug-modal';
    modal.style = "display:none; position:fixed; z-index:9999; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.8); overflow:auto;";
    modal.innerHTML = `
        <div style="background:#fff; margin:5% auto; padding:20px; width:95%; max-width:800px; border-radius:8px; font-family:monospace; position:relative; box-shadow:0 4px 15px rgba(0,0,0,0.5);">
            <span onclick="this.parentElement.parentElement.style.display='none'" style="position:absolute; right:15px; top:5px; cursor:pointer; font-size:30px; font-weight:bold;">&times;</span>
            <h3 id="debug-title" style="margin-top:0;">11G Calculation Debug Log</h3>
            <div id="debug-content" style="overflow-x:auto;"></div>
        </div>`;
    document.body.appendChild(modal);
}

/**
 * [cite_start]長押しタイマー開始 [cite: 1030]
 */
window.start11GTimer = function(seedIdx, colIdx, isAlt) {
    if (!showSeedColumns) return;
    window.clear11GTimer();
    gLongPressTimer = setTimeout(() => { 
        showDebugLog(seedIdx, colIdx, isAlt); 
        gLongPressTimer = null; 
    }, 800);
};

/**
 * [cite_start]長押しタイマークリア [cite: 1031]
 */
window.clear11GTimer = function() {
    if (gLongPressTimer) { 
        clearTimeout(gLongPressTimer); 
        gLongPressTimer = null; 
    }
};

/**
 * [cite_start]詳細デバッグログの表示 [cite: 1032-1036]
 */
window.showDebugLog = function(seedIndex, colIndex, isAlt) {
    if (!showSeedColumns || !currentTableData) return;
    const cellData = currentTableData[seedIndex][colIndex];
    const data = isAlt ? cellData.alternativeGuaranteed : cellData.guaranteed;
    if (!data || !data.debugLog) return;
    
    document.getElementById('debug-title').innerText = isAlt ? "回避ルート詳細ログ" : "通常ルート詳細ログ";
    
    let logHtml = `<table border="1" style="width:100%; border-collapse:collapse; background:#fff; font-size:11px;">
        <tr style="background:#eee; position:sticky; top:0;">
            <th>Step</th><th>SEED</th><th>排出キャラ</th><th>判定詳細</th>
        </tr>`;
        
    data.debugLog.forEach(log => {
        let rerollTxt = "-";
        if (log.isRerolled) rerollTxt = `<span style="color:red;">被り回避</span><br>前回ID:${log.rerollProcess.prevId}を回避`;
        logHtml += `<tr><td>${log.step}</td><td>${log.s1 || log.seedValue}</td><td>${log.finalChar.name} (ID:${log.finalChar.id})</td><td>${rerollTxt}</td></tr>`;
    });
    
    document.getElementById('debug-content').innerHTML = logHtml + "</table>";
    document.getElementById('debug-modal').style.display = 'block';
};