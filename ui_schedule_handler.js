/** @file ui_schedule_handler.js @description スケジュールモード（skd）の切替、スケジュールからの列追加を担当 @dependency schedule_logic.js, view_schedule.js */

// スケジュール情報の事前解析
function prepareScheduleInfo() {
    if (isScheduleAnalyzed) return;
    if (typeof loadedTsvContent === 'string' && loadedTsvContent && 
        typeof parseGachaTSV === 'function' && typeof parseDateTime === 'function') {
        try {
            const scheduleData = parseGachaTSV(loadedTsvContent);
            const now = new Date();
            activeGuaranteedIds.clear();

            scheduleData.forEach(item => {
                const startDt = parseDateTime(item.rawStart, item.startTime);
                const endDt = parseDateTime(item.rawEnd, item.endTime);
                
                if (now >= startDt && now <= endDt) {
            
                    if (item.guaranteed) {
                        const gId = parseInt(item.id);
                        activeGuaranteedIds.add(gId);
                        /**
                        if (gachaMasterData && gachaMasterData.gachas && gachaMasterData.gachas[gId]) {
         
                            const currentName = gachaMasterData.gachas[gId].name;
                            if (!currentName.includes('[確定]')) {
                                 gachaMasterData.gachas[gId].name += " [確定]";
                            }
                        }
                        */
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

// スケジュールモードのUIセットアップ
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
}

// スケジュールモードの切り替え (skdボタン)
function toggleSchedule() {
    if (!loadedTsvContent) {
        alert("スケジュールの読み込みに失敗しました。");
        return;
    }

    isScheduleMode = !isScheduleMode;
    
    if (!isScheduleMode) {
        window.isScheduleEditMode = false;
    }

    if (typeof isDescriptionMode !== 'undefined' && isDescriptionMode && typeof toggleDescription === 'function' && isScheduleMode) {
        toggleDescription();
    }

    const scheduleBtn = document.getElementById('toggle-schedule-btn');
    const simWrapper = document.getElementById('sim-control-wrapper');
    const tableContainer = document.getElementById('rolls-table-container');
    const scheduleContainer = document.getElementById('schedule-container');
    const resultDiv = document.getElementById('result');
    const mainControls = document.getElementById('main-controls');

    if (isScheduleMode) {
        scheduleBtn.classList.add('active');
        if (simWrapper) simWrapper.classList.add('hidden');
        if (tableContainer) tableContainer.classList.add('hidden');
        if (resultDiv) resultDiv.classList.add('hidden');
        if (mainControls) mainControls.classList.add('hidden');
        if (scheduleContainer) {
            scheduleContainer.classList.remove('hidden');
            // 反映ボタン等で解析フラグが落ちている場合に備えて再解析
            prepareScheduleInfo();
            if (typeof renderScheduleTable === 'function') {
                renderScheduleTable(loadedTsvContent, 'schedule-container');
            }
        }
    } else {
        scheduleBtn.classList.remove('active');
        if (isSimulationMode && simWrapper) simWrapper.classList.remove('hidden');
        if (tableContainer) tableContainer.classList.remove('hidden');
        if (resultDiv && showResultDisplay) resultDiv.classList.remove('hidden');
        if (mainControls) mainControls.classList.remove('hidden');
        if (scheduleContainer) {
            scheduleContainer.classList.add('hidden');
        }
    }
}

/**
 * 編集モードへの移行処理
 */
function enterScheduleEditMode() {
    if (!loadedTsvContent) return;
    window.isScheduleEditMode = true;
    if (typeof renderScheduleEditor === 'function') {
        renderScheduleEditor(loadedTsvContent, 'schedule-container');
    }
}

// スケジュールから開催中・予定のガチャを一括追加
function addGachasFromSchedule() {
    if (!loadedTsvContent || typeof parseGachaTSV === 'function') {
        alert("スケジュールデータがありません。");
        return;
    }

    const scheduleData = parseGachaTSV(loadedTsvContent);
    const now = new Date();
    const todayStr = now.getFullYear() + 
                     String(now.getMonth() + 1).padStart(2, '0') + 
                     String(now.getDate()).padStart(2, '0');
    const todayInt = parseInt(todayStr, 10);

    const newGachaData = [];

    scheduleData.forEach((item, index) => {
        let endValue = parseInt(item.rawEnd, 10);
        const isPlat = item.seriesName.includes("プラチナ");
        const isLeg = item.seriesName.includes("レジェンド");

        if (isPlat || isLeg) {
            const nextSameType = scheduleData.slice(index + 1).find(nextItem => {
                if (isPlat) return nextItem.seriesName.includes("プラチナ");
                if (isLeg) return nextItem.seriesName.includes("レジェンド");
                return false;
            });
            if (nextSameType) {
                endValue = parseInt(nextSameType.rawStart, 10);
            }
        }

        if (endValue < todayInt) return;

        let fullId = item.id.toString();
        if (item.guaranteed) fullId += 'g';

        let typeOrder = 0;
        if (isPlat) typeOrder = 1;
        else if (isLeg) typeOrder = 2;
        
        newGachaData.push({
            fullId: fullId,
            rawStart: parseInt(item.rawStart, 10),
            typeOrder: typeOrder,
            count: 0
        });
    });

    if (newGachaData.length === 0) {
        alert("条件に合致するスケジュール（現在開催中または未来）がありません。");
        return;
    }

    newGachaData.sort((a, b) => {
        if (a.typeOrder !== b.typeOrder) return a.typeOrder - b.typeOrder;
        return a.rawStart - b.rawStart;
    });

    const scheduleIds = new Set(newGachaData.map(d => d.fullId.replace(/[gfs]$/, '')));
    const keptGachas = [];
    tableGachaIds.forEach((idWithSuffix, index) => {
        const baseId = idWithSuffix.replace(/[gfs]$/, '');
        if (!scheduleIds.has(baseId)) {
            keptGachas.push({
                fullId: idWithSuffix,
                count: uberAdditionCounts[index] || 0
            });
        }
    });

    const finalGachaList = [...keptGachas, ...newGachaData];
    tableGachaIds = finalGachaList.map(item => item.fullId);
    uberAdditionCounts = finalGachaList.map(item => item.count);
    if (typeof generateRollsTable === 'function') generateRollsTable();
    if (typeof updateMasterInfoView === 'function') updateMasterInfoView();
    if (typeof updateUrlParams === 'function') updateUrlParams();
}

