/** @file schedule_logic.js @description gatya.tsvの解析、日付・時刻計算のユーティリティを担当 @dependency なし */

// YYYYMMDD -> M/D (年は無視、20300101は「永続」)
function formatDateJP(dateStr) {
    if (!dateStr || dateStr.length < 8) return dateStr;
    if (dateStr === '20300101') {
        return '永続';
    }
    const m = parseInt(dateStr.substring(4, 6), 10);
    const d = parseInt(dateStr.substring(6, 8), 10);
    return `${m}/${d}`;
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

// TSVデータのパース処理
function parseGachaTSV(tsv) {
    const lines = tsv.split('\n');
    const schedule = [];
    lines.forEach(line => {
        if (line.trim().startsWith('[') || !line.trim()) return;
        const cols = line.split('\t');
        if (cols.length < 10) return;
        if (cols[8] !== '1') return;

        const startDateStr = cols[0]; 
        const startTimeStr = cols[1]; 
        const endDateStr   = cols[2]; 
        const endTimeStr   = cols[3]; 

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

    // --- 重複期間の自動短縮ロジック（ID一致なら確定・非確定問わず適用） ---
    for (let i = 0; i < schedule.length; i++) {
        const itemA = schedule[i];
        const startA = parseInt(itemA.start);
        const endA = parseInt(itemA.end);

        // 同じIDで、自分より「後に開始」し、かつ自分の「終了前」に開始される別枠を探す
        const itemB = schedule.find(target => 
            target !== itemA &&
            target.id === itemA.id && 
            parseInt(target.start) > startA && 
            parseInt(target.start) < endA
        );

        if (itemB) {
            // 後続枠の開始タイミングに合わせて、前の枠を終了させる
            itemA.end = itemB.start;
            itemA.rawEnd = itemB.rawStart;
            itemA.endTime = itemB.startTime;
        }
    }

    schedule.sort((a, b) => parseInt(a.start) - parseInt(b.start));
    return schedule;
}

function findDefaultGachaState(data) {
    const now = new Date();
    let candidates = data.filter(item => {
        if (isPlatinumOrLegend(item)) return false;
        const endDt = parseDateTime(item.rawEnd, item.endTime);
        return endDt >= now;
    });
    candidates.sort((a, b) => {
        const startA = parseDateTime(a.rawStart, a.startTime);
        const startB = parseDateTime(b.rawStart, b.startTime);
        return startA - startB;
    });
    if (candidates.length === 0) return null;
    const target = candidates[0];
    const recommendedRollType = target.guaranteed ? '11g' : '11';
    return {
        gacha: target,
        gachaId: target.id,
        rollType: recommendedRollType
    };
}