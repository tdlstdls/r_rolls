/** @file ui_cell_event.js @description ガチャセルクリック時のイベントハンドラ */

function onGachaCellClick(targetSeedIndex, gachaId, charName, guaranteedType = null, fromFind = false, targetCharId = null) {
    if (isSimulationMode) {
        const errorEl = document.getElementById('sim-error-msg');
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.style.display = 'none';
        }

        const visibleIds = tableGachaIds.map(id => id);
        const configInput = document.getElementById('sim-config');
        const currentConfig = configInput ? configInput.value : "";

        if (typeof calculateRouteToCell === 'function') {
            let routeConfig;
            if (guaranteedType) {
                const finalAction = { 
                    id: gachaId, 
                    rolls: parseInt(guaranteedType.replace('g', ''), 10), 
                    g: true 
                };
                routeConfig = calculateRouteToCell(targetSeedIndex, gachaId, visibleIds, currentConfig, finalAction, targetCharId);
            } else {
                routeConfig = calculateRouteToCell(targetSeedIndex, gachaId, visibleIds, currentConfig, null, targetCharId);
            }

            if (routeConfig) {
                if (configInput) {
                    configInput.value = routeConfig;
                    if (typeof updateUrlParams === 'function') updateUrlParams();
                    resetAndGenerateTable();
                }
            } else {
                if (errorEl) {
                    const row = Math.floor(targetSeedIndex / 2) + 1;
                    const side = (targetSeedIndex % 2 === 0) ? 'A' : 'B';
                    const cellLabel = `${side}${row}`;
                    errorEl.textContent = `${cellLabel}セルへのルートは見つかりませんでした`;
                    errorEl.style.display = 'block'; 
                }
                console.warn("Route not found.");
            }
        }
    } else {
        toggleAppMode();
        if (fromFind) {
            const notifEl = document.getElementById('sim-notif-msg');
            if (notifEl) {
                notifEl.textContent = 'Findのセル番地クリックによりSIMモードに切り替えました';
                notifEl.style.display = 'inline';
            }
        }
        setTimeout(() => {
            onGachaCellClick(targetSeedIndex, gachaId, charName, guaranteedType, fromFind, targetCharId);
        }, 100);
    }
}