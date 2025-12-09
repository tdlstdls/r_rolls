/**
 * main.js
 * アプリケーションのエントリーポイント
 */

window.onload = async function() {
    // 1. データの読み込み (data_loader.js)
    const success = await loadAllData();
    if (!success) {
        alert("データの読み込みに失敗しました。");
        return;
    }

    // 2. URLパラメータの処理 (ui_controller.js)
    processUrlParams();

    // 3. デフォルトガチャの初期化 (ui_controller.js)
    initializeDefaultGachas();

    // 4. スケジュールUIの準備 (ui_controller.js)
    setupScheduleUI();

    // 5. 初回描画 (ui_controller.js)
    onModeChange();
};