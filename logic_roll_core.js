/** @file logic_roll_core.js @description ガチャ抽選メイン統合ロジック */
function rollWithSeedConsumptionFixed(startIndex, gachaConfig, seeds, lastDrawInfo) {
    if (startIndex + 1 >= seeds.length) {
        return { seedsConsumed: 0, finalChar: { name: "データ不足", id: null } };
    }

    const s0_seed = seeds[startIndex];
    const s1_seed = seeds[startIndex + 1];

    const currentRarity = determineRarity(s0_seed, gachaConfig.rarity_rates);
    const characterPool = gachaConfig.pool[currentRarity] || [];

    if (characterPool.length === 0) {
        return { seedsConsumed: 2, finalChar: { name: "該当なし", id: null }, rarity: currentRarity };
    }

    const totalChars = characterPool.length;
    const charIndex = s1_seed % totalChars;
    const originalChar = characterPool[charIndex];
    
    let character = originalChar;
    let seedsConsumed = 2;
    let isRerolled = false;
    let isConsecutiveRerollTarget = false;
    let rerollProcess = null;

    if (currentRarity === 'rare') {
        const status = checkDuplicateStatus(String(character.id), lastDrawInfo);
        if (status.targetToAvoid !== null) {
            isRerolled = true;
            isConsecutiveRerollTarget = status.isConsecutiveRerollTarget;
            const res = executeReroll(startIndex, charIndex, characterPool, seeds, status.targetToAvoid);
            if (res.character) {
                character = res.character;
                seedsConsumed = res.seedsConsumed;
                rerollProcess = res.rerollProcess;
            }
        }
    }

    return { 
        originalChar, finalChar: character, isRerolled, isConsecutiveRerollTarget,
        rarity: currentRarity, charId: character.id, seedsConsumed, 
        debug: {
            startIndex, s0: s0_seed, rarityRoll: s0_seed % 10000, rarity: currentRarity,
            s1: s1_seed, totalChars, charIndex, originalChar,
            isRerolled, isConsecutiveRerollTarget, rerollProcess, finalChar: character, consumed: seedsConsumed
        }
    };
}