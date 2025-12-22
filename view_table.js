/** @file view_table.js @description ガチャ結果テーブル全体の描画制御 */

const COLOR_ROUTE_HIGHLIGHT = '#aaddff';
const COLOR_ROUTE_UBER = '#66b2ff';

function generateRollsTable() {
    try {
        if (Object.keys(gachaMasterData.gachas).length === 0) return;
        const seedEl = document.getElementById('seed');
        if (!seedEl) return;
        
        let initialSeed = parseInt(seedEl.value, 10);
        if (isNaN(initialSeed)) { 
            initialSeed = 12345;
            seedEl.value = "12345"; 
        }
        
        const numRolls = currentRolls;
        const seeds = [];
        const rngForSeeds = new Xorshift32(initialSeed);
        for (let i = 0; i < numRolls * 15 + 100; i++) seeds.push(rngForSeeds.next());

        const columnConfigs = prepareColumnConfigs();
        const tableData = executeTableSimulation(numRolls, columnConfigs, seeds);

        // 3. ハイライト判定 (view_table_highlight.js に定義)
        const { highlightMap, guarHighlightMap, lastSeedValue } = preparePathHighlightMaps(initialSeed, seeds, numRolls);
        finalSeedForUpdate = lastSeedValue;

        let findAreaHtml = '';
        if (typeof generateFastForecast === 'function') findAreaHtml += generateFastForecast(initialSeed, columnConfigs);
        if (typeof generateMasterInfoHtml === 'function' && showFindInfo && isMasterInfoVisible) {
            findAreaHtml += `<div id="master-info-area" style="padding: 10px; background: #fdfdfd; border: 1px solid #ddd; border-top: none; margin-top: -16px; border-radius: 0 0 4px 4px; font-size: 0.85em;">`;
            findAreaHtml += `<div style="border-top: 1px dashed #ccc; margin-bottom: 10px;"></div>`; 
            findAreaHtml += generateMasterInfoHtml();
            findAreaHtml += `</div>`;
        }

        const container = document.getElementById('rolls-table-container');
        if (!container) return;

        if (isTxtMode && isSimulationMode) {
            // テキスト表示モード
            const txtViewHtml = generateTxtRouteView(seeds, initialSeed);
            container.innerHTML = findAreaHtml + txtViewHtml;
        } else {
            // 通常テーブル表示モード
            let simNoticeHtml = '';
            if (isSimulationMode) {
                simNoticeHtml = `<div id="sim-auto-calc-notice" style="font-size: 0.75em; color: #666; padding: 5px 10px; background: #fff;">
                    ※下の表のキャラ名をタップ（クリック）するとそのセルまでのルートを自動計算します。自動計算では、超激確定・プラチナ・レジェンドは消費を避けるため使用しません。
                </div>`;
            }
            const tableHtml = buildTableDOM(numRolls, columnConfigs, tableData, seeds, highlightMap, guarHighlightMap);
            container.innerHTML = findAreaHtml + simNoticeHtml + tableHtml;
        }

        const resultDiv = document.getElementById('result');
        if (resultDiv) resultDiv.textContent = isSimulationMode ? "Simulation active..." : "Display Mode";
        updateUrlParams();
    } catch (e) {
        const container = document.getElementById('rolls-table-container');
        if (container) container.innerHTML = `<p class="error">エラー: ${e.message}</p>`;
        console.error(e);
    }
}

