/** @file ui_target_handler.js @description Find機能のターゲット指定（伝説・限定）の管理を担当 @dependency ui_globals.js, view_table.js */

// 自動ターゲット対象かどうか
function isAutomaticTarget(charId) {
    const idStr = String(charId);
    if (idStr.startsWith('sim-new-')) return true;
    if (typeof limitedCats !== 'undefined' && Array.isArray(limitedCats)) {
        if (limitedCats.includes(charId) || limitedCats.includes(parseInt(charId)) || limitedCats.includes(idStr)) {
            return true;
        }
    }
    if (typeof gachaMasterData !== 'undefined' && gachaMasterData.cats && gachaMasterData.cats[charId]) {
        if (gachaMasterData.cats[charId].rarity === 'legend') {
            return true;
        }
    }
    return false;
}

/** 他の全ガチャシリーズから当該キャラを検索する (10000件検索・最新ID版) */
function searchInAllGachas(charId, charName) {
    let currentSeed = null;
    if (typeof finalSeedForUpdate !== 'undefined' && finalSeedForUpdate !== null) {
        currentSeed = finalSeedForUpdate;
    }
    if (!currentSeed) {
        const potentialIds = ['seed-input', 'seed', 'input-seed'];
        for (const id of potentialIds) {
            const el = document.getElementById(id);
            if (el && el.value) {
                const val = parseInt(el.value, 10);
                if (!isNaN(val)) {
                    currentSeed = val;
                    break;
                }
            }
        }
    }

    if (currentSeed === null || isNaN(currentSeed)) {
        alert("シード値が有効ではありません。テーブルが表示されているか、シード入力欄が空でないか確認してください。");
        return;
    }

    const currentTableIds = new Set(tableGachaIds.map(tid => {
        let id = tid;
        if (id.endsWith('f') || id.endsWith('s') || id.endsWith('g')) id = id.slice(0, -1);
        return id;
    }));

    const bestMatchesByName = new Map();
    const scanRowsLimit = 10000;
    const seeds = new Uint32Array(scanRowsLimit * 2 + 10);
    const rng = new Xorshift32(currentSeed);
    for (let i = 0; i < seeds.length; i++) seeds[i] = rng.next();

    Object.keys(gachaMasterData.gachas).forEach(gachaId => {
        if (currentTableIds.has(gachaId)) return;
        const config = gachaMasterData.gachas[gachaId];
        const gachaName = config.name;
        
        const targetPools = [];
        ['legend', 'uber', 'super', 'rare'].forEach(r => {
            if (config.pool[r]) {
                const idx = config.pool[r].findIndex(c => String(c.id) === String(charId));
                if (idx !== -1) targetPools.push({ rarity: r, pool: config.pool[r] });
            }
        });
        if (targetPools.length === 0) return;
        const existing = bestMatchesByName.get(gachaName);
        if (existing && parseInt(gachaId) <= parseInt(existing.id)) return;

        const hits = [];
        for (let n = 0; n < scanRowsLimit * 2; n++) {
            const rVal = seeds[n] % 10000;
            const rates = config.rarity_rates;
            let rarity = 'rare';
            if (rVal < rates.rare) rarity = 'rare';
            else if (rVal < rates.rare + rates.super) rarity = 'super';
            else if (rVal < rates.rare + rates.super + rates.uber) rarity = 'uber';
            else if (rVal < rates.rare + rates.super + rates.uber + rates.legend) rarity = 'legend';
            const target = targetPools.find(p => p.rarity === rarity);
            if (target) {
                const slot = seeds[n + 1] % target.pool.length;
                if (String(target.pool[slot].id) === String(charId)) {
                    hits.push(`${Math.floor(n / 2) + 1}${n % 2 === 0 ? 'A' : 'B'}`);
                    if (hits.length >= 3) break;
                }
            }
        }
        if (hits.length === 0) hits.push("9999+");
        bestMatchesByName.set(gachaName, { id: gachaId, gachaName: gachaName, hits: hits });
    });

    globalSearchResults = { charName: charName, results: Array.from(bestMatchesByName.values()) };
    if (typeof generateRollsTable === 'function') generateRollsTable();
}

/** キャラクターを最優先表示に設定する（履歴を保持） */
function prioritizeChar(charId) {
    let idVal = charId;
    if (!isNaN(parseInt(charId)) && !String(charId).includes('sim-new')) {
        idVal = parseInt(charId);
    }
    prioritizedFindIds = prioritizedFindIds.filter(id => id !== idVal);
    prioritizedFindIds.unshift(idVal);
    if (typeof generateRollsTable === 'function') generateRollsTable();
}

