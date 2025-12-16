/**
 * ui_target_handler.js
 * Find機能（ターゲット指定、表示/非表示切り替え）のロジック
 */

// 自動ターゲット対象かどうか（伝説レア、限定キャラなど）
function isAutomaticTarget(charId) {
    const idStr = String(charId);
    if (idStr.startsWith('sim-new-')) return true;
    
    if (typeof limitedCats !== 'undefined' && Array.isArray(limitedCats)) {
        if (limitedCats.includes(charId) || limitedCats.includes(parseInt(charId)) || limitedCats.includes(idStr)) {
            return true;
        }
    }
    
    if (typeof gachaMasterData !== 'undefined' && gachaMasterData.cats) {
        const catInfo = gachaMasterData.cats[charId];
        if (catInfo && catInfo.rarity === 'legend') {
            return true;
        }
    }
    return false;
}

// キャラクターの表示/非表示トグル（Findリストやマスター情報からのクリック）
function toggleCharVisibility(charId) {
    let idVal = charId;
    if (!isNaN(parseInt(charId)) && !String(charId).includes('sim-new')) {
        idVal = parseInt(charId);
    }
    
    if (isAutomaticTarget(idVal)) {
        // 自動ターゲットの場合は hidden リストで管理（デフォルト表示→非表示にする）
        if (hiddenFindIds.has(idVal)) hiddenFindIds.delete(idVal);
        else hiddenFindIds.add(idVal);
    } else {
        // 手動ターゲットの場合は userTarget リストで管理（デフォルト非表示→表示にする）
        if (userTargetIds.has(idVal)) userTargetIds.delete(idVal); 
        else userTargetIds.add(idVal);
    }
    
    if (typeof generateRollsTable === 'function') generateRollsTable();
}

// ターゲット一括操作: 全消去 (×ボタン)
function clearAllTargets() {
    const uniqueIds = [...new Set(tableGachaIds.map(idStr => {
        let id = idStr;
        if (id.endsWith('f') || id.endsWith('s') || id.endsWith('g')) id = id.slice(0, -1);
        return id;
    }))];

    uniqueIds.forEach(id => {
        const config = gachaMasterData.gachas[id];
        if (!config) return;
        ['rare', 'super', 'uber', 'legend'].forEach(r => {
            if (config.pool[r]) {
                config.pool[r].forEach(c => {
                    const cid = c.id;
                    // 自動ターゲットは全てHiddenに追加して隠す
                    if (isAutomaticTarget(cid)) {
                        hiddenFindIds.add(cid);
                    }
                });
            }
        });
        
        // 追加キャラ(sim-new)も隠す
        const colIndex = tableGachaIds.findIndex(tid => tid.startsWith(id));
        const addCount = (colIndex >= 0 && uberAdditionCounts[colIndex]) ? uberAdditionCounts[colIndex] : 0;
        for(let k=1; k<=addCount; k++){
           hiddenFindIds.add(`sim-new-${k}`);
        }
    });

    // 手動ターゲットリストは空にする
    userTargetIds.clear();
    
    if (typeof generateRollsTable === 'function') generateRollsTable();
}

// ターゲット一括操作: 伝説ON
function activateLegendTargets() {
    const uniqueIds = [...new Set(tableGachaIds.map(idStr => {
        let id = idStr;
        if (id.endsWith('f') || id.endsWith('s') || id.endsWith('g')) id = id.slice(0, -1);
        return id;
    }))];

    uniqueIds.forEach(id => {
        const config = gachaMasterData.gachas[id];
        if (!config || !config.pool.legend) return;
        config.pool.legend.forEach(c => {
            const cid = c.id;
            // Hiddenリストから削除 (＝表示状態にする)
            if (hiddenFindIds.has(cid)) hiddenFindIds.delete(cid);
            if (hiddenFindIds.has(String(cid))) hiddenFindIds.delete(String(cid));
        });
    });

    if (typeof generateRollsTable === 'function') generateRollsTable();
}

// ターゲット一括操作: 限定ON
function activateLimitedTargets() {
    const uniqueIds = [...new Set(tableGachaIds.map(idStr => {
        let id = idStr;
        if (id.endsWith('f') || id.endsWith('s') || id.endsWith('g')) id = id.slice(0, -1);
        return id;
    }))];

    const limitedSet = new Set();
    if (typeof limitedCats !== 'undefined' && Array.isArray(limitedCats)) {
        limitedCats.forEach(id => {
            limitedSet.add(id);
            limitedSet.add(String(id));
        });
    }

    uniqueIds.forEach(id => {
        const config = gachaMasterData.gachas[id];
        if (!config) return;
        ['rare', 'super', 'uber'].forEach(r => {
            if (config.pool[r]) {
                config.pool[r].forEach(c => {
                    const cid = c.id;
                    const cStr = String(cid);
                    if (limitedSet.has(cid) || limitedSet.has(cStr)) {
                        if (hiddenFindIds.has(cid)) hiddenFindIds.delete(cid);
                        if (hiddenFindIds.has(cStr)) hiddenFindIds.delete(cStr);
                    }
                });
            }
        });
    });

    if (typeof generateRollsTable === 'function') generateRollsTable();
}