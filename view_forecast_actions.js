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
    const idx = prioritizedFindIds.indexOf(cid);
    if (idx !== -1) prioritizedFindIds.splice(idx, 1);
    prioritizedFindIds.unshift(cid);
    if (typeof generateRollsTable === 'function') generateRollsTable();
}