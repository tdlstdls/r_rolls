/**
 * gacha_selector.js
 * ガチャ選択用プルダウンのオプション生成ロジック
 */

function getGachaSelectorOptions(selectedId) {
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
    if (loadedTsvContent && typeof parseGachaTSV === 'function') {
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
                isGuaranteed: item.guaranteed // 確定フラグを引き継ぐ
            });
        }
    });

    scheduledItems.sort((a, b) => {
        if (a.isSpecial !== b.isSpecial) return a.isSpecial ? 1 : -1;
        return a.s - b.s;
    });

    scheduledItems.forEach(item => {
        if (usedIds.has(item.id.toString())) return;
        
        // 確定フラグがある場合、名称に [確定] を付与 (既に含まれていれば二重付与しない)
        let displayName = item.name;
        if (item.isGuaranteed && !displayName.includes("確定")) {
            displayName += " [確定]";
        }

        // 変更前: const baseName = `${displayName} (${item.id})`;
        // 変更前: let label = item.isSpecial ? ... : ...;

        // 変更後: IDを日付の直後に配置して見切れを防止
        // view_table.jsのヘッダー表示（スペースで改行）に合わせて、"日付(ID) ガチャ名" の形式にする
        let datePart = item.isSpecial 
            ? `${toShortDate(item.rawStart)}~`
            : `${toShortDate(item.rawStart)}~${toShortDate(item.rawEnd)}`;
        
        // 日付とIDの間を詰めることで、view_table.js側で「日付(ID)」の塊として認識させ、改行後にガチャ名を表示させる
        let label = `${datePart}(${item.id}) ${displayName}`;
        
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
        allOptions.push({ value: g.id, label: `${g.id} ${g.name}` });
        usedIds.add(g.id);
    });

    if (selectedId && !usedIds.has(selectedId)) {
        const missing = gachaMasterData.gachas[selectedId];
        if (missing) {
            allOptions.push({ value: selectedId, label: `${selectedId} ${missing.name} (選択中)` });
        }
    }

    return allOptions;
}