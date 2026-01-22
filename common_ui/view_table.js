/**
 * @file view_table.js
 * @description テーブル描画のメインオーケストレータ。計算・ハイライト・DOM構築を統合
 * @managed_state currentTableData (計算済み全行データ)
 * @dependency view_table_data.js, view_table_highlight.js, view_table_dom.js
 */

const COLOR_ROUTE_HIGHLIGHT = '#aaddff';
const COLOR_ROUTE_UBER = '#66b2ff';
let currentTableData = null;

/**
 * テーブル描画のメインエントリーポイント
 * ガチャデータの計算、Find予報エリア、および結果テーブルの構築を制御します。
 */
function generateRollsTable() {
    try {
        if (Object.keys(gachaMasterData.gachas).length === 0) return;
        const seedEl = document.getElementById('seed');
        if (!seedEl) return;
        
        let initialSeed = parseInt(seedEl.value, 10);
        if (isNaN(initialSeed)) { 
            initialSeed = 12345;
            seedEl.value = "12345"; 
        }
        
        const numRolls = currentRolls;
        const seeds = [];
        const rngForSeeds = new Xorshift32(initialSeed);
        for (let i = 0; i < numRolls * 25 + 500; i++) {
            seeds.push(rngForSeeds.next());
        }

        const columnConfigs = prepareColumnConfigs();
        const tableData = executeTableSimulation(numRolls, columnConfigs, seeds);

        // シミュレーション（ルート）のデータ取得
        // logicPathMap: Txtモードの不整合チェック用（全経路）
        // highlightMap / guarHighlightMap: テーブルの背景色用
        const { highlightMap, guarHighlightMap, logicPathMap, lastSeedValue } = preparePathHighlightMaps(initialSeed, seeds, numRolls);
        finalSeedForUpdate = lastSeedValue;

        // --- HTML構築開始 ---
        let finalContainerHtml = '';
        // Find（予報・ターゲット検索）エリアの生成
        if (typeof generateFastForecast === 'function') {
            finalContainerHtml += generateFastForecast(initialSeed, columnConfigs);
        }

        // ガチャのマスター詳細情報エリア
        if (typeof generateMasterInfoHtml === 'function' && showFindInfo && isMasterInfoVisible) {
            finalContainerHtml += `<div id="master-info-area" style="padding: 10px; background: #fdfdfd; border: 1px solid #ddd; border-top: none; margin-top: -16px; border-radius: 0 0 4px 4px; font-size: 0.85em;">`;
            finalContainerHtml += `<div style="border-top: 1px dashed #ccc; margin-bottom: 10px;"></div>`; 
            finalContainerHtml += generateMasterInfoHtml();
            finalContainerHtml += `</div>`;
        }

        // --- Txt（テキストルートビュー）モードの表示 ---
        // logicPathMap を追加で渡すことで、テーブルのハイライトとは独立して経路チェックを行います
        if (isTxtMode && isSimulationMode) {
            if (typeof generateTxtRouteView === 'function') {
                const txtViewHtml = generateTxtRouteView(seeds, initialSeed, highlightMap, guarHighlightMap, logicPathMap);
                if (!txtViewHtml.includes("ルートが入力されていません")) {
                    finalContainerHtml += txtViewHtml;
                }
            }
        }

        // Simモード時の操作ガイド
        if (isSimulationMode) {
            finalContainerHtml += `
                <div id="sim-auto-calc-notice" style="font-size: 0.75em; color: #666; padding: 5px 10px; background: #fff; border-left: 3px solid #007bff; margin: 5px 0;">
                    ※表のキャラ名をタップするとそのセルまでのルートを自動計算します。
                </div>`;
        }

        // メインテーブル本体の構築
        if (typeof buildTableDOM === 'function') {
            finalContainerHtml += buildTableDOM(numRolls, columnConfigs, tableData, seeds, highlightMap, guarHighlightMap);
        }

        const container = document.getElementById('rolls-table-container');
        if (container) {
            container.innerHTML = finalContainerHtml;
        }

        const resultDiv = document.getElementById('result');
        if (resultDiv) {
            resultDiv.style.display = 'block';
            resultDiv.textContent = isSimulationMode ? "Simulation Mode: Active" : "Display Mode";
        }
        
        updateUrlParams();
    } catch (e) {
        const container = document.getElementById('rolls-table-container');
        if (container) {
            container.innerHTML = `
                <div style="padding: 20px; color: #d9534f; background: #f2dede; border: 1px solid #ebccd1; border-radius: 4px;">
                    <h4 style="margin-top:0;">テーブル描画エラー</h4>
                    <p style="font-size: 0.9em;">${e.message}</p>
                </div>`;
        }
        console.error("Critical Table Build Error:", e);
    }
}

/**
 * executeTableSimulation をフックして計算データを保持
 */
(function() {
    const originalExecute = (typeof executeTableSimulation === 'function') ? executeTableSimulation : null;
    if (originalExecute) {
        executeTableSimulation = function(n, c, s) {
            const data = originalExecute(n, c, s);
            currentTableData = data;
            return data;
        };
    }
})();