/** @file view_cell_renderer.js @description 個別セルの描画とレアリティ色の制御（SEED [index] 1列集約版） */

/**
 * テーブル用アドレス（A1, B25等）のフォーマット
 * @param {number} idx - SEEDインデックス
 * @returns {string} フォーマット済み文字列
 */
function formatAddress(idx) {
    if (idx === null || idx === undefined) return '';
    const row = Math.floor(idx / 2) + 1;
    const side = (idx % 2 === 0) ? 'A' : 'B';
    return `${side}${row})`;
}

/**
 * SEED値などの詳細セル（左側の列）を生成する
 * 修正：5列から 1列（SEED [index]）に変更
 */
function generateDetailedCalcCells(seedIndex, seeds, tableData) {
    const calcColClass = `calc-column ${showSeedColumns ? '' : 'hidden'}`;
    if (!showSeedColumns) return `<td class="${calcColClass}"></td>`;
    
    if (seedIndex >= seeds.length) return `<td class="${calcColClass}">-</td>`;

    const s0 = seeds[seedIndex];
    // SEED値 [index] の形式で表示（半角スペース入り）
    return `<td class="${calcColClass}">${s0} [${seedIndex}]</td>`;
}

/**
 * 通常のガチャ結果セル（1マス分）を生成する
 */
function generateCell(seedIndex, id, colIndex, tableData, seeds, highlightMap, isSimulationMode) {
    const rowData = tableData[seedIndex];
    const cell = rowData?.cells?.[colIndex];
    
    if (!cell || !cell.roll) return `<td class="gacha-cell">-</td>`;
    
    const rr = cell.roll;
    const charName = (rr.finalChar && rr.finalChar.name) ? rr.finalChar.name : "データ不足";
    const charId = rr.finalChar.id;
    const charIdStr = String(charId);

    // --- 1. 背景色の判定ロジック ---
    let style = '';
    const sv = seeds[seedIndex] % 10000;

    // A. ユーザーが「Find」で優先指定したキャラ
    const isPrioritized = (typeof userPrioritizedTargets !== 'undefined') && 
                          (userPrioritizedTargets.includes(charId) || userPrioritizedTargets.includes(charIdStr));

    // B. 限定キャラ判定
    let isLimited = false;
    if (typeof limitedCats !== 'undefined' && Array.isArray(limitedCats)) {
        if (limitedCats.includes(parseInt(charId)) || limitedCats.includes(charIdStr)) {
            isLimited = true;
        }
    }

    if (isPrioritized) {
        style = 'background-color: #6EFF72; font-weight: bold;'; 
    } 
    // C. シミュレーションモードのルートハイライト
    else if (isSimulationMode && highlightMap.get(seedIndex) === id) {
        if (isLimited || rr.rarity === 'uber' || rr.rarity === 'legend') {
            style = 'background:#32CD32;';
        } else {
            style = 'background:#98FB98;';
        }
    } 
    // D. 限定キャラの状態色
    else if (isLimited) {
        style = 'background-color: #66FFFF;';
    } 
    // E. レアリティ色分け
    else {
        if (sv >= 9970) style = 'background-color: #DDA0DD;';
        else if (sv >= 9940) style = 'background-color: #de59de;';
        else if (sv >= 9500) style = 'background-color: #FF4C4C;';
        else if (sv >= 9070) style = 'background-color: #fda34e;';
        else if (sv >= 6970) style = 'background-color: #ffff33;';
    }

    // --- 2. クリックイベントの生成 ---
    const escapedName = charName.replace(/'/g, "\\'");
    let clickHandler = "";

    if (showSeedColumns) {
        // SEED表示モードON：算出過程をポップアップ表示
        clickHandler = `onclick="showRollProcessPopup(${seedIndex}, '${id}', ${colIndex})"`;
    } else if (isSimulationMode) {
        // SIMモード：探索エンジン
        clickHandler = `onclick="onGachaCellClick(${seedIndex}, '${id}', '${escapedName}')"`;
    } else {
        // 通常モード：SEEDジャンプ
            const nextSeedValue = seeds[seedIndex + rr.seedsConsumed - 1];
        if (nextSeedValue !== undefined) {
            clickHandler = `onclick="updateSeedAndRefresh(${nextSeedValue})"`;
        }
    }

    // --- 3. セル内コンテンツの構築 ---
    let content = "";
    if (rr.isRerolled) {
        const nextIdx = seedIndex + rr.seedsConsumed;
        let destAddr = (rr.isConsecutiveRerollTarget ? 'R' : '') + formatAddress(nextIdx);
        const oName = (rr.originalChar && rr.originalChar.name) ? rr.originalChar.name : "不明";

        if (showSeedColumns) {
            // SEED表示モード時は、リンク化せず単純なテキスト表示にする
            content = `${oName}<br>${destAddr}${charName}`;
        } else if (!isSimulationMode) {
            const originalJumpSeed = seeds[seedIndex + 2];
            let oHtml = `<span class="char-link" onclick="event.stopPropagation(); updateSeedAndRefresh(${originalJumpSeed})">${oName}</span>`;
            const finalJumpSeed = seeds[seedIndex + rr.seedsConsumed - 1];
            let fHtml = `<span class="char-link" onclick="event.stopPropagation(); updateSeedAndRefresh(${finalJumpSeed})">${destAddr}${charName}</span>`;
            content = `${oHtml}<br>${fHtml}`;
        } else {
            content = `${oName}<br>${destAddr}${charName}`;
        }
    } else {
        content = charName;
    }
    
    return `<td class="gacha-cell" style="${style} cursor:pointer;" ${clickHandler}>${content}</td>`;
}