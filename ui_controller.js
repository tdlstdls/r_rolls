/**
 * ui_controller.js
 * 画面描画制御、イベントハンドラ、UI状態管理
 * (ロジック詳細は url_manager.js, gacha_selector.js, table_renderer.js に委譲)
 */

// UI状態変数 (Global)
let tableGachaIds = [];
let currentRolls = 2000; // ★変更1: 初期値を2000に設定
let showSeedColumns = false;
let showResultDisplay = false;
let finalSeedForUpdate = null;
let isSimulationMode = false;
let isScheduleMode = false;
let activeGuaranteedIds = new Set(); // 現在開催中で確定のガチャIDを保持
let isScheduleAnalyzed = false;
// 解析済みフラグ

// 超激レア追加シミュレーション用 (index -> 追加数)
let uberAdditionCounts = {};

// --- スケジュール解析とデータ反映の共通関数 ---
// gacha_selector.js や initializeDefaultGachas から呼ばれる
function prepareScheduleInfo() {
    if (isScheduleAnalyzed) return;
// すでに実行済みならスキップ

    if (typeof loadedTsvContent === 'string' && loadedTsvContent && 
        typeof parseGachaTSV === 'function' && typeof parseDateTime === 'function') {
        
        try {
            const scheduleData = parseGachaTSV(loadedTsvContent);
            const now = new Date();
            activeGuaranteedIds.clear();

            scheduleData.forEach(item => {
                const startDt = parseDateTime(item.rawStart, item.startTime);
                const endDt = parseDateTime(item.rawEnd, item.endTime);
                
                // 現在開催中かどうか
                if (now >= startDt && now <= endDt) {
                    // 確定ガチャの場合の処理
                    if (item.guaranteed) {
                        const gId = parseInt(item.id);
                        activeGuaranteedIds.add(gId);

                        // マスタデータの名称に [確定] を追加表示 (未追加の場合のみ)
                        if (gachaMasterData && gachaMasterData.gachas && gachaMasterData.gachas[gId]) {
                            const currentName = gachaMasterData.gachas[gId].name;
                            if (!currentName.includes('[確定]')) {
                                gachaMasterData.gachas[gId].name += " [確定]";
                            }
                        }
                    }
                }
            });
            isScheduleAnalyzed = true;
            console.log("Schedule Analyzed. Active Guaranteed IDs:", Array.from(activeGuaranteedIds));

        } catch (e) {
            console.warn("Schedule analysis failed:", e);
        }
    }
}

// --- 初期化関連 ---

function initializeDefaultGachas() {
    // まずスケジュール情報を整理
    prepareScheduleInfo();
    if (tableGachaIds.length === 0) {
        let scheduleFound = false;
        // 1. スケジュールロジックを利用して「現在開催中」の情報を解析
        if (isScheduleAnalyzed && typeof parseGachaTSV === 'function') {
            try {
                const scheduleData = parseGachaTSV(loadedTsvContent);
                const now = new Date();

                // デフォルト表示用のガチャ選択 (プラチナ・レジェンド以外)
                const activeGachas = scheduleData.filter(item => {
                    if (typeof isPlatinumOrLegend === 'function' && isPlatinumOrLegend(item)) return false;
                    const startDt = parseDateTime(item.rawStart, item.startTime);
                    
                    const endDt = parseDateTime(item.rawEnd, item.endTime);
                    return now >= startDt && now <= endDt;
                });
                if (activeGachas.length > 0) {
                    activeGachas.forEach(gacha => {
                        let newId = gacha.id.toString();
                        // 確定フラグがあれば 'g' (11連確定) をデフォルトにする
                        if (gacha.guaranteed) {
                            newId += 'g';
                        }
                        tableGachaIds.push(newId);
                    });
                    scheduleFound = true;
                }
            } catch (e) {
                console.warn("Auto-select from schedule failed:", e);
            }
        }

        // 2. スケジュールから特定できなかった場合のフォールバック
        if (!scheduleFound || tableGachaIds.length === 0) {
            const options = getGachaSelectorOptions(null);
            if (options.length > 0) {
                tableGachaIds.push(options[0].value);
                if (options.length > 1) {
                    tableGachaIds.push(options[1].value);
                }
            } else {
                const sortedGachas = Object.values(gachaMasterData.gachas)
                    .filter(gacha => gacha.sort < 800)
                    .sort((a, b) => a.sort - b.sort);
                if (sortedGachas.length > 0) tableGachaIds.push(sortedGachas[0].id);
                if (sortedGachas.length > 1) tableGachaIds.push(sortedGachas[1].id);
            }
        }
    }
}

