/** @file view_forecast_actions.js @description Find機能のユーザー操作担当 */

function toggleLegendTargets() {
    const columnConfigs = prepareColumnConfigs();
    const status = getAvailableSpecialTargets(columnConfigs);
    const ids = status.availableLegendIds;
    if (status.isLegendActive) {
        ids.forEach(id => hiddenFindIds.add(id));
    } else {
        ids.forEach(id => hiddenFindIds.delete(id));
    }
    if (typeof generateRollsTable === 'function') generateRollsTable();
}

function toggleLimitedTargets() {
    const columnConfigs = prepareColumnConfigs();
    const status = getAvailableSpecialTargets(columnConfigs);
    const ids = status.availableLimitedIds;
    if (status.isLimitedActive) {
        ids.forEach(id => hiddenFindIds.add(id));
    } else {
        ids.forEach(id => hiddenFindIds.delete(id));
    }
    if (typeof generateRollsTable === 'function') generateRollsTable();
}

function toggleUberTargets() {
    const columnConfigs = prepareColumnConfigs();
    const status = getAvailableSpecialTargets(columnConfigs);
    const ids = status.availableUberIds;

    // isUberActiveは、userTargetIdsにIDが一つでもあればtrueになる
    if (status.isUberActive) {
        // ON -> OFF : userTargetIdsから全ての超激レアを削除
        ids.forEach(id => userTargetIds.delete(id));
    } else {
        // OFF -> ON : userTargetIdsに全ての超激レアを追加
        ids.forEach(id => userTargetIds.add(id));
        // 同時に限定もONにする（hiddenFindIdsから限定IDを削除する）
        const limitedIds = status.availableLimitedIds;
        limitedIds.forEach(id => hiddenFindIds.delete(id));
    }
    if (typeof generateRollsTable === 'function') generateRollsTable();
}

function toggleCharVisibility(id) {
    const cid = isNaN(id) ? id : parseInt(id);
    if (hiddenFindIds.has(cid)) {
        hiddenFindIds.delete(cid);
    } else {
        hiddenFindIds.add(cid);
        userTargetIds.delete(cid);
    }
    if (typeof generateRollsTable === 'function') generateRollsTable();
}

function prioritizeChar(id) {
    const cid = isNaN(id) ? id : parseInt(id);

    const idx = userPrioritizedTargets.indexOf(cid);
    const pIdx = prioritizedFindIds.indexOf(cid);

    // すでに優先リストに含まれている場合は、リストから削除（優先解除）
    if (idx > -1) {
        userPrioritizedTargets.splice(idx, 1);
        if (pIdx > -1) {
            prioritizedFindIds.splice(pIdx, 1);
        }
    } else {
        // 優先リストに含まれていない場合は、リストの先頭に追加（優先指定）
        userPrioritizedTargets.unshift(cid);
        if (pIdx > -1) { // 念のため古いリストでも重複を避ける
            prioritizedFindIds.splice(pIdx, 1);
        }
        prioritizedFindIds.unshift(cid);
    }
    
    if (typeof generateRollsTable === 'function') generateRollsTable();
}