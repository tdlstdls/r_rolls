/** @file view_table_data.js @description 経路依存シミュレーションによるテーブルデータ生成 */

/** 各列のガチャ設定を構築 */
function prepareColumnConfigs() {
    return tableGachaIds.map((idWithSuffix, colIndex) => {
        let suffix = '';
        let baseId = idWithSuffix;
        
        // 接尾辞の解析 (g:確定11連, f:確定15連, s:確定7連)
        if (idWithSuffix.endsWith('f')) { suffix = 'f'; baseId = idWithSuffix.slice(0, -1); }
        else if (idWithSuffix.endsWith('s')) { suffix = 's'; baseId = idWithSuffix.slice(0, -1); }
        else if (idWithSuffix.endsWith('g')) { suffix = 'g'; baseId = idWithSuffix.slice(0, -1); }

        let guaranteedNormalRolls = 0;
        if (suffix === 'g') guaranteedNormalRolls = 10;
        else if (suffix === 'f') guaranteedNormalRolls = 14;
        else if (suffix === 's') guaranteedNormalRolls = 6;

        // マスタデータから設定を取得
        const configSource = gachaMasterData.gachas[idWithSuffix] || gachaMasterData.gachas[baseId];
        if (!configSource) return null;

        const config = JSON.parse(JSON.stringify(configSource));
        config._guaranteedNormalRolls = guaranteedNormalRolls;
        config._suffix = suffix;
        
        // 超激レア追加設定
        const addCount = uberAdditionCounts[colIndex] || 0;
        if (addCount > 0 && config.pool.uber) {
            for (let k = 1; k <= addCount; k++) {
                config.pool.uber.unshift({ id: `sim-new-${k}`, name: `新規超激${k}`, rarity: 'uber' });
            }
        }
        return config;
    });
}

/** * 全ガチャ列のシミュレーションを実行 
 * 各セルの計算結果を「着地地点」に保存し、連続性を担保する
 */
function executeTableSimulation(numRolls, columnConfigs, seeds) {
    const tableData = Array(numRolls * 2).fill(null).map(() => []);
    
    columnConfigs.forEach((config, colIndex) => {
        if (!config) return;

        // 列ごとに状態を管理するための一時保存用Map
        // Key: startIndex(着地先), Value: DrawInfo
        const landingMap = new Map(); 
        
        // 通常の縦移動（2つ下のセルへの通常遷移）用の前回結果保持
        let lastDrawA = null; // A列の前回結果保持用
        let lastDrawB = null; // B列の前回結果保持用

        // 全インデックスを 0 から順番に計算することで、リロールによるトラック移動を再現する
        for (let i = 0; i < numRolls * 2; i++) {
            if (i >= seeds.length) break;

            const isTrackB = (i % 2 !== 0);
            let verticalInfo = isTrackB ? lastDrawB : lastDrawA;
            
            // ベースとなる抽選コンテキストの作成
            let drawContext = null;
            if (verticalInfo) {
                // 通常遷移の情報をコピー（デフォルトは連続被り判定なし）
                drawContext = { ...verticalInfo, fromRerollRoute: false };
            }

            // 1. このインデックスへの「ジャンプ着地」が予約されているかチェック
            if (landingMap.has(i)) {
                const jumpSource = landingMap.get(i);
                if (!drawContext) {
                    // 垂直方向の情報がない（開始直後のジャンプ等）場合
                    drawContext = { ...jumpSource, fromRerollRoute: true };
                } else {
                    // 【修正】垂直方向の情報（通常被り判定用）を維持しつつ、
                    // ジャンプ元の確定ID（連続被り判定用）を上書きしてマージする
                    drawContext.charId = jumpSource.charId; 
                    drawContext.fromRerollRoute = true;
                }
            }

            // 2. 抽選実行 (logic.js の rollWithSeedConsumptionFixed を呼び出し)
            const rollResult = rollWithSeedConsumptionFixed(i, config, seeds, drawContext);
            
            // 3. 結果をテーブルデータに保存
            tableData[i][colIndex] = { 
                gachaId: config.id, 
                roll: rollResult 
            };

            // 4. 次回計算用に引き継ぐ「現在の状態」を構築
            const currentDrawState = {
                rarity: rollResult.rarity,
                charId: rollResult.charId, // 再抽選後の最終的な確定ID
                originalCharId: rollResult.originalChar ? rollResult.originalChar.id : rollResult.charId,
                isRerolled: rollResult.isRerolled,
                lastRerollSlot: rollResult.lastRerollSlot
            };

            // 5. 今回リロールが発生した場合、将来の着地地点インデックスにこの状態を予約保存
            if (rollResult.isRerolled) {
                const targetIdx = i + rollResult.seedsConsumed;
                // 到着先のインデックスに情報をセット。ここでの情報が次回の「連続被り判定」に使用される
                landingMap.set(targetIdx, currentDrawState);
            }

            // 6. 通常遷移（2つ下のセル）への基本情報を継承
            // 縦移動自体は「リロールによる着地」ではないため、fromRerollRoute を false として引き継ぐ
            const nextBaseDraw = { ...currentDrawState, isRerolled: false, lastRerollSlot: null };
            if (isTrackB) {
                lastDrawB = nextBaseDraw;
            } else {
                lastDrawA = nextBaseDraw;
            }
        }
    });
    return tableData;
}