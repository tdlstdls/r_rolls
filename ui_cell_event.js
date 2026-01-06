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
                    
                    // 親要素のフレックスボックス設定を変更して折り返しを許可
                    if (errorEl.parentElement) {
                        errorEl.parentElement.style.flexWrap = 'wrap';
                    }

                    // 表示スタイル設定：100%幅で強制改行し、入力欄の下へ
                    errorEl.style.display = 'block'; 
                    errorEl.style.width = '100%';
                    errorEl.style.order = '99'; // フレックス内の最後に配置
                    errorEl.style.marginTop = '4px';
                    errorEl.style.paddingLeft = '45px'; // 「ルート:」ラベルの幅に合わせて調整
                    errorEl.textContent = `${cellLabel}セルへのルートは見つかりませんでした`;
                    
                    // 1秒後に非表示
                    setTimeout(() => {
                        errorEl.style.display = 'none';
                        errorEl.textContent = '';
                    }, 1000);
                }
                console.warn("Route not found.");
            }
        }
    } else {
        toggleAppMode();
        if (fromFind) {
            const notifEl = document.getElementById('sim-notif-msg');
            if (notifEl) {
                // 親要素のフレックスボックス設定を変更して折り返しを許可
                if (notifEl.parentElement) {
                    notifEl.parentElement.style.flexWrap = 'wrap';
                }

                // 表示スタイル設定：100%幅で強制改行し、入力欄の下へ
                notifEl.style.display = 'block';
                notifEl.style.width = '100%';
                notifEl.style.order = '99'; // フレックス内の最後に配置
                notifEl.style.marginTop = '4px';
                notifEl.style.paddingLeft = '45px'; // 「ルート:」ラベルの幅に合わせて調整
                notifEl.textContent = 'Findのセル番地クリックによりSIMモードに切り替えました';
                
                // 1秒後に非表示
                setTimeout(() => {
                    notifEl.style.display = 'none';
                    notifEl.textContent = '';
                }, 1000);
            }
        }
        setTimeout(() => {
            onGachaCellClick(targetSeedIndex, gachaId, charName, guaranteedType, fromFind, targetCharId);
        }, 100);
    }
}