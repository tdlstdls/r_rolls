/** @file ui_cell_event.js @description ガチャセルクリック時のイベントハンドラ（ターゲット同期・エラー案内強化版） */

/**
 * テーブル上のガチャセル、または確定枠（G列）をクリックした際のハンドラ
 */
function onGachaCellClick(targetSeedIndex, gachaId, charName, guaranteedType = null, fromFind = false, targetCharId = null) {
    // シミュレーションモードがOFFの場合は、ONに切り替えてから実行
    if (!isSimulationMode) {
        toggleAppMode();
        
        const notifEl = document.getElementById('sim-notif-msg');
        if (notifEl) {
            notifEl.style.display = 'block';
            notifEl.textContent = 'Simモードに切り替えてルートを探索します...';
            setTimeout(() => { notifEl.style.display = 'none'; }, 2000);
        }

        // モード切替後の再描画を待ってから再試行
        setTimeout(() => {
            onGachaCellClick(targetSeedIndex, gachaId, charName, guaranteedType, fromFind, targetCharId);
        }, 150);
        return;
    }

    // 以前の警告・通知メッセージをクリア
    const errorEl = document.getElementById('sim-error-msg');
    const notifEl = document.getElementById('sim-notif-msg');
    if (errorEl) { errorEl.textContent = ''; errorEl.style.display = 'none'; }
    if (notifEl) { notifEl.textContent = ''; notifEl.style.display = 'none'; }

    // 現在表示されているガチャIDのリストを取得（探索範囲の限定用）
    const visibleIds = tableGachaIds.map(id => id);
    const configInput = document.getElementById('sim-config');
    const currentConfig = configInput ? configInput.value : "";

    if (typeof calculateRouteToCell === 'function') {
        let routeResult = null;
        
        // 1. 確定枠（11g/15g/7g等）をクリックした場合の最終アクション設定
        if (guaranteedType) {
            const rollsCount = parseInt(guaranteedType.replace('g', ''), 10);
            const finalAction = { 
                id: gachaId, 
                rolls: rollsCount, 
                g: true 
            };
            // 確定枠の場合、targetSeedIndex は「確定ガチャを開始する地点」として計算
            routeResult = calculateRouteToCell(targetSeedIndex, gachaId, visibleIds, currentConfig, finalAction, targetCharId);
        } 
        // 2. 通常枠をクリックした場合
        else {
            routeResult = calculateRouteToCell(targetSeedIndex, gachaId, visibleIds, currentConfig, null, targetCharId);
        }

        // ルートが見つかった場合の処理
        if (routeResult) {
            if (configInput) {
                configInput.value = routeResult;
                // URLパラメータを更新し、テーブルを再描画
                if (typeof updateUrlParams === 'function') updateUrlParams();
                resetAndGenerateTable();
                
                // 到達成功の簡易通知
                if (notifEl) {
                    const row = Math.floor(targetSeedIndex / 2) + 1;
                    const side = (targetSeedIndex % 2 === 0) ? 'A' : 'B';
                    notifEl.style.display = 'block';
                    notifEl.style.color = '#28a745';
                    notifEl.textContent = `${side}${row}セルへのルートを更新しました`;
                    setTimeout(() => { notifEl.style.display = 'none'; }, 2000);
                }
            }
        } 
        // ルートが見つからなかった場合の案内
        else {
            if (errorEl) {
                const row = Math.floor(targetSeedIndex / 2) + 1;
                const side = (targetSeedIndex % 2 === 0) ? 'A' : 'B';
                
                errorEl.style.display = 'block';
                errorEl.style.color = '#d9534f'; // 警告色（赤）
                errorEl.style.fontWeight = 'bold';
                errorEl.style.padding = '5px 10px';
                errorEl.style.backgroundColor = '#fff1f0';
                errorEl.style.border = '1px solid #ffa39e';
                errorEl.style.borderRadius = '4px';
                
                errorEl.textContent = `【失敗】${side}${row}セルへの到達ルートは見つかりませんでした（Max設定やレア被り等により到達不能です）`;
                
                // 5秒間表示して注意を促す
                setTimeout(() => {
                    errorEl.style.display = 'none';
                    errorEl.textContent = '';
                }, 5000);
            }
            console.warn(`Route not found for Target: ${targetSeedIndex} (${targetGachaId})`);
        }
    }
}

/**
 * ガチャ詳細デバッグ用のタイマー管理（11Gセルの長押し等）
 */
window.start11GTimer = function(seedIdx, colIdx, isAlt) {
    window.clear11GTimer();
    window.g11Timer = setTimeout(() => {
        if (typeof showGachaDetailLog === 'function') {
            showGachaDetailLog(seedIdx, colIdx, isAlt);
        }
    }, 600); // 0.6秒長押しで詳細ログ表示
};

window.clear11GTimer = function() {
    if (window.g11Timer) {
        clearTimeout(window.g11Timer);
        window.g11Timer = null;
    }
};