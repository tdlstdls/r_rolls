/** @file view_table.js @description ガチャ結果テーブル全体の描画制御（マスター情報・Sim・Txt表示統合版） */

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
        // テーブル表示に必要な十分な数のシードを生成
        for (let i = 0; i < numRolls * 25 + 500; i++) seeds.push(rngForSeeds.next());

        const columnConfigs = prepareColumnConfigs();
        const tableData = executeTableSimulation(numRolls, columnConfigs, seeds);

        // ハイライト判定とシミュレーション後の最終シード取得
        const { highlightMap, guarHighlightMap, lastSeedValue } = preparePathHighlightMaps(initialSeed, seeds, numRolls);
        finalSeedForUpdate = lastSeedValue;

        // 1. Find（予報・ターゲット検索）エリアのHTML生成
        let findAreaHtml = '';
        if (typeof generateFastForecast === 'function') {
            findAreaHtml += generateFastForecast(initialSeed, columnConfigs);
        }

        // --- 機能復元：ガチャのマスター詳細情報エリアの作成 ---
        // Findボタンが有効（showFindInfo）かつ、マスター表示ボタンが活性（isMasterInfoVisible）の場合のみ出力
        if (typeof generateMasterInfoHtml === 'function' && showFindInfo && isMasterInfoVisible) {
            findAreaHtml += `<div id="master-info-area" style="padding: 10px; background: #fdfdfd; border: 1px solid #ddd; border-top: none; margin-top: -16px; border-radius: 0 0 4px 4px; font-size: 0.85em;">`;
            findAreaHtml += `<div style="border-top: 1px dashed #ccc; margin-bottom: 10px;"></div>`; 
            findAreaHtml += generateMasterInfoHtml();
            findAreaHtml += `</div>`;
        }
        // ---------------------------------------------------

        const container = document.getElementById('rolls-table-container');
        if (!container) return;

        // 2. テーブル本体のHTMLを生成 (view_table_dom.js等に依存)
        const tableHtml = buildTableDOM(numRolls, columnConfigs, tableData, seeds, highlightMap, guarHighlightMap);

        // 3. Sim（シミュレーション）モード時の注釈の復元
        let simNoticeHtml = '';
        if (isSimulationMode) {
            simNoticeHtml = `<div id="sim-auto-calc-notice" style="font-size: 0.75em; color: #666; padding: 5px 10px; background: #fff;">
                ※下の表のキャラ名をタップ（クリック）するとそのセルまでのルートを自動計算します。自動計算では、超激確定・プラチナ・レジェンドは消費を避けるため使用しません。
            </div>`;
        }

        // 4. Txt（テキストルートビュー）モード時の表示ロジックの復元
        if (isTxtMode && isSimulationMode) {
            if (typeof generateTxtRouteView === 'function') {
                const txtViewHtml = generateTxtRouteView(seeds, initialSeed);
                // ルート未入力時のエラーメッセージが含まれているかチェック
                if (txtViewHtml.includes("ルートが入力されていません")) {
                    // ルートがない場合は、メッセージを表示せず通常のテーブルのみを表示
                    container.innerHTML = findAreaHtml + simNoticeHtml + tableHtml;
                } else {
                    // ルートがある場合は、テキストビューを上、テーブルを下にして両方表示
                    container.innerHTML = findAreaHtml + txtViewHtml + simNoticeHtml + tableHtml;
                }
            } else {
                container.innerHTML = findAreaHtml + simNoticeHtml + tableHtml;
            }
        } else {
            // 通常表示モード
            container.innerHTML = findAreaHtml + simNoticeHtml + tableHtml;
        }

        const resultDiv = document.getElementById('result');
        if (resultDiv) {
            resultDiv.textContent = isSimulationMode ? "Simulation active..." : "Display Mode";
        }
        
        // デバッグモーダル等の初期化とURL同期
        if (typeof initDebugModal === 'function') initDebugModal();
        updateUrlParams();
        
    } catch (e) {
        const container = document.getElementById('rolls-table-container');
        if (container) container.innerHTML = `<p class="error">テーブル描画エラー: ${e.message}</p>`;
        console.error("Table Build Error:", e);
    }
}

/**
 * executeTableSimulation をフックして、最新の計算データを保持する
 * これにより詳細ログ（11Gデバッグ等）で最新の状態を参照可能にします。
 */
(function() {
    if (typeof executeTableSimulation === 'function') {
        const originalExecute = executeTableSimulation;
        executeTableSimulation = function(n, c, s) {
            currentTableData = originalExecute(n, c, s);
            return currentTableData;
        };
    }
})();