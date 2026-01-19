/** @file logic_roll_core.js @description ガチャ抽選メイン統合ロジック（インデックス線形制御・状態継承強化版） */

/**
 * 指定されたインデックスからガチャを1回実行する
 * @param {number} startIndex - 抽選を開始するSEED配列のインデックス
 * @param {Object} gachaConfig - ガチャのマスタデータ
 * @param {Array} seeds - 乱数シード配列
 * @param {Object} lastDrawInfo - 直前の抽選結果（レア被り判定用）
 * @returns {Object} 抽選結果と消費SEED数
 */
function rollWithSeedConsumptionFixed(startIndex, gachaConfig, seeds, lastDrawInfo) {
    // 境界チェック：レアリティ判定(s0)とキャラ判定(s1)に最低2つのSEEDが必要
    if (startIndex + 1 >= seeds.length) {
        return { 
            seedsConsumed: 0, 
            finalChar: { name: "データ不足", id: null }, 
            rarity: null,
            charId: null
        };
    }

    const s0_seed = seeds[startIndex];     // レアリティ決定用
    const s1_seed = seeds[startIndex + 1]; // キャラクター決定用

    // 1. レアリティの決定
    const currentRarity = determineRarity(s0_seed, gachaConfig.rarity_rates);
    const characterPool = gachaConfig.pool[currentRarity] || [];

    if (characterPool.length === 0) {
        return { 
            seedsConsumed: 2, 
            finalChar: { name: "該当なし", id: null }, 
            rarity: currentRarity,
            charId: null 
        };
    }

    // 2. キャラクターの決定（最初の候補）
    const totalChars = characterPool.length;
    const charIndex = s1_seed % totalChars;
    const originalChar = characterPool[charIndex];

    let character = originalChar;
    let seedsConsumed = 2; // 基本消費量(s0, s1)
    let isRerolled = false;
    let isConsecutiveRerollTarget = false;
    let rerollProcess = null;

    // 3. レア被り判定と再抽選の実行
    // レアリティが 'rare' の場合のみ、直前の結果と比較して再抽選を行う
    if (currentRarity === 'rare' && typeof checkDuplicateStatus === 'function') {
        const status = checkDuplicateStatus(String(character.id), lastDrawInfo);
        
        if (status.targetToAvoid !== null) {
            isRerolled = true;
            isConsecutiveRerollTarget = status.isConsecutiveRerollTarget;

            // 再抽選ロジックの呼び出し（startIndex+2 以降のシードを消費）
            const res = executeReroll(startIndex, charIndex, characterPool, seeds, status.targetToAvoid);
            
            if (res.character) {
                character = res.character;
                seedsConsumed = res.seedsConsumed; // 再抽選にかかった分を含めた総消費数
                rerollProcess = res.rerollProcess;
                // デバッグ用に回避したIDを記録
                if (rerollProcess) rerollProcess.prevId = status.targetToAvoid;
            }
        }
    }

    // 4. 結果の返却
    // 次のロールは必ず (startIndex + seedsConsumed) から開始される必要がある
    return { 
        originalChar, 
        finalChar: character, 
        isRerolled, 
        isConsecutiveRerollTarget,
        rarity: currentRarity, 
        charId: character.id, 
        seedsConsumed, 
        debug: {
            startIndex,
            s0: s0_seed,
            rarity: currentRarity,
            s1: s1_seed,
            charIndex,
            originalChar,
            isRerolled,
            rerollProcess,
            consumed: seedsConsumed
        }
    };
}