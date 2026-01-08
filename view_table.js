/** @file view_table.js @description 結合ヘッダー（名称右に11G表示）・結合操作行・UI完全復元版 */

const COLOR_ROUTE_HIGHLIGHT = '#aaddff';
const COLOR_ROUTE_UBER = '#66b2ff';

/** メイン描画関数 */
function generateRollsTable() {
    try {
        if (Object.keys(gachaMasterData.gachas).length === 0) return;
        const seedEl = document.getElementById('seed');
        if (!seedEl) return;
        
        let initialSeed = parseInt(seedEl.value, 10);
        if (isNaN(initialSeed)) { 
            initialSeed = 12345;
            seedEl.value = "12345"; 
        }
        
        const numRolls = currentRolls;
        const seeds = [];
        const rng = new Xorshift32(initialSeed);
        for (let i = 0; i < numRolls * 25 + 500; i++) seeds.push(rng.next());
        
        const columnConfigs = prepareColumnConfigs();
        const tableData = executeTableSimulation(numRolls, columnConfigs, seeds);
        
        const { highlightMap, guarHighlightMap, lastSeedValue } = preparePathHighlightMaps(initialSeed, seeds, numRolls);
        finalSeedForUpdate = lastSeedValue;

        const container = document.getElementById('rolls-table-container');
        if (!container) return;

        let findAreaHtml = '';
        if (typeof generateFastForecast === 'function') findAreaHtml += generateFastForecast(initialSeed, columnConfigs);

        const tableHtml = buildTableDOM(numRolls, columnConfigs, tableData, seeds, highlightMap, guarHighlightMap);
        
        container.innerHTML = findAreaHtml + tableHtml;
        
        initDebugModal();
        updateUrlParams();

        const resultDiv = document.getElementById('result');
        if (resultDiv) resultDiv.textContent = isSimulationMode ? "Simulation active..." : "Display Mode";
        
    } catch (e) {
        console.error("Table Build Error:", e);
    }
}

/** テーブルDOM構築 */
function buildTableDOM(numRolls, columnConfigs, tableData, seeds, highlightMap, guarHighlightMap) {
    const buttonHtml = `
        <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 3px; font-weight: normal; white-space: normal;">
            <span style="font-weight: bold; margin-right: 1px; font-size: 11px;">A</span>
            <button class="add-gacha-btn" onclick="addGachaColumn()" style="font-size: 11px; padding: 1px 4px;">＋列を追加</button>
            <button class="add-gacha-btn" style="background-color: #17a2b8; font-size: 11px; padding: 1px 4px;" onclick="addGachasFromSchedule()">skdで追加</button>
            <span id="add-id-trigger" style="cursor:pointer; text-decoration:underline; color:#007bff; font-size: 11px; font-weight:bold;" onclick="showIdInput()">IDで追加</span>
            <button class="remove-btn" onclick="resetToFirstGacha()" title="解除" style="font-size: 11px; padding: 1px 5px; margin-left: 2px;">×</button>
        </div>`;

    const calcColSpan = showSeedColumns ? 5 : 0;
    let gachaColSpan = 0;
    tableGachaIds.forEach(idWithSuffix => {
        let id = idWithSuffix.replace(/[gfs]$/, '');
        if (gachaMasterData.gachas[id]) {
            gachaColSpan += /[gfs]$/.test(idWithSuffix) ? 2 : 1;
        }
    });

    const totalTrackSpan = calcColSpan + gachaColSpan;
    const fullTableColSpan = 2 + totalTrackSpan * 2;

    const calcColClass = `calc-column ${showSeedColumns ? '' : 'hidden'}`;

    let html = `<table style="table-layout: auto; width: 100%; border-collapse: collapse;"><thead>
        <tr>
            <th class="col-no" style="position: sticky; left: 0; z-index: 30; background: #f8f9fa; border-right: 1px solid #ddd;"></th>
            <th colspan="${totalTrackSpan}" style="text-align: center; vertical-align: middle; padding: 4px; border-right: 1px solid #ddd;">${buttonHtml}</th>
            <th class="col-no"></th>
            <th colspan="${totalTrackSpan}" style="text-align: center; vertical-align: middle; padding: 4px; font-weight: bold;">B</th>
        </tr>
        <tr class="sticky-row">
            <th class="col-no" style="position: sticky; top: 0; left: 0; z-index: 40; background: #f8f9fa; border-right: 1px solid #ddd;">NO.</th><th class="${calcColClass}" colspan="5">SEED</th>
            ${generateNameHeaderHTML()}
            <th class="col-no" style="border-left: 1px solid #ddd;">NO.</th><th class="${calcColClass}" colspan="5">SEED</th>
            ${generateNameHeaderHTML()}
        </tr>
        <tr class="control-row">
            <th class="col-no" style="position: sticky; left: 0; z-index: 30; background: #f8f9fa; border-right: 1px solid #ddd;"></th><th class="${calcColClass}" colspan="5"></th>
            ${generateControlHeaderHTML(true)}
            <th class="col-no" style="border-left: 1px solid #ddd;"></th><th class="${calcColClass}" colspan="5"></th>
            ${generateControlHeaderHTML(false)}
        </tr>
    </thead><tbody>`;

    for (let i = 0; i < numRolls; i++) {
        const seedIndexA = i * 2, seedIndexB = i * 2 + 1;
        html += `<tr>${renderTableRowSide(i, seedIndexA, columnConfigs, tableData, seeds, highlightMap, guarHighlightMap, true)}`;
        html += `${renderTableRowSide(i, seedIndexB, columnConfigs, tableData, seeds, highlightMap, guarHighlightMap, false)}</tr>`;
    }

    html += `<tr><td colspan="${fullTableColSpan}" style="padding: 10px; text-align: center;">
        <button onclick="addMoreRolls()">+100行</button>
        <button id="toggle-seed-btn" class="secondary" onclick="toggleSeedColumns()">${showSeedColumns ? 'SEED非表示' : 'SEED表示'}</button>
    </td></tr></tbody></table>`;
    return html;
}

