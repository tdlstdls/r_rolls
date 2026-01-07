/** @file logic.js @description ガチャ抽選の核心ロジック（Xorshift32、レア被り再抽選）を担当 @dependency なし */

/** 乱数生成クラス */
class Xorshift32 {
    constructor(seed) {
        this.seed = (seed >>> 0) || 1;
    }
    next() {
        let x = this.seed;
        x ^= (x << 13);
        x ^= (x >>> 17);
        x ^= (x << 15);
        this.seed = x >>> 0;
        return this.seed;
    }
}

/**
 * 1回分のガチャ抽選を行う（シード消費あり）
 * 多重レア被り・連続レア被りに対応
 */
function rollWithSeedConsumptionFixed(startIndex, gachaConfig, seeds, lastDrawInfo) {
    if (startIndex + 1 >= seeds.length) return { seedsConsumed: 0, finalChar: { name: "データ不足", id: null }, originalChar: null, isRerolled: false, rarity: null, charId: null, s0: null, s1: null, s2: null };
    const s0_seed = seeds[startIndex];
    const s1_seed = seeds[startIndex + 1];

    const rarityRoll = s0_seed % 10000;
    const rates = gachaConfig.rarity_rates || {};
    const rareRate = rates.rare || 0, superRate = rates.super || 0, uberRate = rates.uber || 0, legendRate = rates.legend || 0;
    
    let currentRarity;
    if (rarityRoll < rareRate) { currentRarity = 'rare'; } 
    else if (rarityRoll < rareRate + superRate) { currentRarity = 'super'; } 
    else if (rarityRoll < rareRate + superRate + uberRate) { currentRarity = 'uber'; } 
    else if (rarityRoll < rareRate + superRate + uberRate + legendRate) { currentRarity = 'legend'; } 
    else { currentRarity = 'rare'; }
    
    const characterPool = gachaConfig.pool[currentRarity] || [];
    if (characterPool.length === 0) {
        const s2_seed = (startIndex + 2 < seeds.length) ? seeds[startIndex + 2] : null;
        return { seedsConsumed: 2, finalChar: { name: "該当なし", id: null }, originalChar: null, isRerolled: false, rarity: currentRarity, charId: null, charIndex: -1, totalChars: 0, s0: s0_seed, s1: s1_seed, s2: s2_seed };
    }
    
    const totalChars = characterPool.length;
    const charIndex = s1_seed % totalChars;
    let character = characterPool[charIndex];
    const originalChar = character;
    
    let seedsConsumed = 2;
    let isRerolled = false;
    let reRollIndex = null;
    let lastRerollSlotAtCurrent = null; // 今回の最終リロールスロット
    let uniqueTotalAtCurrent = totalChars;

    // --- 【判定1】連続レア被り(Consecutive Duplicate) ---
    // 条件: ジャンプ着地ルートであり、かつ移動元の「最終確定キャラID」と今回が一致
    let isConsecutiveRerollTarget = false;
    if (currentRarity === 'rare' && lastDrawInfo && lastDrawInfo.fromRerollRoute) {
        if (lastDrawInfo.charId !== null && lastDrawInfo.charId === character.id) {
            isConsecutiveRerollTarget = true;
        }
    }

    // --- 【判定2】通常レア被り(Standard Duplicate) ---
    // 条件: 連続被りでない場合で、垂直方向の「初期キャラID」と今回が一致
    // 修正: ジャンプ着地時であっても垂直方向の比較(originalCharId)を行う
    let isStandardDuplicate = false;
    if (!isConsecutiveRerollTarget && currentRarity === 'rare' && lastDrawInfo && lastDrawInfo.rarity === 'rare') {
        if (lastDrawInfo.originalCharId !== null && lastDrawInfo.originalCharId === character.id) {
            isStandardDuplicate = true;
        }
    }

    // --- 再抽選実行ループ ---
    if (isStandardDuplicate || isConsecutiveRerollTarget) {
        let currentPool = [...characterPool];
        let removeIndex = charIndex;
        isRerolled = true;

        // 何を回避するためのリロールかを決定
        const targetIdToAvoid = isConsecutiveRerollTarget ? lastDrawInfo.charId : lastDrawInfo.originalCharId;

        while (true) {
            currentPool.splice(removeIndex, 1);
            uniqueTotalAtCurrent = currentPool.length;
            if (uniqueTotalAtCurrent === 0) break;
            
            if (startIndex + seedsConsumed >= seeds.length) break;
            const nextSeedVal = seeds[startIndex + seedsConsumed];
            seedsConsumed++;
            reRollIndex = nextSeedVal % uniqueTotalAtCurrent;
            lastRerollSlotAtCurrent = reRollIndex;
            character = currentPool[reRollIndex];
            
            // 回避対象（移動元キャラ or 垂直隣接キャラ）と異なるキャラが出るまでループ
            if (character.id !== targetIdToAvoid) {
                break;
            }
            
            removeIndex = reRollIndex;
            if (!currentPool.some(c => c.id !== character.id)) break;
        }
    }

    const finalSeedVal = (startIndex + seedsConsumed - 1 < seeds.length) ? seeds[startIndex + seedsConsumed - 1] : null;

    return { 
        s0: s0_seed, 
        s1: s1_seed, 
        s2: finalSeedVal,
        originalChar: originalChar, 
        finalChar: character, 
        isRerolled: isRerolled, 
        isConsecutiveRerollTarget: isConsecutiveRerollTarget, 
        rarity: currentRarity, 
        charId: character.id, 
        charIndex: charIndex, 
        totalChars: totalChars, 
        uniqueTotal: uniqueTotalAtCurrent, 
        reRollIndex: reRollIndex, 
        lastRerollSlot: isRerolled ? lastRerollSlotAtCurrent : null,
        seedsConsumed: seedsConsumed 
    };
}

