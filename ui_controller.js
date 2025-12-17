/**
 * ui_controller.js
 * アプリケーションのメインコントローラー
 * 初期化、モード管理、基本UI操作を担当
 */

// マスター情報の表示状態管理フラグ
let isMasterInfoVisible = true;

// --- 初期化ロジック ---

function initializeDefaultGachas() {
    // スケジュール情報を解析 (ui_schedule_handler.js)
    if (typeof prepareScheduleInfo === 'function') {
        prepareScheduleInfo();
    }

    if (tableGachaIds.length === 0) {
        let scheduleFound = false;
        if (isScheduleAnalyzed && typeof parseGachaTSV === 'function') {
            try {
                const scheduleData = parseGachaTSV(loadedTsvContent);
                const now = new Date();
                const activeGachas = scheduleData.filter(item => {
                    if (typeof isPlatinumOrLegend === 'function' && isPlatinumOrLegend(item)) return false;
                    const startDt = parseDateTime(item.rawStart, item.startTime);
                    const endDt = parseDateTime(item.rawEnd, item.endTime);
              
                    return now >= startDt && now <= endDt;
                });
                if (activeGachas.length > 0) {
                    activeGachas.forEach(gacha => {
                        let newId = gacha.id.toString();
                        if (gacha.guaranteed) newId += 'g';
                   
                        tableGachaIds.push(newId);
                        uberAdditionCounts.push(0); 
                    });
                    scheduleFound = true;
                }
            } catch (e) {
                console.warn("Auto-select from schedule failed:", e);
            }
        }
        
        // スケジュールから見つからなければデフォルトロジック
        if (!scheduleFound || tableGachaIds.length === 0) {
            const options = getGachaSelectorOptions(null);
            if (options.length > 0) {
                tableGachaIds.push(options[0].value);
                uberAdditionCounts.push(0);
                if (options.length > 1) {
                    tableGachaIds.push(options[1].value);
                    uberAdditionCounts.push(0);
                }
            } else {
                const sortedGachas = Object.values(gachaMasterData.gachas)
                    .filter(gacha => gacha.sort < 800)
                    .sort((a, b) => a.sort - b.sort);
                if (sortedGachas.length > 0) {
                    tableGachaIds.push(sortedGachas[0].id);
                    uberAdditionCounts.push(0);
                }
                if (sortedGachas.length > 1) {
                    tableGachaIds.push(sortedGachas[1].id);
                    uberAdditionCounts.push(0);
                }
            }
        }
    }

    const seedEl = document.getElementById('seed');
    if (seedEl && (seedEl.value === '12345' || seedEl.value === '')) {
        showSeedInput();
    }
}


// --- モード切替 ---

function onModeChange() {
    updateModeButtonState();
    refreshModeView();
}

function toggleAppMode() {
    isSimulationMode = !isSimulationMode;
    onModeChange();
}

function updateModeButtonState() {
    const btn = document.getElementById('mode-toggle-btn');
    if (btn) {
        if (isSimulationMode) {
            // Simモード中は「Back」と表示
            btn.textContent = "Back";
            btn.classList.add('active');
        } else {
            btn.textContent = "Sim";
            btn.classList.remove('active');
        }
    }
}

function refreshModeView() {
    const simWrapper = document.getElementById('sim-control-wrapper');
    if (simWrapper) {
        if (isSimulationMode && !isScheduleMode && !isDescriptionMode) {
            simWrapper.classList.remove('hidden');
        } else {
            simWrapper.classList.add('hidden');
        }
    }
    resetAndGenerateTable();
}

// --- テーブル更新・リセット ---

function resetAndGenerateTable() {
    if (isScheduleMode || isDescriptionMode) return;
    finalSeedForUpdate = null;
    const simConf = document.getElementById('sim-config');
    if (simConf && simConf.value.trim() === '') {
         currentRolls = 300;
    }
    
    if (typeof generateRollsTable === 'function') generateRollsTable();
    updateMasterInfoView();
    if (typeof updateUrlParams === 'function') updateUrlParams();
}

function addMoreRolls() {
    currentRolls += 100;
    if (typeof generateRollsTable === 'function') generateRollsTable();
}

