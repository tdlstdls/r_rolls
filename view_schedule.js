/**
 * view_schedule.js
 * スケジュール表・ガントチャートのレンダリング及び画像保存を担当
 * 依存: schedule_logic.js (Utility functions)
 */

// 文字列の表示幅を概算する関数 (動的幅調整用)
function calcTextWidth(text) {
    let width = 0;
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        // 半角文字(ASCII範囲)は約8px、それ以外(全角)は約13pxと仮定
        if ((code >= 0x00 && code < 0x81) || (code === 0xf8f0) || (code >= 0xff61 && code < 0xffa0) || (code >= 0xf8f1 && code < 0xf8f4)) {
            width += 8;
        } else {
            width += 13;
        }
    }
    return width;
}

// 画像保存処理
function saveGanttImage() {
    const element = document.querySelector('.gantt-chart-container');
    if (!element) return;
    
    const header = element.querySelector('.gantt-header');
    if (!header) return;
    const contentWidth = header.style.width;

    const originalOverflow = element.style.overflow;
    const originalWidth = element.style.width; 
    
    const scrollWrapper = element.querySelector('.gantt-scroll-wrapper');
    const originalWrapperOverflow = scrollWrapper ? scrollWrapper.style.overflow : '';
    
    element.style.overflow = 'visible';
    element.style.width = contentWidth; 
    
    if(scrollWrapper) scrollWrapper.style.overflow = 'visible';
    
    html2canvas(element).then(canvas => {
        element.style.overflow = originalOverflow;
        element.style.width = originalWidth;
        if(scrollWrapper) scrollWrapper.style.overflow = originalWrapperOverflow;

        const link = document.createElement('a');
        link.download = 'gacha_schedule.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    }).catch(err => {
        console.error("Image capture failed:", err);
        alert("画像の保存に失敗しました。");
        element.style.overflow = originalOverflow;
        element.style.width = originalWidth;
        if(scrollWrapper) scrollWrapper.style.overflow = originalWrapperOverflow;
    });
}

