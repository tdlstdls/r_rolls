/** @file view_cell_renderer.js @description テーブル内の個別のセル（通常・確定枠・計算列）のHTML生成を担当 @dependency logic.js, view_analysis.js */

// アドレスフォーマット (例: 1A, 2B)
function formatAddress(idx) {
    if (idx === null || idx === undefined) return '';
    const row = Math.floor(idx / 2) + 1;
    const side = (idx % 2 === 0) ? 'A' : 'B';
    return `${side}${row})`;
}

// 左側の詳細計算列 (SEED, Rarity, Slotなど) を生成
function generateDetailedCalcCells(seedIndex, seeds, tableData) {
    const calcColClass = `calc-column ${showSeedColumns ? '' : 'hidden'}`;
    if (!showSeedColumns) return `<td class="${calcColClass}"></td>`.repeat(5);
    
    const firstGachaIdWithSuffix = tableGachaIds[0];
    if (!firstGachaIdWithSuffix) return `<td class="${calcColClass}">N/A</td>`.repeat(5);
    let firstId = firstGachaIdWithSuffix.replace(/[gfs]$/, '');
    const originalConfig = gachaMasterData.gachas[firstId];
    if(!originalConfig) return `<td class="${calcColClass}">N/A</td>`.repeat(5);
    
    const config = { ...originalConfig };
    config.pool = { ...originalConfig.pool };
    if (config.pool.uber) {
        config.pool.uber = [...config.pool.uber];
        const addCount = uberAdditionCounts[0] || 0;
        if (addCount > 0) {
            for (let k = 1; k <= addCount; k++) config.pool.uber.unshift({ id: `sim-new-${k}`, name: `新規超激${k}`, rarity: 'uber' });
        }
    }

    if (seedIndex + 1 >= seeds.length) return `<td class="${calcColClass}">End</td>`.repeat(5);
    const sVal_0 = seeds[seedIndex];
    const sVal_1 = seeds[seedIndex+1];
    
    const colSeed = `<td>(S${seedIndex+1})<br>${sVal_0}</td>`;
    const rVal = sVal_0 % 10000;
    const rates = config.rarity_rates || {};
    const rareRate = rates.rare || 0, superRate = rates.super || 0, uberRate = rates.uber || 0, legendRate = rates.legend || 0;
    let rType = 'rare';
    if (rVal < rareRate) rType = 'rare';
    else if (rVal < rareRate + superRate) rType = 'super';
    else if (rVal < rareRate + superRate + uberRate) rType = 'uber';
    else if (rVal < rareRate + superRate + uberRate + legendRate) rType = 'legend';
    const colRarity = `<td>(S${seedIndex+1})<br>${rVal}<br>(${rType})</td>`;

    let colSlot = '<td>-</td>';
    let colReRoll = '<td>-</td>';
    if (tableData[seedIndex] && tableData[seedIndex][0] && tableData[seedIndex][0].roll) {
        const roll = tableData[seedIndex][0].roll;
        colSlot = `<td>(S${seedIndex+2})<br>%${roll.totalChars}<br>${roll.charIndex}</td>`;
        if (roll.isRerolled) {
            const finalSeedIdx = seedIndex + roll.seedsConsumed;
            colReRoll = `<td>(S${finalSeedIdx})<br>%${roll.uniqueTotal}<br>${roll.reRollIndex}</td>`;
        } else {
            colReRoll = `<td>false</td>`;
        }
    }

    let colGuar = '<td>-</td>';
    const uberPool = config.pool['uber'] || [];
    if (seedIndex < seeds.length - 20 && uberPool.length > 0) {
        let tempIdx = seedIndex;
        let tempDraw = null;
        for(let k=0; k<10; k++) {
            const rr = rollWithSeedConsumptionFixed(tempIdx, config, seeds, tempDraw);
            if (rr.seedsConsumed === 0) break;
            tempIdx += rr.seedsConsumed;
            tempDraw = { 
                rarity: rr.rarity, 
                charId: rr.charId, 
                originalCharId: rr.originalChar ? rr.originalChar.id : rr.charId,
                isRerolled: rr.isRerolled, 
                lastRerollSlot: rr.lastRerollSlot, 
                fromRerollRoute: rr.isRerolled 
            };
        }
        if (tempIdx < seeds.length) {
            colGuar = `<td>(S${tempIdx+1})<br>%${uberPool.length}<br>${seeds[tempIdx] % uberPool.length}</td>`;
        }
    }

    return colSeed + colRarity + colSlot + colReRoll + colGuar;
}

