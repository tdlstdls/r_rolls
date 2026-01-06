/** @file view_forecast.js @description Find（高速予報）エリアおよび操作ボタンのHTML生成を担当 @dependency logic.js, ui_target_handler.js */

function generateFastForecast(initialSeed, columnConfigs) {
    const scanRows = 2000;
    const extendedScanRows = 10000;
    const requiredSeeds = extendedScanRows * 2 + 10;
    const seeds = new Uint32Array(requiredSeeds);
    const rng = new Xorshift32(initialSeed);
    for (let i = 0; i < requiredSeeds; i++) seeds[i] = rng.next();

    const visibilityClass = (typeof showFindInfo !== 'undefined' && showFindInfo) ? '' : 'hidden';
    let summaryHtml = `<div id="forecast-summary-area" class="forecast-summary-container ${visibilityClass}" style="margin-bottom: 0; padding: 10px; background: #fdfdfd; border: 1px solid #ddd; border-bottom: none; border-radius: 4px 4px 0 0;">`;
    const legendSlots = [];
    const promotedSlots = []; 
    for (let n = 0; n < scanRows * 2; n++) {
        const val = seeds[n] % 10000;
        const addr = `${Math.floor(n / 2) + 1}${n % 2 === 0 ? 'A' : 'B'}`; 
        if (val >= 9970) legendSlots.push(addr);
        else if (val >= 9940) promotedSlots.push(addr);
    }

    summaryHtml += `
        <div style="margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px dashed #eee; font-size: 0.85em;">
            <div style="margin-bottom: 4px;">
                <span style="font-weight:bold; color:#e91e63; background:#ffe0eb; padding:1px 4px; border-radius:3px;">伝説枠</span>
                <span style="font-family: monospace; margin-left: 5px;">${legendSlots.length > 0 ? legendSlots.join(", ") : "なし"}</span>
            </div>
            <div>
                <span style="font-weight:bold; color:#9c27b0; background:#f3e5f5; padding:1px 4px; border-radius:3px;">昇格枠</span>
                <span style="font-family: monospace; margin-left: 5px;">${promotedSlots.length > 0 ? promotedSlots.join(", ") : "なし"}</span>
            </div>
        </div>
    `;

    const processedGachaIdsForBtn = new Set();
    let availableLegendIds = [], availableLimitedIds = [];
    const limitedSet = new Set();
    if (typeof limitedCats !== 'undefined' && Array.isArray(limitedCats)) {
        limitedCats.forEach(id => { limitedSet.add(id); limitedSet.add(String(id)); });
    }

    columnConfigs.forEach((config) => {
        if (!config || processedGachaIdsForBtn.has(config.id)) return;
        processedGachaIdsForBtn.add(config.id);
        if (config.pool.legend) config.pool.legend.forEach(c => availableLegendIds.push(c.id));
        ['rare', 'super', 'uber'].forEach(r => { if (config.pool[r]) config.pool[r].forEach(c => { if (limitedSet.has(c.id) || limitedSet.has(String(c.id))) availableLimitedIds.push(c.id); }); });
    });

    const isLegendActive = (availableLegendIds.length > 0) && availableLegendIds.some(cid => !hiddenFindIds.has(cid));
    const isLimitedActive = (availableLimitedIds.length > 0) && availableLimitedIds.some(cid => !hiddenFindIds.has(cid));
    const isMasterActive = (typeof isMasterInfoVisible !== 'undefined') ? isMasterInfoVisible : true;

    summaryHtml += `
        <div style="margin-bottom: 10px; text-align: left;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span onclick="clearAllTargets()" class="text-btn" title="全て非表示">×</span>
                <span class="separator">|</span>
                <span onclick="toggleLegendTargets()" class="${isLegendActive ? 'text-btn active' : 'text-btn'}">伝説</span>
                <span class="separator">|</span>
                <span onclick="toggleLimitedTargets()" class="${isLimitedActive ? 'text-btn active' : 'text-btn'}">限定</span>
                <span class="separator">|</span>
                <span id="toggle-master-info-btn" onclick="toggleMasterInfo()" class="${isMasterActive ? 'text-btn active' : 'text-btn'}">マスター</span>
                <span style="font-size: 0.8em; color: #666; margin-left: auto;">Target List</span>
            </div>
            <div style="font-size: 0.75em; color: #666; padding-left: 2px; line-height: 1.4;">
                ※キャラ名をタップすると履歴順に先頭へ移動。×で削除。<br>
                ※マスターリスト内のキャラ名（伝説・限定以外も可）をタップすると「Find」ターゲットとして表示/削除できます。<br>
                ※キャラ名の右のアドレスをタップすると、そのアドレスまでのルートを探索します。
            </div>
        </div>
    `;

    columnConfigs.forEach((config) => {
        if (!config) return;
        const targetIds = new Set();
        const poolsToCheck = { legend: false, rare: false, super: false, uber: false };
        ['legend', 'rare', 'super', 'uber'].forEach(r => {
            if (config.pool[r]) config.pool[r].forEach(charObj => {
                const cid = charObj.id;
                const isAuto = (typeof isAutomaticTarget === 'function') ? isAutomaticTarget(cid) : String(cid).startsWith('sim-new-');
                const isHidden = hiddenFindIds.has(cid) || hiddenFindIds.has(String(cid));
                const isManual = userTargetIds.has(cid) || userTargetIds.has(parseInt(cid));
                const isPrioritized = prioritizedFindIds.includes(cid) || prioritizedFindIds.includes(String(cid)) || prioritizedFindIds.includes(parseInt(cid));

                // 修正: 自動ターゲットかつ非表示リストになくても、優先リストにあればターゲットとして残す
                if ((isAuto && !isHidden) || isManual || isPrioritized) {
                    targetIds.add(cid); poolsToCheck[r] = true;
                }
            });
        });

        if (targetIds.size === 0) return;
        const resultMap = new Map();
        const missingTargets = new Set(targetIds); 

        for (let n = 0; n < scanRows * 2; n++) {
            const rVal = seeds[n] % 10000;
            const rates = config.rarity_rates;
            let rarity = 'rare';
            if (rVal < rates.rare) rarity = 'rare';
            else if (rVal < rates.rare + rates.super) rarity = 'super';
            else if (rVal < rates.rare + rates.super + rates.uber) rarity = 'uber';
            else if (rVal < rates.rare + rates.super + rates.uber + rates.legend) rarity = 'legend';
            if (poolsToCheck[rarity]) {
                const targetPool = config.pool[rarity];
                const cid = targetPool[seeds[n + 1] % targetPool.length].id;
                if (targetIds.has(cid)) {
                    if (!resultMap.has(cid)) {
                        resultMap.set(cid, { 
                            name: gachaMasterData.cats[cid]?.name || cid, hits: [], isLegend: (rarity === 'legend'), 
                            isNew: String(cid).startsWith('sim-new-'),
                            isLimited: limitedSet.has(cid) || limitedSet.has(String(cid))
                        });
                        missingTargets.delete(cid); 
                    }
                    resultMap.get(cid).hits.push(`${Math.floor(n / 2) + 1}${n % 2 === 0 ? 'A' : 'B'}`);
                }
            }
        }

        if (missingTargets.size > 0) {
            for (let n = scanRows * 2; n < extendedScanRows * 2; n++) {
                if (missingTargets.size === 0) break;
                const rVal = seeds[n] % 10000;
                const rates = config.rarity_rates;
                let rarity = 'rare';
                if (rVal < rates.rare) rarity = 'rare';
                else if (rVal < rates.rare + rates.super) rarity = 'super';
                else if (rVal < rates.rare + rates.super + rates.uber) rarity = 'uber';
                else if (rVal < rates.rare + rates.super + rates.uber + rates.legend) rarity = 'legend';
                if (poolsToCheck[rarity]) {
                    const targetPool = config.pool[rarity];
                    const cid = targetPool[seeds[n + 1] % targetPool.length].id;
                    if (missingTargets.has(cid)) {
                        resultMap.set(cid, { 
                            name: gachaMasterData.cats[cid]?.name || cid, hits: [], isLegend: (rarity === 'legend'), 
                            isNew: String(cid).startsWith('sim-new-'),
                            isLimited: limitedSet.has(cid) || limitedSet.has(String(cid)),
                            isExtended: true 
                        });
                        resultMap.get(cid).hits.push(`${Math.floor(n / 2) + 1}${n % 2 === 0 ? 'A' : 'B'}`);
                        missingTargets.delete(cid);
                    }
                }
            }
        }
        
        missingTargets.forEach(cid => {
            resultMap.set(cid, { 
                name: gachaMasterData.cats[cid]?.name || cid, hits: ["9999+"], isLegend: false, isNew: String(cid).startsWith('sim-new-'), isLimited: false 
            });
        });

        if (resultMap.size === 0) return;
        let listItems = Array.from(resultMap.entries()).map(([id, data]) => ({ id, ...data }));

        listItems.sort((a, b) => {
            const idxA = prioritizedFindIds.indexOf(a.id);
            const idxB = prioritizedFindIds.indexOf(b.id);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            const idA = String(a.id), idB = String(b.id);
            const isNewA = idA.startsWith('sim-new-'), isNewB = idB.startsWith('sim-new-');
            if (isNewA && !isNewB) return -1;
            if (!isNewA && isNewB) return 1;
            if (isNewA && isNewB) return parseInt(idB.replace('sim-new-', '')) - parseInt(idA.replace('sim-new-', ''));
            return parseInt(idB) - parseInt(idA);
        });

        const itemHtmls = listItems.map(data => {
            let nameStyle = 'font-weight:bold; font-size: 0.9em; cursor:pointer;'; 
            if (data.isNew) nameStyle += ' color:#007bff;'; 
            else if (data.isLegend) nameStyle += ' color:#e91e63;'; 
            else if (data.isLimited) nameStyle += ' color:#d35400;'; 
            else nameStyle += ' color:#333;'; 

            const hitLinks = data.hits.map(addr => {
                if (addr === "9999+") return `<span style="color:#999; font-weight:normal;">${addr}</span>`;
                const row = parseInt(addr), sIdx = (row - 1) * 2 + (addr.endsWith('B')?1:0);
                if (row > 2000) return `<span style="margin-right:4px; color: #999; font-size: 0.9em;">${addr}</span>`;
                return `<span class="char-link" style="cursor:pointer; text-decoration:underline; margin-right:4px;" onclick="onGachaCellClick(${sIdx}, '${config.id}', '${data.name.replace(/'/g, "\\'")}', null, true, '${data.id}')">${addr}</span>`;
            }).join("");
            
            const otherBtn = `<span onclick="searchInAllGachas('${data.id}', '${data.name.replace(/'/g, "\\'")}')" style="cursor:pointer; margin-left:8px; color:#009688; font-size:0.8em; text-decoration:underline;" title="他ガチャを検索">other</span>`;
            return `<div style="margin-bottom: 2px; line-height: 1.3;"><span onclick="toggleCharVisibility('${data.id}')" style="cursor:pointer; margin-right:6px; color:#999; font-weight:bold;">×</span><span style="${nameStyle}" onclick="prioritizeChar('${data.id}')">${data.name}</span>: <span style="font-size: 0.85em; color: #555;">${hitLinks}${otherBtn}</span></div>`;
        });

        summaryHtml += `<div style="margin-bottom: 8px;"><div style="font-weight: bold; background: #eee; padding: 2px 5px; margin-bottom: 3px; font-size: 0.85em;">${config.name}</div><div style="font-family: monospace; font-size: 1em;">${itemHtmls.join('')}</div></div>`;
    });

    if (globalSearchResults) {
        summaryHtml += `<div style="margin-top: 15px; padding-top: 10px; border-top: 2px solid #009688;">
            <div style="font-weight:bold; color:#009688; margin-bottom:5px; font-size:0.9em;">他ガチャでの「${globalSearchResults.charName}」出現位置:</div>`;
        if (globalSearchResults.results.length === 0) {
            summaryHtml += `<div style="font-size:0.85em; color:#999; padding-left:5px;">他のガチャには出現しませんでした。</div>`;
        } else {
            globalSearchResults.results.forEach(res => {
                const displayHits = res.hits.map(h => {
                    if (h === "9999+") return `<span style="color:#999; font-weight:normal;">${h}</span>`;
                    return h;
                }).join(", ");
                summaryHtml += `<div style="font-size:0.85em; margin-bottom:2px; padding-left:5px;"><span style="color:#666;">${res.gachaName}:</span> <span style="font-family:monospace; font-weight:bold;">${displayHits}</span></div>`;
            });
        }
        summaryHtml += `</div>`;
    }

    summaryHtml += '</div>';
    return summaryHtml;
}