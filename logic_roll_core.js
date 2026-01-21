/**
 * @file logic_roll_core.js
 * @description ガチャ抽選のメイン統合ロジック。レア度判定から再抽選までを一括制御
 * @input_data seeds (乱数配列), gachaConfig (マスタ), lastDrawInfo (直前状態)
 * @output_data rollResult {originalChar, finalChar, isRerolled, seedsConsumed, debug}
 * @dependency logic_rarity.js, logic_duplicate.js, logic_reroll.js
 */

/**
 * 指定されたインデックスからガチャを1回実行する統合関数
 * @param {number} startIndex - 抽選を開始するSEED配列のインデックス
 * @param {Object} gachaConfig - ガチャのマスタデータ（rarity_rates, poolを含む）
 * @param {Array} seeds - 乱数生成済みのSEED配列
 * @param {Object|null} lastDrawInfo - 直前の抽選結果（レア被り判定用）。{originalIdAbove, finalIdSource} を含む
 * @returns {Object} 抽選結果オブジェクト
 * - seedsConsumed: 消費されたSEED数（通常は2、再抽選時は3以上）
 * - finalChar: 最終的に確定したキャラクター情報（id, name）
 * - rarity: 決定されたレアリティ
 * - isRerolled: レア被り回避が発生したかどうか
 * - debug: 計算過程のデバッグ情報（s0, s1, charIndex等）
 */
function rollWithSeedConsumptionFixed(startIndex, gachaConfig, seeds, lastDrawInfo, mode = 'table') {
    // 境界チェック：レアリティ判定(s0)とキャラ判定(s1)に最低2つのSEEDが必要
    if (startIndex + 1 >= seeds.length) {
        const errorChar = { name: "データ不足", id: null };
        return { 
            seedsConsumed: 0, 
            finalChar: errorChar, 
            rarity: null,
            charId: null,
            debug: {
                startIndex,
                s0: null,
                rarity: null,
                s1: null,
                charIndex: -1,
                originalChar: errorChar,
                finalChar: errorChar,
                isRerolled: false,
                consumed: 0
            }
        };
    }

    const s0_seed = seeds[startIndex];     // レアリティ決定用
    const s1_seed = seeds[startIndex + 1]; // キャラクター決定用

    // 1. レアリティの決定
    const currentRarity = determineRarity(s0_seed, gachaConfig.rarity_rates);
    const characterPool = gachaConfig.pool[currentRarity] || [];

    if (characterPool.length === 0) {
        const errorChar = { name: "該当なし", id: null };
        return { 
            seedsConsumed: 2, 
            finalChar: errorChar, 
            rarity: currentRarity,
            charId: null,
            debug: {
                startIndex,
                s0: s0_seed,
                rarity: currentRarity,
                s1: s1_seed,
                charIndex: -1,
                originalChar: errorChar,
                finalChar: errorChar,
                isRerolled: false,
                consumed: 2
            }
        };
    }

    // 2. キャラクターの決定（最初の候補）
    const totalChars = characterPool.length;
    const charIndex = s1_seed % totalChars;
    const originalChar = { 
        id: characterPool[charIndex].id, 
        name: characterPool[charIndex].name 
    };

    let character = { ...originalChar };
    let seedsConsumed = 2; // 基本消費量(s0, s1)
    let isRerolled = false;
    let isConsecutiveRerollTarget = false;
    let rerollProcess = null;

    // 3. レア被り判定と再抽選の実行
    // レアリティが 'rare' の場合のみ、直前の結果と比較して再抽選を行う
    if (currentRarity === 'rare' && typeof checkDuplicateStatus === 'function') {
        const status = checkDuplicateStatus(String(character.id), lastDrawInfo, mode);
        
        if (status.targetToAvoid !== null) {
            isRerolled = true;
            isConsecutiveRerollTarget = status.isConsecutiveRerollTarget;

            // 再抽選ロジックの呼び出し（startIndex+2 以降のシードを消費）
            const res = executeReroll(startIndex, charIndex, characterPool, seeds, status.targetToAvoid);
            
            if (res.character) {
                character = { 
                    id: res.character.id, 
                    name: res.character.name 
                };
                seedsConsumed = res.seedsConsumed; // 再抽選にかかった分を含めた総消費数
                rerollProcess = res.rerollProcess;
                
                // デバッグ用に回避したIDを記録
                if (rerollProcess) {
                    rerollProcess.prevId = status.targetToAvoid;
                }
            }
        }
    }

    // 4. 結果の返却
    const result = { 
        originalChar, 
        finalChar: character, 
        isRerolled, 
        isConsecutiveRerollTarget,
        rarity: currentRarity, 
        charId: character.id, 
        seedsConsumed, 
        debug: {
            startIndex,
            s0: s0_seed,           // レアリティ判定に使用したSEED値
            seedValue: s0_seed,    // デバッグ表示用の別名
            rarity: currentRarity,
            s1: s1_seed,           // キャラ判定に使用した最初のSEED値
            charIndex,             // スロット番号
            originalChar,          // 回避前のキャラ
            finalChar: character,  // 最終的に確定したキャラ (view_table_debug.jsが参照)
            isRerolled,
            rerollProcess,
            consumed: seedsConsumed
        }
    };

    return result;
}