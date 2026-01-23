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
    if (hideEndedSchedules) {
        activeData = activeData.filter(item => {
            const endDt = parseDateTime(item.rawEnd, item.endTime);
            return now <= endDt;
        });
    }

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
        if (item.guaranteed && !displayName.includes("[確定]")) {
            displayName += " [確定]";
        }
        // すでに seriesName に含まれているはずなので、ここでの個別追加は不要
        // もし含まれていない場合に備えるなら:
        if (item.stepup && !displayName.includes("[StepUp]")) {
            displayName += " [StepUp]";
        }
        
        if (typeof calcTextWidth === 'function') {
            const textW = calcTextWidth(displayName);
            if (textW > maxLabelTextWidth) maxLabelTextWidth = textW;
        }
    });
    let labelWidth = Math.max(160, maxLabelTextWidth + 20);
    if (labelWidth > 1000) labelWidth = 1000;

    let minDate = parseDateStr(String(minDateInt));
    const viewStartDate = new Date(yesterday);
    viewStartDate.setDate(viewStartDate.getDate() - 2);
    if (minDate < viewStartDate) minDate = viewStartDate;

    let chartEnd = new Date(maxEndDateTime);
    chartEnd.setHours(0, 0, 0, 0);
    chartEnd.setDate(chartEnd.getDate() + 1);

    const totalDays = Math.ceil((chartEnd - minDate) / (1000 * 60 * 60 * 24));
    if (totalDays <= 0) return '';
    const dayWidth = 50; 
    const msPerDay = 1000 * 60 * 60 * 24;
    const totalWidth = labelWidth + (totalDays * dayWidth);
    
    let currentLineHtml = '';
    if (now >= minDate && now < chartEnd) {
        const diffNowMs = now - minDate;
        const currentLineLeftPx = (diffNowMs / msPerDay) * dayWidth;
        currentLineHtml = `<div class="gantt-current-line" style="left:${currentLineLeftPx}px;"></div>`;
    }

    let headerHtml = `<div class="gantt-header" style="width: ${totalWidth}px; min-width: ${totalWidth}px; display: flex; flex-wrap: nowrap; background: #f9f9f9; height: 30px;">
        <div class="gantt-label-col" style="width:${labelWidth}px; min-width:${labelWidth}px; flex: none; display: block; height: 30px; line-height: 30px; text-align: center; box-sizing: border-box; font-weight: bold; border-right: 1px solid #ddd; padding: 0; margin: 0;">ガチャ名</div>`;
    for (let i = 0; i < totalDays; i++) {
        const d = new Date(minDate);
        d.setDate(d.getDate() + i);
        const dateStr = getShortDateStr(d);
        const isToday = getDateInt(d) === getDateInt(new Date());
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        const cls = `gantt-date-cell${isToday ? ' today' : ''}${isWeekend ? ' weekend' : ''}`;
        headerHtml += `<div class="${cls}" style="width:${dayWidth}px; flex: none; display: block; height: 30px; line-height: 30px; text-align: center; box-sizing: border-box; border-right: 1px solid #eee; padding: 0; margin: 0;">${dateStr}</div>`;
    }
    headerHtml += `</div>`;

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
        if (item.guaranteed && !displayName.includes("[確定]")) {
            displayName += " [確定]";
        }
        // すでに seriesName に含まれているはずなので、ここでの個別追加は不要
        // もし含まれていない場合に備えるなら:
        if (item.stepup && !displayName.includes("[StepUp]")) {
            displayName += " [StepUp]";
        }

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
            <div class="${rowClass}" style="width: ${totalWidth}px; min-width: ${totalWidth}px; display: flex; flex-wrap: nowrap; height: 30px;">
                <div class="gantt-label-col" style="width:${labelWidth}px; min-width:${labelWidth}px; flex: none; display: block; height: 30px; line-height: 30px; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-right: 1px solid #ddd; box-sizing: border-box; padding: 0; margin: 0;"
                title="${displayName} (ID:${item.id})">${displayName}</div>
                <div class="gantt-bar-area" style="width: ${totalDays * dayWidth}px; flex: none; position: relative; height: 30px;">
                    ${generateGridLines(totalDays, dayWidth, minDate)}
                    <div class="${barClass}" style="left: ${offsetPx}px; width: ${widthPx}px; height: 20px; top: 5px; position: absolute; display: flex; align-items: center; justify-content: center;">
                        <span class="gantt-bar-text" style="font-size: 10px; line-height: 20px;">${durationDays}日間</span>
                    </div>
                    ${currentLineHtml}
                </div>
            </div>
        `;
    });

    return `
        <div class="gantt-outer-wrapper" style="width: 100%; max-width: 100%; overflow: hidden;">
            <div style="margin-bottom: 5px; text-align: right;">
                <button onclick="saveGanttImage()" class="secondary" style="font-size: 11px; padding: 4px 8px;">画像として保存</button>
            </div>
            <div class="gantt-chart-container" style="width: 100%; max-width: 100%; overflow: hidden; border: 1px solid #ccc; background: #fff;">
                <div class="gantt-scroll-wrapper" style="overflow-x: auto; -webkit-overflow-scrolling: touch; width: 100%;">
                    <div style="width: ${totalWidth}px; min-width: ${totalWidth}px;">
                        ${headerHtml}
                        <div class="gantt-body">${bodyHtml}</div>
                    </div>
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
        const style = `left:${i * width}px; width:${width}px; position: absolute; height: 100%; border-right: 1px solid #eee; box-sizing: border-box; pointer-events: none;`;
        const cls = isWeekend ? 'gantt-grid-line weekend' : 'gantt-grid-line';
        html += `<div class="${cls}" style="${style}"></div>`;
    }
    return html;
}