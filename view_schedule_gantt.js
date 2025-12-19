/** @file view_schedule_gantt.js @description ガントチャートの描画処理 */

function renderGanttChart(data) {
    const filteredData = data.filter(item => !isPlatinumOrLegend(item));
    if (filteredData.length === 0) return '<p>表示可能なスケジュールがありません。</p>';

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0); 
    const yesterdayInt = getDateInt(yesterday);
    
    let activeData = filteredData.filter(item => parseInt(item.rawEnd) >= yesterdayInt);
    const now = new Date();

    // フィルタ: 終了分の非表示設定
    if (hideEndedSchedules) {
        activeData = activeData.filter(item => {
            const endDt = parseDateTime(item.rawEnd, item.endTime);
            return now <= endDt;
        });
    }

    // ソート: 開催終了分を最優先
    activeData.sort((a, b) => {
        const endA = parseDateTime(a.rawEnd, a.endTime);
        const endB = parseDateTime(b.rawEnd, b.endTime);
        const isEndedA = now > endA;
        const isEndedB = now > endB;
        if (isEndedA !== isEndedB) return isEndedA ? -1 : 1;
        return parseInt(a.rawStart) - parseInt(b.rawStart);
    });

    if (activeData.length === 0) return '<p>表示可能な開催中のスケジュールはありません。</p>';

    let minDateInt = parseInt(activeData[0].rawStart);
    let maxEndDateTime = new Date(0);
    let maxLabelTextWidth = 0;

    activeData.forEach(item => {
        const s = parseInt(item.rawStart);
        if (s < minDateInt) minDateInt = s;
        const eDt = parseDateTime(item.rawEnd, item.endTime);
        if (eDt > maxEndDateTime) maxEndDateTime = eDt;

        let displayName = item.seriesName;
        if (item.guaranteed) displayName += " [確定]";
        const textW = calcTextWidth(displayName);
        if (textW > maxLabelTextWidth) maxLabelTextWidth = textW;
    });

    let labelWidth = Math.max(160, maxLabelTextWidth + 20);
    if (labelWidth > 320) labelWidth = 320; 

    let minDate = parseDateStr(String(minDateInt));
    const viewStartDate = new Date(yesterday);
    viewStartDate.setDate(viewStartDate.getDate() - 2);
    if (minDate < viewStartDate) minDate = viewStartDate;

    let limitDate = new Date(minDate);
    limitDate.setDate(limitDate.getDate() + 35);
    let chartEnd = new Date(maxEndDateTime);
    if (chartEnd > limitDate) chartEnd = limitDate;

    chartEnd.setHours(0, 0, 0, 0);
    chartEnd.setDate(chartEnd.getDate() + 1);
    const totalDays = Math.ceil((chartEnd - minDate) / (1000 * 60 * 60 * 24));
    
    if (totalDays <= 0) return '';
    const dayWidth = 50; 
    const msPerDay = 1000 * 60 * 60 * 24;
    const totalWidth = labelWidth + (totalDays * dayWidth) + (dayWidth / 2);
    
    let currentLineHtml = '';
    if (now >= minDate && now < chartEnd) {
        const diffNowMs = now - minDate;
        const currentLineLeftPx = (diffNowMs / msPerDay) * dayWidth;
        currentLineHtml = `<div class="gantt-current-line" style="left:${currentLineLeftPx}px;"></div>`;
    }

    let headerHtml = `<div class="gantt-header" style="min-width: ${totalWidth}px; width: ${totalWidth}px;">
        <div class="gantt-label-col" style="width:${labelWidth}px; min-width:${labelWidth}px;">ガチャ名</div>`;
    for (let i = 0; i < totalDays; i++) {
        const d = new Date(minDate);
        d.setDate(d.getDate() + i);
        const dateStr = getShortDateStr(d);
        const isToday = getDateInt(d) === getDateInt(new Date());
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        const cls = `gantt-date-cell${isToday ? ' today' : ''}${isWeekend ? ' weekend' : ''}`;
        headerHtml += `<div class="${cls}" style="width:${dayWidth}px;">${dateStr}</div>`;
    }
    headerHtml += `<div class="gantt-date-cell" style="width:${dayWidth/2}px; border-right:none;"></div></div>`;

    let bodyHtml = '';
    activeData.forEach(item => {
        const startDateTime = parseDateTime(item.rawStart, item.startTime);
        const endDateTime = parseDateTime(item.rawEnd, item.endTime);
        const diffStartMs = startDateTime - minDate;
        const durationMs = endDateTime - startDateTime;

        let offsetPx = (diffStartMs / msPerDay) * dayWidth;
        let widthPx = (durationMs / msPerDay) * dayWidth;

        if (offsetPx < 0) { widthPx += offsetPx; offsetPx = 0; }
        const maxPx = totalDays * dayWidth;
        if (offsetPx >= maxPx) return;
        if (offsetPx + widthPx > maxPx) widthPx = maxPx - offsetPx; 
        if (widthPx <= 0) return;

        let displayName = item.seriesName;
        if (item.guaranteed) displayName += " [確定]";

        let barClass = 'gantt-bar';
        if (displayName.includes("極選抜")) barClass += ' g-kyoku';
        else if (displayName.includes("超選抜")) barClass += ' g-cho';
        else if (displayName.includes("ネコ祭")) barClass += ' g-fest';
        else if (displayName.includes("コラボ")) barClass += ' g-collab';

        const durationDays = Math.max(1, Math.round(durationMs / msPerDay));
        let rowClass = 'gantt-row';
        if (now > endDateTime) rowClass += ' row-ended';
        else if (item.guaranteed) rowClass += ' row-guaranteed';

        bodyHtml += `
            <div class="${rowClass}" style="min-width: ${totalWidth}px; width: ${totalWidth}px;">
                <div class="gantt-label-col" style="width:${labelWidth}px; min-width:${labelWidth}px;" title="${displayName} (ID:${item.id})">${displayName}</div>
                <div class="gantt-bar-area" style="width: ${(totalDays * dayWidth) + (dayWidth/2)}px;">
                    ${generateGridLines(totalDays, dayWidth, minDate)}
                    <div class="${barClass}" style="left: ${offsetPx}px; width: ${widthPx}px;">
                        <span class="gantt-bar-text">${durationDays}日間</span>
                    </div>
                    ${currentLineHtml}
                </div>
            </div>
        `;
    });

    return `
        <div class="gantt-outer-wrapper">
            <div style="margin-bottom: 5px; text-align: right;">
                <button onclick="saveGanttImage()" class="secondary" style="font-size: 11px; padding: 4px 8px;">画像として保存</button>
            </div>
            <div class="gantt-chart-container">
                <div class="gantt-scroll-wrapper">
                    ${headerHtml}
                    <div class="gantt-body">${bodyHtml}</div>
                </div>
            </div>
        </div>
    `;
}

function generateGridLines(days, width, startDate) {
    let html = '';
    for (let i = 0; i < days; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        const style = `left:${i * width}px; width:${width}px;`;
        const cls = isWeekend ? 'gantt-grid-line weekend' : 'gantt-grid-line';
        html += `<div class="${cls}" style="${style}"></div>`;
    }
    return html;
}