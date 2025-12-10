/**
 * gacha_selector.js
 * ガチャ選択用プルダウンのオプション生成ロジック
 */

// 現在プルダウンに表示されているガチャの確定フラグを保持するマップ
let currentGuaranteedMap = {};

/**
 * 指定されたガチャIDが現在「確定」扱いかどうかを判定する
 * @param {string|number} gachaId 
 * @returns {boolean}
 */
function isGuaranteedGacha(gachaId) {
    if (!gachaId) return false;
    // 文字列化してチェック
    return !!currentGuaranteedMap[gachaId.toString()];
}

function getGachaSelectorOptions(selectedId) {
    // マップを初期化
    currentGuaranteedMap = {};

    const now = new Date();
    const formatInt = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return parseInt(`${y}${m}${day}`, 10);
    };
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayInt = formatInt(yesterdayDate);

    const toShortDate = (str) => {
        if(!str || str.length < 8) return str;
        return `${parseInt(str.substring(4,6))}/${parseInt(str.substring(6,8))}`;
    };

    let scheduleRaw = [];
    if (loadedTsvContent) {
        // 関数呼び出しでTSVをパース
        scheduleRaw = parseGachaTSV(loadedTsvContent);
    }
    
    const usedIds = new Set();
    const allOptions = [];

    // Group 1: スケジュール (終了日 >= 昨日)
    let scheduledItems = [];
    scheduleRaw.forEach(item => {
        if(!gachaMasterData.gachas[item.id]) return;

        const masterName = gachaMasterData.gachas[item.id].name;
        const checkStr = (masterName + item.tsvName).replace(/\s/g, "");
        const isSpecial = checkStr.includes("プラチナ") || checkStr.includes("レジェンド");

        const e = parseInt(item.rawEnd, 10);

        // 表示条件: 特殊ガチャ または 終了日が昨日以降
        if (isSpecial || e >= yesterdayInt) {
            scheduledItems.push({
                id: item.id,
                name: masterName,
                tsvName: item.tsvName || item.name,
                rawStart: item.rawStart,
                rawEnd: item.rawEnd,
                s: parseInt(item.rawStart, 10),
                isSpecial: isSpecial,
                isGuaranteed: item.isGuaranteed
            });
        }
    });

    // ソート順: 特別ガチャ優先、開始日順
    scheduledItems.sort((a, b) => {
        if (a.isSpecial !== b.isSpecial) return a.isSpecial ? 1 : -1;
        return a.s - b.s;
    });

    scheduledItems.forEach(item => {
        if (usedIds.has(item.id.toString())) return;
        
        let baseName = `${item.name} (${item.id})`;
        
        // ★確定ガチャの場合、名称に[確定]を付与し、マップに記録
        if (item.isGuaranteed) {
            baseName += " [確定]";
        }
        currentGuaranteedMap[item.id.toString()] = item.isGuaranteed;

        let label = item.isSpecial 
            ? `${toShortDate(item.rawStart)}~ ${baseName}`
            : `${toShortDate(item.rawStart)}~${toShortDate(item.rawEnd)} ${baseName}`;
        
        allOptions.push({ value: item.id, label: label });
        usedIds.add(item.id.toString());
    });

    // Group 2: シリーズ最新 (G1で表示済みはスキップ)
    const seriesMaxMap = new Map();
    Object.values(gachaMasterData.gachas).forEach(g => {
        if (usedIds.has(g.id)) return;
        if (g.series_id !== undefined && g.sort < 800) {
            const current = seriesMaxMap.get(g.series_id);
            if (!current || parseInt(g.id) > parseInt(current.id)) {
                seriesMaxMap.set(g.series_id, g);
            }
        }
    });

    const seriesList = Array.from(seriesMaxMap.values());
    seriesList.sort((a, b) => a.sort - b.sort);

    seriesList.forEach(g => {
        // マスタデータ上のguaranteed情報があれば使う
        currentGuaranteedMap[g.id.toString()] = !!g.guaranteed;
        
        allOptions.push({ value: g.id, label: `${g.name} (${g.id})` });
        usedIds.add(g.id);
    });

    // Group 3: その他
    const othersList = [];
    Object.values(gachaMasterData.gachas).forEach(g => {
        if (usedIds.has(g.id)) return;
        othersList.push(g);
    });

    othersList.sort((a, b) => parseInt(b.id) - parseInt(a.id));

    othersList.forEach(g => {
        currentGuaranteedMap[g.id.toString()] = !!g.guaranteed;
        
        allOptions.push({ value: g.id, label: `${g.id} ${g.name}` });
        usedIds.add(g.id);
    });

    if (selectedId && !usedIds.has(selectedId)) {
        const missing = gachaMasterData.gachas[selectedId];
        if (missing) {
            currentGuaranteedMap[selectedId.toString()] = !!missing.guaranteed;
            allOptions.push({ value: selectedId, label: `${selectedId} ${missing.name} (選択中)` });
        }
    }

    return allOptions;
}

/**
 * gatya.tsvをパースしてスケジュール情報の配列を返すヘルパー関数
 * 新しい定義に基づき、1行に複数のガチャブロックが含まれる場合に対応
 * 9列目のレアロールズ対象フラグもチェック
 */
function parseGachaTSV(tsvContent) {
    const lines = tsvContent.split('\n');
    const result = [];
    
    lines.forEach(line => {
        // コメント行や空行をスキップ
        if (!line.trim() || line.trim().startsWith('[')) return;
        
        const cols = line.split('\t');
        if (cols.length < 15) return;

        // 9列目(Idx 8)が「1」以外の行は除外（レアロールズ対象外）
        if (cols[8] !== '1') return;

        const rawStart = cols[0];
        const rawEnd = cols[2];

        // 11列目(Idx 10)から15列ごとにブロックをスキャン
        for (let i = 10; i < cols.length; i += 15) {
            // カラム不足チェック
            if (i + 14 >= cols.length) break;

            const gachaIdStr = cols[i];
            const gachaId = parseInt(gachaIdStr);

            // IDが無効、または-1の場合はスキップ
            if (isNaN(gachaId) || gachaId < 0) continue;

            // 確定フラグ: ブロック内12列目 (i+11)
            const isGuaranteed = (cols[i + 11] === '1');
            // 説明文(tsvName)は末尾(i+14)にある
            const tsvName = cols[i + 14] ? cols[i + 14].trim() : "";

            result.push({
                id: gachaId,
                rawStart: rawStart,
                rawEnd: rawEnd,
                tsvName: tsvName,
                isGuaranteed: isGuaranteed
            });
        }
    });
    
    return result;
}