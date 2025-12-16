// view_forecast.js
/**
 * view_forecast.js
 * 「Find (高速予報)」機能のHTML生成を担当
 */

function generateFastForecast(initialSeed, columnConfigs) {
    const scanRows = 2000;
    const requiredSeeds = scanRows * 2 + 10;
    const seeds = new Uint32Array(requiredSeeds);
    const rng = new Xorshift32(initialSeed);
    for (let i = 0; i < requiredSeeds; i++) {
        seeds[i] = rng.next();
    }

    const visibilityClass = (typeof showFindInfo !== 'undefined' && showFindInfo) ? '' : 'hidden';
    let summaryHtml = `<div id="forecast-summary-area" class="forecast-summary-container ${visibilityClass}" style="margin-bottom: 0; padding: 10px; background: #fdfdfd; border: 1px solid #ddd; border-bottom: none; border-radius: 4px 4px 0 0;">`;

    const legendSlots = [];
    const promotedSlots = []; 
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
    
    // ▼▼▼ ボタンエリア変更: [×] [伝説] [限定] ▼▼▼
    summaryHtml += `
        <div style="margin-bottom: 10px; text-align: left; display: flex; align-items: center; gap: 5px;">
            <button onclick="clearAllTargets()" class="secondary" style="font-size: 11px; padding: 2px 8px;" title="全て非表示">×</button>
            <button onclick="activateLegendTargets()" class="secondary" style="font-size: 11px; padding: 2px 8px; background-color: #ffb6c1; color: #333; border: 1px solid #ccc;">伝説</button>
            <button onclick="activateLimitedTargets()" class="secondary" style="font-size: 11px; padding: 2px 8px; background-color: #e0f7fa; color: #333; border: 1px solid #ccc;">限定</button>
            <span style="font-size: 0.8em; color: #666; margin-left: auto;">Target List (～${scanRows})</span>
        </div>
    `;

    const processedGachaIds = new Set();
    const limitedSet = new Set();
    if (typeof limitedCats !== 'undefined' && Array.isArray(limitedCats)) {
        limitedCats.forEach(id => {
            limitedSet.add(id);
            limitedSet.add(String(id));
        });
    }

    const anniversarySet = new Set();
    if (typeof AnniversaryLimited !== 'undefined' && Array.isArray(AnniversaryLimited)) {
        AnniversaryLimited.forEach(id => {
            anniversarySet.add(id);
            anniversarySet.add(String(id));
        });
    }

    columnConfigs.forEach((config, colIndex) => {
        if (!config) return;
        if (processedGachaIds.has(config.id)) return;
        processedGachaIds.add(config.id);

        const targetIds = new Set();
        const poolsToCheck = {}; 

        const hasLegend = (config.rarity_rates.legend > 0 && config.pool.legend && config.pool.legend.length > 0);
        if (hasLegend) {
            config.pool.legend.forEach(c => targetIds.add(c.id));
        }

        ['rare', 'super', 'uber'].forEach(r => {
            if (config.pool[r] && config.pool[r].length > 0) {
                 config.pool[r].forEach(charObj => {
                    const cid = charObj.id;
                    const cStr = String(cid);
                    const isNew = cStr.startsWith('sim-new-');
                    const isLimited = limitedSet.has(cid) || limitedSet.has(cStr);
                    const isManual = userTargetIds.has(cid) || userTargetIds.has(parseInt(cid));
                    if (isNew || isLimited || isManual) {
                        targetIds.add(cid);
                        poolsToCheck[r] = true;
                    }
                });
            }
        });

        if (!hasLegend && Object.keys(poolsToCheck).length === 0) return;
        
        const resultMap = new Map();
        for (let n = 0; n < scanRows * 2; n++) {
            const s0 = seeds[n];
            const rVal = s0 % 10000;
            const rates = config.rarity_rates;
            let rarity = 'rare'; 
            const rareR = rates.rare;
            const superR = rates.super;
            const uberR = rates.uber;
            const legendR = rates.legend;

            if (rVal < rareR) { rarity = 'rare'; }
            else if (rVal < rareR + superR) { rarity = 'super'; }
            else if (rVal < rareR + superR + uberR) { rarity = 'uber'; }
            else if (rVal < rareR + superR + uberR + legendR) { rarity = 'legend'; }
            else { rarity = 'rare'; }

            let targetPool = null;
            let isLegendRank = false;
            if (rarity === 'legend' && hasLegend) {
                targetPool = config.pool.legend;
                isLegendRank = true;
            } else if (poolsToCheck[rarity]) {
                targetPool = config.pool[rarity];
            }

            if (targetPool) {
                const s1 = seeds[n + 1];
                const slot = s1 % targetPool.length;
                const charObj = targetPool[slot];
                const cid = charObj.id;
                
                if (hiddenFindIds.has(cid) || hiddenFindIds.has(String(cid))) {
                    continue;
                }

                if (isLegendRank || targetIds.has(cid)) {
                    if (!resultMap.has(cid)) {
                        const cStr = String(cid);
                        resultMap.set(cid, { 
                            name: charObj.name, 
                            hits: [], 
                            isLegend: isLegendRank,
                            isNew: cStr.startsWith('sim-new-'),
                            isLimited: limitedSet.has(cid) || limitedSet.has(cStr),
                            isAnniversary: anniversarySet.has(cid) || anniversarySet.has(cStr)
                        });
                    }
                    const row = Math.floor(n / 2) + 1;
                    const side = (n % 2 === 0) ? 'A' : 'B';
                    resultMap.get(cid).hits.push(`${row}${side}`);
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

        // ▼▼▼ リスト表示のフォントサイズ調整 ▼▼▼
        const itemHtmls = listItems.map(data => {
            let nameStyle = 'font-weight:bold; font-size: 0.9em;'; // 名前も少し小さく
            if (data.isNew) nameStyle += ' color:#007bff;'; 
            else if (data.isLegend) nameStyle += ' color:#e91e63;'; 
            else if (data.isLimited) nameStyle += ' color:#d35400;'; 
            else nameStyle += ' color:#333;'; 

            const resultStr = data.hits.join(", ");
            const closeBtn = `<span onclick="toggleCharVisibility('${data.id}')" style="cursor:pointer; margin-right:6px; color:#999; font-weight:bold; font-size:1em;" title="非表示にする">×</span>`;
            
            // アドレス列のフォントサイズを縮小
            return `<div style="margin-bottom: 2px; line-height: 1.3;">${closeBtn}<span style="${nameStyle}">${data.name}</span>: <span style="font-size: 0.85em; color: #555;">${resultStr}</span></div>`;
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