/** 確定枠（Uber）の抽選 */
function rollGuaranteedUber(startIndex, gachaConfig, seeds) {
    if (startIndex >= seeds.length) return { seedsConsumed: 0, finalChar: { name: "データ不足", id: null }, originalChar: null, isRerolled: false, rarity: 'uber', charId: null, s0: null };
    const s0_seed = seeds[startIndex];
    const pool = gachaConfig.pool['uber'] || [];
    if (pool.length === 0) return { seedsConsumed: 1, finalChar: { name: "該当なし", id: null }, originalChar: null, isRerolled: false, rarity: 'uber', charId: null, s0: s0_seed };
    const charIndex = s0_seed % pool.length;
    const character = pool[charIndex];
    return { seedsConsumed: 1, finalChar: character, originalChar: character, isRerolled: false, rarity: 'uber', charId: character.id, charIndex: charIndex, totalChars: pool.length, s0: s0_seed };
}

/** 確定枠の先読み計算 */
function calculateGuaranteedLookahead(startSeedIndex, gachaConfig, allSeeds, initialLastDraw, normalRollsCount = 10) {
    if (!gachaConfig || !gachaConfig.pool['uber']) return { name: "N/A", charId: null, nextSeed: null, nextRollStartSeedIndex: null };
    const simulateRoute = (startSeed, startLastDraw) => {
        let seedCursor = startSeed, lastDraw = startLastDraw;
        for (let i = 0; i < normalRollsCount; i++) {
            if (seedCursor + 1 >= allSeeds.length) return null;
            const rr = rollWithSeedConsumptionFixed(seedCursor, gachaConfig, allSeeds, lastDraw);
            if (rr.seedsConsumed === 0) return null;
            seedCursor += rr.seedsConsumed;
            lastDraw = { 
                rarity: rr.rarity, 
                charId: rr.charId, 
                originalCharId: rr.originalChar ? rr.originalChar.id : rr.charId,
                isRerolled: rr.isRerolled,
                lastRerollSlot: rr.lastRerollSlot,
                fromRerollRoute: rr.isRerolled
            };
        }
        if (seedCursor >= allSeeds.length) return null;
        const gr = rollGuaranteedUber(seedCursor, gachaConfig, allSeeds);
        return { 
            name: gr.finalChar.name, 
            charId: gr.finalChar.id, 
            nextSeed: (seedCursor + 1 < allSeeds.length) ? allSeeds[seedCursor + 1] : null, 
            nextRollStartSeedIndex: seedCursor + 1 
        };
    };

    const mainResult = simulateRoute(startSeedIndex, initialLastDraw);
    if (!mainResult) return { name: "データ不足", charId: null, nextSeed: null, nextRollStartSeedIndex: null };
    return { ...mainResult, alternative: null };
}