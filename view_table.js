/**
 * view_table.js
 * ガチャ結果テーブルの構築（メインコントローラー）
 */

// Simルートのハイライト色 (通常: 鮮やかな水色)
const COLOR_ROUTE_HIGHLIGHT = '#aaddff';
// Simルートのハイライト色 (超激・伝説・限定: 鮮やかな青色)
const COLOR_ROUTE_UBER = '#66b2ff';

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
            document.getElementById('rolls-table-container').innerHTML = '<p class="error">logic.js が読み込まれていません。</p>';
            return;
        }

        // 1. SEED配列の生成
        const seeds = [];
        const rngForSeeds = new Xorshift32(initialSeed);
        for (let i = 0; i < numRolls * 15 + 100; i++) seeds.push(rngForSeeds.next());

        // 2. テーブルデータ（シミュレーション結果）の生成
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
            // ConfigにSuffix情報を保持させておく（セル生成時に使用）
            config._suffix = suffix;
            const addCount = uberAdditionCounts[colIndex] || 0;
            if (addCount > 0) {
                for (let k = 1; k <= addCount; k++) {
                    config.pool.uber.unshift({ id: `sim-new-${k}`, name: `新規超激${k}`, rarity: 'uber' });
                }
            }
            return config;
        });

        // 3. 上部エリア（Fast Forecast & Master Info）の生成
        let findAreaHtml = '';
        if (typeof generateFastForecast === 'function') {
            findAreaHtml += generateFastForecast(initialSeed, columnConfigs);
        }

        if (typeof generateMasterInfoHtml === 'function') {
            // Find表示ON(showFindInfo=true) かつ マスター情報ON(isMasterInfoVisible=true) の場合のみ表示
            let visibilityClass = (typeof showFindInfo !== 'undefined' && showFindInfo) ? '' : 'hidden';
            if (typeof isMasterInfoVisible !== 'undefined' && !isMasterInfoVisible) {
                visibilityClass = 'hidden';
            }

            // ID="master-info-area" を追加
            findAreaHtml += `<div id="master-info-area" class="${visibilityClass}" style="margin-bottom: 15px; padding: 10px; background: #fdfdfd; border: 1px solid #ddd; border-top: none; margin-top: -16px; border-radius: 0 0 4px 4px; font-size: 0.85em;">`;
            findAreaHtml += `<div style="border-top: 1px dashed #ccc; margin-bottom: 10px;"></div>`; 
            findAreaHtml += generateMasterInfoHtml();
            findAreaHtml += `</div>`;
        }

        // 4. ロールの実行
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

        // 5. Simモード用のハイライト準備
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

        // 6. テーブルHTMLの構築開始
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

        // 計算列の共通定義
        const stickyCalcCols = `
            <th class="${calcColClass}">SEED</th>
            <th class="${calcColClass}">rarity</th>
            <th class="${calcColClass}">slot</th>
            <th class="${calcColClass}">ReRoll</th>
            <th class="${calcColClass}">Guar</th>
        `;
        const controlCalcCols = `
            <th class="${calcColClass}"></th>
            <th class="${calcColClass}"></th>
            <th class="${calcColClass}"></th>
            <th class="${calcColClass}"></th>
            <th class="${calcColClass}"></th>
        `;

        // ヘッダー生成 (view_header.js の関数を使用)
        // 変更: 固定行(名前)とスクロール行(操作)に分割
        let tableHtml = `<table><thead>
            <tr><th class="col-no"></th><th colspan="${totalTrackSpan}">A ${buttonHtml}</th>
            <th class="col-no"></th><th colspan="${totalTrackSpan}">B</th></tr>`;
        
        // 行1: 名前行 (Sticky)
        tableHtml += `<tr class="sticky-row">`;
        tableHtml += `<th class="col-no">NO.</th>`;
        tableHtml += stickyCalcCols;
        tableHtml += generateNameHeaderHTML(); 
        tableHtml += `<th class="col-no">NO.</th>`;
        tableHtml += stickyCalcCols;
        tableHtml += generateNameHeaderHTML();
        tableHtml += `</tr>`;

        // 行2: 操作行 (Scrollable)
        tableHtml += `<tr class="control-row">`;
        tableHtml += `<th class="col-no"></th>`;
        tableHtml += controlCalcCols;
        tableHtml += generateControlHeaderHTML(true); 
        tableHtml += `<th class="col-no"></th>`;
        tableHtml += controlCalcCols;
        tableHtml += generateControlHeaderHTML(false); // B側はボタン非表示
        tableHtml += `</tr>`;
        
        tableHtml += `</thead><tbody>`;

        // 7. 行ループとセル生成
        for(let i=0; i<numRolls; i++){
            const seedIndexA = i*2, seedIndexB = i*2+1;
            
            // 行の背景色判定 (view_analysis.js の関数を使用)
            let styleNoA = '';
            if (RowAnalysis.isSimpleYellow(seedIndexA, seeds) || RowAnalysis.isConsecutiveYellow(seedIndexA, seeds)) styleNoA = 'style="background-color: #ffeb3b;"';
            else if (RowAnalysis.isSimpleOrange(seedIndexA, seeds) || RowAnalysis.isConsecutiveOrange(seedIndexA, seeds)) styleNoA = 'style="background-color: #ff9800;"';
            
            let styleNoB = '';
            if (RowAnalysis.isSimpleYellow(seedIndexB, seeds) || RowAnalysis.isConsecutiveYellow(seedIndexB, seeds)) styleNoB = 'style="background-color: #ffeb3b;"';
            else if (RowAnalysis.isSimpleOrange(seedIndexB, seeds) || RowAnalysis.isConsecutiveOrange(seedIndexB, seeds)) styleNoB = 'style="background-color: #ff9800;"';

            // --- A側 ---
            let rowHtml = `<tr><td class="col-no" ${styleNoA}>${i+1}</td>`;
            rowHtml += generateDetailedCalcCells(seedIndexA, seeds, tableData); // view_cell_renderer.js

            tableGachaIds.forEach((idWithSuffix, colIndex) => {
                let id = idWithSuffix.replace(/[gfs]$/, '');
                let suffix = '';
                if (idWithSuffix.endsWith('f')) suffix = 'f';
                else if (idWithSuffix.endsWith('s')) suffix = 's';
                else if (idWithSuffix.endsWith('g')) suffix = 'g';
                const isG = (suffix !== '');
                if(!gachaMasterData.gachas[id]) return;
                
                // 通常セル生成 (view_cell_renderer.js)
                let cellHtml = generateCell(seedIndexA, id, colIndex, tableData, seeds, highlightMap, isSimulationMode);
                // 色置換
                if (isSimulationMode) {
                    // 通常ルート(薄緑) -> 鮮やかな水色
                    cellHtml = cellHtml.replace(/background-color:\s*#98FB98;/gi, `background-color: ${COLOR_ROUTE_HIGHLIGHT};`);
                    // 高レア・限定ルート(濃い緑) -> 鮮やかな青色
                    cellHtml = cellHtml.replace(/background-color:\s*#32CD32;/gi, `background-color: ${COLOR_ROUTE_UBER};`);
                }
                rowHtml += cellHtml;
                
                // 確定枠生成
                if(isG) {
                    let gContent = '---';
                    let cellStyle = '';
                    // 確定枠も青色ハイライト
                    if (isSimulationMode && guarHighlightMap.get(seedIndexA) === id) cellStyle = `background-color: ${COLOR_ROUTE_UBER};`; 
                    if (typeof calculateGuaranteedLookahead !== 'undefined') {
                         const config = columnConfigs[colIndex];
                         const normalRolls = config._guaranteedNormalRolls || 10;
                         let lastDraw = (i>0 && tableData[seedIndexA-2]?.[colIndex]?.roll) ? 
                                       {rarity: tableData[seedIndexA-2][colIndex].roll.rarity, charId: tableData[seedIndexA-2][colIndex].roll.charId} : null;
                         const gRes = calculateGuaranteedLookahead(seedIndexA, config, seeds, lastDraw, normalRolls);
                         const addr = formatAddress(gRes.nextRollStartSeedIndex);
                         let charName = gRes.name;
                         
                         // ★確定枠キャラ名へのクリックイベント設定
                         // Simモード: ルート計算 + 確定入力
                         // Viewモード: シードジャンプ
                         let gClickAction = "";
                         let gType = (suffix === 'g') ? '11g' : (suffix === 'f' ? '15g' : '7g');
                         const escapedName = charName.replace(/'/g, "\\'");
                         
                         if (isSimulationMode) {
                            gClickAction = `onclick="onGachaCellClick(${seedIndexA}, '${id}', '${escapedName}', '${gType}')"`;
                         } else {
                            if (gRes.nextRollStartSeedIndex > 0) {
                                 const guarSeedIdx = gRes.nextRollStartSeedIndex - 1;
                                 if (guarSeedIdx < seeds.length) {
                                     const guarSeedVal = seeds[guarSeedIdx];
                                     gClickAction = `onclick="updateSeedAndRefresh(${guarSeedVal})"`;
                                 }
                            }
                         }
                         
                         charName = `<span class="char-link" style="cursor:pointer;" ${gClickAction}>${charName}</span>`;

                         let mainHtml = `<span style="font-size:0.9em; color:#666;">${addr}</span>${charName}`;
                         let altHtml = '';
                         if (gRes.alternative) {
                             const altAddr = formatAddress(gRes.alternative.nextRollStartSeedIndex);
                             let altCharName = gRes.alternative.name;
                             let altClickAction = "";
                             
                             if (isSimulationMode) {
                                const escAlt = altCharName.replace(/'/g, "\\'");
                                altClickAction = `onclick="onGachaCellClick(${seedIndexA}, '${id}', '${escAlt}', '${gType}')"`;
                             } else {
                                 if (gRes.alternative.nextRollStartSeedIndex > 0) {
                                     const altGuarSeedIdx = gRes.alternative.nextRollStartSeedIndex - 1;
                                     if (altGuarSeedIdx < seeds.length) {
                                         const altGuarSeedVal = seeds[altGuarSeedIdx];
                                         altClickAction = `onclick="updateSeedAndRefresh(${altGuarSeedVal})"`;
                                     }
                                 }
                             }
                             altCharName = `<span class="char-link" style="cursor:pointer;" ${altClickAction}>${altCharName}</span>`;

                             altHtml = `<span style="font-size:0.9em; color:#666;">${altAddr}</span>${altCharName}<br>`;
                         }
                         gContent = altHtml + mainHtml;
                         if (cellStyle !== '') {
                             let isLimited = false;
                             if (typeof limitedCats !== 'undefined' && Array.isArray(limitedCats)) {
                                 if (limitedCats.includes(parseInt(gRes.charId)) || limitedCats.includes(String(gRes.charId))) isLimited = true;
                             }
                             // Simモード外の色 (ここではSimモード内なので cellStyle が優先されるが、上書きしないよう注意)
                             // ここでの background-color: #32CD32 はSimモードでない場合の限定確定枠などに適用される
                             // Simモードなら cellStyle が入っている
                         }
                    }
                    rowHtml += `<td style="${cellStyle}">${gContent}</td>`;
                }
            });

            // --- B側 ---
            rowHtml += `<td class="col-no" ${styleNoB}>${i+1}</td>`;
            rowHtml += generateDetailedCalcCells(seedIndexB, seeds, tableData);

            tableGachaIds.forEach((idWithSuffix, colIndex) => {
                let id = idWithSuffix.replace(/[gfs]$/, '');
                let suffix = '';
                if (idWithSuffix.endsWith('f')) suffix = 'f';
                else if (idWithSuffix.endsWith('s')) suffix = 's';
                else if (idWithSuffix.endsWith('g')) suffix = 'g';
                const isG = (suffix !== '');
                if(!gachaMasterData.gachas[id]) return;

                // 通常セル生成
                let cellHtml = generateCell(seedIndexB, id, colIndex, tableData, seeds, highlightMap, isSimulationMode);
                // 色置換
                if (isSimulationMode) {
                    cellHtml = cellHtml.replace(/background-color:\s*#98FB98;/gi, `background-color: ${COLOR_ROUTE_HIGHLIGHT};`);
                    cellHtml = cellHtml.replace(/background-color:\s*#32CD32;/gi, `background-color: ${COLOR_ROUTE_UBER};`);
                }
                rowHtml += cellHtml;

                if(isG) {
                    let gContent = '---';
                    let cellStyle = '';
                    if (isSimulationMode && guarHighlightMap.get(seedIndexB) === id) cellStyle = `background-color: ${COLOR_ROUTE_UBER};`;
                    if (typeof calculateGuaranteedLookahead !== 'undefined') {
                        const config = columnConfigs[colIndex];
                        const normalRolls = config._guaranteedNormalRolls || 10;
                        let lastDraw = (i>0 && tableData[seedIndexB-2]?.[colIndex]?.roll) ? {rarity: tableData[seedIndexB-2][colIndex].roll.rarity, charId: tableData[seedIndexB-2][colIndex].roll.charId} : null;
                        const gRes = calculateGuaranteedLookahead(seedIndexB, config, seeds, lastDraw, normalRolls);
                        const addr = formatAddress(gRes.nextRollStartSeedIndex);
                        let charName = gRes.name;
                        
                        let gClickAction = "";
                        let gType = (suffix === 'g') ? '11g' : (suffix === 'f' ? '15g' : '7g');
                        const escapedName = charName.replace(/'/g, "\\'");
                         
                        if (isSimulationMode) {
                            gClickAction = `onclick="onGachaCellClick(${seedIndexB}, '${id}', '${escapedName}', '${gType}')"`;
                        } else {
                            if (gRes.nextRollStartSeedIndex > 0) {
                                 const guarSeedIdx = gRes.nextRollStartSeedIndex - 1;
                                 if (guarSeedIdx < seeds.length) {
                                     const guarSeedVal = seeds[guarSeedIdx];
                                     gClickAction = `onclick="updateSeedAndRefresh(${guarSeedVal})"`;
                                 }
                            }
                        }
                        charName = `<span class="char-link" style="cursor:pointer;" ${gClickAction}>${charName}</span>`;

                        let mainHtml = `<span style="font-size:0.9em; color:#666;">${addr}</span>${charName}`;
                        let altHtml = '';
                        if (gRes.alternative) {
                             const altAddr = formatAddress(gRes.alternative.nextRollStartSeedIndex);
                             let altCharName = gRes.alternative.name;
                             let altClickAction = "";
                             if (isSimulationMode) {
                                const escAlt = altCharName.replace(/'/g, "\\'");
                                altClickAction = `onclick="onGachaCellClick(${seedIndexB}, '${id}', '${escAlt}', '${gType}')"`;
                             } else {
                                 if (gRes.alternative.nextRollStartSeedIndex > 0) {
                                     const altGuarSeedIdx = gRes.alternative.nextRollStartSeedIndex - 1;
                                     if (altGuarSeedIdx < seeds.length) {
                                         const altGuarSeedVal = seeds[altGuarSeedIdx];
                                         altClickAction = `onclick="updateSeedAndRefresh(${altGuarSeedVal})"`;
                                     }
                                 }
                             }
                             altCharName = `<span class="char-link" style="cursor:pointer;" ${altClickAction}>${altCharName}</span>`;

                             altHtml = `<span style="font-size:0.9em; color:#666;">${altAddr}</span>${altCharName}<br>`;
                        }
                        gContent = altHtml + mainHtml;
                        if (cellStyle !== '') {
                            // Simモードでハイライトされている場合
                        } else {
                            // Simモード外での色付けロジック (必要であれば)
                            let isLimited = false;
                             if (typeof limitedCats !== 'undefined' && Array.isArray(limitedCats)) {
                                 if (limitedCats.includes(parseInt(gRes.charId)) || limitedCats.includes(String(gRes.charId))) isLimited = true;
                             }
                             if(isLimited) cellStyle = 'background-color: #32CD32;';
                        }
                    }
                    rowHtml += `<td style="${cellStyle}">${gContent}</td>`;
                }
            });
            rowHtml += `</tr>`;
            tableHtml += rowHtml;
        }
        
        const seedBtnText = showSeedColumns ? 'SEED非表示' : 'SEED表示';
        const fullColSpan = 2 + (totalTrackSpan * 2);
        tableHtml += `<tr><td colspan="${fullColSpan}" style="padding: 10px; text-align: center;">
            <button onclick="addMoreRolls()">+100行</button>
            <button id="toggle-seed-btn" class="secondary" onclick="toggleSeedColumns()">${seedBtnText}</button>
        </td></tr>`;
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