/** @file view_cell_renderer.js @description 通常列の描画処理（スペース削除版） */

function formatAddress(idx) {
    if (idx === null || idx === undefined) return '';
    const row = Math.floor(idx / 2) + 1;
    const side = (idx % 2 === 0) ? 'A' : 'B';
    return `${side}${row})`;
}

function generateDetailedCalcCells(seedIndex, seeds, tableData) {
    const calcColClass = `calc-column ${showSeedColumns ? '' : 'hidden'}`;
    if (!showSeedColumns) return `<td class="${calcColClass}"></td>`.repeat(5);
    const firstGachaId = tableGachaIds[0]?.replace(/[gfs]$/, '');
    const config = gachaMasterData.gachas[firstGachaId];
    if (!config || seedIndex + 1 >= seeds.length) return `<td class="${calcColClass}">-</td>`.repeat(5);
    const s0 = seeds[seedIndex], rVal = s0 % 10000;
    const rates = config.rarity_rates || {};
    let rType = (rVal < rates.rare) ? 'rare' : (rVal < rates.rare + rates.super) ? 'super' : (rVal < rates.rare + rates.super + rates.uber) ? 'uber' : (rVal < rates.rare + rates.super + rates.uber + rates.legend) ? 'legend' : 'rare';
    return `<td class="${calcColClass}">${s0}</td><td class="${calcColClass}">${rType}</td><td class="${calcColClass}">-</td><td class="${calcColClass}">-</td><td class="${calcColClass}">-</td>`;
}

function generateCell(seedIndex, id, colIndex, tableData, seeds, highlightMap, isSimulationMode) {
    const cell = tableData[seedIndex]?.[colIndex];
    if (!cell || !cell.roll) return `<td>N/A</td>`;
    const r = cell.roll;
    let style = '';
    if (isSimulationMode && highlightMap.get(seedIndex) === id) {
        style = (r.rarity === 'uber' || r.rarity === 'legend') ? 'background:#32CD32;' : 'background:#98FB98;';
    } else {
        if (r.rarity === 'legend') style = 'background:#ffcc00;';
        else if (r.rarity === 'uber') style = 'background:#FF4C4C;';
        else if (r.rarity === 'super') style = 'background:#ffff33;';
    }

    const clickHandler = `onclick="onGachaCellClick(${seedIndex}, '${id}', '${r.finalChar.name.replace(/'/g, "\\'")}')"`;
    let content = "";
    
    if (r.isRerolled) {
        const nextIdx = seedIndex + r.seedsConsumed;
        // Rフラグ判定に基づいたアドレス生成
        let destAddr = (r.isConsecutiveRerollTarget ? 'R' : '') + formatAddress(nextIdx);
        
        const oName = r.originalChar.name;
        const fName = r.finalChar.name;
        
        if (!isSimulationMode) {
            const s2 = seeds[seedIndex + 1];
            // 修正：destAddr と fName の間のスペースを削除
            let oHtml = s2 ? `<span class="char-link" onclick="event.stopPropagation(); updateSeedAndRefresh(${s2})">${oName}</span>` : oName;
            let fHtml = `<span class="char-link">${destAddr}${fName}</span>`;
            content = `${oHtml}<br>${fHtml}`;
        } else {
            content = `${oName}<br>${destAddr}${fName}`;
        }
    } else {
        content = r.finalChar.name;
    }
    
    return `<td class="gacha-cell" style="${style} cursor:pointer;" ${clickHandler}>${content}</td>`;
}