/** 内部関数: テーブルDOMの組み立て */
function buildTableDOM(numRolls, columnConfigs, tableData, seeds, highlightMap, guarHighlightMap) {
    const buttonHtml = `
        <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 5px; font-weight: normal; white-space: normal;">
            <span style="font-weight: bold; margin-right: 2px;">A</span>
            <button class="add-gacha-btn" onclick="addGachaColumn()">＋列を追加</button>
            <button class="add-gacha-btn" style="background-color: #17a2b8;" onclick="addGachasFromSchedule()">skdで追加</button>
            <span id="add-id-trigger" style="cursor:pointer; text-decoration:underline; color:#007bff; font-size:0.9em; font-weight:bold;" onclick="showIdInput()">IDで追加</span>
            <button class="remove-btn" onclick="resetToFirstGacha()" title="一番左の列以外を解除" style="font-size:11px; padding:2px 6px; margin-left: 5px;">×</button>
        </div>`;
    
    let totalGachaCols = 0;
    tableGachaIds.forEach(idWithSuffix => {
        let id = idWithSuffix.replace(/[gfs]$/, '');
        if (gachaMasterData.gachas[id]) totalGachaCols += /[gfs]$/.test(idWithSuffix) ? 2 : 1;
    });

    const calcColClass = `calc-column ${showSeedColumns ? '' : 'hidden'}`;
    const calcColSpan = showSeedColumns ? 5 : 0;
    const totalTrackSpan = calcColSpan + totalGachaCols;

    // 変更箇所: A側とB側の colspan セルに width: 50% を指定して左右のバランスを固定
    let html = `<table style="table-layout: auto; width: 100%; border-collapse: collapse;"><thead>
        <tr>
            <th class="col-no"></th>
            <th colspan="${totalTrackSpan}" style="text-align: center; vertical-align: middle; padding: 5px; width: 50%;">${buttonHtml}</th>
            <th class="col-no"></th>
            <th colspan="${totalTrackSpan}" style="text-align: center; vertical-align: middle; padding: 5px; font-weight: bold; width: 50%;">B</th>
        </tr>
        <tr class="sticky-row">
            <th class="col-no">NO.</th><th class="${calcColClass}">SEED</th><th class="${calcColClass}">rarity</th><th class="${calcColClass}">slot</th><th class="${calcColClass}">ReRoll</th><th class="${calcColClass}">Guar</th>
            ${generateNameHeaderHTML()}
            <th class="col-no">NO.</th><th class="${calcColClass}">SEED</th><th class="${calcColClass}">rarity</th><th class="${calcColClass}">slot</th><th class="${calcColClass}">ReRoll</th><th class="${calcColClass}">Guar</th>
            ${generateNameHeaderHTML()}
        </tr>
        <tr class="control-row">
            <th class="col-no"></th><th class="${calcColClass}"></th><th class="${calcColClass}"></th><th class="${calcColClass}"></th><th class="${calcColClass}"></th><th class="${calcColClass}"></th>
            ${generateControlHeaderHTML(true)}
            <th class="col-no"></th><th class="${calcColClass}"></th><th class="${calcColClass}"></th><th class="${calcColClass}"></th><th class="${calcColClass}"></th><th class="${calcColClass}"></th>
            ${generateControlHeaderHTML(false)}
        </tr>
    </thead><tbody>`;

    for (let i = 0; i < numRolls; i++) {
        const seedIndexA = i * 2, seedIndexB = i * 2 + 1;
        html += `<tr>${renderTableRowSide(i, seedIndexA, columnConfigs, tableData, seeds, highlightMap, guarHighlightMap)}`;
        html += `${renderTableRowSide(i, seedIndexB, columnConfigs, tableData, seeds, highlightMap, guarHighlightMap)}</tr>`;
    }

    const fullColSpan = 2 + (totalTrackSpan * 2);
    html += `<tr><td colspan="${fullColSpan}" style="padding: 10px; text-align: center;">
        <button onclick="addMoreRolls()">+100行</button>
        <button id="toggle-seed-btn" class="secondary" onclick="toggleSeedColumns()">${showSeedColumns ? 'SEED非表示' : 'SEED表示'}</button>
    </td></tr></tbody></table>`;
    return html;
}

