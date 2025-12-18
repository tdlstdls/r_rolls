/** @file main.js @description アプリのエントリーポイント（window.onloadでの初期化フロー実行） @dependency data_loader.js, ui_controller.js */

/**
 * ==============================================================================
 * [R_Rolls] システム相関図 (System Dependency Map)
 * ==============================================================================
 * * 【1. Entry Point / Controller】
 * main.js --------------------> アプリ初期化フローの実行
 * |
 * +--> ui_controller.js ----> 表示切替(Sim/skd/概要)・描画指示の司令塔
 * +--> url_manager.js ------> URLとアプリ状態の同期
 * * 【2. Data & Logic Layer】
 * data_loader.js -------------> CSV/TSV取得・マスタデータ構築
 * |                             (cats.js, gacha_series.js を参照)
 * logic.js -------------------> ガチャ抽選・再抽選の核心計算ロジック
 * simulation.js --------------> 経路探索(ビームサーチ)・回避誘発判定
 * schedule_logic.js ----------> gatya.tsv解析・日付計算
 * * 【3. View / Rendering Layer】
 * view_table.js --------------> テーブル描画の主制御
 * |
 * +--> view_header.js ------> ヘッダー(固定名/操作ボタン)生成
 * +--> view_cell_renderer.js -> 各セルのHTML生成
 * |      +--> view_analysis.js -> レア被りハイライト判定
 * |
 * +--> view_forecast.js ----> Findエリア・予報HTML生成
 * +--> view_master.js ------> マスタ詳細情報HTML生成
 * +--> view_schedule.js ----> スケジュール・ガントチャート描画
 * * 【4. Event Handlers / UI Parts】
 * ui_table_handler.js --------> 列追加/削除/変更のイベント
 * ui_target_handler.js -------> Findターゲットの管理
 * ui_schedule_handler.js -----> skdモード切替・スケジュール列追加
 * gacha_selector.js ----------> プルダウンの選択肢生成
 * * 【5. Core State】
 * ui_globals.js --------------> 全ファイルで共有されるグローバル変数
 * * ==============================================================================
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