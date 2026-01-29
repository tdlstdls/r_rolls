/** @file main.js @description アプリ起動時の初期化フロー */

window.onload = async function() {
    console.log("Initializing R_Rolls...");

    // 1. 概要表示の初期化
    if (typeof initDescriptionView === 'function') {
        try { 
            initDescriptionView(); 
        } catch (e) { 
            console.error("Description View Error:", e); 
        }
    }

    // 2. データロード
    try {
        const success = await loadAllData();
        if (!success) {
            console.error("Data loading failed.");
            return;
        }
    } catch (e) {
        console.error("Fatal Data Error:", e);
        return;
    }

    // 3. 各種状態の初期化と描画
    try {
        if (typeof processUrlParams === 'function') processUrlParams();
        if (typeof initializeDefaultGachas === 'function') initializeDefaultGachas();
        if (typeof setupScheduleUI === 'function') setupScheduleUI();
        
        // 初回描画（テーブル生成など）
        if (typeof onModeChange === 'function') onModeChange();

        // ヘッダーのSEED値をURLパラメータに基づいて同期表示
        if (typeof updateSeedDisplay === 'function') {
            updateSeedDisplay();
        }

        console.log("Application fully initialized.");
    } catch (e) {
        console.error("Initialization Flow Error:", e);
    }
};

/**
 * デバッグ用関数
 */
window.getAppStatus = function() {
    return {
        seed: document.getElementById('seed')?.value,
        rolls: typeof currentRolls !== 'undefined' ? currentRolls : null,
        mode: typeof isSimulationMode !== 'undefined' ? (isSimulationMode ? "Sim" : "View") : "Unknown",
        gachas: typeof tableGachaIds !== 'undefined' ? tableGachaIds : []
    };
};