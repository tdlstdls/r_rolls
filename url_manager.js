/**
 * url_manager.js
 * URLパラメータの読み込みと更新を担当
 */

function processUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const seedParam = urlParams.get('seed');
    const simConfigParam = urlParams.get('sim_config');
    const gachasParam = urlParams.get('gachas');

    // global変数のtableGachaIdsを参照
    if (gachasParam) {
        tableGachaIds = gachasParam.split('-');
    }

    const seedEl = document.getElementById('seed');
    if (seedParam) {
        if(seedEl) seedEl.value = seedParam;
    } else {
        // デフォルト値
        if(seedEl && !seedEl.value) seedEl.value = "12345";
    }

    if (simConfigParam) {
        const configEl = document.getElementById('sim-config');
        if(configEl) configEl.value = simConfigParam;
        
        // ui_controllerで管理されるisSimulationModeも更新が必要だが
        // ここではDOMを操作し、初期化フローで整合性を取る
        const simRadio = document.querySelector('input[value="simulation"]');
        if(simRadio) {
            simRadio.checked = true;
            // グローバル変数の更新（ui_controllerがロードされている前提）
            if(typeof isSimulationMode !== 'undefined') isSimulationMode = true;
        }
    }
}

function updateUrlParams() {
    const seed = document.getElementById('seed').value;
    const simConfig = document.getElementById('sim-config').value;
    const urlParams = new URLSearchParams(window.location.search);

    if (seed) urlParams.set('seed', seed); else urlParams.delete('seed');
    // global変数のisSimulationModeを参照
    if (simConfig && isSimulationMode) urlParams.set('sim_config', simConfig); else urlParams.delete('sim_config');
    // global変数のtableGachaIdsを参照
    if (tableGachaIds.length > 0) urlParams.set('gachas', tableGachaIds.join('-')); else urlParams.delete('gachas');

    const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
    try { window.history.pushState({path: newUrl}, '', newUrl); } catch (e) { console.warn("URL update failed", e); }
}