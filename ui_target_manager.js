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
    // 1. 各種フィルタリング対象のIDリストを取得
    const columnConfigs = prepareColumnConfigs();
    const status = getAvailableSpecialTargets(columnConfigs);

    // 2. 伝説・限定をOFFにする（hiddenFindIds に追加）
    status.availableLegendIds.forEach(id => hiddenFindIds.add(id));
    status.availableLimitedIds.forEach(id => hiddenFindIds.add(id));

    // 3. 超激をOFFにし、その他手動追加されたターゲットもすべてクリア
    userTargetIds.clear();

    // 4. 優先表示リストをクリア
    userPrioritizedTargets = [];
    // レガシーな優先リストもクリア
    prioritizedFindIds = [];

    // 5. 元々の処理も念のため維持
    searchTargets = [];
    if (typeof updateTargetListUI === 'function') {
        updateTargetListUI();
    }
    
    // 6. テーブルを再描画してUIに反映
    if (typeof generateRollsTable === 'function') {
        generateRollsTable();
    }
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