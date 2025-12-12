/**
 * view_forecast.js
 * 「Find (高速予報)」機能のHTML生成を担当
 * 描画用のテーブルデータとは独立して、2000行先まで数値計算のみでスキャンします。
 */

function generateFastForecast(initialSeed, columnConfigs) {
    const scanRows = 2000;
    // 2000行先までチェック
    const requiredSeeds = scanRows * 2 + 10;
    
    // 1. 計算用のシード配列を高速生成
    const seeds = new Uint32Array(requiredSeeds);
    const rng = new Xorshift32(initialSeed);
    for (let i = 0; i < requiredSeeds; i++) {
        seeds[i] = rng.next();
    }

    // IDとクラス(hidden)の動的付与 (showFindInfoはグローバル変数)
    const visibilityClass = (typeof showFindInfo !== 'undefined' && showFindInfo) ? '' : 'hidden';
    let summaryHtml = `<div id="forecast-summary-area" class="forecast-summary-container ${visibilityClass}" style="margin-bottom: 15px; padding: 10px; background: #fdfdfd; border: 1px solid #ddd; border-radius: 4px;">`;
    
    // -------------------------------------------------------------------------
    // 伝説枠・昇格伝説枠の汎用アドレス表示 (共通)
    // -------------------------------------------------------------------------
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
        <div style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #eee;">
            <div style="margin-bottom: 6px;">
                <span style="font-weight:bold; color:#e91e63; background:#ffe0eb; padding:2px 6px; border-radius:3px;">伝説枠 (9970↑)</span>
                <span style="font-family: monospace; font-size: 1.1em; margin-left: 8px;">${legendStr}</span>
            </div>
            <div>
                <span style="font-weight:bold; color:#9c27b0; background:#f3e5f5; padding:2px 6px; border-radius:3px;">昇格伝説枠 (9940-9969)</span>
                <span style="font-family: monospace; font-size: 1.1em; margin-left: 8px;">${promotedStr}</span>
            </div>
        </div>
    `;

    // ▼ 追加: 一括選択解除ボタン
    // isFindListClearedフラグを見てボタンのラベルを変える
    const toggleBtnText = (typeof isFindListCleared !== 'undefined' && isFindListCleared) ? "伝説・限定を表示" : "一括非表示";
    summaryHtml += `
        <div style="margin-bottom: 15px; text-align: left;">
            <button onclick="toggleAllFindVisibility()" class="secondary" style="font-size: 11px; padding: 4px 8px;">${toggleBtnText}</button>
        </div>
    `;

    // -------------------------------------------------------------------------
    // 各ガチャ列ごとのターゲット表示
    // -------------------------------------------------------------------------
    const processedGachaIds = new Set();
    
    // 限定キャラ判定用のSet作成
    const limitedSet = new Set();
    if (typeof limitedCats !== 'undefined' && Array.isArray(limitedCats)) {
        limitedCats.forEach(id => {
            limitedSet.add(id);
            limitedSet.add(String(id));
        });
    }

    // AnniversaryLimited判定用のSet作成
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

        const gachaName = config.name || "";
        if (gachaName.includes("プラチナ") || gachaName.includes("レジェンド")) return;

        // --- 準備: ターゲット情報の整理 ---
        const targetIds = new Set();
        const poolsToCheck = {}; 

        // 1. 伝説レア (自動)
        const hasLegend = (config.rarity_rates.legend > 0 && config.pool.legend && config.pool.legend.length > 0);
        if (hasLegend) {
            config.pool.legend.forEach(c => targetIds.add(c.id));
        }

        // 2. 限定/新規 (自動) および ユーザーターゲット (手動)
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

        // --- 高速スキャン実行 ---
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

                // 非表示リストに含まれている場合はスキップ (自動ターゲットのみ)
                if (hiddenFindIds.has(cid) || hiddenFindIds.has(String(cid))) {
                    continue;
                }

                // ターゲットIDに含まれているか
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

        // --- 結果リストの生成とソート ---
        let listItems = [];
        resultMap.forEach((data, id) => {
            data.id = id;
            listItems.push(data);
        });
        
        // ソート順の定義
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

        // 表示用HTML生成
        const itemHtmls = listItems.map(data => {
            let nameStyle = 'font-weight:bold;';
            if (data.isNew) {
                nameStyle += ' color:#007bff;'; 
            } else if (data.isLegend) {
                nameStyle += ' color:#e91e63;'; 
            } else if (data.isLimited) {
                nameStyle += ' color:#d35400;'; 
            } else {
                nameStyle += ' color:#333;'; 
            }

            const resultStr = data.hits.join(", ");
            // ×ボタン (行頭)
            const closeBtn = `<span onclick="toggleCharVisibility('${data.id}')" style="cursor:pointer; margin-right:8px; color:#999; font-weight:bold; font-size:1.1em;" title="非表示にする">×</span>`;
            
            return `<div style="margin-bottom: 4px;">${closeBtn}<span style="${nameStyle}">${data.name}</span>: ${resultStr}</div>`;
        });

        summaryHtml += `<div style="margin-bottom: 10px;">
            <div style="font-weight: bold; background: #eee; padding: 2px 5px; margin-bottom: 5px; font-size: 0.9em;">
                ${config.name} (ID:${config.id}) - Target List (～${scanRows}行)
            </div>
            <div style="font-family: monospace; font-size: 1.1em; line-height: 1.4;">
                ${itemHtmls.join('')}
            </div>
        </div>`;
    });

    summaryHtml += '</div>';
    return summaryHtml;
}