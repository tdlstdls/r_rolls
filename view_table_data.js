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
    const tableData = Array(numRolls * 2).fill(null).map(() => []);
    columnConfigs.forEach((config, colIndex) => {
        if (!config) return;

        const landingMap = new Map(); 
        let lastDrawA = null; 
        let lastDrawB = null; 
        
        // 各トラックの「直前のセルの実行有無（ジャンプで立ち去ったか）」を管理
        let trackA_active = true;
        let trackB_active = true;

        for (let i = 0; i < numRolls * 2; i++) {
            if (i >= seeds.length) break;

            const isTrackB = (i % 2 !== 0);
            
            // 物理的な直上セルの情報を取得（レア被り判定用：常に参照）
            const drawAbove = (isTrackB ? lastDrawB : lastDrawA);
            
            // 実際にそのセルに「着地」した移動元の情報を取得
            let sourceDraw = null;
            if (landingMap.has(i)) {
                // 他のセルからのジャンプ着地がある場合
                sourceDraw = landingMap.get(i);
                if (isTrackB) trackB_active = true; else trackA_active = true;
            } else {
                // 直前セルから垂直移動してきた場合（直前セルがジャンプで立ち去っていないことが条件）
                const isActive = isTrackB ? trackB_active : trackA_active;
                if (isActive) {
                    sourceDraw = drawAbove;
                }
            }

            // コンテキストの構築
            // sourceDrawがnull（ジャンプで飛ばされたセル）でも、drawAboveがあればレア被り判定は行う
            const drawContext = (sourceDraw || drawAbove) ? {
                originalIdAbove: drawAbove ? drawAbove.originalCharId : null,
                finalIdSource: sourceDraw ? sourceDraw.charId : null, // 着地していない場合はnull
                rarity: sourceDraw ? sourceDraw.rarity : (drawAbove ? drawAbove.rarity : 'rare'),
                charId: sourceDraw ? sourceDraw.charId : null
            } : null;

            // 通常ロールのシミュレーション
            const rollResult = rollWithSeedConsumptionFixed(i, config, seeds, drawContext);

            // 確定枠（11G等）の計算
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

            // セルデータを保存
            tableData[i][colIndex] = { 
                gachaId: config.id, 
                roll: rollResult, 
                guaranteed: guaranteedResult, 
                alternativeGuaranteed 
            };

            // 次回への状態の準備
            const nextState = { 
                rarity: rollResult.rarity, 
                charId: rollResult.charId, 
                originalCharId: rollResult.originalChar?.id || rollResult.charId 
            };

            // ジャンプ・移動フラグの更新
            if (rollResult.isRerolled) {
                // ジャンプ先を予約
                landingMap.set(i + rollResult.seedsConsumed, nextState);
                // 現在のトラックはジャンプにより「空き」になる
                if (isTrackB) trackB_active = false; else trackA_active = false;
            } else {
                // 通常移動
                if (isTrackB) trackB_active = true; else trackA_active = true;
            }

            // 垂直履歴は「物理的な直上」として常に更新
            if (isTrackB) {
                lastDrawB = nextState;
            } else {
                lastDrawA = nextState;
            }
        }
    });
    return tableData;
}