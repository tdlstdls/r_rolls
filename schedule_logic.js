/** @file schedule_logic.js @description gatya.tsvの解析、日付・時刻計算のユーティリティを担当 @dependency なし */

// YYYYMMDD -> M/D (年は無視、20300101は「永続」)
function formatDateJP(dateStr) {
    if (!dateStr || dateStr.length < 8) return dateStr;
    // 特殊対応: 2030/1/1 (20300101) は「永続」と表示
    if (dateStr === '20300101') {
        return '永続';
    }

    // 年は切り捨てて 月/日 形式に変換 (parseIntで0埋めを除去: 05月 -> 5)
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

        if (validBlockIndex === -1) 
        {
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