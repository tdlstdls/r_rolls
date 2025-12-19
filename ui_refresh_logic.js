/** @file ui_refresh_logic.js @description テーブル再描画とConfig操作の管理 */

function resetAndGenerateTable() {
    if (isScheduleMode || isDescriptionMode) return;
    finalSeedForUpdate = null;
    const simConf = document.getElementById('sim-config');
    if (simConf && simConf.value.trim() === '') {
         currentRolls = 300;
    }
    if (typeof generateRollsTable === 'function') generateRollsTable();
    updateMasterInfoView();
    if (typeof updateUrlParams === 'function') updateUrlParams();
}

function addMoreRolls() {
    currentRolls += 100;
    if (typeof generateRollsTable === 'function') generateRollsTable();
}

function clearSimConfig() {
    const el = document.getElementById('sim-config');
    if(el) el.value = '';
    const errorEl = document.getElementById('sim-error-msg');
    if (errorEl) {
        errorEl.textContent = '';
        errorEl.style.display = 'none';
    }
    const notifEl = document.getElementById('sim-notif-msg');
    if (notifEl) {
        notifEl.textContent = '';
        notifEl.style.display = 'none';
    }
    resetAndGenerateTable();
}

function backSimConfig() {
    const el = document.getElementById('sim-config');
    if (el && typeof removeLastConfigSegment === 'function') {
        el.value = removeLastConfigSegment(el.value);
        resetAndGenerateTable();
    }
}

function updateMasterInfoView() {
    const el = document.getElementById('master-info-area');
    if (!el || typeof generateMasterInfoHTML !== 'function') return;
    const configs = [];
    tableGachaIds.forEach(idStr => {
        let gachaId = idStr.replace(/[gfs]$/, '');
        if (gachaMasterData.gachas[gachaId]) {
            configs.push(gachaMasterData.gachas[gachaId]);
        }
    });
    el.innerHTML = generateMasterInfoHTML(configs);
}