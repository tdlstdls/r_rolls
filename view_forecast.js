/** @file view_forecast.js @description Find（高速予報）エリアおよび操作ボタンのHTML生成を担当 @dependency logic.js, ui_target_handler.js */

function generateFastForecast(initialSeed, columnConfigs) {
    const scanRows = 2000;
    const extendedScanRows = 10000; // 2000件で見つからない場合の最大検索範囲
    const requiredSeeds = extendedScanRows * 2 + 10;
    const seeds = new Uint32Array(requiredSeeds);
    const rng = new Xorshift32(initialSeed);
    for (let i = 0; i < requiredSeeds; i++) {
        seeds[i] = rng.next();
    }

    const visibilityClass = (typeof showFindInfo !== 'undefined' && showFindInfo) ? '' : 'hidden';
    let summaryHtml = `<div id="forecast-summary-area" class="forecast-summary-container ${visibilityClass}" style="margin-bottom: 0; padding: 10px; background: #fdfdfd; border: 1px solid #ddd; border-bottom: none; border-radius: 4px 4px 0 0;">`;

    const legendSlots = [];
    const promotedSlots = []; 
    // 伝説・昇格枠の予報は2000件固定
    for (let n = 0; n < scanRows * 2; n++) {
        const val = seeds[n] % 10000;
        const row = Math.floor(n / 2) + 1;
        const side = (n % 2 === 0) ? 'A' : 'B';
        const addr = `${row}${side}`; 
        if (val >= 9970) {
            legendSlots.push(addr);
        } else if (val >= 9940) {
            promotedSlots.push(addr);
        }
    }

    const legendStr = legendSlots.length > 0 ? legendSlots.join(", ") : "なし";
    const promotedStr = promotedSlots.length > 0 ? promotedSlots.join(", ") : "なし";

    summaryHtml += `
        <div style="margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px dashed #eee; font-size: 0.85em;">
            <div style="margin-bottom: 4px;">
                <span style="font-weight:bold; color:#e91e63; background:#ffe0eb; padding:1px 4px; border-radius:3px;">伝説枠</span>
                <span style="font-family: monospace; margin-left: 5px;">${legendStr}</span>
            </div>
            <div>
                <span style="font-weight:bold; color:#9c27b0; background:#f3e5f5; padding:1px 4px; border-radius:3px;">昇格枠</span>
                <span style="font-family: monospace; margin-left: 5px;">${promotedStr}</span>
            </div>
        </div>
    `;

    const processedGachaIdsForBtn = new Set();
    let availableLegendIds = [];
    let availableLimitedIds = [];
    const limitedSet = new Set();
    if (typeof limitedCats !== 'undefined' && Array.isArray(limitedCats)) {
        limitedCats.forEach(id => { limitedSet.add(id); limitedSet.add(String(id)); });
    }

    columnConfigs.forEach((config) => {
        if (!config || processedGachaIdsForBtn.has(config.id)) return;
        processedGachaIdsForBtn.add(config.id);

        if (config.pool.legend) {
            config.pool.legend.forEach(c => availableLegendIds.push(c.id));
        }
        ['rare', 'super', 'uber'].forEach(r => {
            if (config.pool[r]) {
                config.pool[r].forEach(c => {
                    if (limitedSet.has(c.id) || limitedSet.has(String(c.id))) {
                        availableLimitedIds.push(c.id);
                    }
                });
            }
        });
    });

    const isLegendActive = (availableLegendIds.length > 0) && availableLegendIds.every(cid => userTargetIds.has(cid));
    const isLimitedActive = (availableLimitedIds.length > 0) && availableLimitedIds.every(cid => userTargetIds.has(cid));
    const isMasterActive = (typeof isMasterInfoVisible !== 'undefined') ? isMasterInfoVisible : true;

    const legendBtnClass = isLegendActive ? 'text-btn active' : 'text-btn';
    const limitedBtnClass = isLimitedActive ? 'text-btn active' : 'text-btn';
    const masterBtnClass = isMasterActive ? 'text-btn active' : 'text-btn';

    summaryHtml += `
        <div style="margin-bottom: 10px; text-align: left;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span onclick="clearAllTargets()" class="text-btn" title="全て非表示">×</span>
                <span class="separator">|</span>
                <span onclick="toggleLegendTargets()" class="${legendBtnClass}">伝説</span>
                <span class="separator">|</span>
                <span onclick="toggleLimitedTargets()" class="${limitedBtnClass}">限定</span>
                <span class="separator">|</span>
                <span id="toggle-master-info-btn" onclick="toggleMasterInfo()" class="${masterBtnClass}">マスター</span>
                <span style="font-size: 0.8em; color: #666; margin-left: auto;">Target List</span>
            </div>
            <div style="font-size: 0.75em; color: #666; padding-left: 2px;">
                ※マスターリスト内のキャラ名をタップ（クリック）すると、そのキャラを「Find」ターゲットとして登録/解除できます。
            </div>
        </div>
    `;

    const processedGachaIds = new Set();
    const anniversarySet = new Set();
    if (typeof AnniversaryLimited !== 'undefined' && Array.isArray(AnniversaryLimited)) {
        AnniversaryLimited.forEach(id => { anniversarySet.add(id); anniversarySet.add(String(id)); });
    }

    columnConfigs.forEach((config) => {
        if (!config || processedGachaIds.has(config.id)) return;
        processedGachaIds.add(config.id);

        const targetIds = new Set();
        const poolsToCheck = { legend: false, rare: false, super: false, uber: false };

        ['legend', 'rare', 'super', 'uber'].forEach(r => {
            if (config.pool[r] && config.pool[r].length > 0) {
                config.pool[r].forEach(charObj => {
                    const cid = charObj.id;
                    const idStr = String(cid);
                    const isAuto = idStr.startsWith('sim-new-');
                    const isHidden = hiddenFindIds.has(cid) || hiddenFindIds.has(idStr);
                    const isManual = userTargetIds.has(cid) || userTargetIds.has(parseInt(cid));

                    if ((isAuto && !isHidden) || isManual) {
                        targetIds.add(cid);
                        poolsToCheck[r] = true;
                    }
                });
            }
        });

        if (targetIds.size === 0) return;

        const resultMap = new Map();
        const missingTargets = new Set(targetIds); 

        // 1. 通常検索（0-2000件）
        for (let n = 0; n < scanRows * 2; n++) {
            const s0 = seeds[n];
            const rVal = s0 % 10000;
            const rates = config.rarity_rates;
            let rarity = 'rare'; 
            if (rVal < rates.rare) rarity = 'rare';
            else if (rVal < rates.rare + rates.super) rarity = 'super';
            else if (rVal < rates.rare + rates.super + rates.uber) rarity = 'uber';
            else if (rVal < rates.rare + rates.super + rates.uber + rates.legend) rarity = 'legend';

            if (poolsToCheck[rarity]) {
                const targetPool = config.pool[rarity];
                const s1 = seeds[n + 1];
                const slot = s1 % targetPool.length;
                const charObj = targetPool[slot];
                const cid = charObj.id;
                
                if (targetIds.has(cid)) {
                    if (!resultMap.has(cid)) {
                        resultMap.set(cid, { 
                            name: charObj.name, hits: [], isLegend: (rarity === 'legend'), 
                            isNew: String(cid).startsWith('sim-new-'),
                            isLimited: limitedSet.has(cid) || limitedSet.has(String(cid)),
                            isAnniversary: anniversarySet.has(cid) || anniversarySet.has(String(cid))
                        });
                        missingTargets.delete(cid); 
                    }
                    const row = Math.floor(n / 2) + 1;
                    const side = (n % 2 === 0) ? 'A' : 'B';
                    resultMap.get(cid).hits.push(`${row}${side}`);
                }
            }
        }

        // 2. 延長検索（2000件で見つかっていないターゲットを最大1万件まで探す）
        if (missingTargets.size > 0) {
            for (let n = scanRows * 2; n < extendedScanRows * 2; n++) {
                if (missingTargets.size === 0) break;

                const s0 = seeds[n];
                const rVal = s0 % 10000;
                const rates = config.rarity_rates;
                let rarity = 'rare'; 
                if (rVal < rates.rare) rarity = 'rare';
                else if (rVal < rates.rare + rates.super) rarity = 'super';
                else if (rVal < rates.rare + rates.super + rates.uber) rarity = 'uber';
                else if (rVal < rates.rare + rates.super + rates.uber + rates.legend) rarity = 'legend';

                if (poolsToCheck[rarity]) {
                    const targetPool = config.pool[rarity];
                    const s1 = seeds[n + 1];
                    const slot = s1 % targetPool.length;
                    const charObj = targetPool[slot];
                    const cid = charObj.id;

                    if (missingTargets.has(cid)) {
                        resultMap.set(cid, { 
                            name: charObj.name, hits: [], isLegend: (rarity === 'legend'), 
                            isNew: String(cid).startsWith('sim-new-'),
                            isLimited: limitedSet.has(cid) || limitedSet.has(String(cid)),
                            isAnniversary: anniversarySet.has(cid) || anniversarySet.has(String(cid)),
                            isExtended: true 
                        });
                        const row = Math.floor(n / 2) + 1;
                        const side = (n % 2 === 0) ? 'A' : 'B';
                        resultMap.get(cid).hits.push(`${row}${side}`);
                        missingTargets.delete(cid);
                    }
                }
            }
        }

        if (resultMap.size === 0) return;

        let listItems = [];
        resultMap.forEach((data, id) => {
            data.id = id;
            listItems.push(data);
        });

        listItems.sort((a, b) => {
            const getPriority = (item) => {
                if (item.isNew) return 1;
                if (item.isLegend && item.isLimited) return 2;
                if (item.isLegend) return 3;
                if (item.isAnniversary) return 4;
                if (item.isLimited) return 5;
                return 6; 
            };
            const pA = getPriority(a);
            const pB = getPriority(b);
            if (pA !== pB) return pA - pB;
            if (pA === 1) {
                const nA = parseInt(String(a.id).replace('sim-new-', ''), 10);
                const nB = parseInt(String(b.id).replace('sim-new-', ''), 10);
                return nB - nA;
            }
            if (pA >= 2 && pA <= 5) return parseInt(b.id) - parseInt(a.id);
            const firstHitA = parseInt(a.hits[0]);
            const firstHitB = parseInt(b.hits[0]);
            return firstHitA - firstHitB;
        });

        const itemHtmls = listItems.map(data => {
            let nameStyle = 'font-weight:bold; font-size: 0.9em;'; 
            if (data.isNew) nameStyle += ' color:#007bff;'; 
            else if (data.isLegend) nameStyle += ' color:#e91e63;'; 
            else if (data.isLimited) nameStyle += ' color:#d35400;'; 
            else nameStyle += ' color:#333;'; 

            const hitLinks = data.hits.map(addr => {
                const row = parseInt(addr);
                const side = addr.endsWith('B') ? 1 : 0;
                const sIdx = (row - 1) * 2 + side;
                const escapedName = data.name.replace(/'/g, "\\'");
                
                // --- 変更箇所: 2000番を超える場合はリンクにせずテキストのみにする ---
                if (row > 2000) {
                    return `<span style="margin-right:4px; color: #999; font-size: 0.9em;">${addr}</span>`;
                } else {
                    return `<span class="char-link" style="cursor:pointer; text-decoration:underline; margin-right:4px;" 
                                 onclick="onGachaCellClick(${sIdx}, '${config.id}', '${escapedName}', null, true, '${data.id}')">${addr}</span>`;
                }
            }).join("");

            const closeBtn = `<span onclick="toggleCharVisibility('${data.id}')" style="cursor:pointer; margin-right:6px; color:#999; font-weight:bold; font-size:1em;" title="非表示にする">×</span>`;
            return `<div style="margin-bottom: 2px; line-height: 1.3;">${closeBtn}<span style="${nameStyle}">${data.name}</span>: <span style="font-size: 0.85em; color: #555;">${hitLinks}</span></div>`;
        });

        summaryHtml += `<div style="margin-bottom: 8px;">
            <div style="font-weight: bold; background: #eee; padding: 2px 5px; margin-bottom: 3px; font-size: 0.85em;">
                ${config.name} (ID:${config.id})
            </div>
            <div style="font-family: monospace; font-size: 1em;">
                ${itemHtmls.join('')}
            </div>
        </div>`;
    });

    summaryHtml += '</div>';
    return summaryHtml;
}