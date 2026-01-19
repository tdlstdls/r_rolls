/** @file view_cell_renderer.js @description 個別セルの描画とレアリティ色の制御（昇格枠追加・インデックス同期版） */

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
 * SEED値やレアリティ判定などの詳細セル群（左側の5列）を生成する
 */
function generateDetailedCalcCells(seedIndex, seeds, tableData) {
    const calcColClass = `calc-column ${showSeedColumns ? '' : 'hidden'}`;
    if (!showSeedColumns) return `<td class="${calcColClass}"></td>`.repeat(5);
    
    // 最初の列のガチャ設定を取得してレート計算の基準にする
    const firstGachaIdWithSuffix = tableGachaIds[0] || "";
    const firstGachaId = firstGachaIdWithSuffix.replace(/[gfs]$/, '');
    const config = gachaMasterData.gachas[firstGachaId];
    
    if (!config || seedIndex + 1 >= seeds.length) return `<td class="${calcColClass}">-</td>`.repeat(5);
    
    const s0 = seeds[seedIndex];
    const rVal = s0 % 10000;
    const rates = config.rarity_rates || { rare: 6970, super: 2500, uber: 500, legend: 30 };
    
    let rType = (rVal < rates.rare) ? 'rare' : 
                (rVal < rates.rare + rates.super) ? 'super' : 
                (rVal < rates.rare + rates.super + rates.uber) ? 'uber' : 
                (rVal < rates.rare + rates.super + rates.uber + rates.legend) ? 'legend' : 'rare';
                
    return `
        <td class="${calcColClass}">${s0}</td>
        <td class="${calcColClass}">${rType}</td>
        <td class="${calcColClass}">${rVal}</td>
        <td class="${calcColClass}">-</td>
        <td class="${calcColClass}">-</td>
    `;
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

    // A. ユーザーが「Find」で優先指定したキャラ（最優先：緑）
    const isPrioritized = userPrioritizedTargets.includes(charId) || userPrioritizedTargets.includes(charIdStr);
    
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
            style = 'background:#32CD32;'; // 濃い緑（重要なキャラ）
        } else {
            style = 'background:#98FB98;'; // 薄い緑（ルート上）
        }
    } 
    // D. 個別キャラの状態色
    else if (isLimited) {
        style = 'background-color: #66FFFF;'; // 限定キャラ：水色
    } 
    // E. SEEDの下4桁（sv）によるレアリティ閾値の色分け
    else {
        if (sv >= 9970) style = 'background-color: #DDA0DD;';      // 伝説レア枠
        else if (sv >= 9940) style = 'background-color: #de59de;'; // 伝説への昇格枠
        else if (sv >= 9500) style = 'background-color: #FF4C4C;'; // 超激レア枠
        else if (sv >= 9070) style = 'background-color: #fda34e;'; // 【追加】超ネコ/極ネコ用昇格枠
        else if (sv >= 6970) style = 'background-color: #ffff33;'; // 激レア枠
    }

    // --- 2. クリックイベントの生成 ---
    const escapedName = charName.replace(/'/g, "\\'");
    let clickHandler = "";

    if (isSimulationMode) {
        // SIMモード：探索エンジンを呼び出し、ターゲットまでのルートを計算
        clickHandler = `onclick="onGachaCellClick(${seedIndex}, '${id}', '${escapedName}')"`;
    } else {
        // 通常モード：このキャラを引いた直後のSEEDインデックスへジャンプ
        // 線形性を保つため、現在の index + seedsConsumed の位置にあるSEED値を渡す
        const nextSeedValue = seeds[seedIndex + rr.seedsConsumed];
        if (nextSeedValue !== undefined) {
            clickHandler = `onclick="updateSeedAndRefresh(${nextSeedValue})"`;
        }
    }

    // --- 3. セル内コンテンツの構築 ---
    let content = "";
    if (rr.isRerolled) {
        // レア被り回避（再抽選）が発生している場合
        const nextIdx = seedIndex + rr.seedsConsumed;
        let destAddr = (rr.isConsecutiveRerollTarget ? 'R' : '') + formatAddress(nextIdx);
        const oName = (rr.originalChar && rr.originalChar.name) ? rr.originalChar.name : "不明";

        if (!isSimulationMode) {
            // 被り元のキャラ（1回分消費した時点のSEED）
            const originalJumpSeed = seeds[seedIndex + 2];
            let oHtml = `<span class="char-link" onclick="event.stopPropagation(); updateSeedAndRefresh(${originalJumpSeed})">${oName}</span>`;
            // 最終結果（全工程消費した後のSEED）
            const finalJumpSeed = seeds[seedIndex + rr.seedsConsumed];
            let fHtml = `<span class="char-link" onclick="event.stopPropagation(); updateSeedAndRefresh(${finalJumpSeed})">${destAddr}${charName}</span>`;
            content = `${oHtml}<br>${fHtml}`;
        } else {
            content = `${oName}<br>${destAddr}${charName}`;
        }
    } else {
        // 通常の排出
        content = charName;
    }
    
    return `<td class="gacha-cell" style="${style} cursor:pointer;" ${clickHandler}>${content}</td>`;
}