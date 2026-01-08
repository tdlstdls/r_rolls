/** @file view_table_renderer.js @description 行・セルの描画処理 */

/**
 * [cite_start]行レンダリング (A/Bサイド別) [cite: 986-999]
 */
function renderTableRowSide(rowIndex, seedIndex, columnConfigs, tableData, seeds, highlightMap, guarHighlightMap, isLeftSide) {
    let sideHtml = `<td class="col-no" style="background: #f8f9fa; ${isLeftSide ? 'position: sticky; left: 0; z-index: 5; border-right: 1px solid #ddd;' : ''}">${rowIndex + 1}</td>`;
    
    sideHtml += generateDetailedCalcCells(seedIndex, seeds, tableData);
    
    tableGachaIds.forEach((idWithSuffix, colIndex) => {
        const id = idWithSuffix.replace(/[gfs]$/, '');
        const suffix = idWithSuffix.match(/[gfs]$/)?.[0] || '';
        const data = tableData[seedIndex][colIndex];
        if (!data) return;

        sideHtml += generateCell(seedIndex, id, colIndex, tableData, seeds, highlightMap, isSimulationMode);

        if (suffix) {
            sideHtml += renderGuaranteedCell(seedIndex, id, suffix, data, seeds, colIndex, guarHighlightMap);
        }
    });
    return sideHtml;
}

/**
 * [cite_start]確定枠セルの詳細描画 [cite: 988-998]
 */
function renderGuaranteedCell(seedIndex, id, suffix, data, seeds, colIndex, guarHighlightMap) {
    let cellStyle = 'white-space: normal; min-width: 80px; word-break: break-all; vertical-align: middle; border: 1px solid #ddd; font-size: 11px; padding: 0;';
    if (isSimulationMode && guarHighlightMap.get(seedIndex) === id) {
        cellStyle += `background-color: ${COLOR_ROUTE_UBER};`;
    } else {
        cellStyle += `background-color: #eef7ff;`;
    }

    const gMain = data.guaranteed, gAlt = data.alternativeGuaranteed;
    let gContent = '<div style="padding: 4px;">---</div>';

    if (gMain && gMain.name !== "データ不足") {
        const buildGHtml = (res, isAltRoute) => {
            const addr = formatTableAddress(res.nextRollStartSeedIndex);
            const verifiedStyle = (!res.isVerified && showSeedColumns && !isAltRoute) ? "border-left: 3px solid #ff4444;" : "";
            const gType = (suffix === 'g') ? '11g' : (suffix === 'f' ? '15g' : '7g');
            const escapedName = res.name.replace(/'/g, "\\'");
            
            let clickAction = isSimulationMode ?
                `onclick="if(!event.ctrlKey) onGachaCellClick(${seedIndex}, '${id}', '${escapedName}', '${gType}')"` :
                (res.nextRollStartSeedIndex >= 0 ? `onclick="if(!event.ctrlKey) updateSeedAndRefresh(${seeds[res.nextRollStartSeedIndex - 1]})"` : "");
            
            const debugAttrs = showSeedColumns ? 
                `onpointerdown="window.start11GTimer(${seedIndex}, ${colIndex}, ${isAltRoute})" onpointerup="window.clear11GTimer()" onpointerleave="window.clear11GTimer()"` : "";
            
            return `<div ${clickAction} ${debugAttrs} style="cursor:pointer; padding:4px; ${verifiedStyle} ${isAltRoute ? 'border-bottom:1px dashed #ccc;' : ''}">${addr}<span class="char-link" style="font-weight:bold; color:#0056b3;">${res.name}</span></div>`;
        };
        gContent = gAlt ? buildGHtml(gAlt, true) + buildGHtml(gMain, false) : buildGHtml(gMain, false);
    }
    return `<td class="gacha-cell gacha-column" style="${cellStyle}">${gContent}</td>`;
}

/**
 * [cite_start]アドレス書式のフォーマット [cite: 1024-1026]
 */
function formatTableAddress(index) {
    if (index === null || index === undefined) return "---";
    const row = Math.floor(index / 2) + 1;
    const track = (index % 2 === 0) ? "A" : "B";
    return `${track}${row})`;
}