// ガチャ結果セル (キャラ名、色分け、リンク等) を生成
function generateCell(seedIndex, id, colIndex, tableData, seeds, highlightMap, isSimulationMode) {
    if(!tableData[seedIndex] || !tableData[seedIndex][colIndex]) return `<td class="gacha-cell gacha-column">N/A</td>`;
    const fullRoll = tableData[seedIndex][colIndex].roll;
    if(!fullRoll) return `<td>N/A</td>`;
    
    const gConfig = gachaMasterData.gachas[id];
    const isPlatOrLegend = gConfig?.name.includes("プラチナ") || gConfig?.name.includes("レジェンド");
    const charId = String(fullRoll.finalChar.id);
    let isLimited = (typeof limitedCats !== 'undefined') && (limitedCats.includes(parseInt(charId)) || limitedCats.includes(charId));
    const isAuto = isAutomaticTarget(charId);
    const isHidden = hiddenFindIds.has(charId) || (typeof charId === 'number' && hiddenFindIds.has(charId));
    const isManual = userTargetIds.has(charId) || (typeof charId === 'number' && userTargetIds.has(charId));
    const isFindTarget = (isAuto && !isHidden) || isManual;

    let hlClass = '', isSimRoute = false, style = '';
    if (isSimulationMode && highlightMap.get(seedIndex) === id) {
        isSimRoute = true;
        if (isLimited || fullRoll.rarity === 'uber' || fullRoll.rarity === 'legend' || isFindTarget) {
            style = 'background-color: #32CD32;';
            hlClass = ' highlight highlight-uber';
        } else {
            style = 'background-color: #98FB98;';
            hlClass = ' highlight';
        }
    }

    if (!isSimRoute) {
        if (isFindTarget) {
            style = 'background-color: #adff2f; font-weight: bold;';
        } else if (isLimited) {
            style = 'background-color: #66FFFF;';
        } else if (!isPlatOrLegend) {
            const sv = seeds[seedIndex] % 10000;
            if (fullRoll.rarity === 'legend') style = 'background-color: #ffcc00;';
            else if (fullRoll.rarity === 'uber') style = 'background-color: #FF4C4C;';
            else if (sv >= 9100) style = 'background-color: #FFB6C1;';
            else if (fullRoll.rarity === 'super') style = 'background-color: #ffff33;';
            else if (sv >= 6470) style = 'background-color: #FFFFcc;';
        }
    }

    const charName = fullRoll.finalChar.name;
    const clickHandler = `onclick="onGachaCellClick(${seedIndex}, '${id}', '${charName.replace(/'/g, "\\'")}')"`;
    style += ' cursor: pointer;';

    let content = charName;

    // リロール（被り遷移）表示
    if (fullRoll.isRerolled) {
        const nextSeedIdx = seedIndex + fullRoll.seedsConsumed;
        let addr = formatAddress(nextSeedIdx);
        
        // 【修正箇所】連続レア被りが発生している場合のみ、アドレスの前にRを付与
        if (fullRoll.isConsecutiveRerollTarget) {
            addr = 'R' + addr;
        }

        if (!isSimulationMode) {
            const s2Val = (seedIndex + 1 < seeds.length) ? seeds[seedIndex + 1] : null;
            const s3Val = (seedIndex + 2 < seeds.length) ? seeds[seedIndex + 2] : null;
            const originalName = fullRoll.originalChar.name;
            let oHtml = s2Val ? `<span class="char-link" onclick="event.stopPropagation(); updateSeedAndRefresh(${s2Val})">${originalName}</span>` : originalName;
            let fHtml = s3Val ? `<span class="char-link" onclick="event.stopPropagation(); updateSeedAndRefresh(${s3Val})">${charName}</span>` : charName;
            content = `${oHtml}<br><span style="font-size:0.85em; color:#555;">${addr}</span>${fHtml}`;
        } else {
            content = `${fullRoll.originalChar.name}<br><span style="font-size:0.85em; color:#555;">${addr}</span>${charName}`;
        }
    } else if (!isSimulationMode) {
        const slotSeedVal = (seedIndex + 1 < seeds.length) ? seeds[seedIndex + 1] : null;
        if(slotSeedVal !== null) {
            content = `<span class="char-link" onclick="event.stopPropagation(); updateSeedAndRefresh(${slotSeedVal})">${content}</span>`;
        }
    }
    
    return `<td class="gacha-cell gacha-column${hlClass}" style="${style}" ${clickHandler}>${content}</td>`;
}