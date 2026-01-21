/**
 * @file logic_sequential.js
 * @description 連続抽選（11連等）および確定枠までのSEED消費・状態遷移の管理
 * @input_data startSeedIndex, allSeeds, normalRollsCount, forceNoRerollFirst
 * @output_data {name, charId, nextRollStartSeedIndex, normalRollsResults, debugLog}
 */

/**
 * 連続した通常抽選と、その後の確定枠抽選をシミュレートする
 * @param {number} startSeedIndex - 開始SEEDインデックス
 * @param {Object} gachaConfig - ガチャのマスタデータ
 * @param {Array} allSeeds - 乱数シード配列
 * @param {Object} initialLastDraw - 直前の抽選状態
 * @param {number} normalRollsCount - 確定枠に到達するまでの通常枠数 (通常は10)
 * @param {boolean} forceNoRerollFirst - 初回のレア被り回避を無効化するか（回避ルート計算用）
 * @returns {Object} 最終結果、道中の全抽選結果、および詳細デバッグログ
 */
function calculateSequentialGuaranteed(startSeedIndex, gachaConfig, allSeeds, initialLastDraw, normalRollsCount = 10, forceNoRerollFirst = false) {
    let seedCursor = startSeedIndex;
    // 回避ルート（Avoided）の場合は直前状態をリセットして開始
    let currentLastDraw = forceNoRerollFirst ? null : initialLastDraw;
    
    const debugLog = [];
    const normalRollsResults = [];

    // 1. 通常枠の連続シミュレーション (1回目 ～ 10回目等)
    for (let i = 0; i < normalRollsCount; i++) {
        // 現在のカーソル位置から1回ロールを実行
        const rr = rollWithSeedConsumptionFixed(seedCursor, gachaConfig, allSeeds, currentLastDraw);
        
        // シード不足等の異常終了チェック
        if (rr.seedsConsumed === 0) {
            debugLog.push({ 
                step: `Roll ${i + 1} (Error)`, 
                startIndex: seedCursor, 
                finalChar: { name: "データ不足", id: null } 
            });
            break;
        }

        // デバッグログの構築
        // rr.debug には logic_roll_core.js で追加した finalChar 等が含まれています
        debugLog.push({ 
            step: `Roll ${i + 1}${i === 0 && forceNoRerollFirst ? ' (Avoided)' : ''}`, 
            ...rr.debug 
        });

        // 簡易結果リストへの保存
        normalRollsResults.push(rr);
        
        // 次のロールへの状態更新
        seedCursor += rr.seedsConsumed;
        currentLastDraw = { 
            originalIdAbove: rr.charId, 
            finalIdSource: rr.charId, 
            rarity: rr.rarity, 
            charId: rr.charId 
        };
    }

    // 2. 確定枠のシミュレーション (11回目)
    // 確定枠は seedCursor の位置にあるシードをそのまま使用する
    const gr = rollGuaranteedUber(seedCursor, gachaConfig, allSeeds);
    
    // 確定枠のログを追加
    // gr.debug には logic_uber.js で追加した finalChar 等が含まれています
    debugLog.push({ 
        step: `Guaranteed Uber`, 
        ...gr.debug 
    });

    // 3. 全行程の結果をまとめて返却
    // 次回の抽選開始インデックスは「確定枠で使用したインデックス + 1」となる
    return { 
        name: gr.finalChar.name, 
        charId: gr.charId, 
        nextRollStartSeedIndex: seedCursor + 1, 
        normalRollsResults, 
        debugLog, 
        isAvoidedRoute: forceNoRerollFirst 
    };
}