// シード更新（セルクリック時などに呼ばれる）
function updateSeedAndRefresh(newSeed) {
    const seedInput = document.getElementById('seed');
    if(seedInput && newSeed) {
        seedInput.value = newSeed;
        currentRolls = 300;
        if (typeof generateRollsTable === 'function') generateRollsTable();
        updateMasterInfoView();
        if (typeof updateUrlParams === 'function') updateUrlParams();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// シミュレーションConfigクリア
function clearSimConfig() {
    const el = document.getElementById('sim-config');
    if(el) el.value = '';
    // エラーメッセージもクリア
    const errorEl = document.getElementById('sim-error-msg');
    if (errorEl) {
        errorEl.textContent = '';
        errorEl.style.display = 'none';
    }

    resetAndGenerateTable();
}

// シミュレーションConfig 一つ戻る (Back)
function backSimConfig() {
    const el = document.getElementById('sim-config');
    if (el && typeof removeLastConfigSegment === 'function') {
        el.value = removeLastConfigSegment(el.value);
        resetAndGenerateTable();
    }
}

// シミュレーション結果のシードをStart Seedに反映
function updateSeedFromSim() {
    if (finalSeedForUpdate) {
        document.getElementById('seed').value = finalSeedForUpdate;
        document.getElementById('sim-config').value = '';
        resetAndGenerateTable(); 
    }
}


// --- SEED入力欄の制御 ---

function showSeedInput() {
    const container = document.getElementById('seed-input-container');
    const trigger = document.getElementById('seed-input-trigger');
    if (container) container.classList.remove('hidden');
    if (trigger) trigger.classList.add('hidden');
    
    const input = document.getElementById('seed');
    if (input) input.focus();
}

function applySeedInput() {
    if (typeof updateUrlParams === 'function') updateUrlParams();
    resetAndGenerateTable();
    
    const container = document.getElementById('seed-input-container');
    const trigger = document.getElementById('seed-input-trigger');
    
    if (container) container.classList.add('hidden');
    if (trigger) trigger.classList.remove('hidden');
}

// 追加: SEED入力をキャンセルして閉じる
function cancelSeedInput() {
    const container = document.getElementById('seed-input-container');
    const trigger = document.getElementById('seed-input-trigger');
    const input = document.getElementById('seed');

    // 現在のURLパラメータから値を復元（変更を破棄）
    const urlParams = new URLSearchParams(window.location.search);
    const currentSeed = urlParams.get('seed') || "12345";
    if (input) input.value = currentSeed;

    if (container) container.classList.add('hidden');
    if (trigger) trigger.classList.remove('hidden');
}

// 追加: SEEDをクリップボードにコピー
function copySeedToClipboard() {
    const seedInput = document.getElementById('seed');
    if (!seedInput) return;
    navigator.clipboard.writeText(seedInput.value).catch(err => {
        console.error('Failed to copy: ', err);
    });
}


// --- 表示切替 ---

function toggleSeedColumns() {
    showSeedColumns = !showSeedColumns;
    if (typeof generateRollsTable === 'function') generateRollsTable(); 
    updateToggleButtons();
}

function updateToggleButtons() {
    const btnSeed = document.getElementById('toggle-seed-btn');
    if(btnSeed) btnSeed.textContent = showSeedColumns ? 'SEED非表示' : 'SEED表示';
}

// 追加: マスター情報の表示切替
function toggleMasterInfo() {
    isMasterInfoVisible = !isMasterInfoVisible;
    const el = document.getElementById('master-info-area');
    const btn = document.getElementById('toggle-master-info-btn');
    
    if (el) {
        if (isMasterInfoVisible) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    }
    
    if (btn) {
        btn.textContent = isMasterInfoVisible ? 'マスター情報を隠す' : 'マスター情報を表示';
    }
}

function toggleDescription() {
    const content = document.getElementById('description-content');
    const toggle = document.getElementById('toggle-description');
    // UI要素の取得
    const tableContainer = document.getElementById('rolls-table-container');
    const simWrapper = document.getElementById('sim-control-wrapper');
    const resultDiv = document.getElementById('result');
    const mainControls = document.getElementById('main-controls');
    const scheduleContainer = document.getElementById('schedule-container');

    // モード切替
    isDescriptionMode = !isDescriptionMode;
    if (isDescriptionMode) {
        // --- 概要モード ON ---

        // 1. スケジュールモードが開いていれば閉じる
        if (typeof isScheduleMode !== 'undefined' && isScheduleMode && typeof toggleSchedule === 'function') {
            toggleSchedule();
        }

        // 2. ボタン状態更新
        if (toggle) {
            toggle.textContent = 'Back';
            toggle.classList.add('active');
        }

        // 3. メイン画面の要素を隠す
        if (tableContainer) tableContainer.classList.add('hidden');
        if (simWrapper) simWrapper.classList.add('hidden');
        if (resultDiv) resultDiv.classList.add('hidden');
        if (mainControls) mainControls.classList.add('hidden');
        if (scheduleContainer) scheduleContainer.classList.add('hidden');
        // 4. 概要コンテンツを表示＆スタイル調整
        if (content) {
            content.classList.remove('hidden');
            content.style.flexGrow = '1';       
            content.style.overflowY = 'auto';   
            content.style.height = '100%';
            content.style.webkitOverflowScrolling = 'touch';
            content.style.minHeight = '0';
            content.style.maxHeight = 'none';
        }

    } else {
        // --- 概要モード OFF ---

        // 1. ボタン状態更新
        if (toggle) {
            toggle.textContent = '概要';
            toggle.classList.remove('active');
        }

        // 2. 概要コンテンツを隠す＆スタイルリセット
        if (content) {
            content.classList.add('hidden');
            content.style.flexGrow = '';
            content.style.overflowY = '';
            content.style.height = '';
            content.style.minHeight = '';
            content.style.maxHeight = '';
            content.style.webkitOverflowScrolling = '';
        }

        // 3. メイン画面の要素を復帰
        if (tableContainer) tableContainer.classList.remove('hidden');
        if (mainControls) mainControls.classList.remove('hidden');
        
        if (isSimulationMode && simWrapper) simWrapper.classList.remove('hidden');
        if (showResultDisplay && resultDiv) resultDiv.classList.remove('hidden');
    }
}

function toggleFindInfo() {
    showFindInfo = !showFindInfo;
    const btn = document.getElementById('toggle-find-info-btn');
    if (typeof generateRollsTable === 'function') {
        generateRollsTable();
    }
    if (btn) btn.textContent = showFindInfo ? 'Findを隠す' : 'Find';
}

// --- 共通View更新 ---

function updateMasterInfoView() {
    // マスター情報は generateRollsTable 内で生成されるため、ここでは何もしない
    // (将来的に分離する場合はここにロジックを追加)
}

/**
 * セルクリック時のハンドラ
 * Simモード時: ルートを計算してConfigに入力
 * 通常時: キャラ名をクリップボードにコピー（またはSimモードへ誘導）
 * @param targetSeedIndex クリックされたセルのシードインデックス
 * @param gachaId ガチャID
 * @param charName キャラ名
 * @param guaranteedType (optional) 確定枠クリック時の指定 (例: '11g', '15g', '7g')
 */
function onGachaCellClick(targetSeedIndex, gachaId, charName, guaranteedType = null) {
    if (isSimulationMode) {
        // まずエラー表示をクリア
        const errorEl = document.getElementById('sim-error-msg');
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.style.display = 'none';
        }

        const visibleIds = tableGachaIds.map(id => id);
        // Config欄の現在の値を取得
        const configInput = document.getElementById('sim-config');
        const currentConfig = configInput ? configInput.value : "";

        // ルート計算 (simulation.js)
        if (typeof calculateRouteToCell === 'function') {
            let routeConfig;
            if (guaranteedType) {
                // 確定枠クリック時の特別なアクション
                const finalAction = { 
                    id: gachaId, 
                    rolls: parseInt(guaranteedType.replace('g', ''), 10), 
               
                    g: true 
                };
                // 第5引数に finalAction を渡す
                routeConfig = calculateRouteToCell(targetSeedIndex, gachaId, visibleIds, currentConfig, finalAction);
            } else {
                // 通常クリック
                routeConfig = calculateRouteToCell(targetSeedIndex, gachaId, visibleIds, currentConfig);
            }

            if (routeConfig) {
                // 【追加ロジック】
                // Simモードでクリックした際、現在の構成（特に確定枠など）を書き換えて無理やり到達するルートを提示するのではなく、
                // 「ここから先へのルート」として成立しない（過去改変が必要な）場合は「見つからない」扱いにする。
                // 判定：currentConfigが空でなく、かつ、routeConfigがcurrentConfigから始まっていない（追記でない）場合は除外。
                
                const normCurrent = currentConfig.replace(/\s+/g, ' ').trim();
                const normRoute = routeConfig.replace(/\s+/g, ' ').trim();

                if (normCurrent.length > 0 && !normRoute.startsWith(normCurrent)) {
                    // 履歴の書き換えが発生しているため、ルートとしては不採用（無効）とする
                    routeConfig = null;
                }
            }

            if (routeConfig) {
                // 成功: Configに入力して更新
                if (configInput) {
                    configInput.value = routeConfig;
                    if (typeof updateUrlParams === 'function') updateUrlParams();
                    resetAndGenerateTable();
                }
            } else {
                // 失敗: ルートが見つからない場合
                // Configは更新せず、エラーメッセージを表示する
                if (errorEl) {
                    // セル番号の計算 (SeedIndex -> A1, B10 etc.)
                    const row = Math.floor(targetSeedIndex / 2) + 1;
                    const side = (targetSeedIndex % 2 === 0) ? 'A' : 'B';
                    const cellLabel = `${side}${row}`;
                    
                    errorEl.textContent = `${cellLabel}セルへのルートは見つかりませんでした`;
                    errorEl.style.display = 'block'; 
                }
                console.warn("Route not found or history rewrite rejected.");
            }
        }
    } else {
        // 通常モード時の挙動
        const confirmSwitch = confirm(`Simモードに切り替えて、このセル(${charName})へのルートを計算しますか？`);
        if (confirmSwitch) {
            toggleAppMode();
            setTimeout(() => {
                onGachaCellClick(targetSeedIndex, gachaId, charName, guaranteedType);
            }, 100);
        }
    }
}