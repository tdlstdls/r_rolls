/** @file logic_reroll.js @description 再抽選実行ロジック */
function executeReroll(startIndex, targetToAvoid, characterPool, seeds) {
    let seedsConsumed = 2;
    let character = null;
    let rerollProcess = null;

    const currentPool = characterPool.filter(c => String(c.id) !== targetToAvoid);
    
    if (currentPool.length > 0 && startIndex + seedsConsumed < seeds.length) {
        const nextSeedVal = seeds[startIndex + seedsConsumed];
        const reRollIndex = nextSeedVal % currentPool.length;
        character = currentPool[reRollIndex];
        
        rerollProcess = {
            prevId: targetToAvoid,
            nextSeed: nextSeedVal,
            reRollIndex: reRollIndex
        };
        seedsConsumed++;
    }

    return { character, seedsConsumed, rerollProcess };
}