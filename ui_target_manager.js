/** @file ui_target_manager.js @description ターゲット（Find対象）の状態管理 */

function toggleTarget(id, name, rarity) {
    const index = searchTargets.findIndex(t => t.id === id);
    if (index === -1) {
        addTarget({ id, name, rarity });
    } else {
        removeTarget(id);
    }
    updateTargetListUI();
    refreshFindAreaOnly();
}

function addTarget(target) {
    if (!searchTargets.some(t => t.id === target.id)) {
        searchTargets.push(target);
    }
}

function removeTarget(id) {
    searchTargets = searchTargets.filter(t => t.id !== id);
}

function clearAllTargets() {
    searchTargets = [];
    updateTargetListUI();
    generateRollsTable();
}

/**
 * 予報エリア（Findエリア）のみを再描画する内部ヘルパー
 */
function refreshFindAreaOnly() {
    const container = document.getElementById('rolls-table-container');
    if (container && typeof generateFastForecast === 'function') {
        const seedEl = document.getElementById('seed');
        const initialSeed = parseInt(seedEl ? seedEl.value : 12345);
        const columnConfigs = prepareColumnConfigs();
        const findArea = document.getElementById('fast-forecast-area');
        if (findArea) {
            findArea.outerHTML = generateFastForecast(initialSeed, columnConfigs);
        }
    }
}