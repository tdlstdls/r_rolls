/**
 * url_manager.js
 * URLパラメータの読み込みと更新を担当
 */

function processUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const seedParam = urlParams.get('seed');
    const simConfigParam = urlParams.get('sim_config');
    const gachasParam = urlParams.get('gachas');

    // uberAdditionCounts をリセット
    // ui_controller.js で定義された uberAdditionCounts を使用
    if (typeof uberAdditionCounts !== 'undefined') {
        uberAdditionCounts.length = 0; // 配列を空にする
    } else {
        // Fallback: ui_controller.js がまだ走っていない場合 (通常ありえないが)
        window.uberAdditionCounts = [];
    }

    if (gachasParam) {
        const parts = gachasParam.split('-');
        tableGachaIds = []; // reset
        
        parts.forEach((part, index) => {
            // "1006gadd5" 形式への対応
            if (part.includes('add')) {
                const subParts = part.split('add');
                const id = subParts[0];
                const addVal = parseInt(subParts[1], 10);
                
                tableGachaIds.push(id);
                // 追加数を保存
                if (!isNaN(addVal) && addVal > 0) {
                    uberAdditionCounts[index] = addVal;
                } else {
                    uberAdditionCounts[index] = 0;
                }
            } else {
                tableGachaIds.push(part);
                uberAdditionCounts[index] = 0;
            }
        });
    }

    const seedEl = document.getElementById('seed');
    if (seedParam) {
        if(seedEl) seedEl.value = seedParam;
    } else {
        if(seedEl && !seedEl.value) seedEl.value = "12345";
    }

    if (simConfigParam) {
        const configEl = document.getElementById('sim-config');
        if(configEl) configEl.value = simConfigParam;
        
        const simRadio = document.querySelector('input[value="simulation"]');
        if(simRadio) {
            simRadio.checked = true;
            if(typeof isSimulationMode !== 'undefined') isSimulationMode = true;
        }
    }
}

function updateUrlParams() {
    const seed = document.getElementById('seed').value;
    const simConfig = document.getElementById('sim-config').value;
    const urlParams = new URLSearchParams(window.location.search);

    if (seed) urlParams.set('seed', seed); else urlParams.delete('seed');
    if (simConfig && isSimulationMode) urlParams.set('sim_config', simConfig); else urlParams.delete('sim_config');
    
    // gachasパラメータの生成 (ID + "add" + Add数)
    if (tableGachaIds.length > 0) {
        const joined = tableGachaIds.map((id, index) => {
            const addVal = uberAdditionCounts[index];
            if (addVal && addVal > 0) {
                return `${id}add${addVal}`;
            }
            return id;
        }).join('-');
        urlParams.set('gachas', joined);
    } else {
        urlParams.delete('gachas');
    }

    const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
    try { window.history.pushState({path: newUrl}, '', newUrl); } catch (e) { console.warn("URL update failed", e); }
}