// --- イベントハンドラ ---

function onModeChange() {
    const radios = document.getElementsByName('appMode');
    for (const radio of radios) {
        if (radio.checked) {
            isSimulationMode = (radio.value === 'simulation');
            break;
        }
    }
    const simWrapper = document.getElementById('sim-control-wrapper');
    if (simWrapper) {
        if (isSimulationMode && !isScheduleMode) {
            simWrapper.classList.remove('hidden');
        } else {
            simWrapper.classList.add('hidden');
        }
    }
    resetAndGenerateTable();
}

function resetAndGenerateTable() {
    if (isScheduleMode) return;
    finalSeedForUpdate = null;
    const simConf = document.getElementById('sim-config');
    if (simConf && simConf.value.trim() === '') {
         // ★変更2: ここで強制的に100に戻されていたのを2000に変更
         currentRolls = 2000; 
    }
    generateRollsTable();
    updateUrlParams();
}

function addMoreRolls() {
    currentRolls += 100;
    generateRollsTable();
}

function updateSeedAndRefresh(newSeed) {
    const seedInput = document.getElementById('seed');
    if(seedInput && newSeed) {
        seedInput.value = newSeed;
        currentRolls = 2000; // ★ここも念のため初期値(2000)に戻す設定にしておきます
        generateRollsTable();
        updateUrlParams();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function clearSimConfig() {
    const el = document.getElementById('sim-config');
    if(el) el.value = '';
    resetAndGenerateTable();
}

function updateSeedFromSim() {
    if (finalSeedForUpdate) {
        document.getElementById('seed').value = finalSeedForUpdate;
        document.getElementById('sim-config').value = '';
        resetAndGenerateTable(); 
    }
}

function addGachaColumn() {
    const options = getGachaSelectorOptions(null);
    if (options.length > 0) {
        // 追加時も、そのガチャが確定中なら最初から 'g' をつける
        let val = options[0].value;
        if (activeGuaranteedIds.has(parseInt(val))) {
            val += 'g';
        }
        tableGachaIds.push(val);
        generateRollsTable();
    }
}

function removeGachaColumn(index) {
    tableGachaIds.splice(index, 1);
    delete uberAdditionCounts[index];
    generateRollsTable();
}

function updateGachaSelection(selectElement, index) {
    const originalIdWithSuffix = tableGachaIds[index];
    const newBaseId = selectElement.value;
    // 選択されたガチャが現在「確定」かどうかチェック
    if (activeGuaranteedIds.has(parseInt(newBaseId))) {
        // 確定ガチャなら強制的に 11g (11連確定) モードにする
        tableGachaIds[index] = newBaseId + 'g';
    } else {
        // 確定でない場合は、元のサフィックスを引き継ぐ
        let suffix = '';
        if (originalIdWithSuffix.endsWith('f')) suffix = 'f';
        else if (originalIdWithSuffix.endsWith('s')) suffix = 's';
        else if (originalIdWithSuffix.endsWith('g')) suffix = 'g';
        tableGachaIds[index] = newBaseId + suffix;
    }
    
    generateRollsTable();
}

function toggleGuaranteedColumn(index) {
    const currentVal = tableGachaIds[index];
    
    let baseId = currentVal;
    let suffix = '';
    if (currentVal.endsWith('f')) {
        suffix = 'f';
        baseId = currentVal.substring(0, currentVal.length - 1);
    } else if (currentVal.endsWith('s')) {
        suffix = 's';
        baseId = currentVal.substring(0, currentVal.length - 1);
    } else if (currentVal.endsWith('g')) {
        suffix = 'g';
        baseId = currentVal.substring(0, currentVal.length - 1);
    }

    let nextSuffix = '';
    // サイクル: ''(通常) -> 'g'(11連) -> 'f'(15連) -> 's'(7連) -> ''(通常)
    if (suffix === '') nextSuffix = 'g';
    else if (suffix === 'g') nextSuffix = 'f';
    else if (suffix === 'f') nextSuffix = 's';
    else if (suffix === 's') nextSuffix = '';

    tableGachaIds[index] = baseId + nextSuffix;
    generateRollsTable();
}

function updateUberAddition(selectElement, index) {
    const val = parseInt(selectElement.value, 10);
    if (!isNaN(val)) {
        uberAdditionCounts[index] = val;
    } else {
        uberAdditionCounts[index] = 0;
    }
    generateRollsTable();
}

function toggleSeedColumns() {
    showSeedColumns = !showSeedColumns;
    generateRollsTable(); 
    updateToggleButtons();
}

function toggleResultDisplay() {
    showResultDisplay = !showResultDisplay;
    const res = document.getElementById('result');
    if(res) res.classList.toggle('hidden', !showResultDisplay);
    updateToggleButtons();
}

function updateToggleButtons() {
    const btnSeed = document.getElementById('toggle-seed-btn');
    const btnRes = document.getElementById('toggle-result-btn');
    if(btnSeed) btnSeed.textContent = showSeedColumns ? 'SEEDを非表示' : 'SEEDを表示';
    if(btnRes) btnRes.textContent = showResultDisplay ? '計算過程を非表示' : '計算過程を表示';
}

function toggleDescription() {
    const content = document.getElementById('description-content');
    const toggle = document.getElementById('toggle-description');
    if(content && toggle) {
        const isHidden = content.classList.toggle('hidden');
        toggle.textContent = isHidden ?
        '概要を表示' : '概要を非表示';
    }
}

// --- スケジュール表示関連 ---

function setupScheduleUI() {
    let scheduleContainer = document.getElementById('schedule-container');
    if (!scheduleContainer) {
        scheduleContainer = document.createElement('div');
        scheduleContainer.id = 'schedule-container';
        scheduleContainer.className = 'hidden';
        const tableContainer = document.getElementById('rolls-table-container');
        if (tableContainer) {
            tableContainer.parentNode.insertBefore(scheduleContainer, tableContainer.nextSibling);
        } else {
            document.body.appendChild(scheduleContainer);
        }
    }

    if (!document.getElementById('toggle-schedule-btn')) {
        const btn = document.createElement('button');
        btn.id = 'toggle-schedule-btn';
        btn.textContent = 'スケジュールを表示';
        btn.onclick = toggleSchedule;
        btn.className = 'secondary';
        
        const refBtn = document.getElementById('toggle-description');
        if (refBtn && refBtn.parentNode) {
            refBtn.parentNode.insertBefore(btn, refBtn.nextSibling);
        } else {
            const controls = document.querySelector('.controls');
            if(controls) controls.appendChild(btn);
        }
    }
}

function toggleSchedule() {
    if (!loadedTsvContent) {
        alert("スケジュールの読み込みに失敗しました。");
        return;
    }

    isScheduleMode = !isScheduleMode;
    const scheduleBtn = document.getElementById('toggle-schedule-btn');
    const simWrapper = document.getElementById('sim-control-wrapper');
    const tableContainer = document.getElementById('rolls-table-container');
    const scheduleContainer = document.getElementById('schedule-container');
    const resultDiv = document.getElementById('result');
    const bottomControls = document.getElementById('bottom-controls');
    if (isScheduleMode) {
        scheduleBtn.textContent = 'ロールズに戻る';
        scheduleBtn.classList.add('active');
        if (simWrapper) simWrapper.classList.add('hidden');
        if (tableContainer) tableContainer.classList.add('hidden');
        if (resultDiv) resultDiv.classList.add('hidden');
        if (bottomControls) bottomControls.classList.add('hidden');
        if (scheduleContainer) {
            scheduleContainer.classList.remove('hidden');
            if (typeof renderScheduleTable === 'function') {
                renderScheduleTable(loadedTsvContent, 'schedule-container');
            }
        }
    } else {
        scheduleBtn.textContent = 'スケジュールを表示';
        scheduleBtn.classList.remove('active');
        if (isSimulationMode && simWrapper) simWrapper.classList.remove('hidden');
        if (tableContainer) tableContainer.classList.remove('hidden');
        if (resultDiv && showResultDisplay) resultDiv.classList.remove('hidden');
        if (bottomControls) bottomControls.classList.remove('hidden');
        if (scheduleContainer) scheduleContainer.classList.add('hidden');
    }
}