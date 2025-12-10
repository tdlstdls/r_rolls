/**
 * schedule_logic.js
 * gatya.tsvの解析とスケジュール表・ガントチャートのレンダリング
 */

// YYYYMMDD -> YYYY年MM月DD日
function formatDateJP(dateStr) {
    if (!dateStr || dateStr.length < 8) return dateStr;
    const y = dateStr.substring(0, 4);
    const m = dateStr.substring(4, 6);
    const d = dateStr.substring(6, 8);
    return `${y}年${m}月${d}日`;
}

// HHMM -> HH:MM
function formatTime(timeStr) {
    if (!timeStr) return "00:00";
    let s = timeStr.toString().padStart(4, '0');
    return `${s.substring(0, 2)}:${s.substring(2, 4)}`;
}

// YYYYMMDD -> Dateオブジェクト (00:00:00)
function parseDateStr(dateStr) {
    if (!dateStr || dateStr.length < 8) return new Date();
    const y = parseInt(dateStr.substring(0, 4), 10);
    const m = parseInt(dateStr.substring(4, 6), 10) - 1;
    const d = parseInt(dateStr.substring(6, 8), 10);
    return new Date(y, m, d);
}

// YYYYMMDD, HHMM -> Dateオブジェクト
function parseDateTime(dateStr, timeStr) {
    const d = parseDateStr(dateStr);
    if (timeStr) {
        let s = timeStr.toString().padStart(4, '0');
        const h = parseInt(s.substring(0, 2), 10);
        const min = parseInt(s.substring(2, 4), 10);
        d.setHours(h, min, 0, 0);
    }
    return d;
}

// Date -> YYYYMMDD 数値
function getDateInt(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return parseInt(`${y}${m}${d}`, 10);
}

