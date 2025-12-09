/**
 * schedule_logic.js
 * gatya.tsvの解析とスケジュール表のレンダリング
 */

// YYYYMMDD -> YYYY年MM月DD日 変換ヘルパー
function formatDate(dateStr) {
    if (!dateStr || dateStr.length < 8) return dateStr;
    const y = dateStr.substring(0, 4);
    const m = dateStr.substring(4, 6);
    const d = dateStr.substring(6, 8);
    return `${y}年${m}月${d}日`;
}

// YYYYMMDD形式の数値を生成するヘルパー
function getDateInt(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return parseInt(`${y}${m}${d}`, 10);
}

// TSVデータのパース処理
function parseGachaTSV(tsv) {
    const lines = tsv.split('\n');
    const schedule = [];

    lines.forEach(line => {
        if (line.trim().startsWith('[') || !line.trim()) return;

        const cols = line.split('\t');
        if (cols.length < 10) return;

        // --- フィルタ: 9列目(index 8)が '1' 以外ならスキップ ---
        if (cols[8] !== '1') return;

        // 年月日エリア
        const rawStart = cols[0];
        const rawEnd = cols[2];
        const startDate = formatDate(rawStart);
        const endDate = formatDate(rawEnd);

        // ガチャ情報エリア (15列ごと)
        for (let i = 10; i < cols.length; i += 15) {
            if (i + 14 >= cols.length) break;

            const gachaId = cols[i];
            const tsvDescription = cols[i + 14];
            
            // IDと説明文が有効な場合のみ
            if (gachaId && parseInt(gachaId) >= 0 && tsvDescription && tsvDescription.trim() !== "") {
                schedule.push({
                    rawStart: rawStart,
                    rawEnd: rawEnd,
                    start: startDate,
                    end: endDate,
                    id: gachaId,
                    tsvName: tsvDescription, // TSV由来の説明文
                    
                    // レート
                    rare: cols[i + 6],
                    supa: cols[i + 8],
                    uber: cols[i + 10],
                    legend: cols[i + 12],
                    guaranteed: cols[i + 11] === '1'
                });
            }
        }
    });
    
    return schedule;
}

// テーブルHTMLの生成
function renderScheduleTable(tsvContent, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let scheduleData = parseGachaTSV(tsvContent);
    
    if (scheduleData.length === 0) {
        container.innerHTML = '<p>スケジュール情報が見つかりません。</p>';
        return;
    }

    // --- 日付計算 ---
    const now = new Date();
    // 昨日 (Yesterday)
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(now.getDate() - 1);
    const yesterdayInt = getDateInt(yesterdayDate);

    // --- データ加工 ---
    const filteredData = [];

    scheduleData.forEach(item => {
        // マスタデータからシリーズ名を取得 (global変数を参照)
        item.seriesName = '';
        if (typeof gachaMasterData !== 'undefined' && gachaMasterData.gachas) {
            const master = gachaMasterData.gachas[item.id];
            if (master) {
                item.seriesName = master.name;
            }
        }

        // 特殊ガチャ判定
        const checkStr = (item.seriesName + item.tsvName).replace(/\s/g, "");
        item.isSpecial = checkStr.includes("プラチナ") || checkStr.includes("レジェンド");

        // --- フィルタリングロジック ---
        // 終了日が昨日以降 (e >= yesterdayInt)
        const e = parseInt(item.rawEnd, 10);
        
        let shouldShow = false;
        if (item.isSpecial) {
            shouldShow = true;
        } else {
            if (e >= yesterdayInt) {
                shouldShow = true;
            }
        }

        if (shouldShow) {
            filteredData.push(item);
        }
    });

    // --- ソート ---
    // 1. Special以外が先、Specialが後
    // 2. 開始日昇順
    filteredData.sort((a, b) => {
        if (a.isSpecial !== b.isSpecial) {
            return a.isSpecial ? 1 : -1;
        }
        return parseInt(a.rawStart, 10) - parseInt(b.rawStart, 10);
    });

    // --- HTML構築 ---
    if (filteredData.length === 0) {
        container.innerHTML = '<p>表示対象のスケジュールがありません。</p>';
        return;
    }

    const fmtRate = (val) => {
        const num = parseInt(val, 10);
        return isNaN(num) ? '-' : (num / 100).toFixed(1) + '%';
    };

    let html = `
    <h3 style="margin-top:0;">ガチャ開催スケジュール</h3>
    <div class="schedule-scroll-wrapper">
    <table class="schedule-table">
        <thead>
            <tr>
                <th style="min-width:110px;">開始日</th>
                <th style="min-width:110px;">終了日</th>
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

    filteredData.forEach(item => {
        const seriesDisplay = item.seriesName ? item.seriesName : "シリーズ不明";
        
        html += `
            <tr>
                <td>${item.start}</td>
                <td>${item.end}</td>
                <td style="text-align:left; vertical-align: middle;">
                    <div style="font-weight:bold; color:#000;">${seriesDisplay} <span style="font-weight:normal; font-size:0.9em; color:#555;">(ID: ${item.id})</span></div>
                    <div style="font-size:0.85em; color:#333; margin-top:2px;">${item.tsvName}</div>
                </td>
                <td>${fmtRate(item.rare)}</td>
                <td>${fmtRate(item.supa)}</td>
                <td style="color:red; font-weight:bold;">${fmtRate(item.uber)}</td>
                <td>${fmtRate(item.legend)}</td>
                <td style="text-align:center; font-size:1.2em;">
                    ${item.guaranteed ? '<span style="color:red;">●</span>' : '-'}
                </td>
            </tr>
        `;
    });

    html += `</tbody></table></div>`;
    
    container.innerHTML = html;
}