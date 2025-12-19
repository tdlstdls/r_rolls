/** @file view_table_data.js @description テーブル用データ（ColumnConfigおよび抽選結果）の生成 */

/** 各列のガチャ設定を構築 */
function prepareColumnConfigs() {
    return tableGachaIds.map((idWithSuffix, colIndex) => {
        let id = idWithSuffix;
        let suffix = '';
        if (idWithSuffix.endsWith('f')) { suffix = 'f'; id = idWithSuffix.slice(0, -1); }
        else if (idWithSuffix.endsWith('s')) { suffix = 's'; id = idWithSuffix.slice(0, -1); }
        else if (idWithSuffix.endsWith('g')) { suffix = 'g'; id = idWithSuffix.slice(0, -1); }

        let guaranteedNormalRolls = 0;
        if (suffix === 'g') guaranteedNormalRolls = 10;
        else if (suffix === 'f') guaranteedNormalRolls = 14;
        else if (suffix === 's') guaranteedNormalRolls = 6;

        const originalConfig = gachaMasterData.gachas[id];
        if (!originalConfig) return null;

        const config = JSON.parse(JSON.stringify(originalConfig)); // 深いコピー
        config._guaranteedNormalRolls = guaranteedNormalRolls;
        config._suffix = suffix;

        const addCount = uberAdditionCounts[colIndex] || 0;
        if (addCount > 0 && config.pool.uber) {
            for (let k = 1; k <= addCount; k++) {
                config.pool.uber.unshift({ id: `sim-new-${k}`, name: `新規超激${k}`, rarity: 'uber' });
            }
        }
        return config;
    });
}

/** 全ガチャ列のシミュレーションを実行 */
function executeTableSimulation(numRolls, columnConfigs, seeds) {
    const tableData = Array(numRolls * 2).fill(null).map(() => []);

    columnConfigs.forEach((config, colIndex) => {
        if (!config) return;
        let prevDrawA = null, prevDrawB = null;

        for (let i = 0; i < numRolls; i++) {
            const seedIndexA = i * 2;
            const seedIndexB = i * 2 + 1;

            // A側
            const rollResultA = rollWithSeedConsumptionFixed(seedIndexA, config, seeds, prevDrawA);
            const isConsecutiveA = prevDrawA && prevDrawA.isRerolled && rollResultA.isRerolled;
            tableData[seedIndexA][colIndex] = { 
                gachaId: config.id, 
                roll: rollResultA, 
                isConsecutive: isConsecutiveA 
            };
            prevDrawA = { rarity: rollResultA.rarity, charId: rollResultA.charId, isRerolled: rollResultA.isRerolled };

            // B側
            if (seedIndexB < seeds.length - 2) {
                const rollResultB = rollWithSeedConsumptionFixed(seedIndexB, config, seeds, prevDrawB);
                const isConsecutiveB = prevDrawB && prevDrawB.isRerolled && rollResultB.isRerolled;
                tableData[seedIndexB][colIndex] = { 
                    gachaId: config.id, 
                    roll: rollResultB, 
                    isConsecutive: isConsecutiveB 
                };
                prevDrawB = { rarity: rollResultB.rarity, charId: rollResultB.charId, isRerolled: rollResultB.isRerolled };
            }
        }
    });
    return tableData;
}