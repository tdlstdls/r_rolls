/** @file view_table.js @description ガチャ結果テーブル全体の描画制御（マスター情報・Sim・Txt表示・ターゲット精度同期版） */

const COLOR_ROUTE_HIGHLIGHT = '#aaddff';
const COLOR_ROUTE_UBER = '#66b2ff';
let currentTableData = null;

/**
 * テーブル描画のメインエントリーポイント
 * ガチャデータの計算、Find予報エリア、および結果テーブルの構築を制御します。
 */
function generateRollsTable() {
    try {
        // マスタデータが未ロードの場合は何もしない
        if (Object.keys(gachaMasterData.gachas).length === 0) return;

        const seedEl = document.getElementById('seed');
        if (!seedEl) return;
        
        let initialSeed = parseInt(seedEl.value, 10);
        if (isNaN(initialSeed)) { 
            initialSeed = 12345;
            seedEl.value = "12345"; 
        }
        
        // 現在の表示行数（デフォルト300〜）
        const numRolls = currentRolls;
        
        // 1. テーブル表示に必要な乱数シード配列を生成
        const seeds = [];
        const rngForSeeds = new Xorshift32(initialSeed);
        // レア被りによる消費増を考慮し、行数の約25倍程度の余裕を持って生成
        for (let i = 0; i < numRolls * 25 + 500; i++) {
            seeds.push(rngForSeeds.next());
        }

        // 2. カラム設定（ガチャIDや将来の新規キャラ追加add設定）を構築
        const columnConfigs = prepareColumnConfigs();

        // 3. 全セルのシミュレーション実行
        // この関数内で currentTableData が更新され、詳細ログ表示等で参照されます
        const tableData = executeTableSimulation(numRolls, columnConfigs, seeds);

        // 4. シミュレーション（ルート）のハイライト判定と最終シードの取得
        // 強化された判定エンジンにより、ターゲット番地（A/B・行）とのズレを解消したマップを取得
        const { highlightMap, guarHighlightMap, lastSeedValue } = preparePathHighlightMaps(initialSeed, seeds, numRolls);
        
        // Txtモード等で継続計算するために最終SEEDを保持
        finalSeedForUpdate = lastSeedValue;

        // --- HTML構築開始 ---
        let finalContainerHtml = '';

        // 5. Find（予報・ターゲット検索）エリアの生成
        if (typeof generateFastForecast === 'function') {
            finalContainerHtml += generateFastForecast(initialSeed, columnConfigs);
        }

        // 6. ガチャのマスター詳細情報エリア（キャラリスト）の生成
        // Findボタンが有効かつ、マスター表示ボタンがONの場合のみ出力
        if (typeof generateMasterInfoHtml === 'function' && showFindInfo && isMasterInfoVisible) {
            finalContainerHtml += `<div id="master-info-area" style="padding: 10px; background: #fdfdfd; border: 1px solid #ddd; border-top: none; margin-top: -16px; border-radius: 0 0 4px 4px; font-size: 0.85em;">`;
            finalContainerHtml += `<div style="border-top: 1px dashed #ccc; margin-bottom: 10px;"></div>`; 
            finalContainerHtml += generateMasterInfoHtml();
            finalContainerHtml += `</div>`;
        }

        // 7. Txt（テキストルートビュー）モードの表示
        // SimモードかつTxtボタンがONの場合、テーブルの上にテキスト形式のルートを表示
        if (isTxtMode && isSimulationMode) {
            if (typeof generateTxtRouteView === 'function') {
                const txtViewHtml = generateTxtRouteView(seeds, initialSeed);
                // ルートが空でない場合のみ表示
                if (!txtViewHtml.includes("ルートが入力されていません")) {
                    finalContainerHtml += txtViewHtml;
                }
            }
        }

        // 8. Simモード時の操作ガイド注釈
        if (isSimulationMode) {
            finalContainerHtml += `
                <div id="sim-auto-calc-notice" style="font-size: 0.75em; color: #666; padding: 5px 10px; background: #fff; border-left: 3px solid #007bff; margin: 5px 0;">
                    ※表のキャラ名をタップするとそのセルまでのルートを自動計算します。計算結果はクリックしたターゲット番地（A/Bトラック）に正確に到達するよう調整されます。
                </div>`;
        }

        // 9. メインテーブル本体の構築
        if (typeof buildTableDOM === 'function') {
            finalContainerHtml += buildTableDOM(numRolls, columnConfigs, tableData, seeds, highlightMap, guarHighlightMap);
        }

        // コンテナへの流し込み
        const container = document.getElementById('rolls-table-container');
        if (container) {
            container.innerHTML = finalContainerHtml;
        }

        // 状態表示の更新
        const resultDiv = document.getElementById('result');
        if (resultDiv) {
            resultDiv.style.display = 'block';
            resultDiv.textContent = isSimulationMode ? "Simulation Mode: Active" : "Display Mode";
        }
        
        // URLパラメータの同期
        updateUrlParams();
        
    } catch (e) {
        // 万が一の描画エラー時のフォールバック表示
        const container = document.getElementById('rolls-table-container');
        if (container) {
            container.innerHTML = `
                <div style="padding: 20px; color: #d9534f; background: #f2dede; border: 1px solid #ebccd1; border-radius: 4px;">
                    <h4 style="margin-top:0;">テーブル描画エラー</h4>
                    <p style="font-size: 0.9em;">申し訳ありません、データの処理中にエラーが発生しました。<br>SEED値やルート設定を確認してください。</p>
                    <code style="font-size: 0.8em;">${e.message}</code>
                </div>`;
        }
        console.error("Critical Table Build Error:", e);
    }
}

/**
 * executeTableSimulation をフックして、最新の計算データをグローバルに保持する
 * これにより、詳細ログ（11Gデバッグ等）で常に画面表示と一致するデータを参照可能にします。
 */
(function() {
    // 既存の関数をラップして currentTableData を更新するように拡張
    const originalExecute = (typeof executeTableSimulation === 'function') ? executeTableSimulation : null;
    
    if (originalExecute) {
        executeTableSimulation = function(n, c, s) {
            const data = originalExecute(n, c, s);
            currentTableData = data;
            return data;
        };
    }
})();