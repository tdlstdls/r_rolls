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
        
        const numRolls = currentRolls; // グローバル変数

        if (typeof Xorshift32 === 'undefined' || typeof rollWithSeedConsumptionFixed === 'undefined') {
            document.getElementById('rolls-table-container').innerHTML = 
                '<p class="error">logic.js が読み込まれていません。</p>';
            return;
        }

        const seeds = [];
        const rngForSeeds = new Xorshift32(initialSeed);
        // テーブル表示用に必要な分だけ生成 (300行分 + バッファ)
        for (let i = 0; i < numRolls * 15 + 100; i++) seeds.push(rngForSeeds.next());

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

        // 1. 高速予報サマリーの生成 (view_forecast.jsを使用)
        const summaryHtml = (typeof generateFastForecast === 'function') 
            ? generateFastForecast(initialSeed, columnConfigs) 
            : '';

        // 2. テーブル計算実行 (Column Base)
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

        // 3. シミュレーションモードのハイライト計算
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
                        else { normalRolls = sim.rolls;
                        }
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
                // UIコントローラで参照
            }
        }

        // 4. HTML生成
        let buttonHtml = `<button class="add-gacha-btn" onclick="addGachaColumn()">＋列を追加</button> <button class="add-gacha-btn" style="background-color: #17a2b8;" onclick="addGachasFromSchedule()">skdで追加</button>`;
        
        // ID追加用のトリガーと入力フォーム
        buttonHtml += `<span id="add-id-trigger" style="margin-left:8px; cursor:pointer; text-decoration:underline; color:#007bff; font-size:0.9em; font-weight:bold;" onclick="showIdInput()">IDで追加</span>`;
        buttonHtml += `<span id="add-id-container" style="display:none; margin-left:5px;">`;
        buttonHtml += `<label for="gacha-id-input" style="font-weight:normal; font-size:0.9em;">ID:</label>`;
        buttonHtml += `<input type="number" id="gacha-id-input" style="width:60px; padding:1px; font-size:0.9em;" onkeydown="if(event.key==='Enter') addGachaById()">`;
        buttonHtml += `<button onclick="addGachaById()" class="secondary" style="margin-left:3px; padding:1px 6px; font-size:0.85em;">追加</button>`;
        buttonHtml += `</span>`;

        // ★★★ 追加: ×ボタン (一番左以外を削除) ★★★
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

        // ヘッダー部HTML生成関数（内部）
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
                    // ボタンサイズ調整: ガチャ名称(約11-12px)に合わせてサイズを統一
                    const removeBtn = `<button class="remove-btn" onclick="removeGachaColumn(${index})" style="font-size:11px; padding:2px 6px; margin-left: 5px;">x</button>`;
                    let gBtnLabel = 'G';
                    if (suffix === 'g') gBtnLabel = '11G';
                    else if (suffix === 'f') gBtnLabel = '15G';
                    else if (suffix === 's') gBtnLabel = '7G';
                    
                    // Gボタン: フォントサイズ11px, パディング調整
                    const gBtn = `<button onclick="toggleGuaranteedColumn(${index})" style="min-width:25px; font-size:11px; padding:2px 6px;">${gBtnLabel}</button>`;

                    const currentAddVal = uberAdditionCounts[index] || 0;
                    const addLabelText = (currentAddVal > 0) ? `add:${currentAddVal}` : `add`;
                    // add文字: 12pxに変更
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

        // 内部ヘルパー: アドレスフォーマット
        const formatAddress = (idx) => {
            if (idx === null || idx === undefined) return '';
            const row = Math.floor(idx / 2) + 1;
            const side = (idx % 2 === 0) ? 'A' : 'B';
            return `${side}${row})`;
        };

        // 内部ヘルパー: 詳細計算セルの生成
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
                        const finalSeedIndex = seedIndex + roll.seedsConsumed - 1;
                        const sNumFinal = finalSeedIndex + 1;
                        const finalPoolSize = roll.uniqueTotal;
                        const finalVal = roll.reRollIndex;
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

        // 内部ヘルパー: セル生成
        const generateCell = (seedIndex, id, colIndex) => {
            if(!tableData[seedIndex] || !tableData[seedIndex][colIndex]) return `<td class="gacha-cell gacha-column">N/A</td>`;
            const fullRoll = tableData[seedIndex][colIndex].roll;
            if(!fullRoll) return `<td>N/A</td>`;
            const gachaConfig = gachaMasterData.gachas[id];
            const gachaName = gachaConfig ? gachaConfig.name : "";
            const isPlatOrLegend = gachaName.includes("プラチナ") || gachaName.includes("レジェンド");
            let isLimited = false;
            // 限定キャラ判定
            const charId = fullRoll.finalChar.id;
            // ID取得
            const charIdStr = String(charId);
            // 文字列ID

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
            // --- 背景色の決定 ---
            if (isSimRoute) {
                // シミュレーションルート上のハイライト
                if (isLimited || fullRoll.rarity === 'uber' || fullRoll.rarity === 'legend') style = 'background-color: #32CD32;';
                else style = 'background-color: #98FB98;';
            } else {
                // 通常モードの色分け
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

            // ▼▼▼ 追加: Find機能がONの時、ターゲット（取得可能として表示されているキャラ）を黄緑にする ▼▼▼
            if (typeof showFindInfo !== 'undefined' && showFindInfo && !isSimRoute) {
                // 1. 自動ターゲット（伝説、限定、新規）かどうか
                let isAuto = false;
                if (fullRoll.rarity === 'legend') isAuto = true;
                else if (isLimited) isAuto = true;
                else if (charIdStr.startsWith('sim-new-')) isAuto = true;

                // 2. 非表示リストに入っているか
                const isHidden = hiddenFindIds.has(charId) ||
                (typeof charId === 'number' && hiddenFindIds.has(charId)) || hiddenFindIds.has(charIdStr);
                
                // 3. 手動ターゲットに入っているか
                const isManual = userTargetIds.has(charId) ||
                (typeof charId === 'number' && userTargetIds.has(charId));

                // 「自動ターゲットかつ非表示でない」または「手動ターゲット」の場合にハイライト
                if ((isAuto && !isHidden) || isManual) {
                    style = 'background-color: #adff2f; font-weight: bold;'; // 黄緑色 (GreenYellow)
                }
            }
            // ▲▲▲ 追加終了 ▲▲▲

            let content = fullRoll.finalChar.name;
            if (!isSimulationMode) {
                if (fullRoll.isRerolled) {
                    const s2Val = (seedIndex + 1 < seeds.length) ?
                    seeds[seedIndex + 1] : null;
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
                    const slotSeedVal = (seedIndex + 1 < seeds.length) ?
                    seeds[seedIndex + 1] : null;
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

        // --- No列ハイライト判定関数 (単純被り: Sn vs Sn+2) ---
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
        // --- No列ハイライト判定関数 (連続被り: Sn vs Sn+2 vs Sn+5) ---
        // currIdx は Sn+5 (Row 3) に相当
        const isConsecutiveYellow = (currIdx) => {
            if (currIdx < 5) return false;
            const n = currIdx - 5;
            if (currIdx + 1 >= seeds.length) return false;
            // Rarity checks
            if (seeds[n] % 10000 > 6969) return false;
            if (seeds[n+2] % 10000 > 6969) return false;
            if (seeds[currIdx] % 10000 > 6969) return false;
            // 1st Dupe must be Normal (Yellow-type) logic as per spec: "Sn+1 % 25 == Sn+3 % 25"
            if (seeds[n+1] % 25 !== seeds[n+3] % 25) return false;
            // 2nd Dupe Yellow check: Sn+4 (re-roll slot using reduced pool 24) vs Sn+6 (current row slot 25)
            // seeds[n+4] is reroll seed for 2nd row (Sn+2), used with pool size 24
            // seeds[currIdx+1] is slot seed for 3rd row (Sn+5), used with pool size 25
            return seeds[n+4] % 24 === seeds[currIdx+1] % 25;
        };

        const isConsecutiveOrange = (currIdx) => {
            if (currIdx < 5) return false;
            const n = currIdx - 5;
            if (currIdx + 1 >= seeds.length) return false;
            // Rarity checks
            if (seeds[n] % 10000 > 6969) return false;
            if (seeds[n+2] % 10000 > 6969) return false;
            if (seeds[currIdx] % 10000 > 6969) return false;
            // 1st Dupe Normal check
            if (seeds[n+1] % 25 !== seeds[n+3] % 25) return false;
            // 2nd Dupe Orange check: Sn+4 % 24 == 24 - (Sn+6 % 25)
            return seeds[n+4] % 24 === (24 - (seeds[currIdx+1] % 25));
        };
        // ------------------------------------

        // 行の生成ループ
        for(let i=0; i<numRolls; i++){
            const seedIndexA = i*2, seedIndexB = i*2+1;
            // スタイル判定 (Yellow優先)
            // 両方満たす場合(slot 12等)は黄色になる
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
        
        tableHtml += '</tbody></table>';
        const container = document.getElementById('rolls-table-container');
        if(container) {
            container.innerHTML = summaryHtml + tableHtml;
        }

        const resultDiv = document.getElementById('result');
        if(resultDiv) resultDiv.textContent = isSimulationMode ?
        "Simulation active..." : "Display Mode";
        
        updateUrlParams();

    } catch(e) {
        const container = document.getElementById('rolls-table-container');
        if(container) container.innerHTML = `<p class="error">エラー: ${e.message}</p>`;
        console.error(e);
    }
}