/** 内部関数: A側/B側それぞれの行レンダリング */
function renderTableRowSide(rowIndex, seedIndex, columnConfigs, tableData, seeds, highlightMap, guarHighlightMap) {
    let styleNo = '';
    if (RowAnalysis.isSimpleYellow(seedIndex, seeds) || RowAnalysis.isConsecutiveYellow(seedIndex, seeds)) styleNo = 'style="background-color: #ffeb3b;"';
    else if (RowAnalysis.isSimpleOrange(seedIndex, seeds) || RowAnalysis.isConsecutiveOrange(seedIndex, seeds)) styleNo = 'style="background-color: #ff9800;"';

    let sideHtml = `<td class="col-no" ${styleNo}>${rowIndex + 1}</td>`;
    sideHtml += generateDetailedCalcCells(seedIndex, seeds, tableData);

    tableGachaIds.forEach((idWithSuffix, colIndex) => {
        let id = idWithSuffix.replace(/[gfs]$/, '');
        let suffix = '';
        if (idWithSuffix.endsWith('f')) suffix = 'f';
        else if (idWithSuffix.endsWith('s')) suffix = 's';
        else if (idWithSuffix.endsWith('g')) suffix = 'g';
        const isG = (suffix !== '');

        if (!gachaMasterData.gachas[id]) return;

        let cellHtml = generateCell(seedIndex, id, colIndex, tableData, seeds, highlightMap, isSimulationMode);
        
        // 変更箇所: セル内改行を許可。幅は自動(ヘッダーの50%指定が優先される)
        cellHtml = cellHtml.replace('style="', 'style="white-space: normal; width: auto; word-break: break-all; vertical-align: middle; ');
        
        if (isSimulationMode) {
            cellHtml = cellHtml.replace(/background-color:\s*#98FB98;/gi, `background-color: ${COLOR_ROUTE_HIGHLIGHT};`);
            cellHtml = cellHtml.replace(/background-color:\s*#32CD32;/gi, `background-color: ${COLOR_ROUTE_UBER};`);
        }
        sideHtml += cellHtml;

        if (isG) {
            let gContent = '---';
            let cellStyle = 'white-space: normal; width: auto; word-break: break-all; vertical-align: middle; ';
            if (isSimulationMode && guarHighlightMap.get(seedIndex) === id) cellStyle += `background-color: ${COLOR_ROUTE_UBER};`;
            
            const config = columnConfigs[colIndex];
            const normalRolls = config._guaranteedNormalRolls || 10;
            let lastDraw = (rowIndex > 0 && tableData[seedIndex - 2]?.[colIndex]?.roll) ?
                { rarity: tableData[seedIndex - 2][colIndex].roll.rarity, charId: tableData[seedIndex - 2][colIndex].roll.charId } : null;
            
            const gRes = calculateGuaranteedLookahead(seedIndex, config, seeds, lastDraw, normalRolls);
            const addr = formatAddress(gRes.nextRollStartSeedIndex);
            let charName = gRes.name;
            let gType = (suffix === 'g') ? '11g' : (suffix === 'f' ? '15g' : '7g');
            const escapedName = charName.replace(/'/g, "\\'");

            let gClickAction = isSimulationMode ?
                `onclick="onGachaCellClick(${seedIndex}, '${id}', '${escapedName}', '${gType}')"` :
                (gRes.nextRollStartSeedIndex > 0 ? `onclick="updateSeedAndRefresh(${seeds[gRes.nextRollStartSeedIndex - 1]})"` : "");

            let mainHtml = `<span style="font-size:0.9em; color:#666;">${addr}</span><span class="char-link" style="cursor:pointer;" ${gClickAction}>${charName}</span>`;
            let altHtml = '';
            if (gRes.alternative) {
                const altAddr = formatAddress(gRes.alternative.nextRollStartSeedIndex);
                let altCharName = gRes.alternative.name;
                const escAlt = altCharName.replace(/'/g, "\\'");
                let altClickAction = isSimulationMode ?
                    `onclick="onGachaCellClick(${seedIndex}, '${id}', '${escAlt}', '${gType}')"` :
                    (gRes.alternative.nextRollStartSeedIndex > 0 ? `onclick="updateSeedAndRefresh(${seeds[gRes.alternative.nextRollStartSeedIndex - 1]})"` : "");
                altHtml = `<span style="font-size:0.9em; color:#666;">${altAddr}</span><span class="char-link" style="cursor:pointer;" ${altClickAction}>${altCharName}</span><br>`;
            }
            gContent = altHtml + mainHtml;
            sideHtml += `<td style="${cellStyle}">${gContent}</td>`;
        }
    });
    return sideHtml;
}

/** ルートに従ったテキスト表示を生成 */
function generateTxtRouteView(seeds, initialSeed) {
    const configInput = document.getElementById('sim-config');
    const configStr = configInput ? configInput.value.trim() : "";
    if (!configStr) return "<div style='padding:20px; color:#666;'>ルートが入力されていません。</div>";

    const configs = parseSimConfig(configStr);
    let currentIdx = 0;
    let lastDraw = null;
    let outputArr = [];

    let stats = { single: 0, plat: 0, leg: 0, guar: 0, legends: {}, limiteds: {}, ubers: {} };
    const limitedSet = new Set();
    if (typeof limitedCats !== 'undefined') {
        limitedCats.forEach(id => { limitedSet.add(id); limitedSet.add(String(id)); });
    }
    const addStat = (map, name) => { map[name] = (map[name] || 0) + 1; };

    configs.forEach(sim => {
        const originalGacha = gachaMasterData.gachas[sim.id];
        if (!originalGacha) return;

        const colIdx = tableGachaIds.findIndex(tid => tid.replace(/[gfs]$/, '') === sim.id);
        const addCount = (colIdx >= 0) ? (uberAdditionCounts[colIdx] || 0) : 0;

        let gacha = JSON.parse(JSON.stringify(originalGacha));
        if (addCount > 0 && gacha.pool.uber) {
            for (let k = 1; k <= addCount; k++) {
                gacha.pool.uber.unshift({ id: `sim-new-${k}`, name: `新規超激${k}`, rarity: 'uber' });
            }
        }

        let suffixText = "";
        let normalRolls = sim.rolls;
        let isG = false;
        const isPlat = gacha.name.includes("プラチナ");
        const isLeg = gacha.name.includes("レジェンド");

        if (sim.g) {
            isG = true; stats.guar++;
            if (sim.rolls === 11) { normalRolls = 10; suffixText = "11連確定"; }
            else if (sim.rolls === 15) { normalRolls = 14; suffixText = "15連確定"; }
            else if (sim.rolls === 7) { normalRolls = 6; suffixText = "7連確定"; }
            else { normalRolls = sim.rolls; suffixText = `${sim.rolls}連確定`; }
        } else {
            suffixText = `${sim.rolls}Roll`;
        }

        if (isPlat) stats.plat += normalRolls;
        else if (isLeg) stats.leg += normalRolls;
        else stats.single += normalRolls;

        const startAddr = typeof formatAddress === 'function' ? formatAddress(currentIdx).replace(')', '') : '';
        let segmentTxt = `[${gacha.name}]（${suffixText}/${startAddr}）<br>=> `;

        let charNames = [];
        for (let k = 0; k < normalRolls; k++) {
            if (currentIdx + 1 >= seeds.length) break;
            const rr = rollWithSeedConsumptionFixed(currentIdx, gacha, seeds, lastDraw);
            const charObj = rr.finalChar;
            charNames.push(charObj.name);
            if (rr.rarity === 'legend') addStat(stats.legends, charObj.name);
            else if (limitedSet.has(charObj.id)) addStat(stats.limiteds, charObj.name);
            else if (rr.rarity === 'uber') addStat(stats.ubers, charObj.name);
            currentIdx += rr.seedsConsumed;
            lastDraw = { rarity: rr.rarity, charId: rr.charId, isRerolled: rr.isRerolled };
        }

        if (isG && currentIdx < seeds.length) {
            const gr = rollGuaranteedUber(currentIdx, gacha, seeds);
            const charObj = gr.finalChar;
            charNames.push(charObj.name);
            if (limitedSet.has(charObj.id)) addStat(stats.limiteds, charObj.name);
            else if (gr.rarity === 'uber') addStat(stats.ubers, charObj.name);
            currentIdx += gr.seedsConsumed;
            lastDraw = { rarity: gr.rarity, charId: gr.charId, isRerolled: false };
        }
        segmentTxt += charNames.join(", ");
        outputArr.push(segmentTxt);
    });

    const formatStatMap = (map) => {
        const entries = Object.entries(map);
        if (entries.length === 0) return "";
        return entries.map(([name, count]) => count >= 2 ? `${name}（${count}）` : name).join("、");
    };

    let countsHtml = "";
    if (stats.single > 0) countsHtml += `レアチケ：${stats.single}回<br>`;
    if (stats.plat > 0) countsHtml += `プラチケ：${stats.plat}回<br>`;
    if (stats.leg > 0) countsHtml += `レジェチケ：${stats.leg}回<br>`;
    if (stats.guar > 0) countsHtml += `確定：${stats.guar}回<br>`;

    let acquisitionHtml = "";
    const legendStr = formatStatMap(stats.legends), limitedStr = formatStatMap(stats.limiteds), uberStr = formatStatMap(stats.ubers);
    if (legendStr) acquisitionHtml += `伝説：${legendStr}<br>`;
    if (limitedStr) acquisitionHtml += `限定：${limitedStr}<br>`;
    if (uberStr) acquisitionHtml += `超激：${uberStr}<br>`;

    let summaryHtml = `
<div style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #eee; font-family: monospace;">
【SEED】<br>実行前：${initialSeed}<br>最終：${finalSeedForUpdate || "---"}<br><br>
【回数】<br>${countsHtml}<br>
【取得】<br>${acquisitionHtml}
</div>`;

    return `<div id="txt-route-display" style="padding: 20px; background: #fff; line-height: 1.8; font-size: 14px; user-select: text; font-family: sans-serif;">
        ${summaryHtml}${outputArr.join("<br>")}<br></div>`;
}