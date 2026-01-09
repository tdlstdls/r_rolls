/** @file view_cell_renderer.js @description 個別セルの描画とレアリティ色の制御（SEED更新精度修正版） */

/**
 * テーブル用アドレス（A1, B25等）のフォーマット
 */
function formatAddress(idx) {
    if (idx === null || idx === undefined) return '';
    const row = Math.floor(idx / 2) + 1;
    const side = (idx % 2 === 0) ? 'A' : 'B';
    return `${side}${row})`;
}

/**
 * SEED値やレアリティ判定などの詳細セル群を生成する
 */
function generateDetailedCalcCells(seedIndex, seeds, tableData) {
    const calcColClass = `calc-column ${showSeedColumns ? '' : 'hidden'}`;
    if (!showSeedColumns) return `<td class="${calcColClass}"></td>`.repeat(5);
    
    const firstGachaIdWithSuffix = tableGachaIds[0] || "";
    const firstGachaId = firstGachaIdWithSuffix.replace(/[gfs]$/, '');
    const config = gachaMasterData.gachas[firstGachaId];
    
    if (!config || seedIndex + 1 >= seeds.length) return `<td class="${calcColClass}">-</td>`.repeat(5);
    
    const s0 = seeds[seedIndex];
    const rVal = s0 % 10000;
    const rates = config.rarity_rates || {};
    
    let rType = (rVal < rates.rare) ? 'rare' : 
                (rVal < rates.rare + rates.super) ? 'super' : 
                (rVal < rates.rare + rates.super + rates.uber) ? 'uber' : 
                (rVal < rates.rare + rates.super + rates.uber + rates.legend) ? 'legend' : 'rare';
                
    return `<td class="${calcColClass}">${s0}</td><td class="${calcColClass}">${rType}</td><td class="${calcColClass}">-</td><td class="${calcColClass}">-</td><td class="${calcColClass}">-</td>`;
}

/**
 * 通常のガチャ結果セル（1マス分）を生成する
 */
function generateCell(seedIndex, id, colIndex, tableData, seeds, highlightMap, isSimulationMode) {
    const cell = tableData[seedIndex]?.cells?.[colIndex];
    if (!cell || !cell.roll) return `<td>-</td>`;
    
    const r = cell.roll;
    const charName = (r.finalChar && r.finalChar.name) ? r.finalChar.name : "データ不足";
    
    let style = '';
    const gachaConfig = gachaMasterData.gachas[id];
    const isSpecialGacha = gachaConfig && (gachaConfig.name.includes("プラチナ") || gachaConfig.name.includes("レジェンド"));

    const charId = r.finalChar.id;
    const charIdStr = String(charId);

    // --- 期間限定キャラ判定 ---
    let isLimited = false;
    if (typeof limitedCats !== 'undefined' && Array.isArray(limitedCats)) {
        if (limitedCats.includes(parseInt(charId)) || limitedCats.includes(charIdStr)) {
            isLimited = true;
        }
    }

    // --- Findターゲット判定 ---
    const isAuto = typeof isAutomaticTarget !== 'undefined' && isAutomaticTarget(charId);
    const isHidden = typeof hiddenFindIds !== 'undefined' && (hiddenFindIds.has(charId) || hiddenFindIds.has(charIdStr));
    const isManual = typeof userTargetIds !== 'undefined' && (userTargetIds.has(charId) || userTargetIds.has(charIdStr));
    const isFindTarget = (isAuto && !isHidden) || isManual;

    if (isSimulationMode && highlightMap.get(seedIndex) === id) {
        if (isLimited || r.rarity === 'uber' || r.rarity === 'legend' || isFindTarget) {
            style = 'background:#32CD32;';
        } else {
            style = 'background:#98FB98;';
        }
    } else {
        if (isFindTarget) {
            style = 'background-color: #adff2f; font-weight: bold;';
        } else if (isLimited) {
            style = 'background-color: #66FFFF;';
        } else if (isSpecialGacha) {
            style = '';
        } else {
            const sv = seeds[seedIndex] % 10000;
            if(sv >= 9970) style = 'background-color: #DDA0DD;';
            else if(sv >= 9940) style = 'background-color: #de59de;';
            else if(sv >= 9500) style = 'background-color: #FF4C4C;';
            else if(sv >= 6970) style = 'background-color: #ffff33;';
        }
    }

    const escapedName = charName.replace(/'/g, "\\'");
    
    // 非Simモード時のSEED更新：そのロールで最後に消費されたSEED値（seeds[seedIndex + r.seedsConsumed - 1]）をセット
    const finalUsedSeed = seeds[seedIndex + r.seedsConsumed - 1];
    const clickHandler = isSimulationMode ? 
        `onclick="onGachaCellClick(${seedIndex}, '${id}', '${escapedName}')"` :
        `onclick="updateSeedAndRefresh(${finalUsedSeed})"`;
    
    let content = "";
    if (r.isRerolled) {
        // レア被り回避時の処理
        const nextIdx = seedIndex + r.seedsConsumed;
        let destAddr = (r.isConsecutiveRerollTarget ? 'R' : '') + formatAddress(nextIdx);
        const oName = (r.originalChar && r.originalChar.name) ? r.originalChar.name : "不明";
        
        if (!isSimulationMode) {
            // 回避元のキャラ：最初に消費されたSEED（その1回分）で更新
            const originalFinalSeed = seeds[seedIndex];
            let oHtml = `<span class="char-link" onclick="event.stopPropagation(); updateSeedAndRefresh(${originalFinalSeed})">${oName}</span>`;
            
            // 回避先（最終結果）：一連の処理で最後に消費されたSEEDで更新
            let fHtml = `<span class="char-link" onclick="event.stopPropagation(); updateSeedAndRefresh(${finalUsedSeed})">${destAddr}${charName}</span>`;
            content = `${oHtml}<br>${fHtml}`;
        } else {
            content = `${oName}<br>${destAddr}${charName}`;
        }
    } else {
        content = charName;
    }
    
    return `<td class="gacha-cell" style="${style} cursor:pointer;" ${clickHandler}>${content}</td>`;
}