/**
 * @file main.js
 * @description エントリーポイント。初期化フロー（概要・データロード・URL・UI構築）の制御
 * @dependency data_loader.js, url_manager.js, ui_mode_logic.js, ui_schedule_handler.js
 */

/**
 * ==============================================================================
 * [R_Rolls] システム構成マップ (Refactored)
 * ==============================================================================
 * main.js --------------------> アプリ初期化
 * |
 * +-- view_description.js ----> 概要モードのHTML注入
 * +-- data_loader.js ---------> マスタデータ読み込み
 * +-- url_manager.js ---------> URLパラメータ解析
 * +-- ui_mode_logic.js --------> デフォルトガチャ設定
 * +-- ui_schedule_handler.js --> スケジュールUI準備
 * +-- ui_mode_logic.js --------> 初回描画実行 (onModeChange)
 * ==============================================================================
 */

window.onload = async function() {
    console.log("Initializing R_Rolls...");

    // 1. 概要モード（使い方ガイド）の初期化
    // データ読み込み中にユーザーが読めるよう、最優先で実行します
    if (typeof initDescriptionView === 'function') {
        try {
            initDescriptionView();
            console.log("Description view initialized.");
        } catch (e) {
            console.error("Description View Error:", e);
        }
    } else {
        console.warn("view_description.js is not loaded yet.");
    }

    // 2. 外部データの読み込み (data_loader.js)
    // CSV/TSV等の重いデータを非同期で取得します
    try {
        const success = await loadAllData();
        if (!success) {
            console.error("Data loading failed.");
            alert("データの読み込みに失敗しました。ページを再読み込みしてください。");
            return;
        }
        console.log("Master data loaded successfully.");
    } catch (e) {
        console.error("Fatal Data Error:", e);
        return;
    }

    // 3. アプリケーション状態の初期化
    // URLからの設定復元、デフォルトガチャの配置などを行います
    try {
        // URLパラメータの処理 (url_manager.js)
        if (typeof processUrlParams === 'function') {
            processUrlParams();
        }

        // デフォルトガチャの初期化 (ui_mode_logic.js)
        if (typeof initializeDefaultGachas === 'function') {
            initializeDefaultGachas();
        }

        // スケジュールUIの準備 (ui_schedule_handler.js)
        if (typeof setupScheduleUI === 'function') {
            setupScheduleUI();
        }

        // 4. 初回描画の実行
        // 全ての準備が整った後、画面を更新します
        if (typeof onModeChange === 'function') {
            onModeChange();
        }

        console.log("Application fully initialized.");

    } catch (e) {
        console.error("Initialization Flow Error:", e);
    }
};

/**
 * 補助：ブラウザのコンソールで状態を確認するためのデバッグ用関数
 */
window.getAppStatus = function() {
    return {
        seed: document.getElementById('seed')?.value,
        rolls: typeof currentRolls !== 'undefined' ? currentRolls : null,
        mode: typeof isSimulationMode !== 'undefined' ? (isSimulationMode ? "Sim" : "View") : "Unknown",
        gachas: typeof tableGachaIds !== 'undefined' ? tableGachaIds : []
    };
};