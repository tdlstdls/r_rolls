/** @file view_schedule_table.js @description リスト形式のスケジュール表描画 */

function renderScheduleTable(tsvContent, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const data = parseGachaTSV(tsvContent);
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayInt = getDateInt(yesterday);
    
    let filteredData = data.filter(item => parseInt(item.rawEnd) >= yesterdayInt);
    // フィルタ: 終了分の非表示設定
    if (hideEndedSchedules) {
        filteredData = filteredData.filter(item => {
            const endDt = parseDateTime(item.rawEnd, item.endTime);
            return now <= endDt;
        });
    }

    // ソート順：開催終了分を最優先 -> 通常ガチャ（日付順） -> 特別枠（日付順）
    filteredData.sort((a, b) => {
        const endA = parseDateTime(a.rawEnd, a.endTime);
        const endB = parseDateTime(b.rawEnd, b.endTime);
        const isEndedA = now > endA;
        const isEndedB = now > endB;

        if (isEndedA !== isEndedB) return isEndedA ? -1 : 1;

        const isSpecialA = isPlatinumOrLegend(a);
      
        const isSpecialB = isPlatinumOrLegend(b);
        if (isSpecialA !== isSpecialB) return isSpecialA ? 1 : -1; 

        return parseInt(a.rawStart) - parseInt(b.rawStart);
    });
    const ganttHtml = renderGanttChart(data);
    const hideBtnClass = hideEndedSchedules ? 'text-btn active' : 'text-btn';
    let html = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
            <h3 style="margin:0;">開催スケジュール</h3>
            <span onclick="toggleHideEnded()" class="${hideBtnClass}" style="font-size: 0.8em;">終了分を非表示</span>
        </div>
        ${ganttHtml}
        <div style="margin-top: 20px;"></div>
        <div class="schedule-scroll-wrapper">
        <table class="schedule-table">
        
        <thead>
            <tr>
                <th style="min-width:50px;">自</th>
                <th style="min-width:50px;">至</th>
                <th>ガチャ名 / 詳細</th>
                <th>レア</th>
            
                <th>激レア</th>
    
                <th>超激</th>
                <th>伝説</th>
                <th>確定</th>
            </tr>
        </thead>
        <tbody>
    `;
    filteredData.forEach((item, index) => {
        let seriesDisplay = item.seriesName ? item.seriesName : "シリーズ不明";
        
        // 修正点1: ステップアップ（item.stepup）でない場合のみ「[確定]」を付与する
        if (item.guaranteed && !item.stepup && !seriesDisplay.includes("[確定]")) {
            seriesDisplay += " [確定]";
        }
        
        // ステップアップのラベル追加処理
        if (item.stepup && !seriesDisplay.includes("[StepUp]")) {
            seriesDisplay += " [StepUp]";
        }

        const startStr = `${formatDateJP(item.rawStart)}<br><span style="font-size:0.85em">${formatTime(item.startTime)}</span>`;
        const endDateFormatted = formatDateJP(item.rawEnd);
        let endStr = endDateFormatted;

        const isPlat = item.seriesName.includes("プラチナ");
        const isLeg = item.seriesName.includes("レジェンド");
        let isAppliedNextStart = false;

        if (isPlat || isLeg) {
            const nextSameType = filteredData.slice(index + 1).find(nextItem => {
                if (isPlat) return nextItem.seriesName.includes("プラチナ");
                if (isLeg) return nextItem.seriesName.includes("レジェンド");
                return false;
            });
    
            if (nextSameType) {
                if (parseInt(nextSameType.rawStart) < yesterdayInt) {
                    return;
                }

                endStr = `${formatDateJP(nextSameType.rawStart)}<br><span style="font-size:0.85em">${formatTime(nextSameType.startTime)}</span>`;
                isAppliedNextStart = true;
            }
        }

        if (!isAppliedNextStart && endDateFormatted !== '永続') {
            endStr += `<br><span style="font-size:0.85em">${formatTime(item.endTime)}</span>`;
        }
        
        const isPlatLeg = isPlatinumOrLegend(item);
        const uberRateVal = parseInt(item.uber);
        let uberStyle = ( !isPlatLeg && uberRateVal !== 500 ) ? 'color:red; font-weight:bold;' : '';
        const legendRateVal = parseInt(item.legend);
        let legendStyle = ( !isPlatLeg && legendRateVal > 30 ) ? 'color:red; font-weight:bold;' : '';
        const endDateTime = parseDateTime(item.rawEnd, item.endTime);

        // 修正点2: 行のハイライト（row-guaranteed）もステップアップの場合は除外する
        let rowClass = (now > endDateTime) ? "row-ended" : ((item.guaranteed && !item.stepup) ? "row-guaranteed" : "");
        
        html += `
            <tr class="${rowClass}">
                <td>${startStr}</td>
                <td>${endStr}</td>
                <td style="text-align:left; vertical-align: middle;">
                    <div style="font-weight:bold; color:#000;">${seriesDisplay} <span style="font-weight:normal; font-size:0.9em; color:#555; user-select: text;">(ID: ${item.id})</span></div>
                    <div style="font-size:0.85em; color:#333; margin-top:2px;">${item.tsvName}</div>
                </td>
                <td>${fmtRate(item.rare)}</td>
                <td>${fmtRate(item.supa)}</td>
                <td style="${uberStyle}">${fmtRate(item.uber)}</td>
                <td style="${legendStyle}">${fmtRate(item.legend)}</td>
                <td style="text-align:center; font-size:1.2em;">
                    ${(item.guaranteed && !item.stepup) ? // 修正点3: 確定列の赤丸表示もステップアップを除外
                '<span style="color:red;">●</span>' : '-'}
                </td>
            </tr>
        `;
    });

    html += `</tbody></table></div>`;

    // 編集モードへの移行ボタンを追加
    html += `
        <div style="margin-top: 20px; padding-bottom: 30px; text-align: center;">
            <button id="enter-edit-mode-btn" class="secondary" onclick="enterScheduleEditMode()" style="padding: 10px 20px; font-size: 14px;">
                スケジュールを編集する
            </button>
        </div>
    `;

    container.innerHTML = html;
}