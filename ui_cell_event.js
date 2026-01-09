/** @file ui_cell_event.js @description ガチャセルクリック時のイベントハンドラ（ターゲット同期・エラー案内・トラック一致強化版） */

/**
 * テーブル上のガチャセル、または確定枠（G列）をクリックした際のハンドラ
 * ターゲットのインデックス（A/Bおよび行番号）を保持したまま探索エンジンを呼び出します。
 */
function onGachaCellClick(targetSeedIndex, gachaId, charName, guaranteedType = null, fromFind = false, targetCharId = null) {
    // 1. シミュレーションモードがOFFの場合は、ONに切り替えてから実行
    if (!isSimulationMode) {
        toggleAppMode();
        const notifEl = document.getElementById('sim-notif-msg');
        if (notifEl) {
            notifEl.style.display = 'block';
            notifEl.style.color = '#007bff';
            notifEl.textContent = 'Simモードに切り替えてルートを探索します...';
            setTimeout(() => { if (notifEl.textContent.includes('Simモード')) notifEl.style.display = 'none'; }, 2000);
        }

        // モード切替後の再描画と状態遷移を待ってから再試行
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

    // 現在表示されているガチャIDのリストを取得（探索範囲をテーブル表示中のものに限定）
    const visibleIds = tableGachaIds.map(id => id);
    const configInput = document.getElementById('sim-config');
    const currentConfig = configInput ? configInput.value : "";

    if (typeof calculateRouteToCell === 'function') {
        let routeResult = null;

        // 2. 確定枠（11g/15g/7g等）をクリックした場合の最終アクション設定
        if (guaranteedType) {
            const rollsCount = parseInt(guaranteedType.replace('g', ''), 10);
            const finalAction = { 
                id: gachaId, 
                rolls: rollsCount, 
                g: true,
                fullId: gachaId + 'g'
            };
            // 確定枠の場合、targetSeedIndex は「確定ガチャを開始する地点」として渡し、
            // エンジン側でその地点までの最短経路 + 最後の確定ロールを結合させます
            routeResult = calculateRouteToCell(targetSeedIndex, gachaId, visibleIds, currentConfig, finalAction, targetCharId);
        } 
        // 3. 通常枠をクリックした場合
        else {
            // 通常セルの場合は finalActionOverride を null にし、エンジン内で最終ステップを自動補完させます
            routeResult = calculateRouteToCell(targetSeedIndex, gachaId, visibleIds, currentConfig, null, targetCharId);
        }

        // 4. ルートが見つかった場合の処理
        if (routeResult) {
            if (configInput) {
                configInput.value = routeResult;
                
                // URLパラメータを更新し、テーブルを再描画してハイライトを反映
                if (typeof updateUrlParams === 'function') updateUrlParams();
                resetAndGenerateTable();
                
                // 到達成功の通知（番地をフォーマットして表示）
                if (notifEl) {
                    const row = Math.floor(targetSeedIndex / 2) + 1;
                    const side = (targetSeedIndex % 2 === 0) ? 'A' : 'B';
                    notifEl.style.display = 'block';
                    notifEl.style.color = '#28a745'; // 成功色（緑）
                    notifEl.textContent = `${side}${row}セルへのルートを更新しました`;
                    setTimeout(() => { notifEl.style.display = 'none'; }, 3000);
                }
            }
        } 
        // 5. ルートが見つからなかった場合の案内
        else {
            if (errorEl) {
                errorEl.style.display = 'block';
                errorEl.style.color = '#d9534f'; // 警告色（赤）
                errorEl.textContent = '見つかりませんでした';
                
                // 1.5秒間表示して注意を促す
                setTimeout(() => {
                    errorEl.style.display = 'none';
                    errorEl.textContent = '';
                }, 1500);
            }
            console.warn(`Route not found for Target Index: ${targetSeedIndex} (Gacha: ${gachaId})`);
        }
    } else {
        console.error("calculateRouteToCell function is not defined. check sim_engine_config.js loading.");
    }
}

/**
 * 確定枠（11G）セルの詳細デバッグログ表示用のタイマー管理
 * 長押し（0.6秒）で詳細な計算過程を表示します。
 */
window.start11GTimer = function(seedIdx, colIdx, isAlt) {
    window.clear11GTimer();
    window.g11Timer = setTimeout(() => {
        if (typeof showDebugLog === 'function') {
            showDebugLog(seedIdx, colIdx, isAlt);
        }
    }, 600);
};

window.clear11GTimer = function() {
    if (window.g11Timer) {
        clearTimeout(window.g11Timer);
        window.g11Timer = null;
    }
};