/** @file logic_sequential.js @description 連続抽選シミュレーション */
function calculateSequentialGuaranteed(startSeedIndex, gachaConfig, allSeeds, initialLastDraw, normalRollsCount = 10, forceNoRerollFirst = false) {
    let seedCursor = startSeedIndex;
    let currentLastDraw = forceNoRerollFirst ? null : initialLastDraw;
    const debugLog = [];
    const normalRollsResults = [];

    for (let i = 0; i < normalRollsCount; i++) {
        const rr = rollWithSeedConsumptionFixed(seedCursor, gachaConfig, allSeeds, currentLastDraw);
        if (rr.seedsConsumed === 0) break;

        debugLog.push({ step: `Roll ${i + 1}${i === 0 && forceNoRerollFirst ? ' (Avoided)' : ''}`, ...rr.debug });
        normalRollsResults.push(rr);
        
        seedCursor += rr.seedsConsumed;
        currentLastDraw = { 
            originalIdAbove: rr.charId, 
            finalIdSource: rr.charId, 
            rarity: rr.rarity, 
            charId: rr.charId 
        };
    }

    const gr = rollGuaranteedUber(seedCursor, gachaConfig, allSeeds);
    debugLog.push({ step: `Guaranteed Uber`, ...gr.debug });

    return { 
        name: gr.finalChar.name, charId: gr.charId, nextRollStartSeedIndex: seedCursor + 1, 
        normalRollsResults, debugLog, isAvoidedRoute: forceNoRerollFirst 
    };
}