/** @file logic.js @description ガチャ抽選ロジック（二系統判定・R優先度調整版） */

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
 * 1回分のガチャ抽選を行う
 * @param {Object} lastDrawInfo { originalIdAbove: 直上の再抽選前ID, finalIdSource: 遷移元の再抽選後ID, rarity: レアリティ }
 */
function rollWithSeedConsumptionFixed(startIndex, gachaConfig, seeds, lastDrawInfo) {
    if (startIndex + 1 >= seeds.length) {
        return { seedsConsumed: 0, finalChar: { name: "データ不足", id: null } };
    }

    const s0_seed = seeds[startIndex];
    const s1_seed = seeds[startIndex + 1];
    
    // 1. レアリティ判定
    const rarityRoll = s0_seed % 10000;
    const rates = gachaConfig.rarity_rates || { rare: 6970, super: 2500, uber: 500, legend: 30 };
    
    let currentRarity = 'rare';
    if (rarityRoll < rates.rare) currentRarity = 'rare';
    else if (rarityRoll < rates.rare + rates.super) currentRarity = 'super';
    else if (rarityRoll < rates.rare + rates.super + rates.uber) currentRarity = 'uber';
    else if (rarityRoll < rates.rare + rates.super + rates.uber + rates.legend) currentRarity = 'legend';

    const characterPool = gachaConfig.pool[currentRarity] || [];
    if (characterPool.length === 0) {
        return { seedsConsumed: 2, finalChar: { name: "該当なし", id: null }, rarity: currentRarity };
    }
    
    // 2. キャラクター判定
    const totalChars = characterPool.length;
    const charIndex = s1_seed % totalChars;
    let character = characterPool[charIndex];
    const originalChar = character;
    
    let seedsConsumed = 2;
    let isRerolled = false;
    let isConsecutiveRerollTarget = false; // Rプレフィックス用フラグ
    let rerollProcess = null;

    // 3. レア被り判定（二系統チェック）
    if (currentRarity === 'rare' && lastDrawInfo) {
        const currentCharId = String(character.id);
        
        // 直上セルの再抽選前ID（物理的な隣接関係による被り回避用）
        const idAboveOriginal = lastDrawInfo.originalIdAbove ? String(lastDrawInfo.originalIdAbove) : null;
        // 遷移元セルの排出確定ID（ルート上の連続性による被り判定用）
        const idSourceFinal = lastDrawInfo.finalIdSource ? String(lastDrawInfo.finalIdSource) : null;

        let targetToAvoid = null;

        // 【判定ロジックの修正】
        // ルートの連続性（idSourceFinal）がある場合はそれを最優先でチェック
        if (idSourceFinal && currentCharId === idSourceFinal) {
            targetToAvoid = idSourceFinal;
            // 直上のキャラと遷移元のキャラが異なる場合のみ「R（軌道修正）」を表示
            if (idAboveOriginal && currentCharId !== idAboveOriginal) {
                isConsecutiveRerollTarget = true;
            }
        } 
        // 連続性がない場合、あるいは連続性で一致しなかった場合でも、直上（idAboveOriginal）との一致をチェック
        else if (idAboveOriginal && currentCharId === idAboveOriginal) {
            targetToAvoid = idAboveOriginal;
            // 物理的な直上との一致による再抽選は、通常のレア被り（Rなし）として扱う
            isConsecutiveRerollTarget = false;
        }

        // 被り確定時の再抽選処理
        if (targetToAvoid !== null) {
            isRerolled = true;
            let currentPool = characterPool.filter(c => String(c.id) !== targetToAvoid);
            
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
        }
    }

    const debug = {
        startIndex, s0: s0_seed, rarityRoll, rarity: currentRarity,
        s1: s1_seed, totalChars, charIndex, originalChar,
        isRerolled, isConsecutiveRerollTarget, rerollProcess, finalChar: character, consumed: seedsConsumed
    };

    return { 
        originalChar, 
        finalChar: character, 
        isRerolled, 
        isConsecutiveRerollTarget,
        rarity: currentRarity, 
        charId: character.id, 
        seedsConsumed, 
        debug 
    };
}

/** 確定枠（Uber）の単体抽選 */
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

/** 確定11連等の線形連続計算 */
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
        // 11連内部の遷移は常に「直前の排出確定キャラ」が比較対象
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
        name: gr.finalChar.name, 
        charId: gr.charId, 
        nextRollStartSeedIndex: seedCursor + 1, 
        normalRollsResults, 
        debugLog, 
        isAvoidedRoute: forceNoRerollFirst 
    };
}