/**
 * ui_target_handler.js
 * Find機能（ターゲット指定、表示/非表示切り替え）のロジック
 */

// 自動ターゲット対象かどうか
// 変更: 伝説レア・限定キャラを除外し、手動追加（sim-new）のみを自動対象とする
function isAutomaticTarget(charId) {
    const idStr = String(charId);
    if (idStr.startsWith('sim-new-')) return true;
    
    // 以前のロジック（限定・伝説を自動対象とする）を無効化
    return false;
}

// キャラクターの表示/非表示トグル（Findリストやマスター情報からのクリック）
function toggleCharVisibility(charId) {
    let idVal = charId;
    if (!isNaN(parseInt(charId)) && !String(charId).includes('sim-new')) {
        idVal = parseInt(charId);
    }
    
    if (isAutomaticTarget(idVal)) {
        // 自動ターゲット（sim-new等）は hidden リストで管理（デフォルト表示→非表示にする）
        if (hiddenFindIds.has(idVal)) hiddenFindIds.delete(idVal);
        else hiddenFindIds.add(idVal);
    } else {
        // 手動ターゲット（伝説・限定含む）は userTarget リストで管理（デフォルト非表示→表示にする）
        if (userTargetIds.has(idVal)) userTargetIds.delete(idVal);
        else userTargetIds.add(idVal);
    }
    
    // テーブルとFindエリアの更新
    if (typeof generateRollsTable === 'function') generateRollsTable();
    // マスター情報の表示更新（ハイライト切り替えのため追加）
    if (typeof updateMasterInfoView === 'function') updateMasterInfoView();
}

// ターゲット一括操作: 全消去 (×ボタン)
function clearAllTargets() {
    const uniqueIds = [...new Set(tableGachaIds.map(idStr => {
        let id = idStr;
        if (id.endsWith('f') || id.endsWith('s') || id.endsWith('g')) id = id.slice(0, -1);
        return id;
    }))];
    
    uniqueIds.forEach(id => {
        // 追加キャラ(sim-new)を隠す
        const colIndex = tableGachaIds.findIndex(tid => tid.startsWith(id));
        const addCount = (colIndex >= 0 && uberAdditionCounts[colIndex]) ? uberAdditionCounts[colIndex] : 0;
        for(let k=1; k<=addCount; k++){
           hiddenFindIds.add(`sim-new-${k}`);
        }
    });

    // 手動ターゲットリスト（伝説・限定含む）を空にする
    userTargetIds.clear();
    
    if (typeof generateRollsTable === 'function') generateRollsTable();
    if (typeof updateMasterInfoView === 'function') updateMasterInfoView();
}

// ターゲット一括操作: 伝説トグル
// 変更: 現在の状態を確認し、全て選択済みなら解除、それ以外なら全選択を行う
function toggleLegendTargets() {
    const uniqueIds = [...new Set(tableGachaIds.map(idStr => {
        let id = idStr;
        if (id.endsWith('f') || id.endsWith('s') || id.endsWith('g')) id = id.slice(0, -1);
        return id;
    }))];

    // まず対象となるIDを全て収集
    let allLegendIds = [];
    uniqueIds.forEach(id => {
        const config = gachaMasterData.gachas[id];
        if (!config || !config.pool.legend) return;
        config.pool.legend.forEach(c => {
            allLegendIds.push(c.id);
        });
    });

    if (allLegendIds.length === 0) return;

    // 現在全て選択されているかチェック
    const isAllSelected = allLegendIds.every(cid => userTargetIds.has(cid));

    if (isAllSelected) {
        // 全て選択済み -> 全解除
        allLegendIds.forEach(cid => userTargetIds.delete(cid));
    } else {
        // 未選択がある -> 全選択
        allLegendIds.forEach(cid => userTargetIds.add(cid));
        // もしHiddenに入っていたら削除（自動ターゲットの場合の保険）
        allLegendIds.forEach(cid => {
             if (hiddenFindIds.has(cid)) hiddenFindIds.delete(cid);
        });
    }

    if (typeof generateRollsTable === 'function') generateRollsTable();
    if (typeof updateMasterInfoView === 'function') updateMasterInfoView();
}

// ターゲット一括操作: 限定トグル
// 変更: 現在の状態を確認し、全て選択済みなら解除、それ以外なら全選択を行う
function toggleLimitedTargets() {
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

    // まず対象となるIDを全て収集
    let allLimitedIds = [];
    uniqueIds.forEach(id => {
        const config = gachaMasterData.gachas[id];
        if (!config) return;
        ['rare', 'super', 'uber'].forEach(r => {
            if (config.pool[r]) {
                config.pool[r].forEach(c => {
                    const cid = c.id;
                    const cStr = String(cid);
                    if (limitedSet.has(cid) || limitedSet.has(cStr)) {
                        allLimitedIds.push(cid);
                    }
                });
            }
        });
    });

    if (allLimitedIds.length === 0) return;

    // 現在全て選択されているかチェック
    const isAllSelected = allLimitedIds.every(cid => userTargetIds.has(cid));

    if (isAllSelected) {
        // 全て選択済み -> 全解除
        allLimitedIds.forEach(cid => userTargetIds.delete(cid));
    } else {
        // 未選択がある -> 全選択
        allLimitedIds.forEach(cid => userTargetIds.add(cid));
        // もしHiddenに入っていたら削除
        allLimitedIds.forEach(cid => {
             if (hiddenFindIds.has(cid)) hiddenFindIds.delete(cid);
             if (hiddenFindIds.has(String(cid))) hiddenFindIds.delete(String(cid));
        });
    }

    if (typeof generateRollsTable === 'function') generateRollsTable();
    if (typeof updateMasterInfoView === 'function') updateMasterInfoView();
}