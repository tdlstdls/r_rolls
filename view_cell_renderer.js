
/**
 * view_cell_renderer.js
 * セル単位のHTML生成ロジック
 */

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

    if (seedIndex + 10 >= seeds.length) return `<td class="${calcColClass}">End</td>`.repeat(5);
    const sNum1 = seedIndex + 1;
    const sNum2 = seedIndex + 2;
    const sVal_0 = seeds[seedIndex];
    const sVal_1 = seeds[seedIndex+1];
    const colSeed = `<td>(S${sNum1})<br>${sVal_0}</td>`;

    const rVal = sVal_0 % 10000;
    const rates = config.rarity_rates || {};
    const rareRate = rates.rare || 0, superRate = rates.super || 0, uberRate = rates.uber || 0, legendRate = rates.legend || 0;
    let rType = 'rare';
    if (rVal < rareRate) rType = 'rare';
    else if (rVal < rareRate + superRate) rType = 'super';
    else if (rVal < rareRate + superRate + uberRate) rType = 'uber';
    else if (rVal < rareRate + superRate + uberRate + legendRate) rType = 'legend';
    
    const colRarity = `<td>(S${sNum1})<br>${rVal}<br>(${rType})</td>`;
    const pool = config.pool[rType] || [];
    let colSlot = '<td>-</td>';
    let slotVal = '-';
    if (pool.length > 0) {
        slotVal = sVal_1 % pool.length;
        colSlot = `<td>(S${sNum2})<br>%${pool.length}<br>${slotVal}</td>`;
    }

    let colReRoll = '<td>-</td>';
    if (tableData[seedIndex] && tableData[seedIndex][0] && tableData[seedIndex][0].roll) {
        const roll = tableData[seedIndex][0].roll;
        if (pool.length > 0) {
            if (roll.isRerolled) {
                const finalPoolSize = roll.uniqueTotal;
                const finalVal = roll.reRollIndex;
                // reRoll時は seedsConsumed 分だけ進む
                // ここでは単純表示のため seedIndex + seedsConsumed - 1 を使用
                const finalSeedIndex = seedIndex + roll.seedsConsumed - 1;
                const sNumFinal = finalSeedIndex + 1;
                colReRoll = `<td>(S${sNumFinal})<br>%${finalPoolSize}<br>${finalVal}</td>`;
            } else {
                colReRoll = `<td>false</td>`;
            }
        }
    }

    // Guar列の簡易計算（シミュレーション）
    let tempSeedIdx = seedIndex;
    let tempDraw = null;
    let validSim = true;
    for(let k=0; k<10; k++) {
        if (tempSeedIdx + 1 >= seeds.length) { validSim = false; break; }
        const rr = rollWithSeedConsumptionFixed(tempSeedIdx, config, seeds, tempDraw);
        if (rr.seedsConsumed === 0) { validSim = false; break; }
        tempSeedIdx += rr.seedsConsumed;
        tempDraw = { rarity: rr.rarity, charId: rr.charId };
    }
    let colGuar = '<td>-</td>';
    if (validSim && tempSeedIdx < seeds.length) {
        const uberPool = config.pool['uber'] || [];
        if (uberPool.length > 0) {
            const guarSeedVal = seeds[tempSeedIdx];
            const guarSlot = guarSeedVal % uberPool.length;
            const sNumGuar = tempSeedIdx + 1;
            colGuar = `<td>(S${sNumGuar})<br>%${uberPool.length}<br>${guarSlot}</td>`;
        }
    }
    return colSeed + colRarity + colSlot + colReRoll + colGuar;
}

