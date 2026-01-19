/** @file logic_uber.js @description 確定枠抽選ロジック */
function rollGuaranteedUber(startIndex, gachaConfig, seeds) {
    if (startIndex >= seeds.length) {
        return { seedsConsumed: 1, finalChar: { name: "データ不足", id: null } };
    }
    const pool = gachaConfig.pool['uber'] || [];
    if (pool.length === 0) {
        return { seedsConsumed: 1, finalChar: { name: "該当なし", id: null } };
    }
    
    const seedValue = seeds[startIndex];
    const charIndex = seedValue % pool.length;
    const character = pool[charIndex];

    return { 
        seedsConsumed: 1, 
        finalChar: character, 
        charId: character.id,
        debug: { startIndex, seedValue, totalChars: pool.length, charIndex, finalChar: character }
    };
}