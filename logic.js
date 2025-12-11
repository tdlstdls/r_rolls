/**
 * 乱数生成クラス
 */
class Xorshift32 {
    constructor(seed) { this.seed = (seed >>> 0) || 1;
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
 * 多重レア被りに対応 (被り続ける限りプールを減らして再抽選)
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
    let uniqueTotal = null;
    let finalSeedVal = null; // 最後に使用したSEED（表示用）

    // --- レア被り判定と多重再抽選ロジック ---
    if (currentRarity === 'rare' && lastDrawInfo && lastDrawInfo.rarity === 'rare' && lastDrawInfo.charId === character.id) {
        
        // 元のプールをコピーして操作用プールを作成
        let currentPool = [...characterPool];
        // 直前に選ばれたインデックス（除外対象）
        let removeIndex = charIndex;
        
        // 被りが解消されるまでループ
        while (true) {
            // 1. 直前の抽選で選ばれたキャラ（index）をプールから除外
            currentPool.splice(removeIndex, 1);
            uniqueTotal = currentPool.length;

            if (uniqueTotal === 0) {
                // 万が一プールが空になった場合はループ終了
                break;
            }

            // 2. 次のSEEDが存在するか確認
            if (startIndex + seedsConsumed >= seeds.length) {
                return { seedsConsumed: 0, finalChar: { name: "データ不足", id: null }, originalChar: null, isRerolled: false, rarity: null, charId: null, s0: s0_seed, s1: s1_seed, s2: null };
            }

            // 3. 次のSEEDを取得
            finalSeedVal = seeds[startIndex + seedsConsumed];
            seedsConsumed++; // SEED消費数を加算

            // 4. 新しいプールで抽選
            reRollIndex = finalSeedVal % uniqueTotal;
            character = currentPool[reRollIndex];
            
            isRerolled = true;

            // 5. 再抽選結果が、なお前回の確定キャラ(lastDrawInfo)と同じIDか確認
            if (character.id !== lastDrawInfo.charId) {
                // 被りが解消されたので終了
                break;
            }

            // まだ被っている場合
            // 今回選ばれた reRollIndex を次の除外対象としてループ継続
            removeIndex = reRollIndex;

            // 安全策: もしプール内の全キャラが同じIDなら無限ループになるためチェック
            const hasDifferentChar = currentPool.some(c => c.id !== lastDrawInfo.charId);
            if (!hasDifferentChar) {
                break; // 回避不可能
            }
        }
    } else {
        // 再抽選なしの場合、S2のSEED値として仮に次の値をセット（従来の互換性のため）
        if (startIndex + 2 < seeds.length) finalSeedVal = seeds[startIndex + 2];
    }
    
    return { 
        s0: s0_seed, 
        s1: s1_seed, 
        s2: finalSeedVal, // 最終的に抽選に使用されたSEED
        originalChar: originalChar, 
        finalChar: character, 
        isRerolled: isRerolled, 
        rarity: currentRarity, 
        charId: character.id, 
        charIndex: charIndex, 
        totalChars: totalChars, 
        uniqueTotal: uniqueTotal, // 最終ループ時のプールサイズ
        reRollIndex: reRollIndex, // 最終ループ時のスロット値
        seedsConsumed: seedsConsumed 
    };
}

/**
 * 確定枠（Uber）の抽選
 */
function rollGuaranteedUber(startIndex, gachaConfig, seeds) {
    if (startIndex >= seeds.length) return { seedsConsumed: 0, finalChar: { name: "データ不足", id: null }, originalChar: null, isRerolled: false, rarity: 'uber', charId: null, s0: null };
    const s0_seed = seeds[startIndex];
    const currentRarity = 'uber';
    const characterPool = gachaConfig.pool[currentRarity] || [];
    const totalChars = characterPool.length;
    if (totalChars === 0) {
        return { seedsConsumed: 1, finalChar: { name: "該当なし", id: null }, originalChar: null, isRerolled: false, rarity: currentRarity, charId: null, charIndex: -1, totalChars: 0, s0: s0_seed };
    }
    const charIndex = s0_seed % totalChars;
    const character = characterPool[charIndex];
    return { seedsConsumed: 1, finalChar: character, originalChar: character, isRerolled: false, rarity: currentRarity, charId: character.id, charIndex: charIndex, totalChars: totalChars, s0: s0_seed };
}

/**
 * 確定枠の先読み計算
 */
function calculateGuaranteedLookahead(startSeedIndex, gachaConfig, allSeeds, initialLastDraw, normalRollsCount = 10) {
    if (!gachaConfig || !gachaConfig.pool['uber']) return { name: "N/A", charId: null, nextSeed: null, nextRollStartSeedIndex: null };
    // シミュレーション実行用ヘルパー関数
    const simulateRoute = (startSeed, startLastDraw) => {
        let seedCursor = startSeed;
        let lastDraw = startLastDraw;
        
        for (let i = 0; i < normalRollsCount; i++) {
            if (seedCursor + 1 >= allSeeds.length) return null;
            const rollResult = rollWithSeedConsumptionFixed(seedCursor, gachaConfig, allSeeds, lastDraw);
            if (rollResult.seedsConsumed === 0) return null;
            
            seedCursor += rollResult.seedsConsumed;
            lastDraw = { rarity: rollResult.rarity, charId: rollResult.charId };
        }

        if (seedCursor >= allSeeds.length) return null;
        const guarRoll = rollGuaranteedUber(seedCursor, gachaConfig, allSeeds);
        if (guarRoll.seedsConsumed === 0) return null;
        
        seedCursor += guarRoll.seedsConsumed;
        const nextSimSeedValue = (seedCursor < allSeeds.length) ? allSeeds[seedCursor] : null;
        return {
            name: guarRoll.finalChar.name,
            charId: guarRoll.finalChar.id,
            nextSeed: nextSimSeedValue,
            nextRollStartSeedIndex: seedCursor // 排出後のインデックス
        };
    };

    // 1. 最初の1回目がレア被りになるかチェック
    let isFirstDupe = false;
    if (normalRollsCount > 0 && startSeedIndex + 1 < allSeeds.length) {
        const checkRoll = rollWithSeedConsumptionFixed(startSeedIndex, gachaConfig, allSeeds, initialLastDraw);
        if (checkRoll.isRerolled) {
            isFirstDupe = true;
        }
    }

    // 2. メインルート（実際の挙動）
    const mainResult = simulateRoute(startSeedIndex, initialLastDraw);
    if (!mainResult) return { name: "データ不足", charId: null, nextSeed: null, nextRollStartSeedIndex: null };
    // 3. Alternativeルート（1回目が被りなしと仮定）
    let altResult = null;
    if (isFirstDupe) {
        // initialLastDrawをnullにすることで、1回目の被り判定を回避させる
        altResult = simulateRoute(startSeedIndex, null);
    }

    // 結果をマージして返す
    return {
        ...mainResult, // 既存コードとの互換性のため展開
        alternative: altResult
    };
}