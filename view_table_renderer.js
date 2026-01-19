/** @file view_table_renderer.js @description 行・セルの描画処理（G列SEED更新精度修正版） */

/**
 * 行レンダリング (A/Bサイド別)
 */
function renderTableRowSide(rowIndex, seedIndex, columnConfigs, tableData, seeds, highlightMap, guarHighlightMap, isLeftSide) {
    const rowData = tableData[seedIndex];
    if (!rowData) return ''; // データがなければ空の行を返す

    // No列の背景色を決定
    const rowInfo = rowData.rowInfo || {};
    let noColBgColor = '#f8f9fa'; // デフォルト色
    if (rowInfo.isNormalReroll) {
        noColBgColor = '#FFFF00'; // 黄色
    } else if (rowInfo.isCrossReroll) {
        noColBgColor = '#FFA500'; // オレンジ
    } else if (rowInfo.isActualReroll) {
        noColBgColor = '#FFDAB9'; // 淡いオレンジ (PeachPuff)
    }

    let sideHtml = `<td class="col-no" style="background: ${noColBgColor}; ${isLeftSide ? 'position: sticky; left: 0; z-index: 5; border-right: 1px solid #ddd;' : ''}">${rowIndex + 1}</td>`;

    // 詳細計算セルの描画 (view_cell_renderer.js で tableData の新構造に対応する必要がある)
    if (typeof generateDetailedCalcCells === 'function') {
        sideHtml += generateDetailedCalcCells(seedIndex, seeds, tableData);
    } else {
        const calcColClass = `calc-column ${showSeedColumns ? '' : 'hidden'}`;
        sideHtml += `<td class="${calcColClass}">-</td>`.repeat(5);
    }

    // 各ガチャ列のセルを描画
    tableGachaIds.forEach((idWithSuffix, colIndex) => {
        const id = idWithSuffix.replace(/[gfs]$/, '');
        const suffix = idWithSuffix.match(/[gfs]$/)?.[0] || '';
        // ★データ取得元を変更
        const data = rowData.cells ? rowData.cells[colIndex] : null;

        // 通常セルの描画 (view_cell_renderer.js で tableData の新構造に対応する必要がある)
        if (typeof generateCell === 'function') {
            sideHtml += generateCell(seedIndex, id, colIndex, tableData, seeds, highlightMap, isSimulationMode);
        } else {
            sideHtml += `<td>-</td>`;
        }

        // 確定枠セルの描画
        if (suffix) {
            // data の参照は既に新しい構造に対応済み
            if (data && (data.guaranteed || (data.result && data.result.guaranteed))) {
                sideHtml += renderGuaranteedCell(seedIndex, id, suffix, data, seeds, colIndex, guarHighlightMap);
            } else {
                sideHtml += `<td style="border: 1px solid #ddd; background: #eee; font-size:10px; text-align:center;">-</td>`;
            }
        }
    });
    return sideHtml;
}

/**
 * 確定枠セルの詳細描画
 */
function renderGuaranteedCell(seedIndex, id, suffix, data, seeds, colIndex, guarHighlightMap) {
    let cellStyle = 'white-space: normal; min-width: 80px; word-break: break-all; vertical-align: middle; border: 1px solid #ddd; font-size: 11px; padding: 0;';
    
    if (isSimulationMode && guarHighlightMap.get(seedIndex) === id) {
        cellStyle += `background-color: ${COLOR_ROUTE_UBER || '#66b2ff'};`;
    } else {
        cellStyle += `background-color: #eef7ff;`;
    }

    const gMain = data.guaranteed || (data.result ? data.result.guaranteed : null);
    const gAlt = data.alternativeGuaranteed || (data.result ? data.result.alternativeGuaranteed : null);
    
    let gContent = '<div style="padding: 4px;">---</div>';

    if (gMain && (gMain.name || (gMain.finalChar && gMain.finalChar.name))) {
        const buildGHtml = (res, isAltRoute) => {
            if (!res) return "";
            const addr = formatTableAddress(res.nextRollStartSeedIndex);
            const verifiedStyle = (!res.isVerified && showSeedColumns && !isAltRoute) ? "border-left: 3px solid #ff4444;" : "";
            const gType = (suffix === 'g') ? '11g' : (suffix === 'f' ? '15g' : '7g');
            
            const charName = res.name || (res.finalChar ? res.finalChar.name : "データ不足");
            const escapedName = charName.replace(/'/g, "\\'");
            
            // 非Simモード時：確定枠までの全ロールを終えた「最終消費SEED（res.nextRollStartSeedIndex - 1）」で更新
            // これにより、新しいテーブルの1行目が正確に次のロール開始SEED（res.nextRollStartSeedIndex）となります
            const finalSeedInProcess = seeds[res.nextRollStartSeedIndex - 1];
            
            let clickAction = isSimulationMode ?
                `onclick="if(!event.ctrlKey) onGachaCellClick(${seedIndex}, '${id}', '${escapedName}', '${gType}')"` :
                (res.nextRollStartSeedIndex >= 0 ? `onclick="if(!event.ctrlKey) updateSeedAndRefresh(${finalSeedInProcess})"` : "");
            
            const debugAttrs = showSeedColumns ? 
                `onpointerdown="window.start11GTimer(${seedIndex}, ${colIndex}, ${isAltRoute})" onpointerup="window.clear11GTimer()" onpointerleave="window.clear11GTimer()"` : "";
            
            return `<div ${clickAction} ${debugAttrs} style="cursor:pointer; padding:4px; ${verifiedStyle} ${isAltRoute ? 'border-bottom:1px dashed #ccc;' : ''}">${addr})<span class="char-link" style="font-weight:bold; color:#0056b3;">${charName}</span></div>`;
        };

        gContent = gAlt ? buildGHtml(gAlt, true) + buildGHtml(gMain, false) : buildGHtml(gMain, false);
    }
    
    return `<td class="gacha-cell gacha-column" style="${cellStyle}">${gContent}</td>`;
}

/**
 * テーブル用アドレス（A1, B25等）のフォーマット
 */
function formatTableAddress(index) {
    if (index === null || index === undefined || index < 0) return "---";
    const row = Math.floor(index / 2) + 1;
    const track = (index % 2 === 0) ? "A" : "B";
    return `${track}${row}`;
}