// ガチャ結果セル (キャラ名、色分け、リンク等) を生成
function generateCell(seedIndex, id, colIndex, tableData, seeds, highlightMap, isSimulationMode) {
    if(!tableData[seedIndex] || !tableData[seedIndex][colIndex]) return `<td class="gacha-cell gacha-column">N/A</td>`;
    const fullRoll = tableData[seedIndex][colIndex].roll;
    if(!fullRoll) return `<td>N/A</td>`;
    
    const gachaConfig = gachaMasterData.gachas[id];
    const gachaName = gachaConfig ? gachaConfig.name : "";
    const isPlatOrLegend = gachaName.includes("プラチナ") || gachaName.includes("レジェンド");
    
    let isLimited = false;
    const charId = fullRoll.finalChar.id;
    const charIdStr = String(charId);
    if (typeof limitedCats !== 'undefined' && Array.isArray(limitedCats)) {
        if (limitedCats.includes(parseInt(charId)) || limitedCats.includes(charIdStr)) {
            isLimited = true;
        }
    }

    let hlClass = '';
    let isSimRoute = false;
    if (isSimulationMode) {
        if (highlightMap.get(seedIndex) === id) {
            hlClass = ' highlight';
            isSimRoute = true;
        }
        if (hlClass && fullRoll.rarity === 'uber') hlClass = ' highlight-uber';
    }

    let style = '';
    if (isSimRoute) {
        if (isLimited || fullRoll.rarity === 'uber' || fullRoll.rarity === 'legend') style = 'background-color: #32CD32;';
        else style = 'background-color: #98FB98;';
    } else {
        if (isLimited) style = 'background-color: #66FFFF;';
        else if (isPlatOrLegend) style = '';
        else {
            if (!hlClass) {
                const sv = seeds[seedIndex] % 10000;
                if(sv >= 9970) style = 'background-color: #DDA0DD;';
                else if(sv >= 9940) style = 'background-color: #de59de;';
                else if(sv >= 9500) style = 'background-color: #FF4C4C;';
                else if(sv >= 9100) style = 'background-color: #FFB6C1;';
                else if(sv >= 6970) style = 'background-color: #ffff33;';
                else if(sv >= 6470) style = 'background-color: #FFFFcc;';
            }
        }
    }

    if (!isSimRoute) {
        let isAuto = false;
        if (fullRoll.rarity === 'legend') isAuto = true;
        else if (isLimited) isAuto = true;
        else if (charIdStr.startsWith('sim-new-')) isAuto = true;
        const isHidden = hiddenFindIds.has(charId) || (typeof charId === 'number' && hiddenFindIds.has(charId)) || hiddenFindIds.has(charIdStr);
        const isManual = userTargetIds.has(charId) || (typeof charId === 'number' && userTargetIds.has(charId));

        if ((isAuto && !isHidden) || isManual) {
            style = 'background-color: #adff2f; font-weight: bold;';
        }
    }

    // --- クリックイベント設定 (経路計算用) ---
    // キャラ名のエスケープ処理 (簡易)
    const charNameForCopy = fullRoll.finalChar.name.replace(/'/g, "\\'");
    const clickHandler = `onclick="onGachaCellClick(${seedIndex}, '${id}', '${charNameForCopy}')"`;
    style += ' cursor: pointer;';

    let content = fullRoll.finalChar.name;
    if (!isSimulationMode) {
        if (fullRoll.isRerolled) {
            const s2Val = (seedIndex + 1 < seeds.length) ? seeds[seedIndex + 1] : null;
            const s3Val = (seedIndex + 2 < seeds.length) ? seeds[seedIndex + 2] : null;
            const originalName = fullRoll.originalChar.name;
            const finalName = fullRoll.finalChar.name;
            let originalHtml = originalName;
            // 内部リンクには stopPropagation を追加してセルのonclick発火を防止
            if (s2Val !== null) originalHtml = `<span class="char-link" style="cursor:pointer;" onclick="event.stopPropagation(); updateSeedAndRefresh(${s2Val})">${originalName}</span>`;
            let finalHtml = finalName;
            if (s3Val !== null) finalHtml = `<span class="char-link" style="cursor:pointer;" onclick="event.stopPropagation(); updateSeedAndRefresh(${s3Val})">${finalName}</span>`;
            
            const nextSeedIdx = seedIndex + fullRoll.seedsConsumed;
            let addr = formatAddress(nextSeedIdx);
            if (fullRoll.isForceDuplicate) {
                addr = 'R' + addr;
            }
            content = `${originalHtml}<br><span style="font-size:0.9em; color:#666;">${addr}</span>${finalHtml}`;
        } else {
            const slotSeedVal = (seedIndex + 1 < seeds.length) ? seeds[seedIndex + 1] : null;
            if(slotSeedVal !== null) content = `<span class="char-link" style="cursor:pointer;" onclick="event.stopPropagation(); updateSeedAndRefresh(${slotSeedVal})">${content}</span>`;
        }
    } else {
        if (fullRoll.isRerolled) {
            const nextSeedIdx = seedIndex + fullRoll.seedsConsumed;
            let addr = formatAddress(nextSeedIdx);
            if (fullRoll.isForceDuplicate) {
                addr = 'R' + addr;
            }
            content = `${fullRoll.originalChar.name}<br><span style="font-size:0.9em; color:#666;">${addr}</span>${fullRoll.finalChar.name}`;
        }
    }
    
    return `<td class="gacha-cell gacha-column${hlClass}" style="${style}" ${clickHandler}>${content}</td>`;
}