/** キャラクターの表示/非表示トグル (Xボタン) */
function toggleCharVisibility(charId) {
    let idVal = charId;
    if (!isNaN(parseInt(charId)) && !String(charId).includes('sim-new')) {
        idVal = parseInt(charId);
    }
    if (isAutomaticTarget(idVal)) {
        if (hiddenFindIds.has(idVal)) {
            hiddenFindIds.delete(idVal);
            prioritizeChar(idVal);
        } else {
            hiddenFindIds.add(idVal);
            // 個別に消した時だけ履歴から削除
            prioritizedFindIds = prioritizedFindIds.filter(id => id !== idVal);
        }
    } else {
        if (userTargetIds.has(idVal)) {
            userTargetIds.delete(idVal);
            prioritizedFindIds = prioritizedFindIds.filter(id => id !== idVal);
        } else {
            userTargetIds.add(idVal);
            prioritizeChar(idVal);
        }
    }
    if (typeof generateRollsTable === 'function') generateRollsTable();
    if (typeof updateMasterInfoView === 'function') updateMasterInfoView();
}

/** 全ターゲット消去 (×ボタン) */
function clearAllTargets() {
    prioritizedFindIds = [];
    globalSearchResults = null; 
    const uniqueIds = [...new Set(tableGachaIds.map(idStr => {
        let id = idStr;
        if (id.endsWith('f') || id.endsWith('s') || id.endsWith('g')) id = id.slice(0, -1);
        return id;
    }))];
    uniqueIds.forEach(id => {
        const config = gachaMasterData.gachas[id];
        if (!config) return;
        ['legend', 'rare', 'super', 'uber'].forEach(r => {
            if (config.pool[r]) config.pool[r].forEach(c => { if (isAutomaticTarget(c.id)) hiddenFindIds.add(c.id); });
        });
        const colIndex = tableGachaIds.findIndex(tid => tid.startsWith(id));
        const addCount = (colIndex >= 0 && uberAdditionCounts[colIndex]) ? uberAdditionCounts[colIndex] : 0;
        for(let k=1; k<=addCount; k++){ hiddenFindIds.add(`sim-new-${k}`); }
    });
    userTargetIds.clear();
    if (typeof generateRollsTable === 'function') generateRollsTable();
    if (typeof updateMasterInfoView === 'function') updateMasterInfoView();
}

/** 伝説トグルボタン操作 */
function toggleLegendTargets() {
    const uniqueIds = [...new Set(tableGachaIds.map(idStr => {
        let id = idStr.replace(/[gfs]$/, '');
        return id;
    }))];
    let allLegendIds = [];
    uniqueIds.forEach(id => {
        const config = gachaMasterData.gachas[id];
        if (!config || !config.pool.legend) return;
        config.pool.legend.forEach(c => allLegendIds.push(c.id));
    });
    if (allLegendIds.length === 0) return;
    const anyVisible = allLegendIds.some(cid => !hiddenFindIds.has(cid));
    if (anyVisible) {
        allLegendIds.forEach(cid => { 
            hiddenFindIds.add(cid);
            // 修正: 優先リストからは削除しない
        });
    } else {
        allLegendIds.forEach(cid => hiddenFindIds.delete(cid));
    }
    if (typeof generateRollsTable === 'function') generateRollsTable();
    if (typeof updateMasterInfoView === 'function') updateMasterInfoView();
}

/** 限定トグルボタン操作 */
function toggleLimitedTargets() {
    const uniqueIds = [...new Set(tableGachaIds.map(idStr => {
        let id = idStr.replace(/[gfs]$/, '');
        return id;
    }))];
    const limitedSet = new Set();
    if (typeof limitedCats !== 'undefined' && Array.isArray(limitedCats)) {
        limitedCats.forEach(id => { limitedSet.add(id); limitedSet.add(String(id)); });
    }
    let allLimitedIds = [];
    uniqueIds.forEach(id => {
        const config = gachaMasterData.gachas[id];
        if (!config) return;
        ['rare', 'super', 'uber'].forEach(r => {
            if (config.pool[r]) config.pool[r].forEach(c => { if (limitedSet.has(c.id) || limitedSet.has(String(c.id))) allLimitedIds.push(c.id); });
        });
    });
    if (allLimitedIds.length === 0) return;
    const anyVisible = allLimitedIds.some(cid => !hiddenFindIds.has(cid));
    if (anyVisible) {
        allLimitedIds.forEach(cid => { 
            hiddenFindIds.add(cid);
            // 修正: 優先リストからは削除しない
        });
    } else {
        allLimitedIds.forEach(cid => { hiddenFindIds.delete(cid); hiddenFindIds.delete(String(cid)); });
    }
    if (typeof generateRollsTable === 'function') generateRollsTable();
    if (typeof updateMasterInfoView === 'function') updateMasterInfoView();
}