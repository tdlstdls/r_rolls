/** @file view_table_highlight_normal.js @description 通常ロールの処理とハイライトマップ更新 */

/**
 * 通常ロールの処理を実行し、ハイライトマップを更新する
 * @param {Object} params - 処理パラメータ
 * @param {number} params.currentSeedIndex - 現在のシードインデックス
 * @param {number} params.normalRolls - 通常ロール回数
 * @param {Object} params.config - ガチャ設定
 * @param {Array} params.seeds - 乱数シード配列
 * @param {number} params.numRolls - 表示行数
 * @param {string} params.simId - シミュレーションID
 * @param {Object} params.lastDrawA - Aトラックの前回抽選結果
 * @param {Object} params.lastDrawB - Bトラックの前回抽選結果
 * @param {Object} params.lastRollState - 前回のロール状態
 * @param {Object} params.maps - マップオブジェクト { highlightMap, logicPathMap }
 * @param {Xorshift32} params.rngForText - テキスト用乱数生成器
 * @returns {Object} { newSeedIndex: number, newLastDrawA: Object, newLastDrawB: Object, newLastRollState: Object }
 */
function processNormalRolls(params) {
    let { currentSeedIndex, normalRolls, config, seeds, numRolls, simId, 
          lastDrawA, lastDrawB, lastRollState, maps, rngForText } = params;
    
    for (let k = 0; k < normalRolls; k++) {
        if (currentSeedIndex >= seeds.length) break;

        const isTrackB = (currentSeedIndex % 2 !== 0);
        
        // 【検証用】通過した全てのインデックスを記録（Txtモードでのエラー防止）
        maps.logicPathMap.set(currentSeedIndex, simId);

        // 【テーブル表示用】通常列（A/B）を緑色にするために登録
        if (currentSeedIndex < numRolls * 2) {
            maps.highlightMap.set(currentSeedIndex, simId);
        }

        const drawAbove = isTrackB ? lastDrawB : lastDrawA;
        const drawContext = {
            originalIdAbove: drawAbove ? String(drawAbove.charId) : null,
            finalIdSource: lastRollState ? String(lastRollState.charId) : null
        };

        const rr = rollWithSeedConsumptionFixed(currentSeedIndex, config, seeds, drawContext, 'sim');
        if (rr.seedsConsumed === 0) break;

        const resultState = {
            rarity: rr.rarity,
            charId: String(rr.charId),
            trackB: isTrackB
        };

        if (isTrackB) lastDrawB = resultState;
        else lastDrawA = resultState;
        lastRollState = resultState;

        const consumed = rr.seedsConsumed;
        currentSeedIndex += consumed;
        for (let x = 0; x < consumed; x++) rngForText.next();
    }

    return {
        newSeedIndex: currentSeedIndex,
        newLastDrawA: lastDrawA,
        newLastDrawB: lastDrawB,
        newLastRollState: lastRollState
    };
}