/** @file main.js @description アプリのエントリーポイント（window.onloadでの初期化フロー実行） @dependency data_loader.js, ui_controller.js */

/**
 * ==============================================================================
 * [R_Rolls] システム相関図 (System Dependency Map) - Updated 2025
 * ==============================================================================
 * 【1. Entry Point / Controller】
 * main.js --------------------> アプリ初期化フローの実行
 * |
 * +--[ UI Management Modules ]--+
 * | ui_mode_logic.js ----------> 初期化・Sim/skd/概要の切替
 * | ui_seed_logic.js ----------> SEED値操作・同期
 * | ui_refresh_logic.js --------> 再描画・Config操作
 * | ui_display_logic.js --------> SEED列/マスター情報の表示管理
 * |
 * | ui_cell_event.js -----------> セルクリック時のルート計算指令
 * +-----------------------------+
 * +--> url_manager.js ------> URLとアプリ状態の同期
 *
 * 【2. Data & Logic Layer】
 * data_loader.js -------------> CSV/TSV取得・マスタデータ構築
 * |
 * (cats.js, gacha_series.js を参照)
 * logic.js -------------------> ガチャ抽選・再抽選の核心計算ロジック
 * schedule_logic.js ----------> gatya.tsv解析・日付計算
 * |
 * +--[ Simulation Modules ]--+
 * |
 * | sim_config_helpers.js ----> Config文字列の解析・生成・操作
 * | sim_engine.js ------------> 経路探索(ビームサーチ)・シミュレーション実行
 * | sim_ui_logic.js ----------> 回避・誘発判定・UI表示判定ロジック
 * |
 * | sim_utils.js -------------> 探索された経路の圧縮・整形
 * +--------------------------+
 *
 * 【3. View / Rendering Layer】
 * view_table.js --------------> テーブル描画のメイン制御・DOM構築
 * |
 * +--> view_table_data.js ----> テーブル用データの生成
 * +--> view_table_highlight.js -> ルートハイライトの計算
 * +--> view_header.js ------> ヘッダー(固定名/操作ボタン)生成
 * +--> view_cell_renderer.js -> 各セルのHTML生成
 * |
 * +--> view_analysis.js -> レア被りハイライト判定
 * |
 * +--> view_forecast.js ----> Findエリア・予報HTML生成
 * +--> view_master.js ------> マスタ詳細情報HTML生成
 * +--> view_schedule_utils.js -> スケジュール共通設定・ユーティリティ
 * +--> view_schedule_gantt.js -> ガントチャート描画
 * +--> view_schedule_table.js -> スケジュール表描画
 *
 * 【4. Event Handlers / UI Parts】
 * ui_table_handler.js --------> 列追加/削除/変更のイベント
 * ui_target_handler.js -------> Findターゲットの管理
 * ui_schedule_handler.js -----> skdモード切替・スケジュール列追加
 * gacha_selector.js ----------> プルダウンの選択肢生成
 *
 * 【5. Core State】
 * ui_globals.js --------------> 全ファイルで共有されるグローバル変数
 * ==============================================================================
 */

window.onload = async function() {
    // 1. データの読み込み (data_loader.js)
    const success = await loadAllData();
    if (!success) {
        alert("データの読み込みに失敗しました。");
        return;
    }

    // 2. URLパラメータの処理 (url_manager.js)
    processUrlParams();

    // 3. デフォルトガチャの初期化 (ui_mode_logic.js)
    initializeDefaultGachas();

    // 4. スケジュールUIの準備 (ui_schedule_handler.js)
    setupScheduleUI();

    // 5. 初回描画 (ui_mode_logic.js)
    onModeChange();
};