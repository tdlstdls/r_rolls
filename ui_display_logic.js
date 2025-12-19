/** @file ui_display_logic.js @description 表示要素（SEED列/マスター情報/Find）のトグル管理 */

// グローバル変数の定義を ui_globals.js に移行することを推奨
let isMasterInfoVisible = false; 

function toggleSeedColumns() {
    showSeedColumns = !showSeedColumns;
    if (typeof generateRollsTable === 'function') generateRollsTable(); 
    updateToggleButtons();
}

function updateToggleButtons() {
    const btnSeed = document.getElementById('toggle-seed-btn');
    if(btnSeed) btnSeed.textContent = showSeedColumns ? 'SEED非表示' : 'SEED表示';
}

function toggleMasterInfo() {
    isMasterInfoVisible = !isMasterInfoVisible;
    const content = document.getElementById('master-info-content');
    if (content) {
        content.style.display = isMasterInfoVisible ? 'block' : 'none';
    }
    if (typeof generateRollsTable === 'function') generateRollsTable();
    if (typeof updateMasterInfoView === 'function') updateMasterInfoView();
}

function toggleFindInfo() {
    showFindInfo = !showFindInfo;
    const btn = document.getElementById('toggle-find-info-btn');
    if (typeof generateRollsTable === 'function') generateRollsTable();
    if (btn) {
        if (showFindInfo) btn.classList.add('active');
        else btn.classList.remove('active');
    }
}