/** @file view_cell_renderer.js @description 個別セルの描画とレアリティ色の制御（データ構造整合版） */

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
    
    // tableGachaIds[0] が存在しない場合の安全策
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
    const cell = tableData[seedIndex]?.[colIndex];
    // データ構造の不整合（Data Insufficiency）を防ぐため、存在チェックとパスを修正
    if (!cell || !cell.roll) return `<td>-</td>`;
    
    const r = cell.roll;
    // 実際のデータ構造に合わせて r.finalChar.name を参照
    const charName = (r.finalChar && r.finalChar.name) ? r.finalChar.name : "データ不足";
    
    let style = '';
    
    // ガチャ設定から名称を取得（プラチナ・レジェンド判定用）
    const gachaConfig = gachaMasterData.gachas[id];
    const isSpecialGacha = gachaConfig && (gachaConfig.name.includes("プラチナ") || gachaConfig.name.includes("レジェンド"));

    // レアリティおよびルートハイライトのスタイル適用
    if (isSimulationMode && highlightMap.get(seedIndex) === id) {
        // シミュレーションルート上のハイライト（緑系）
        style = (r.rarity === 'uber' || r.rarity === 'legend') ? 'background:#32CD32;' : 'background:#98FB98;';
    } else {
        // 通常のレアリティ背景色設定
        if (r.rarity === 'legend') {
            style = 'background:#ffcc00;'; // 伝説レア（オレンジ/黄）
        } else if (r.rarity === 'uber') {
            // プラチナガチャ・レジェンドガチャの場合は赤色（#FF4C4C）を適用しない
            if (!isSpecialGacha) {
                style = 'background:#FF4C4C;'; // 通常の超激レア（赤）
            }
        } else if (r.rarity === 'super') {
            style = 'background:#ffff33;'; // 激レア（黄）
        }
    }

    const escapedName = charName.replace(/'/g, "\\'");
    // Simモード時はルート計算、通常時はSEED更新のイベントを付与
    const clickHandler = `onclick="onGachaCellClick(${seedIndex}, '${id}', '${escapedName}')"`;
    
    let content = "";
    if (r.isRerolled) {
        // レア被り回避（ジャンプ）が発生している場合の表示
        const nextIdx = seedIndex + r.seedsConsumed;
        let destAddr = (r.isConsecutiveRerollTarget ? 'R' : '') + formatAddress(nextIdx);
        const oName = (r.originalChar && r.originalChar.name) ? r.originalChar.name : "不明";
        const fName = charName;
        
        if (!isSimulationMode) {
            // 通常モード時は中間SEEDへのクリック更新リンクを付与
            const s2 = seeds[seedIndex + 1];
            let oHtml = s2 ? `<span class="char-link" onclick="event.stopPropagation(); updateSeedAndRefresh(${s2})">${oName}</span>` : oName;
            let fHtml = `<span class="char-link">${destAddr}${fName}</span>`;
            content = `${oHtml}<br>${fHtml}`;
        } else {
            content = `${oName}<br>${destAddr}${fName}`;
        }
    } else {
        // 通常時のキャラ名表示
        content = charName;
    }
    
    return `<td class="gacha-cell" style="${style} cursor:pointer;" ${clickHandler}>${content}</td>`;
}