/** 行レンダリング */
function renderTableRowSide(rowIndex, seedIndex, columnConfigs, tableData, seeds, highlightMap, guarHighlightMap, isLeftSide) {
    let sideHtml = `<td class="col-no" style="background: #f8f9fa; ${isLeftSide ? 'position: sticky; left: 0; z-index: 5; border-right: 1px solid #ddd;' : ''}">${rowIndex + 1}</td>`;
    
    sideHtml += generateDetailedCalcCells(seedIndex, seeds, tableData);
    
    tableGachaIds.forEach((idWithSuffix, colIndex) => {
        const id = idWithSuffix.replace(/[gfs]$/, '');
        const suffix = idWithSuffix.match(/[gfs]$/)?.[0] || '';
        const data = tableData[seedIndex][colIndex];
        if (!data) return;

        // 通常セルの描画 (min-widthで幅を維持)
        sideHtml += generateCell(seedIndex, id, colIndex, tableData, seeds, highlightMap, isSimulationMode);
        // generateCell内のスタイルに min-width: 120px; を追加（CSSかJS側での対応が必要な場合はここで補強）

        // 11G（確定枠）の描画
        if (suffix) {
            let cellStyle = 'white-space: normal; min-width: 80px; word-break: break-all; vertical-align: middle; border: 1px solid #ddd; font-size: 11px; padding: 0;';
            if (isSimulationMode && guarHighlightMap.get(seedIndex) === id) cellStyle += `background-color: ${COLOR_ROUTE_UBER};`;
            else cellStyle += `background-color: #eef7ff;`;

            const gMain = data.guaranteed, gAlt = data.alternativeGuaranteed;
            let gContent = '<div style="padding: 4px;">---</div>';

            if (gMain && gMain.name !== "データ不足") {
                const buildGHtml = (res, isAltRoute) => {
                    const addr = formatAddress(res.nextRollStartSeedIndex);
                    const verifiedStyle = (!res.isVerified && showSeedColumns && !isAltRoute) ? "border-left: 3px solid #ff4444;" : "";
                    const gType = (suffix === 'g') ? '11g' : (suffix === 'f' ? '15g' : '7g');
                    const escapedName = res.name.replace(/'/g, "\\'");
                    let clickAction = isSimulationMode ?
                        `onclick="if(!event.ctrlKey) onGachaCellClick(${seedIndex}, '${id}', '${escapedName}', '${gType}')"` :
                        (res.nextRollStartSeedIndex >= 0 ? `onclick="if(!event.ctrlKey) updateSeedAndRefresh(${seeds[res.nextRollStartSeedIndex - 1]})"` : "");
                    const debugAttrs = showSeedColumns ? 
                        `onpointerdown="window.start11GTimer(${seedIndex}, ${colIndex}, ${isAltRoute})" onpointerup="window.clear11GTimer()" onpointerleave="window.clear11GTimer()"` : "";
                    
                    // スペースなしでアドレスと名称を結合
                    return `<div ${clickAction} ${debugAttrs} style="cursor:pointer; padding:4px; ${verifiedStyle} ${isAltRoute ? 'border-bottom:1px dashed #ccc;' : ''}">${addr}<span class="char-link" style="font-weight:bold; color:#0056b3;">${res.name}</span></div>`;
                };
                gContent = gAlt ? buildGHtml(gAlt, true) + buildGHtml(gMain, false) : buildGHtml(gMain, false);
            }
            sideHtml += `<td class="gacha-cell gacha-column" style="${cellStyle}">${gContent}</td>`;
        }
    });
    return sideHtml;
}

/** 名称ヘッダーの生成 (結合 + ガチャ名右にラベル表示) */
function generateNameHeaderHTML() {
    let html = "";
    tableGachaIds.forEach((idWithSuffix, index) => {
        let id = idWithSuffix.replace(/[gfs]$/, '');
        const suffix = idWithSuffix.match(/[gfs]$/)?.[0] || '';
        const isGCol = suffix !== '';
        const config = gachaMasterData.gachas[id];
        if (!config) return;

        const options = (typeof getGachaSelectorOptions === 'function') ? getGachaSelectorOptions(id) : [];
        const currentOpt = options.find(o => String(o.value) === id);
        let label = currentOpt ? currentOpt.label : config.name;
        const addCount = uberAdditionCounts[index] || 0;
        let addStr = addCount > 0 ? ` <span style="color:#d9534f; font-weight:normal; font-size:0.8em;">(add:${addCount})</span>` : "";

        let displayHTML = "";
        const spaceIdx = label.indexOf(' ');
        if (spaceIdx !== -1) {
            const p1 = label.substring(0, spaceIdx), p2 = label.substring(spaceIdx + 1);
            displayHTML = `<span style="font-size:0.85em; color:#666;">${p1}</span><br><span style="font-weight:bold;">${p2}${addStr}</span>`;
        } else {
            displayHTML = `<span>${label}${addStr}</span>`;
        }

        if (isGCol) {
            let gText = (suffix === 'g') ? '11G' : (suffix === 'f' ? '15G' : '7G');
            // colspan=2で結合し、flexboxで名称とラベルを横に並べる
            html += `<th colspan="2" class="gacha-column" style="vertical-align: bottom; padding: 4px; border-right: 1px solid #ddd;">
                        <div style="display:flex; align-items:center; justify-content:center; gap:8px;">
                            <div style="text-align: center; line-height: 1.2;">${displayHTML}</div>
                            <div style="font-weight:bold; background:#d0e8ff; border-radius:3px; font-size:10px; padding:2px 8px; white-space:nowrap;">${gText}</div>
                        </div>
                     </th>`;
        } else {
            html += `<th class="gacha-column" style="vertical-align: bottom; padding: 4px; min-width: 120px; border-right: 1px solid #ddd;">
                        <div style="text-align: center; line-height: 1.2;">${displayHTML}</div>
                     </th>`;
        }
    });
    return html;
}

/** 操作ヘッダーの生成 (タイトル行と同じ幅で結合) */
function generateControlHeaderHTML(isInteractive) {
    let html = "";
    tableGachaIds.forEach((idWithSuffix, index) => {
        let id = idWithSuffix.replace(/[gfs]$/, '');
        let suffix = idWithSuffix.match(/[gfs]$/)?.[0] || '';
        const isGCol = suffix !== '';

        let controlArea = "";
        if (isInteractive) {
            const options = (typeof getGachaSelectorOptions === 'function') ? getGachaSelectorOptions(id) : [];
            let select = `<select onchange="updateGachaSelection(this, ${index})" style="width:100%; height:100%; opacity:0; position:absolute; left:0; top:0; cursor:pointer;">`;
            options.forEach(opt => {
                select += `<option value="${opt.value}" ${String(opt.value) === id ? 'selected' : ''}>${opt.label}</option>`;
            });
            select += `</select>`;
            const pullDownBtn = `<div style="position:relative; width:18px; height:18px; background:#eee; border:1px solid #999; border-radius:3px; display:flex; align-items:center; justify-content:center; font-size:10px;">▼${select}</div>`;
            let gLabel = 'G';
            if (suffix === 'g') gLabel = '11G'; else if (suffix === 'f') gLabel = '15G'; else if (suffix === 's') gLabel = '7G';
            const gBtn = `<button onclick="toggleGStep(${index})" style="min-width:28px; font-size:10px; padding:1px 3px;">${gLabel}</button>`;
            const curAdd = uberAdditionCounts[index] || 0;
            const addLabel = curAdd > 0 ? `add:${curAdd}` : `add`;
            const addTrigger = `<span id="add-trigger-${index}" style="font-size:10px; color:#007bff; cursor:pointer; text-decoration:underline;" onclick="showAddInput(${index})">${addLabel}</span>`;
            let addSelect = `<span id="add-select-wrapper-${index}" style="display:none;"><select class="uber-add-select" onchange="updateUberAddition(this, ${index})" style="width:35px; font-size:10px;">`;
            for(let k=0; k<=20; k++) addSelect += `<option value="${k}" ${k===curAdd?'selected':''}>${k}</option>`;
            addSelect += `</select></span>`;
            const delBtn = `<button class="remove-btn" onclick="removeGachaColumn(${index})" style="font-size:10px; padding:1px 5px;">×</button>`;
            controlArea = `<div style="display:flex; justify-content:center; align-items:center; gap:5px;">${pullDownBtn}${gBtn}${addTrigger}${addSelect}${delBtn}</div>`;
        }

        if (isGCol) {
            // タイトル行と同様にcolspan=2で結合
            html += `<th colspan="2" class="gacha-column" style="padding: 2px; border-right: 1px solid #ddd;">${controlArea}</th>`;
        } else {
            html += `<th class="gacha-column" style="padding: 2px; min-width: 120px; border-right: 1px solid #ddd;">${controlArea}</th>`;
        }
    });
    return html;
}

window.toggleGStep = function(index) {
    let idFull = tableGachaIds[index];
    let base = idFull.replace(/[gfs]$/, '');
    if (idFull.endsWith('g')) tableGachaIds[index] = base + 'f';
    else if (idFull.endsWith('f')) tableGachaIds[index] = base + 's';
    else if (idFull.endsWith('s')) tableGachaIds[index] = base;
    else tableGachaIds[index] = base + 'g';
    generateRollsTable();
};

window.showAddInput = function(index) {
    document.getElementById(`add-trigger-${index}`).style.display = 'none';
    document.getElementById(`add-select-wrapper-${index}`).style.display = 'inline';
};

window.updateUberAddition = function(el, index) {
    uberAdditionCounts[index] = parseInt(el.value, 10);
    generateRollsTable();
};

function formatAddress(index) {
    if (index === null || index === undefined) return "---";
    const row = Math.floor(index / 2) + 1;
    const track = (index % 2 === 0) ? "A" : "B";
    return `${track}${row})`;
}

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

window.start11GTimer = function(seedIdx, colIdx, isAlt) {
    if (!showSeedColumns) return;
    window.clear11GTimer();
    gLongPressTimer = setTimeout(() => { showDebugLog(seedIdx, colIdx, isAlt); gLongPressTimer = null; }, 800);
};
window.clear11GTimer = function() {
    if (gLongPressTimer) { clearTimeout(gLongPressTimer); gLongPressTimer = null; }
};

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

let currentTableData = null;
const originalExecute = executeTableSimulation;
executeTableSimulation = function(n, c, s) {
    currentTableData = originalExecute(n, c, s);
    return currentTableData;
};