// Date -> M/D 文字列
function getShortDateStr(dateObj) {
    return `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
}

// プラチナ・レジェンド判定
function isPlatinumOrLegend(item) {
    const name = (item.seriesName + (item.tsvName || "")).replace(/\s/g, "");
    return name.includes("プラチナガチャ") || name.includes("レジェンドガチャ");
}

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

// TSVデータのパース処理
function parseGachaTSV(tsv) {
    const lines = tsv.split('\n');
    const schedule = [];

    lines.forEach(line => {
        if (line.trim().startsWith('[') || !line.trim()) return;

        const cols = line.split('\t');
        if (cols.length < 10) return;

        // 1. フィルタリング: 9列目(index 8)が '1' のもののみ抽出
        if (cols[8] !== '1') return;

        // 2. 年月日・時刻情報の取得
        const startDateStr = cols[0]; 
        const startTimeStr = cols[1]; 
        const endDateStr   = cols[2]; 
        const endTimeStr   = cols[3]; 

        // 3. 有効なガチャ情報ブロックの探索
        let validBlockIndex = -1;
        for (let i = 10; i < cols.length; i += 15) {
            const descIndex = i + 14;
            if (descIndex >= cols.length) break;
            const desc = cols[descIndex];
            if (desc && desc !== '0' && /[^\x01-\x7E]/.test(desc)) {
                validBlockIndex = i;
                break; 
            }
        }

        if (validBlockIndex === -1) {
            if (cols[10] && cols[10] !== '-1') {
                validBlockIndex = 10;
            } else {
                return;
            }
        }

        const base = validBlockIndex;
        
        // ガチャ情報抽出
        const gachaId = cols[base];
        const rateRare = cols[base + 6]; 
        const rateSupa = cols[base + 8]; 
        const rateUber = cols[base + 10]; 
        const guarFlag = cols[base + 11]; 
        const rateLegend = cols[base + 12]; 
        const detail = cols[base + 14];   

        const guaranteed = (guarFlag === '1' || parseInt(guarFlag) > 0);

        let seriesName = "";
        let tsvName = detail || ""; 
        
        if (typeof gachaMasterData !== 'undefined' && gachaMasterData.gachas[gachaId]) {
            seriesName = gachaMasterData.gachas[gachaId].name;
        } else {
            seriesName = `ID:${gachaId}`;
        }

        schedule.push({
            id: gachaId,
            start: startDateStr,
            end: endDateStr,
            rawStart: startDateStr,
            rawEnd: endDateStr,
            startTime: startTimeStr,
            endTime: endTimeStr,
            seriesName: seriesName,
            tsvName: tsvName,
            rare: rateRare,
            supa: rateSupa,
            uber: rateUber,
            legend: rateLegend,
            guaranteed: guaranteed
        });
    });

    // 開始日順にソート
    schedule.sort((a, b) => parseInt(a.start) - parseInt(b.start));
    return schedule;
}

/**
 * ロールズ（シミュレータ）の初期値を決定する関数
 * - 終了していないガチャの中で開始日が最も早いものを選択
 * - 確定ガチャの場合は '11g'、それ以外は '11' を推奨設定として返す
 */
function findDefaultGachaState(data) {
    const now = new Date();

    // 1. フィルタリング (終了していない & プラチナ・レジェンド除外)
    let candidates = data.filter(item => {
        if (isPlatinumOrLegend(item)) return false; // 通常ロールズ対象外を除外
        
        const endDt = parseDateTime(item.rawEnd, item.endTime);
        return endDt >= now; // 現在時刻を過ぎていない
    });

    // 2. 開始日順にソート
    candidates.sort((a, b) => {
        const startA = parseDateTime(a.rawStart, a.startTime);
        const startB = parseDateTime(b.rawStart, b.startTime);
        return startA - startB;
    });

    if (candidates.length === 0) return null;

    // 3. 最も開催が近い(または開催中の)ものを選択
    const target = candidates[0];

    // 確定フラグがあれば初期表示を '11g' (11連確定) にする
    const recommendedRollType = target.guaranteed ? '11g' : '11';

    return {
        gacha: target,
        gachaId: target.id,
        rollType: recommendedRollType
    };
}

// 画像保存処理
function saveGanttImage() {
    const element = document.querySelector('.gantt-chart-container');
    if (!element) return;

    // ガントチャートのコンテンツ幅を取得
    const header = element.querySelector('.gantt-header');
    if (!header) return;
    const contentWidth = header.style.width;

    const originalOverflow = element.style.overflow;
    const originalWidth = element.style.width; 
    
    const scrollWrapper = element.querySelector('.gantt-scroll-wrapper');
    const originalWrapperOverflow = scrollWrapper ? scrollWrapper.style.overflow : '';

    // キャプチャ用に一時的にスタイル変更
    element.style.overflow = 'visible';
    element.style.width = contentWidth; 
    
    if(scrollWrapper) scrollWrapper.style.overflow = 'visible';

    html2canvas(element).then(canvas => {
        // スタイル復元
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

    // 表示範囲の決定
    let minDateInt = parseInt(activeData[0].rawStart);
    let maxEndDateTime = new Date(0);

    // 動的幅計算用の最大幅変数
    let maxLabelTextWidth = 0;

    activeData.forEach(item => {
        const s = parseInt(item.rawStart);
        if (s < minDateInt) minDateInt = s;
        
        const eDt = parseDateTime(item.rawEnd, item.endTime);
        if (eDt > maxEndDateTime) maxEndDateTime = eDt;

        // --- 幅計算ロジック ---
        let displayName = item.seriesName;
        if (item.guaranteed) displayName += " [確定]";
        // 表示名の長さを計算
        const textW = calcTextWidth(displayName);
        if (textW > maxLabelTextWidth) {
            maxLabelTextWidth = textW;
        }
    });

    // 幅の設定
    // ベース幅160px、最大300pxまで拡張。padding分(+20px)を加味
    let labelWidth = Math.max(160, maxLabelTextWidth + 20);
    if (labelWidth > 320) labelWidth = 320; // 上限設定

    let minDate = parseDateStr(String(minDateInt));
    
    // 表示開始日を調整
    const viewStartDate = new Date(yesterday);
    viewStartDate.setDate(viewStartDate.getDate() - 2); 
    if (minDate < viewStartDate) {
        minDate = viewStartDate;
    }

    // --- 終了日の決定 ---
    let limitDate = new Date(minDate);
    limitDate.setDate(limitDate.getDate() + 35); 
    
    let chartEnd = new Date(maxEndDateTime);
    if (chartEnd > limitDate) {
        chartEnd = limitDate;
    }

    // 右端
    chartEnd.setHours(0, 0, 0, 0);
    chartEnd.setDate(chartEnd.getDate() + 1);

    const totalDays = Math.ceil((chartEnd - minDate) / (1000 * 60 * 60 * 24));
    
    if (totalDays <= 0) return '';

    const dayWidth = 50; 
    const msPerDay = 1000 * 60 * 60 * 24;
    
    // 全体幅計算
    const totalWidth = labelWidth + (totalDays * dayWidth) + (dayWidth / 2);

    // 現在時刻線の位置計算
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
        // 確定なら表記追加
        if (item.guaranteed) {
            displayName += " [確定]";
        }

        let barClass = 'gantt-bar';
        if (displayName.includes("極選抜")) barClass += ' g-kyoku';
        else if (displayName.includes("超選抜")) barClass += ' g-cho';
        else if (displayName.includes("ネコ祭")) barClass += ' g-fest';
        else if (displayName.includes("コラボ")) barClass += ' g-collab';

        const durationDays = Math.max(1, Math.round(durationMs / msPerDay));

        // 行のスタイル判定
        let rowClass = 'gantt-row';
        if (now > endDateTime) {
            rowClass += ' row-ended';
        } else if (item.guaranteed) {
            rowClass += ' row-guaranteed';
        }

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
                <th style="min-width:140px;">開始日時</th>
                <th style="min-width:140px;">終了日時</th>
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

    filteredData.forEach(item => {
        let seriesDisplay = item.seriesName ? item.seriesName : "シリーズ不明";
        
        if (item.guaranteed) {
            seriesDisplay += " [確定]";
        }

        const startStr = `${formatDateJP(item.rawStart)}<br><span style="font-size:0.85em">${formatTime(item.startTime)}</span>`;
        const endStr = `${formatDateJP(item.rawEnd)}<br><span style="font-size:0.85em">${formatTime(item.endTime)}</span>`;
        
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

        // 行の背景色決定
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
                    <div style="font-weight:bold; color:#000;">${seriesDisplay} <span style="font-weight:normal; font-size:0.9em; color:#555; user-select: text;">(ID: ${item.id})</span></div>
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