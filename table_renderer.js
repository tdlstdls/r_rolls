/**
 * table_renderer.js
 * ガチャ結果テーブルのHTML生成と描画ロジック
 */

function generateRollsTable() {
    try {
        if (Object.keys(gachaMasterData.gachas).length === 0) return;
        const seedEl = document.getElementById('seed');
        if(!seedEl) return;
        
        let initialSeed = parseInt(seedEl.value, 10);
        if (isNaN(initialSeed)) {
             initialSeed = 12345;
             seedEl.value = "12345";
        }
        const numRolls = currentRolls; // global変数参照

        if (typeof Xorshift32 === 'undefined' || typeof rollWithSeedConsumptionFixed === 'undefined') {
            document.getElementById('rolls-table-container').innerHTML = 
                '<p class="error">logic.js が読み込まれていません。</p>';
            return;
        }

        const seeds = [];
        const rngForSeeds = new Xorshift32(initialSeed);
        // 少し多めに生成
        for (let i = 0; i < numRolls * 15 + 100; i++) seeds.push(rngForSeeds.next());

        // ID抽出（suffix除去）
        const uniqueGachaIds = [...new Set(tableGachaIds.map(idStr => {
            let id = idStr;
            if (idStr.endsWith('f')) id = idStr.slice(0, -1);
            else if (idStr.endsWith('s')) id = idStr.slice(0, -1);
            else if (idStr.endsWith('g')) id = idStr.slice(0, -1);
            return id;
        }))];
        
        // データの計算 (表示用ロジック)
        const tableData = Array(numRolls * 2).fill(null).map(() => []);
        
        // 列ごとの設定を生成
        const columnConfigs = tableGachaIds.map((idWithSuffix, colIndex) => {
            let id = idWithSuffix;
            let suffix = '';
            if (idWithSuffix.endsWith('f')) { suffix = 'f'; id = idWithSuffix.slice(0, -1); }
            else if (idWithSuffix.endsWith('s')) { suffix = 's'; id = idWithSuffix.slice(0, -1); }
            else if (idWithSuffix.endsWith('g')) { suffix = 'g'; id = idWithSuffix.slice(0, -1); }

            let guaranteedNormalRolls = 0;
            if (suffix === 'g') guaranteedNormalRolls = 10;
            else if (suffix === 'f') guaranteedNormalRolls = 14;
            else if (suffix === 's') guaranteedNormalRolls = 6;

            const originalConfig = gachaMasterData.gachas[id];
            if(!originalConfig) return null;

            // コピー作成
            const config = { ...originalConfig };
            config.pool = { ...originalConfig.pool };
            if (config.pool.uber) {
                config.pool.uber = [...config.pool.uber];
            }
            
            config._guaranteedNormalRolls = guaranteedNormalRolls;

            // 超激レア追加ロジック
            const addCount = uberAdditionCounts[colIndex] || 0;
            if (addCount > 0) {
                for (let k = 1; k <= addCount; k++) {
                    config.pool.uber.unshift({
                        id: `sim-new-${k}`,
                        name: `新規超激${k}`,
                        rarity: 'uber'
                    });
                }
            }
            return config;
        });

        // 計算実行 (Column Base)
        columnConfigs.forEach((config, colIndex) => {
            if (!config) return;
            let prevDrawA = null, prevDrawB = null;
            for (let i = 0; i < numRolls; i++) {
                const seedIndexA = i * 2, seedIndexB = i * 2 + 1;
                
                const rollResultA = rollWithSeedConsumptionFixed(seedIndexA, config, seeds, prevDrawA);
                const isConsecutiveA = prevDrawA && prevDrawA.isRerolled && rollResultA.isRerolled;
                
                if (!tableData[seedIndexA]) tableData[seedIndexA] = [];
                tableData[seedIndexA][colIndex] = { gachaId: config.id, roll: rollResultA, isConsecutive: isConsecutiveA };
                
                prevDrawA = { rarity: rollResultA.rarity, charId: rollResultA.charId, isRerolled: rollResultA.isRerolled };
                
                if (seedIndexB < seeds.length - 2) {
                    const rollResultB = rollWithSeedConsumptionFixed(seedIndexB, config, seeds, prevDrawB);
                    const isConsecutiveB = prevDrawB && prevDrawB.isRerolled && rollResultB.isRerolled;
                    
                    if (!tableData[seedIndexB]) tableData[seedIndexB] = [];
                    tableData[seedIndexB][colIndex] = { gachaId: config.id, roll: rollResultB, isConsecutive: isConsecutiveB };
                    
                    prevDrawB = { rarity: rollResultB.rarity, charId: rollResultB.charId, isRerolled: rollResultB.isRerolled };
                }
            }
        });

        // シミュレーションモードのハイライト計算
        const highlightMap = new Map();
        const guarHighlightMap = new Map(); // 確定ガチャ開始行のハイライト用
        
        if (isSimulationMode) { 
            const simConfigEl = document.getElementById('sim-config');
            if(simConfigEl && typeof parseSimConfig !== 'undefined') {
                const simConfigs = parseSimConfig(simConfigEl.value.trim());
                let rngForText = new Xorshift32(initialSeed);
                let currentSeedIndex = 0;
                let lastDrawForHighlight = { rarity: null, charId: null };

                for (const sim of simConfigs) {
                    if (gachaMasterData.gachas[sim.id]) sim.gachaConfig = gachaMasterData.gachas[sim.id];
                    if (!sim.gachaConfig) continue;

                    let normalRolls = sim.rolls; 
                    let isGuaranteedStep = false;
                    
                    if (sim.g) {
                        if (sim.rolls === 15) { normalRolls = 14; isGuaranteedStep = true; }
                        else if (sim.rolls === 7) { normalRolls = 6; isGuaranteedStep = true; }
                        else if (sim.rolls === 11) { normalRolls = 10; isGuaranteedStep = true; }
                        else { normalRolls = sim.rolls; }
                    }

                    if (isGuaranteedStep) {
                        const startSeedIndex = currentSeedIndex;
                        guarHighlightMap.set(startSeedIndex, sim.id);

                        for(let k=0; k<normalRolls; k++){
                             if(currentSeedIndex >= numRolls*2) break;
                             highlightMap.set(currentSeedIndex, sim.id);
                             const rr = rollWithSeedConsumptionFixed(currentSeedIndex, sim.gachaConfig, seeds, lastDrawForHighlight);
                             if(rr.seedsConsumed===0) break;
                             lastDrawForHighlight = {rarity: rr.rarity, charId: rr.charId};
                             currentSeedIndex += rr.seedsConsumed;
                             for(let x=0; x<rr.seedsConsumed; x++) rngForText.next();
                        }
                        if(startSeedIndex < numRolls*2) highlightMap.set(`${startSeedIndex}G`, sim.id);
                        if(currentSeedIndex < seeds.length && typeof rollGuaranteedUber !== 'undefined') {
                            const gr = rollGuaranteedUber(currentSeedIndex, sim.gachaConfig, seeds);
                            currentSeedIndex += gr.seedsConsumed;
                            for(let x=0; x<gr.seedsConsumed; x++) rngForText.next();
                        }
                    } else {
                        for(let k=0; k<normalRolls; k++){
                            if(currentSeedIndex >= numRolls*2) break;
                            highlightMap.set(currentSeedIndex, sim.id);
                            const rr = rollWithSeedConsumptionFixed(currentSeedIndex, sim.gachaConfig, seeds, lastDrawForHighlight);
                            if(rr.seedsConsumed===0) break;
                            lastDrawForHighlight = {rarity: rr.rarity, charId: rr.charId};
                            currentSeedIndex += rr.seedsConsumed;
                            for(let x=0; x<rr.seedsConsumed; x++) rngForText.next();
                        }
                    }
                }
                finalSeedForUpdate = rngForText.seed; 
            }
        }
        
        const buttonHtml = `<button class="add-gacha-btn" onclick="addGachaColumn()">＋列を追加</button>`;
        let totalGachaCols = 0;
        tableGachaIds.forEach(idWithSuffix => {
            const hasSuffix = /[gfs]$/.test(idWithSuffix);
            let id = idWithSuffix;
            if (idWithSuffix.endsWith('f')) id = idWithSuffix.slice(0, -1);
            else if (idWithSuffix.endsWith('s')) id = idWithSuffix.slice(0, -1);
            else if (idWithSuffix.endsWith('g')) id = idWithSuffix.slice(0, -1);

            if (gachaMasterData.gachas[id]) totalGachaCols += hasSuffix ? 2 : 1;
        });
        
        const calcColClass = `calc-column ${showSeedColumns ? '' : 'hidden'}`;
        const calcColSpan = showSeedColumns ? 5 : 0;
        const totalTrackSpan = calcColSpan + totalGachaCols;

        // ヘッダー生成関数
        let tableHtml = `<table><thead>
            <tr><th rowspan="2" class="col-no">NO.</th><th colspan="${totalTrackSpan}">A ${buttonHtml}</th>
            <th rowspan="2" class="col-no">NO.</th><th colspan="${totalTrackSpan}">B</th></tr><tr>`;
        
        const generateHeader = (isInteractive) => {
            let html = `
                <th class="${calcColClass}">SEED</th>
                <th class="${calcColClass}">rarity</th>
                <th class="${calcColClass}">slot</th>
                <th class="${calcColClass}">ReRoll</th>
                <th class="${calcColClass}">Guar</th>
            `;
            tableGachaIds.forEach((idWithSuffix, index) => {
                let id = idWithSuffix;
                let suffix = '';
                if (idWithSuffix.endsWith('f')) { suffix = 'f'; id = idWithSuffix.slice(0, -1); }
                else if (idWithSuffix.endsWith('s')) { suffix = 's'; id = idWithSuffix.slice(0, -1); }
                else if (idWithSuffix.endsWith('g')) { suffix = 'g'; id = idWithSuffix.slice(0, -1); }

                const isGuaranteed = (suffix !== '');

                const gachaConfig = gachaMasterData.gachas[id];
                if (!gachaConfig) return;
                
                // ガチャ名の生成 (期間情報などを含むラベルを取得)
                let selectedLabel = `${id} ${gachaConfig.name}`;
                // B列(isInteractive=false)でも詳細情報(期間)を表示するためにOptionsを検索
                const options = getGachaSelectorOptions(id);
                const foundOption = options.find(o => o.value == id);
                if (foundOption) {
                    selectedLabel = foundOption.label;
                }

                let displayHTML = "";
                const firstSpaceIdx = selectedLabel.indexOf(' ');
                if (firstSpaceIdx !== -1) {
                    const part1 = selectedLabel.substring(0, firstSpaceIdx);
                    const part2 = selectedLabel.substring(firstSpaceIdx + 1);
                    displayHTML = `<span style="font-size:0.85em; color:#333;">${part1}</span><br><span style="font-weight:bold; font-size:0.95em;">${part2}</span>`;
                } else {
                    displayHTML = selectedLabel;
                }

                // 操作エリアまたは情報表示エリアの生成
                let selectorArea = '';
                let controlArea = '';

                if (isInteractive) {
                    // --- A列: ボタンやプルダウンを表示 ---
                    const removeBtn = `<button class="remove-btn" onclick="removeGachaColumn(${index})">x</button>`;
                    let gBtnLabel = 'G';
                    if (suffix === 'g') gBtnLabel = '11G';
                    else if (suffix === 'f') gBtnLabel = '15G';
                    else if (suffix === 's') gBtnLabel = '7G';
                    
                    const gBtn = `<button onclick="toggleGuaranteedColumn(${index})" style="min-width:25px;">${gBtnLabel}</button>`;
                    
                    const currentAddVal = uberAdditionCounts[index] || 0;
                    let addSelect = `<select class="uber-add-select" onchange="updateUberAddition(this, ${index})" style="width: 40px; margin: 0 2px; padding: 0; font-size: 0.85em;">`;
                    for(let k=0; k<=19; k++){
                        addSelect += `<option value="${k}" ${k===currentAddVal ? 'selected':''}>${k}</option>`;
                    }
                    addSelect += `</select>`;

                    // プルダウン生成
                    let selector = `<select onchange="updateGachaSelection(this, ${index})" style="width: 30px; cursor: pointer; opacity: 0; position: absolute; left:0; top:0; height: 100%; width: 100%;">`;
                    options.forEach(opt => {
                        const selected = (opt.value == id) ? 'selected' : '';
                        selector += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
                    });
                    selector += '</select>';
                    
                    const fakeSelectBtn = `<div style="width:20px; height:20px; background:#ddd; border:1px solid #999; display:flex; align-items:center; justify-content:center; border-radius:3px;">▼</div>`;

                    selectorArea = `
                        <div style="position: relative; width: 24px; height: 24px;">
                            ${fakeSelectBtn}
                            ${selector}
                        </div>`;
                    
                    controlArea = `
                        <div style="margin-top:4px; display:flex; justify-content:center; align-items:center; gap:3px;">
                            ${gBtn}
                            <span style="font-size:0.8em; color:#555;">add:</span>
                            ${addSelect}
                            ${removeBtn}
                        </div>`;
                } else {
                    // --- B列: テキスト情報のみ表示 ---
                    
                    // セレクターの場所は空けておく
                    selectorArea = `<div style="width: 24px; height: 24px;"></div>`;

                    // 設定情報のテキスト化
                    let statusTextParts = [];
                    
                    // 1. 確定設定
                    if (suffix === 'g') statusTextParts.push('11G');
                    else if (suffix === 'f') statusTextParts.push('15G');
                    else if (suffix === 's') statusTextParts.push('7G');
                    
                    // 2. Add設定
                    const currentAddVal = uberAdditionCounts[index] || 0;
                    if (currentAddVal > 0) {
                        statusTextParts.push(`add:${currentAddVal}`);
                    }

                    if (statusTextParts.length > 0) {
                        controlArea = `
                            <div style="margin-top:4px; font-size:0.85em; color:#555; height: 21px; display: flex; align-items: center; justify-content: center;">
                                ${statusTextParts.join(' / ')}
                            </div>`;
                    } else {
                         // 高さを揃えるための空要素
                         controlArea = `<div style="margin-top:4px; height: 21px;"></div>`;
                    }
                }
                
                const cls = isGuaranteed ? '' : 'class="gacha-column"';

                html += `
                <th ${cls} ${isGuaranteed?'colspan="2"':''}>
                    <div class="gacha-header-wrapper" style="display: flex; align-items: center; justify-content: center; gap: 6px; position: relative;">
                        ${selectorArea}
                        <div style="text-align: left; line-height: 1.25;">
                            ${displayHTML}
                        </div>
                    </div>
                    ${controlArea}
                </th>`;
            });
            return html;
        };
        // A列はインタラクティブ、B列は非インタラクティブ
        tableHtml += generateHeader(true) + generateHeader(false) + `</tr></thead><tbody>`;

        const formatAddress = (idx) => {
            if (idx === null || idx === undefined) return '';
            const row = Math.floor(idx / 2) + 1;
            const side = (idx % 2 === 0) ? 'A' : 'B';
            return `${side}${row})`;
        };

        const generateDetailedCalcCells = (seedIndex) => {
            if (!showSeedColumns) return `<td class="${calcColClass}"></td>`.repeat(5);

            const firstGachaIdWithSuffix = tableGachaIds[0];
            if (!firstGachaIdWithSuffix) return `<td class="${calcColClass}">N/A</td>`.repeat(5);
            
            let firstId = firstGachaIdWithSuffix;
            if (firstGachaIdWithSuffix.endsWith('f')) firstId = firstGachaIdWithSuffix.slice(0, -1);
            else if (firstGachaIdWithSuffix.endsWith('s')) firstId = firstGachaIdWithSuffix.slice(0, -1);
            else if (firstGachaIdWithSuffix.endsWith('g')) firstId = firstGachaIdWithSuffix.slice(0, -1);

            const originalConfig = gachaMasterData.gachas[firstId];
            if(!originalConfig) return `<td class="${calcColClass}">N/A</td>`.repeat(5);

            const config = { ...originalConfig };
            config.pool = { ...originalConfig.pool };
            if (config.pool.uber) {
                config.pool.uber = [...config.pool.uber];
                const addCount = uberAdditionCounts[0] || 0;
                if (addCount > 0) {
                    for (let k = 1; k <= addCount; k++) {
                        config.pool.uber.unshift({ id: `sim-new-${k}`, name: `新規超激${k}`, rarity: 'uber' });
                    }
                }
            }

            if (seedIndex + 10 >= seeds.length) return `<td class="${calcColClass}">End</td>`.repeat(5);

            const sNum1 = seedIndex + 1;
            const sNum2 = seedIndex + 2;
            const sNum3 = seedIndex + 3;

            const sVal_0 = seeds[seedIndex];
            const sVal_1 = seeds[seedIndex+1];
            const sVal_2 = seeds[seedIndex+2];

            const colSeed = `<td>(S${sNum1})<br>${sVal_0}</td>`;

            const rVal = sVal_0 % 10000;
            const rates = config.rarity_rates || {};
            const rareRate = rates.rare || 0, superRate = rates.super || 0, uberRate = rates.uber || 0, legendRate = rates.legend || 0;
            let rType = 'rare';
            if (rVal < rareRate) { rType = 'rare'; } 
            else if (rVal < rareRate + superRate) { rType = 'super'; } 
            else if (rVal < rareRate + superRate + uberRate) { rType = 'uber'; } 
            else if (rVal < rareRate + superRate + uberRate + legendRate) { rType = 'legend'; } 
            
            const colRarity = `<td>(S${sNum1})<br>${rVal}<br>(${rType})</td>`;

            const pool = config.pool[rType] || [];
            let colSlot = '<td>-</td>';
            let slotVal = '-';
            if (pool.length > 0) {
                slotVal = sVal_1 % pool.length;
                colSlot = `<td>(S${sNum2})<br>%${pool.length}<br>${slotVal}</td>`;
            }

            let isDupe = false;
            if (tableData[seedIndex] && tableData[seedIndex][0]) {
                 isDupe = tableData[seedIndex][0].roll.isRerolled;
            }

            let colReRoll = '<td>-</td>';
            if (pool.length > 0) {
                 const poolLen2 = pool.length > 1 ? pool.length - 1 : 1;
                 
                 if (isDupe) {
                     const reRollVal = sVal_2 % poolLen2;
                     colReRoll = `<td>(S${sNum3}%${poolLen2})<br>${isDupe}<br>${reRollVal}</td>`;
                 } else {
                     colReRoll = `<td>(S${sNum2})<br>${isDupe}<br>${slotVal}</td>`;
                 }
            }

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
        };

        const generateCell = (seedIndex, id, colIndex) => {
            if(!tableData[seedIndex] || !tableData[seedIndex][colIndex]) {
                return `<td class="gacha-cell gacha-column">N/A</td>`;
            }
            const fullRoll = tableData[seedIndex][colIndex].roll;
            if(!fullRoll) return `<td>N/A</td>`;
            
            const gachaConfig = gachaMasterData.gachas[id];
            const gachaName = gachaConfig ? gachaConfig.name : "";
            const isPlatOrLegend = gachaName.includes("プラチナ") || gachaName.includes("レジェンド");
            
            let isLimited = false;
            if (typeof limitedCats !== 'undefined' && Array.isArray(limitedCats)) {
                if (limitedCats.includes(parseInt(fullRoll.finalChar.id)) || limitedCats.includes(fullRoll.finalChar.id.toString())) {
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
                if (isLimited || fullRoll.rarity === 'uber' || fullRoll.rarity === 'legend') {
                    style = 'background-color: #32CD32;'; 
                } else {
                    style = 'background-color: #98FB98;'; 
                }
            } else {
                if (isLimited) {
                    style = 'background-color: #66FFFF;'; 
                } else if (isPlatOrLegend) {
                    style = '';
                } else {
                    if (!hlClass) {
                        const sv = seeds[seedIndex] % 10000;
                        if(sv >= 9970) style = 'background-color: #DDA0DD;';
                        else if(sv >= 9500) style = 'background-color: #FF4C4C;';
                        else if(sv >= 9070) style = 'background-color: #FFB6C1;';
                        else if(sv >= 6970) style = 'background-color: #FFDAB9;';
                        else if(sv >= 6470) style = 'background-color: #FFFFE0;';
                    }
                }
            }

            let content = fullRoll.finalChar.name;
            
            if (!isSimulationMode) {
                if (fullRoll.isRerolled) {
                    const s2Val = (seedIndex + 1 < seeds.length) ? seeds[seedIndex + 1] : null;
                    const s3Val = (seedIndex + 2 < seeds.length) ? seeds[seedIndex + 2] : null;

                    const originalName = fullRoll.originalChar.name;
                    const finalName = fullRoll.finalChar.name;

                    let originalHtml = originalName;
                    if (s2Val !== null) {
                        originalHtml = `<span class="char-link" style="cursor:pointer;" onclick="updateSeedAndRefresh(${s2Val})">${originalName}</span>`;
                    }
                    
                    let finalHtml = finalName;
                    if (s3Val !== null) {
                        finalHtml = `<span class="char-link" style="cursor:pointer;" onclick="updateSeedAndRefresh(${s3Val})">${finalName}</span>`;
                    }

                    const nextSeedIdx = seedIndex + fullRoll.seedsConsumed;
                    const addr = formatAddress(nextSeedIdx);
                    
                    content = `${originalHtml}<br><span style="font-size:0.9em; color:#666;">${addr}</span>${finalHtml}`;

                } else {
                    const slotSeedVal = (seedIndex + 1 < seeds.length) ? seeds[seedIndex + 1] : null;
                    if(slotSeedVal !== null) {
                        content = `<span class="char-link" style="cursor:pointer;" onclick="updateSeedAndRefresh(${slotSeedVal})">${content}</span>`;
                    }
                }
            } else {
                if (fullRoll.isRerolled) {
                    const nextSeedIdx = seedIndex + fullRoll.seedsConsumed;
                    const addr = formatAddress(nextSeedIdx);
                    content = `${fullRoll.originalChar.name}<br><span style="font-size:0.9em; color:#666;">${addr}</span>${fullRoll.finalChar.name}`;
                }
            }

            return `<td class="gacha-cell gacha-column${hlClass}" style="${style}">${content}</td>`;
        };

        for(let i=0; i<numRolls; i++){
            const seedIndexA = i*2, seedIndexB = i*2+1;
            let rowHtml = `<tr><td class="col-no">${i+1}</td>`;
            
            rowHtml += generateDetailedCalcCells(seedIndexA);

            tableGachaIds.forEach((idWithSuffix, colIndex) => {
                let id = idWithSuffix;
                let suffix = '';
                if (idWithSuffix.endsWith('f')) { suffix = 'f'; id = idWithSuffix.slice(0, -1); }
                else if (idWithSuffix.endsWith('s')) { suffix = 's'; id = idWithSuffix.slice(0, -1); }
                else if (idWithSuffix.endsWith('g')) { suffix = 'g'; id = idWithSuffix.slice(0, -1); }
                
                const isG = (suffix !== '');

                if(!gachaMasterData.gachas[id]) return;
                rowHtml += generateCell(seedIndexA, id, colIndex);
                if(isG) {
                    let gContent = '---';
                    let cellStyle = '';

                    if (isSimulationMode && guarHighlightMap.get(seedIndexA) === id) {
                        cellStyle = 'background-color: #98FB98;'; 
                    }

                    if (typeof calculateGuaranteedLookahead !== 'undefined') {
                         const config = columnConfigs[colIndex];
                         const normalRolls = config._guaranteedNormalRolls || 10;

                         let lastDraw = (i>0 && tableData[seedIndexA-2]?.[colIndex]?.roll) ? 
                                       {rarity: tableData[seedIndexA-2][colIndex].roll.rarity, charId: tableData[seedIndexA-2][colIndex].roll.charId} : null;
                         
                         const gRes = calculateGuaranteedLookahead(seedIndexA, config, seeds, lastDraw, normalRolls);
                         
                         const addr = formatAddress(gRes.nextRollStartSeedIndex);
                         let charName = gRes.name;

                         if (!isSimulationMode && gRes.nextRollStartSeedIndex > 0) {
                             const guarSeedIdx = gRes.nextRollStartSeedIndex - 1;
                             if (guarSeedIdx < seeds.length) {
                                 const guarSeedVal = seeds[guarSeedIdx];
                                 charName = `<span class="char-link" style="cursor:pointer;" onclick="updateSeedAndRefresh(${guarSeedVal})">${charName}</span>`;
                             }
                         }

                         let mainHtml = `<span style="font-size:0.9em; color:#666;">${addr}</span>${charName}`;

                         let altHtml = '';
                         if (gRes.alternative) {
                             const altAddr = formatAddress(gRes.alternative.nextRollStartSeedIndex);
                             let altCharName = gRes.alternative.name;
                             if (!isSimulationMode && gRes.alternative.nextRollStartSeedIndex > 0) {
                                 const altGuarSeedIdx = gRes.alternative.nextRollStartSeedIndex - 1;
                                 if (altGuarSeedIdx < seeds.length) {
                                     const altGuarSeedVal = seeds[altGuarSeedIdx];
                                     altCharName = `<span class="char-link" style="cursor:pointer;" onclick="updateSeedAndRefresh(${altGuarSeedVal})">${altCharName}</span>`;
                                 }
                             }
                             altHtml = `<span style="font-size:0.9em; color:#666;">${altAddr}</span>${altCharName}<br>`;
                         }

                         gContent = altHtml + mainHtml;

                         if (cellStyle !== '') {
                             let isLimited = false;
                             if (typeof limitedCats !== 'undefined' && Array.isArray(limitedCats)) {
                                 if (limitedCats.includes(parseInt(gRes.charId)) || limitedCats.includes(String(gRes.charId))) {
                                     isLimited = true;
                                 }
                             }
                             cellStyle = 'background-color: #32CD32;';
                         }
                    }
                    rowHtml += `<td style="${cellStyle}">${gContent}</td>`;
                }
            });

            rowHtml += `<td class="col-no">${i+1}</td>`;

            rowHtml += generateDetailedCalcCells(seedIndexB);

            tableGachaIds.forEach((idWithSuffix, colIndex) => {
                let id = idWithSuffix;
                let suffix = '';
                if (idWithSuffix.endsWith('f')) { suffix = 'f'; id = idWithSuffix.slice(0, -1); }
                else if (idWithSuffix.endsWith('s')) { suffix = 's'; id = idWithSuffix.slice(0, -1); }
                else if (idWithSuffix.endsWith('g')) { suffix = 'g'; id = idWithSuffix.slice(0, -1); }
                
                const isG = (suffix !== '');

                if(!gachaMasterData.gachas[id]) return;
                rowHtml += generateCell(seedIndexB, id, colIndex);
                if(isG) {
                    let gContent = '---';
                    let cellStyle = '';

                    if (isSimulationMode && guarHighlightMap.get(seedIndexB) === id) {
                        cellStyle = 'background-color: #98FB98;';
                    }

                    if (typeof calculateGuaranteedLookahead !== 'undefined') {
                        const config = columnConfigs[colIndex];
                        const normalRolls = config._guaranteedNormalRolls || 10;

                        let lastDraw = (i>0 && tableData[seedIndexB-2]?.[colIndex]?.roll) ? 
                                       {rarity: tableData[seedIndexB-2][colIndex].roll.rarity, charId: tableData[seedIndexB-2][colIndex].roll.charId} : null;
                        const gRes = calculateGuaranteedLookahead(seedIndexB, config, seeds, lastDraw, normalRolls);
                        
                        const addr = formatAddress(gRes.nextRollStartSeedIndex);
                        let charName = gRes.name;

                        if (!isSimulationMode && gRes.nextRollStartSeedIndex > 0) {
                             const guarSeedIdx = gRes.nextRollStartSeedIndex - 1;
                             if (guarSeedIdx < seeds.length) {
                                 const guarSeedVal = seeds[guarSeedIdx];
                                 charName = `<span class="char-link" style="cursor:pointer;" onclick="updateSeedAndRefresh(${guarSeedVal})">${charName}</span>`;
                             }
                        }

                        let mainHtml = `<span style="font-size:0.9em; color:#666;">${addr}</span>${charName}`;

                        let altHtml = '';
                        if (gRes.alternative) {
                             const altAddr = formatAddress(gRes.alternative.nextRollStartSeedIndex);
                             let altCharName = gRes.alternative.name;
                             if (!isSimulationMode && gRes.alternative.nextRollStartSeedIndex > 0) {
                                 const altGuarSeedIdx = gRes.alternative.nextRollStartSeedIndex - 1;
                                 if (altGuarSeedIdx < seeds.length) {
                                     const altGuarSeedVal = seeds[altGuarSeedIdx];
                                     altCharName = `<span class="char-link" style="cursor:pointer;" onclick="updateSeedAndRefresh(${altGuarSeedVal})">${altCharName}</span>`;
                                 }
                             }
                             altHtml = `<span style="font-size:0.9em; color:#666;">${altAddr}</span>${altCharName}<br>`;
                        }

                        gContent = altHtml + mainHtml;

                        if (cellStyle !== '') {
                             cellStyle = 'background-color: #32CD32;';
                        }
                    }
                    rowHtml += `<td style="${cellStyle}">${gContent}</td>`;
                }
            });
            
            rowHtml += `</tr>`;
            tableHtml += rowHtml;
        }
        
        tableHtml += '</tbody></table>';
        const container = document.getElementById('rolls-table-container');
        if(container) container.innerHTML = tableHtml;

        const resultDiv = document.getElementById('result');
        if(resultDiv) resultDiv.textContent = isSimulationMode ? "Simulation active..." : "Display Mode";
        
        updateUrlParams();

    } catch(e) {
        const container = document.getElementById('rolls-table-container');
        if(container) container.innerHTML = `<p class="error">エラー: ${e.message}</p>`;
        console.error(e);
    }
}