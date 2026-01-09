/** @file view_table_data.js @description シミュレーションデータ生成（将来のキャラ追加・消費SEED・二系統ID管理） */

/**
 * 各列のガチャ設定を構築する
 * 将来の超激レア追加シミュレーション(add)をここで反映する
 */
function prepareColumnConfigs() {
    return tableGachaIds.map((idWithSuffix, colIndex) => {
        let suffix = idWithSuffix.match(/[gfs]$/)?.[0] || '';
        let baseId = suffix ? idWithSuffix.slice(0, -1) : idWithSuffix;
        
        // 確定枠の通常ロール回数設定
        let normalRolls = 0;
        if (suffix === 'g') normalRolls = 10;
        else if (suffix === 'f') normalRolls = 14;
        else if (suffix === 's') normalRolls = 6;

        const configSource = gachaMasterData.gachas[idWithSuffix] || gachaMasterData.gachas[baseId];
        if (!configSource) return null;

        // 設定をコピーしてカスタマイズ
        const config = JSON.parse(JSON.stringify(configSource));
        config._guaranteedNormalRolls = normalRolls;
        config._suffix = suffix;
        
        // --- 将来の超激追加（add機能）の実装 ---
        const addCount = uberAdditionCounts[colIndex] || 0;
        if (addCount > 0 && config.pool.uber) {
            // 先頭に新規キャラを追加していく
            for (let k = 1; k <= addCount; k++) {
                config.pool.uber.unshift({ 
                    id: `sim-new-${k}`, 
                    name: `新規超激${k}`, 
                    rarity: 'uber' 
                });
            }
        }
        return config;
    });
}

/**
 * 全ガチャ列のテーブルデータをシミュレートする
 */
function executeTableSimulation(numRolls, columnConfigs, seeds) {
    const tableData = Array(numRolls * 2).fill(null).map(() => ({ cells: [], rowInfo: {} }));

    // --- 事前計算：No列の黄色・オレンジハイライト ---
    // この処理はガチャ設定に依存しないため、最初に一括で計算する
    for (let i = 2; i < numRolls * 2; i++) {
        if (seeds[i + 1] === undefined) continue;

        // レアリティチェック (固定値 6500)
        const isPrevRare = seeds[i - 2] % 10000 < 6500;
        const isCurrentRare = seeds[i] % 10000 < 6500;

        if (isPrevRare && isCurrentRare) {
            const divisor = 25; // 除数は25で固定
            const prevSlot = seeds[i - 1] % divisor;
            const currentSlot = seeds[i + 1] % divisor;

            if (prevSlot === currentSlot) {
                tableData[i].rowInfo.isNormalReroll = true; // 黄色
            } else if (prevSlot + currentSlot === (divisor - 1)) {
                tableData[i].rowInfo.isCrossReroll = true; // オレンジ
            }
        }
    }
    // --- 事前計算終了 ---

    columnConfigs.forEach((config, colIndex) => {
        if (!config) return;

        const landingMap = new Map();
        let lastDrawA = null;
        let lastDrawB = null;

        let trackA_active = true;
        let trackB_active = true;

        for (let i = 0; i < numRolls * 2; i++) {
            if (i >= seeds.length) break;

            const isTrackB = (i % 2 !== 0);
            const drawAbove = (isTrackB ? lastDrawB : lastDrawA);
            let sourceDraw = null;

            if (landingMap.has(i)) {
                sourceDraw = landingMap.get(i);
                if (isTrackB) trackB_active = true; else trackA_active = true;
            } else {
                const isActive = isTrackB ? trackB_active : trackA_active;
                if (isActive) {
                    sourceDraw = drawAbove;
                }
            }

            const drawContext = (sourceDraw || drawAbove) ? {
                originalIdAbove: drawAbove ? drawAbove.originalCharId : null,
                finalIdSource: sourceDraw ? sourceDraw.charId : null,
                rarity: sourceDraw ? sourceDraw.rarity : (drawAbove ? drawAbove.rarity : 'rare'),
                charId: sourceDraw ? sourceDraw.charId : null
            } : null;

            const rollResult = rollWithSeedConsumptionFixed(i, config, seeds, drawContext);

            // --- 事後計算：No列の淡いオレンジハイライト ---
            if (rollResult.isRerolled) {
                tableData[i].rowInfo.isActualReroll = true;
            }
            // --- 判定終了 ---

            let guaranteedResult = null;
            let alternativeGuaranteed = null;
            if (config._suffix !== '') {
                const normalCount = config._guaranteedNormalRolls;
                guaranteedResult = calculateSequentialGuaranteed(i, config, seeds, drawContext, normalCount, false);
                if (guaranteedResult.normalRollsResults && guaranteedResult.normalRollsResults.length > 0) {
                    const firstIdInG = String(guaranteedResult.normalRollsResults[0].finalChar.id);
                    const currentRollId = String(rollResult.finalChar.id);
                    guaranteedResult.isVerified = (firstIdInG === currentRollId);
                }
                if (rollResult.isRerolled) {
                    alternativeGuaranteed = calculateSequentialGuaranteed(i, config, seeds, drawContext, normalCount, true);
                }
            }

            tableData[i].cells[colIndex] = {
                gachaId: config.id,
                roll: rollResult,
                guaranteed: guaranteedResult,
                alternativeGuaranteed
            };

            const nextState = {
                rarity: rollResult.rarity,
                charId: rollResult.charId,
                originalCharId: rollResult.originalChar?.id || rollResult.charId,
                sourceGachaConfig: config
            };

            if (rollResult.isRerolled) {
                landingMap.set(i + rollResult.seedsConsumed, nextState);
                if (isTrackB) trackB_active = false; else trackA_active = false;
            } else {
                if (isTrackB) trackB_active = true; else trackA_active = true;
            }

            if (isTrackB) {
                lastDrawB = nextState;
            } else {
                lastDrawA = nextState;
            }
        }
    });
    return tableData;
}