// ガントチャート生成ロジック
function renderGanttChart(data) {
    const filteredData = data.filter(item => !isPlatinumOrLegend(item));

    if (filteredData.length === 0) return '<p>表示可能なスケジュールがありません。</p>';
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0); 
    const yesterdayInt = getDateInt(yesterday);
    const activeData = filteredData.filter(item => parseInt(item.rawEnd) >= yesterdayInt);
    
    if (activeData.length === 0) {
        return '<p>現在開催中または予定されているガチャはありません。</p>';
    }

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
        if (textW > maxLabelTextWidth) {
            maxLabelTextWidth = textW;
        }
    });
    
    let labelWidth = Math.max(160, maxLabelTextWidth + 20);
    if (labelWidth > 320) labelWidth = 320; 

    let minDate = parseDateStr(String(minDateInt));
    const viewStartDate = new Date(yesterday);
    viewStartDate.setDate(viewStartDate.getDate() - 2);
    if (minDate < viewStartDate) {
        minDate = viewStartDate;
    }

    let limitDate = new Date(minDate);
    limitDate.setDate(limitDate.getDate() + 35);
    let chartEnd = new Date(maxEndDateTime);
    if (chartEnd > limitDate) {
        chartEnd = limitDate;
    }

    chartEnd.setHours(0, 0, 0, 0);
    chartEnd.setDate(chartEnd.getDate() + 1);
    const totalDays = Math.ceil((chartEnd - minDate) / (1000 * 60 * 60 * 24));
    
    if (totalDays <= 0) return '';
    const dayWidth = 50; 
    const msPerDay = 1000 * 60 * 60 * 24;
    const totalWidth = labelWidth + (totalDays * dayWidth) + (dayWidth / 2);
    
    const now = new Date();
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
    headerHtml += `<div class="gantt-date-cell" style="width:${dayWidth/2}px; border-right:none;"></div>`;
    headerHtml += '</div>';

    let bodyHtml = '';
    activeData.forEach(item => {
        const startDateTime = parseDateTime(item.rawStart, item.startTime);
        const endDateTime = parseDateTime(item.rawEnd, item.endTime);

        const diffStartMs = startDateTime - minDate;
        const durationMs = endDateTime - startDateTime;

        let offsetPx = (diffStartMs / msPerDay) * dayWidth;
        let widthPx = (durationMs / msPerDay) * dayWidth;

        if (offsetPx < 0) {
            widthPx += offsetPx; 
            offsetPx = 0;
        }
        
        const maxPx = totalDays * dayWidth;
        if (offsetPx >= maxPx) return;
        if (offsetPx + widthPx > maxPx) {
            widthPx = maxPx - offsetPx; 
        }
        
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
        if (now > endDateTime) {
            rowClass += ' row-ended';
        } else if (item.guaranteed) {
            rowClass += ' row-guaranteed';
        }

        bodyHtml += `
            <div class="${rowClass}" style="min-width: ${totalWidth}px; width: ${totalWidth}px;">
                <div class="gantt-label-col" style="width:${labelWidth}px; min-width:${labelWidth}px;"
                title="${displayName} (ID:${item.id})">${displayName}</div>
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
                    <div class="gantt-body">
                        ${bodyHtml}
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
        const style = `left:${i * width}px; width:${width}px;`;
        const cls = isWeekend ? 'gantt-grid-line weekend' : 'gantt-grid-line';
        html += `<div class="${cls}" style="${style}"></div>`;
    }
    return html;
}

function fmtRate(val) {
    if (!val) return "0%";
    return (parseInt(val) / 100) + "%";
}

function renderScheduleTable(tsvContent, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const data = parseGachaTSV(tsvContent);
    const ganttHtml = renderGanttChart(data);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayInt = getDateInt(yesterday);
    
    let filteredData = data.filter(item => parseInt(item.rawEnd) >= yesterdayInt);
    
    // ソート順：通常ガチャ（日付順） -> 特別枠（プラチナ・レジェンド、日付順）
    filteredData.sort((a, b) => {
        const isSpecialA = isPlatinumOrLegend(a);
        const isSpecialB = isPlatinumOrLegend(b);
        if (isSpecialA && !isSpecialB) return 1; 
        if (!isSpecialA && isSpecialB) return -1; 
        return parseInt(a.rawStart) - parseInt(b.rawStart);
    });

    let html = `
        <h3 style="margin-top:0;">開催スケジュール</h3>
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
    
    const now = new Date();

    filteredData.forEach((item, index) => {
        let seriesDisplay = item.seriesName ? item.seriesName : "シリーズ不明";
        if (item.guaranteed) {
            seriesDisplay += " [確定]";
        }

        const startStr = `${formatDateJP(item.rawStart)}<br><span style="font-size:0.85em">${formatTime(item.startTime)}</span>`;
        
        const endDateFormatted = formatDateJP(item.rawEnd);
        let endStr = endDateFormatted;

        // --- プラチナ/レジェンドガチャの「至」の調整ロジック ---
        const isPlat = item.seriesName.includes("プラチナ");
        const isLeg = item.seriesName.includes("レジェンド");
        let isAppliedNextStart = false;

        if (isPlat || isLeg) {
            // 現在の行より後のデータから、同じ種類のガチャ（プラチナ同士 or レジェンド同士）を検索
            const nextSameType = filteredData.slice(index + 1).find(nextItem => {
                if (isPlat) return nextItem.seriesName.includes("プラチナ");
                if (isLeg) return nextItem.seriesName.includes("レジェンド");
                return false;
            });

            if (nextSameType) {
                // 次に見つかった同じ種類の「自（開始日時）」を、この行の「至（終了日時）」として表示
                endStr = `${formatDateJP(nextSameType.rawStart)}<br><span style="font-size:0.85em">${formatTime(nextSameType.startTime)}</span>`;
                isAppliedNextStart = true;
            }
        }

        // 通常の終了時間表示（上記特殊処理が行われなかった場合）
        if (!isAppliedNextStart && endDateFormatted !== '永続') {
            endStr += `<br><span style="font-size:0.85em">${formatTime(item.endTime)}</span>`;
        }
        
        const isPlatLeg = isPlatinumOrLegend(item);
        const uberRateVal = parseInt(item.uber);
        let uberStyle = '';
        if (!isPlatLeg && uberRateVal !== 500) {
            uberStyle = 'color:red; font-weight:bold;';
        }

        const legendRateVal = parseInt(item.legend);
        let legendStyle = '';
        if (!isPlatLeg && legendRateVal > 30) {
            legendStyle = 'color:red; font-weight:bold;';
        }

        const endDateTime = parseDateTime(item.rawEnd, item.endTime);
        let rowClass = "";
        if (now > endDateTime) {
            rowClass = "row-ended";
        } else if (item.guaranteed) {
            rowClass = "row-guaranteed";
        }

        html += `
            <tr class="${rowClass}">
                <td>${startStr}</td>
                <td>${endStr}</td>
                <td style="text-align:left; vertical-align: middle;">
                    <div style="font-weight:bold; color:#000;">${seriesDisplay} <span style="font-weight:normal; font-size:0.9em; 
                    color:#555; user-select: text;">(ID: ${item.id})</span></div>
                    <div style="font-size:0.85em; color:#333; margin-top:2px;">${item.tsvName}</div>
                </td>
                <td>${fmtRate(item.rare)}</td>
                <td>${fmtRate(item.supa)}</td>
                <td style="${uberStyle}">${fmtRate(item.uber)}</td>
                <td style="${legendStyle}">${fmtRate(item.legend)}</td>
                <td style="text-align:center; font-size:1.2em;">
                    ${item.guaranteed ? '<span style="color:red;">●</span>' : '-'}
                </td>
            </tr>
        `;
    });

    html += `
        </tbody>
        </table>
        </div>
    `;
    container.innerHTML = html;
}