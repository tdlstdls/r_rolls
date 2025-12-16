// view_table.js
/**
 * view_table.js
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
        
        const numRolls = currentRolls;

        if (typeof Xorshift32 === 'undefined' || typeof rollWithSeedConsumptionFixed === 'undefined') {
            document.getElementById('rolls-table-container').innerHTML = 
                '<p class="error">logic.js が読み込まれていません。</p>';
            return;
        }

        const seeds = [];
        const rngForSeeds = new Xorshift32(initialSeed);
        for (let i = 0; i < numRolls * 15 + 100; i++) seeds.push(rngForSeeds.next());
        
        const tableData = Array(numRolls * 2).fill(null).map(() => []);
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

            const config = { ...originalConfig };
            config.pool = { ...originalConfig.pool };
            if (config.pool.uber) {
                config.pool.uber = [...config.pool.uber];
            }
            
            config._guaranteedNormalRolls = guaranteedNormalRolls;
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

        let findAreaHtml = '';
        if (typeof generateFastForecast === 'function') {
            findAreaHtml += generateFastForecast(initialSeed, columnConfigs);
        }

        if (typeof generateMasterInfoHtml === 'function') {
            const visibilityClass = (typeof showFindInfo !== 'undefined' && showFindInfo) ? '' : 'hidden';
            findAreaHtml += `<div class="${visibilityClass}" style="margin-bottom: 15px; padding: 10px; background: #fdfdfd; border: 1px solid #ddd; border-top: none; margin-top: -16px; border-radius: 0 0 4px 4px; font-size: 0.85em;">`;
            findAreaHtml += `<div style="border-top: 1px dashed #ccc; margin-bottom: 10px;"></div>`; 
            findAreaHtml += generateMasterInfoHtml();
            findAreaHtml += `</div>`;
        }

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

        const highlightMap = new Map();
        const guarHighlightMap = new Map();
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

        let buttonHtml = `<button class="add-gacha-btn" onclick="addGachaColumn()">＋列を追加</button> <button class="add-gacha-btn" style="background-color: #17a2b8;" onclick="addGachasFromSchedule()">skdで追加</button>`;
        
        buttonHtml += `<span id="add-id-trigger" style="margin-left:8px; cursor:pointer; text-decoration:underline; color:#007bff; font-size:0.9em; font-weight:bold;" onclick="showIdInput()">IDで追加</span>`;
        buttonHtml += `<span id="add-id-container" style="display:none; margin-left:5px;">`;
        buttonHtml += `<label for="gacha-id-input" style="font-weight:normal; font-size:0.9em;">ID:</label>`;
        buttonHtml += `<input type="number" id="gacha-id-input" style="width:60px; padding:1px; font-size:0.9em;" onkeydown="if(event.key==='Enter') addGachaById()">`;
        buttonHtml += `<button onclick="addGachaById()" class="secondary" style="margin-left:3px; padding:1px 6px; font-size:0.85em;">追加</button>`;
        buttonHtml += `</span>`;
        buttonHtml += `<button class="remove-btn" style="margin-left:8px; padding: 2px 8px; font-size: 11px;" onclick="resetToFirstGacha()" title="一番左以外を全削除">×</button>`;

        let totalGachaCols = 0;
        tableGachaIds.forEach(idWithSuffix => {
            let id = idWithSuffix.replace(/[gfs]$/, '');
            if (gachaMasterData.gachas[id]) totalGachaCols += /[gfs]$/.test(idWithSuffix) ? 2 : 1;
        });
        const calcColClass = `calc-column ${showSeedColumns ? '' : 'hidden'}`;
        const calcColSpan = showSeedColumns ? 5 : 0;
        const totalTrackSpan = calcColSpan + totalGachaCols;

        let tableHtml = `<table><thead>
            <tr><th class="col-no"></th><th colspan="${totalTrackSpan}">A ${buttonHtml}</th>
            <th class="col-no"></th><th colspan="${totalTrackSpan}">B</th></tr><tr>`;
        
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
                
                let selectedLabel = `${id} ${gachaConfig.name}`;
                const options = getGachaSelectorOptions(id);
                const foundOption = options.find(o => o.value == id);
                if (foundOption) selectedLabel = foundOption.label;

                let displayHTML = "";
                const firstSpaceIdx = selectedLabel.indexOf(' ');
                if (firstSpaceIdx !== -1) {
                    const part1 = selectedLabel.substring(0, firstSpaceIdx);
                    const part2 = selectedLabel.substring(firstSpaceIdx + 1);
                    displayHTML = `<span style="font-size:0.85em; color:#333;">${part1}</span><br><span style="font-weight:bold; font-size:0.95em;">${part2}</span>`;
                } else {
                    displayHTML = selectedLabel;
                }

                let selectorArea = '';
                let controlArea = '';

                if (isInteractive) {
                    const removeBtn = `<button class="remove-btn" onclick="removeGachaColumn(${index})" style="font-size:11px; padding:2px 6px; margin-left: 5px;">x</button>`;
                    let gBtnLabel = 'G';
                    if (suffix === 'g') gBtnLabel = '11G';
                    else if (suffix === 'f') gBtnLabel = '15G';
                    else if (suffix === 's') gBtnLabel = '7G';
                    
                    const gBtn = `<button onclick="toggleGuaranteedColumn(${index})" style="min-width:25px; font-size:11px; padding:2px 6px;">${gBtnLabel}</button>`;
                    const currentAddVal = uberAdditionCounts[index] || 0;
                    const addLabelText = (currentAddVal > 0) ? `add:${currentAddVal}` : `add`;
                    const triggerHtml = `<span id="add-trigger-${index}" style="font-size:12px; color:#007bff; cursor:pointer; text-decoration:underline;" onclick="showAddInput(${index})">${addLabelText}</span>`;
                    
                    let addSelect = `<span id="add-select-wrapper-${index}" style="display:none;">`;
                    addSelect += `<select class="uber-add-select" onchange="updateUberAddition(this, ${index})" style="width: 40px; margin: 0 2px; padding: 0; font-size: 0.85em;">`;
                    for(let k=0; k<=19; k++){
                        addSelect += `<option value="${k}" ${k===currentAddVal ? 'selected':''}>${k}</option>`;
                    }
                    addSelect += `</select></span>`;
                    let selector = `<select onchange="updateGachaSelection(this, ${index})" style="width: 30px; cursor: pointer; opacity: 0; position: absolute; left:0; top:0; height: 100%; width: 100%;">`;
                    options.forEach(opt => {
                        const selected = (opt.value == id) ? 'selected' : '';
                        selector += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
                    });
                    selector += '</select>';
                    
                    const fakeSelectBtn = `<div style="width:20px; height:20px; background:#ddd; border:1px solid #999; display:flex; align-items:center; justify-content:center; border-radius:3px;">▼</div>`;
                    selectorArea = `<div style="position: relative; width: 24px; height: 24px;">${fakeSelectBtn}${selector}</div>`;
                    controlArea = `<div style="margin-top:4px; display:flex; justify-content:center; align-items:center; gap:3px;">${gBtn}${triggerHtml}${addSelect}${removeBtn}</div>`;
                } else {
                    selectorArea = `<div style="width: 24px; height: 24px;"></div>`;
                    let statusTextParts = [];
                    if (suffix === 'g') statusTextParts.push('11G');
                    else if (suffix === 'f') statusTextParts.push('15G');
                    else if (suffix === 's') statusTextParts.push('7G');
                    const currentAddVal = uberAdditionCounts[index] || 0;
                    if (currentAddVal > 0) statusTextParts.push(`add:${currentAddVal}`);
                    if (statusTextParts.length > 0) {
                        controlArea = `<div style="margin-top:4px; font-size:0.85em; color:#555; height: 21px; display: flex; align-items: center; justify-content: center;">${statusTextParts.join(' / ')}</div>`;
                    } else {
                         controlArea = `<div style="margin-top:4px; height: 21px;"></div>`;
                    }
                }
                
                const cls = isGuaranteed ? '' : 'class="gacha-column"';
                html += `<th ${cls} ${isGuaranteed?'colspan="2"':''}><div class="gacha-header-wrapper" style="display: flex; align-items: center; justify-content: center; gap: 6px; position: relative;">${selectorArea}<div style="text-align: left; line-height: 1.25;">${displayHTML}</div></div>${controlArea}</th>`;
            });
            return html;
        };

        tableHtml += `<th class="col-no">NO.</th>` + generateHeader(true) + `<th class="col-no">NO.</th>` + generateHeader(false) + `</tr></thead><tbody>`;

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
                        const finalSeedIndex = seedIndex + roll.seedsConsumed - 1;
                        const sNumFinal = finalSeedIndex + 1;
                        colReRoll = `<td>(S${sNumFinal})<br>%${finalPoolSize}<br>${finalVal}</td>`;
                    } else {
                        colReRoll = `<td>false</td>`;
                    }
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

            let content = fullRoll.finalChar.name;
            if (!isSimulationMode) {
                if (fullRoll.isRerolled) {
                    const s2Val = (seedIndex + 1 < seeds.length) ? seeds[seedIndex + 1] : null;
                    const s3Val = (seedIndex + 2 < seeds.length) ? seeds[seedIndex + 2] : null;
                    const originalName = fullRoll.originalChar.name;
                    const finalName = fullRoll.finalChar.name;
                    let originalHtml = originalName;
                    if (s2Val !== null) originalHtml = `<span class="char-link" style="cursor:pointer;" onclick="updateSeedAndRefresh(${s2Val})">${originalName}</span>`;
                    let finalHtml = finalName;
                    if (s3Val !== null) finalHtml = `<span class="char-link" style="cursor:pointer;" onclick="updateSeedAndRefresh(${s3Val})">${finalName}</span>`;
                    
                    const nextSeedIdx = seedIndex + fullRoll.seedsConsumed;
                    let addr = formatAddress(nextSeedIdx);
                    if (fullRoll.isForceDuplicate) {
                        addr = 'R' + addr;
                    }
                    content = `${originalHtml}<br><span style="font-size:0.9em; color:#666;">${addr}</span>${finalHtml}`;
                } else {
                    const slotSeedVal = (seedIndex + 1 < seeds.length) ? seeds[seedIndex + 1] : null;
                    if(slotSeedVal !== null) content = `<span class="char-link" style="cursor:pointer;" onclick="updateSeedAndRefresh(${slotSeedVal})">${content}</span>`;
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
            return `<td class="gacha-cell gacha-column${hlClass}" style="${style}">${content}</td>`;
        };

        const isSimpleYellow = (currIdx) => {
            if (currIdx < 2) return false;
            const n = currIdx - 2; 
            if (n + 3 >= seeds.length) return false;
            if (seeds[n] % 10000 > 6969 || seeds[n+2] % 10000 > 6969) return false;
            return (seeds[n+1] % 25) === (seeds[n+3] % 25);
        };

        const isSimpleOrange = (currIdx) => {
            if (currIdx < 2) return false;
            const n = currIdx - 2; 
            if (n + 3 >= seeds.length) return false;
            if (seeds[n] % 10000 > 6969 || seeds[n+2] % 10000 > 6969) return false;
            return (seeds[n+1] % 25) === (24 - (seeds[n+3] % 25));
        };

        const isConsecutiveYellow = (currIdx) => {
            if (currIdx < 5) return false;
            const n = currIdx - 5;
            if (currIdx + 1 >= seeds.length) return false;
            if (seeds[n] % 10000 > 6969) return false;
            if (seeds[n+2] % 10000 > 6969) return false;
            if (seeds[currIdx] % 10000 > 6969) return false;
            if (seeds[n+1] % 25 !== seeds[n+3] % 25) return false;
            return seeds[n+4] % 24 === seeds[currIdx+1] % 25;
        };

        const isConsecutiveOrange = (currIdx) => {
            if (currIdx < 5) return false;
            const n = currIdx - 5;
            if (currIdx + 1 >= seeds.length) return false;
            if (seeds[n] % 10000 > 6969) return false;
            if (seeds[n+2] % 10000 > 6969) return false;
            if (seeds[currIdx] % 10000 > 6969) return false;
            if (seeds[n+1] % 25 !== seeds[n+3] % 25) return false;
            return seeds[n+4] % 24 === (24 - (seeds[currIdx+1] % 25));
        };

        for(let i=0; i<numRolls; i++){
            const seedIndexA = i*2, seedIndexB = i*2+1;
            let styleNoA = '';
            if (isSimpleYellow(seedIndexA) || isConsecutiveYellow(seedIndexA)) styleNoA = 'style="background-color: #ffeb3b;"';
            else if (isSimpleOrange(seedIndexA) || isConsecutiveOrange(seedIndexA)) styleNoA = 'style="background-color: #ff9800;"';
            let styleNoB = '';
            if (isSimpleYellow(seedIndexB) || isConsecutiveYellow(seedIndexB)) styleNoB = 'style="background-color: #ffeb3b;"';
            else if (isSimpleOrange(seedIndexB) || isConsecutiveOrange(seedIndexB)) styleNoB = 'style="background-color: #ff9800;"';

            let rowHtml = `<tr><td class="col-no" ${styleNoA}>${i+1}</td>`;
            rowHtml += generateDetailedCalcCells(seedIndexA);
            tableGachaIds.forEach((idWithSuffix, colIndex) => {
                let id = idWithSuffix.replace(/[gfs]$/, '');
                let suffix = '';
                if (idWithSuffix.endsWith('f')) suffix = 'f';
                else if (idWithSuffix.endsWith('s')) suffix = 's';
                else if (idWithSuffix.endsWith('g')) suffix = 'g';
                const isG = (suffix !== '');
                if(!gachaMasterData.gachas[id]) return;
                
                rowHtml += generateCell(seedIndexA, id, colIndex);
                
                if(isG) {
                    let gContent = '---';
                    let cellStyle = '';
                    if (isSimulationMode && guarHighlightMap.get(seedIndexA) === id) cellStyle = 'background-color: #98FB98;'; 
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
                                 if (limitedCats.includes(parseInt(gRes.charId)) || limitedCats.includes(String(gRes.charId))) isLimited = true;
                             }
                             cellStyle = 'background-color: #32CD32;';
                         }
                    }
                    rowHtml += `<td style="${cellStyle}">${gContent}</td>`;
                }
            });
            
            rowHtml += `<td class="col-no" ${styleNoB}>${i+1}</td>`;
            rowHtml += generateDetailedCalcCells(seedIndexB);
            tableGachaIds.forEach((idWithSuffix, colIndex) => {
                let id = idWithSuffix.replace(/[gfs]$/, '');
                let suffix = '';
                if (idWithSuffix.endsWith('f')) suffix = 'f';
                else if (idWithSuffix.endsWith('s')) suffix = 's';
                else if (idWithSuffix.endsWith('g')) suffix = 'g';
                const isG = (suffix !== '');
                if(!gachaMasterData.gachas[id]) return;

                rowHtml += generateCell(seedIndexB, id, colIndex);
                if(isG) {
                    let gContent = '---';
                    let cellStyle = '';
                    if (isSimulationMode && guarHighlightMap.get(seedIndexB) === id) cellStyle = 'background-color: #98FB98;';
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
                        if (cellStyle !== '') cellStyle = 'background-color: #32CD32;';
                    }
                    rowHtml += `<td style="${cellStyle}">${gContent}</td>`;
                }
            });
            rowHtml += `</tr>`;
            tableHtml += rowHtml;
        }
        
        // ▼▼▼ テーブル最下部に追加: +100行 & SEED表示ボタン ▼▼▼
        const seedBtnText = showSeedColumns ? 'SEED非表示' : 'SEED表示';
        // colspan = 1(NoA) + totalTrackSpan(A) + 1(NoB) + totalTrackSpan(B)
        const fullColSpan = 2 + (totalTrackSpan * 2); 
        
        tableHtml += `<tr><td colspan="${fullColSpan}" style="padding: 10px; text-align: center;">
            <button onclick="addMoreRolls()">+100行</button>
            <button id="toggle-seed-btn" class="secondary" onclick="toggleSeedColumns()">${seedBtnText}</button>
        </td></tr>`;
        // ▲▲▲ 追加終了 ▲▲▲

        tableHtml += '</tbody></table>';
        const container = document.getElementById('rolls-table-container');
        if(container) {
            container.innerHTML = findAreaHtml + tableHtml;
        }

        const resultDiv = document.getElementById('result');
        if(resultDiv) resultDiv.textContent = isSimulationMode ? "Simulation active..." : "Display Mode";
        
        updateUrlParams();

    } catch(e) {
        const container = document.getElementById('rolls-table-container');
        if(container) container.innerHTML = `<p class="error">エラー: ${e.message}</p>`;
        console.error(e);
    }
}