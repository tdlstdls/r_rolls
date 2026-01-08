/** @file view_table_renderer.js @description 行・セルの描画処理（G列アドレス書式修正版） */

/**
 * 行レンダリング (A/Bサイド別)
 * 特定のトラック（AまたはB）の1行分（NO、SEED情報、各ガチャ列）のHTMLを生成します。
 */
function renderTableRowSide(rowIndex, seedIndex, columnConfigs, tableData, seeds, highlightMap, guarHighlightMap, isLeftSide) {
    // NO.（行番号）セルの生成。左サイドの場合は固定列（Sticky）のスタイルを適用
    let sideHtml = `<td class="col-no" style="background: #f8f9fa; ${isLeftSide ? 'position: sticky; left: 0; z-index: 5; border-right: 1px solid #ddd;' : ''}">${rowIndex + 1}</td>`;
    
    // 詳細計算（SEED値、レアリティ判定等）セルの生成 (view_cell_renderer.jsに依存)
    if (typeof generateDetailedCalcCells === 'function') {
        sideHtml += generateDetailedCalcCells(seedIndex, seeds, tableData);
    } else {
        const calcColClass = `calc-column ${showSeedColumns ? '' : 'hidden'}`;
        sideHtml += `<td class="${calcColClass}">-</td>`.repeat(5);
    }
    
    // 各ガチャ列のセルを順番に生成
    tableGachaIds.forEach((idWithSuffix, colIndex) => {
        const id = idWithSuffix.replace(/[gfs]$/, '');
        const suffix = idWithSuffix.match(/[gfs]$/)?.[0] || '';
        
        // tableData から現在の行・列のデータを取得
        const data = tableData[seedIndex] ? tableData[seedIndex][colIndex] : null;

        // 通常ロールセルの生成 (view_cell_renderer.jsに依存)
        if (typeof generateCell === 'function') {
            sideHtml += generateCell(seedIndex, id, colIndex, tableData, seeds, highlightMap, isSimulationMode);
        } else {
            sideHtml += `<td>-</td>`;
        }

        // 確定枠（G列）が設定されている場合、確定枠セルを生成
        if (suffix) {
            // データが存在し、かつ確定枠の情報を持っているかチェック
            if (data && (data.guaranteed || (data.result && data.result.guaranteed))) {
                sideHtml += renderGuaranteedCell(seedIndex, id, suffix, data, seeds, colIndex, guarHighlightMap);
            } else {
                // 確定データが生成されていない場合のフォールバック表示
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
    
    // シミュレーションルート上の確定枠（G）セルのハイライト判定
    if (isSimulationMode && guarHighlightMap.get(seedIndex) === id) {
        cellStyle += `background-color: ${COLOR_ROUTE_UBER || '#66b2ff'};`;
    } else {
        cellStyle += `background-color: #eef7ff;`;
    }

    // 確定データの抽出 (通常のシミュレーション結果、または logic_sequential の戻り値に対応)
    const gMain = data.guaranteed || (data.result ? data.result.guaranteed : null);
    const gAlt = data.alternativeGuaranteed || (data.result ? data.result.alternativeGuaranteed : null);
    
    let gContent = '<div style="padding: 4px;">---</div>';

    if (gMain && (gMain.name || (gMain.finalChar && gMain.finalChar.name))) {
        /**
         * 確定枠内での表示用HTML構築
         */
        const buildGHtml = (res, isAltRoute) => {
            if (!res) return "";
            const addr = formatTableAddress(res.nextRollStartSeedIndex);
            
            // レア被り警告表示
            const verifiedStyle = (!res.isVerified && showSeedColumns && !isAltRoute) ? "border-left: 3px solid #ff4444;" : "";
            const gType = (suffix === 'g') ? '11g' : (suffix === 'f' ? '15g' : '7g');
            
            // 安全対策：キャラクター名が未定義の場合に備える
            const charName = res.name || (res.finalChar ? res.finalChar.name : "データ不足");
            const escapedName = charName.replace(/'/g, "\\'");
            
            // クリックイベントの設定
            let clickAction = isSimulationMode ?
                `onclick="if(!event.ctrlKey) onGachaCellClick(${seedIndex}, '${id}', '${escapedName}', '${gType}')"` :
                (res.nextRollStartSeedIndex >= 0 ? `onclick="if(!event.ctrlKey) updateSeedAndRefresh(${seeds[res.nextRollStartSeedIndex - 1]})"` : "");
            
            // 長押しデバッグ用の属性 (view_table_debug.jsに依存)
            const debugAttrs = showSeedColumns ? 
                `onpointerdown="window.start11GTimer(${seedIndex}, ${colIndex}, ${isAltRoute})" onpointerup="window.clear11GTimer()" onpointerleave="window.clear11GTimer()"` : "";
            
            // アドレス(addr)とキャラクター名の間に ) を挿入
            return `<div ${clickAction} ${debugAttrs} style="cursor:pointer; padding:4px; ${verifiedStyle} ${isAltRoute ? 'border-bottom:1px dashed #ccc;' : ''}">${addr})<span class="char-link" style="font-weight:bold; color:#0056b3;">${charName}</span></div>`;
        };

        // 回避ルートがある場合は両方、ない場合は通常ルートのみ表示
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
    // ) は buildGHtml 側で結合時に追加するため、ここではベースのアドレス文字列のみを返す
    return `${track}${row}`;
}