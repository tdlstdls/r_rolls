/**
 * @file logic_uber.js
 * @description 確定枠（Uber確定）専用の抽選およびデバッグ情報生成
 * @output_data {finalChar, seedsConsumed, debug}
 */

/**
 * 確定枠（Uber確定）の抽選を実行し、デバッグ用の詳細情報を返却する
 * @param {number} startIndex - 抽選に使用するSEEDインデックス
 * @param {Object} gachaConfig - ガチャのマスタデータ
 * @param {Array} seeds - 乱数シード配列
 * @returns {Object} 抽選結果とデバッグ情報
 */
function rollGuaranteedUber(startIndex, gachaConfig, seeds) {
    // 境界チェック：指定されたインデックスがシード配列の範囲内か確認
    if (startIndex >= seeds.length) {
        const errorChar = { name: "データ不足", id: null };
        return { 
            seedsConsumed: 1, 
            finalChar: errorChar,
            charId: null,
            debug: { 
                startIndex, 
                seedValue: null, 
                totalChars: 0, 
                charIndex: -1, 
                finalChar: errorChar, // デバッグログ表示用に含める
                rarity: 'uber'
            }
        };
    }

    // 超激レアキャラクタープールの取得
    const pool = gachaConfig.pool['uber'] || [];
    if (pool.length === 0) {
        const errorChar = { name: "該当なし", id: null };
        return { 
            seedsConsumed: 1, 
            finalChar: errorChar,
            charId: null,
            debug: { 
                startIndex, 
                seedValue: seeds[startIndex], 
                totalChars: 0, 
                charIndex: -1, 
                finalChar: errorChar, // デバッグログ表示用に含める
                rarity: 'uber'
            }
        };
    }
    
    // 抽選処理
    const seedValue = seeds[startIndex];
    const totalChars = pool.length;
    const charIndex = seedValue % totalChars;
    const character = pool[charIndex];

    // キャラクター情報の整形
    // オブジェクトの参照渡しによる予期せぬ書き換えを防ぐため、新しいオブジェクトとして生成
    const resultChar = { 
        id: character.id, 
        name: character.name 
    };

    // 抽選結果と、詳細な計算過程（debug）を返却
    return { 
        seedsConsumed: 1, 
        finalChar: resultChar, 
        charId: resultChar.id,
        debug: { 
            startIndex, 
            seedValue, 
            totalChars, 
            charIndex, 
            finalChar: resultChar, // view_table_debug.js の log.finalChar がここを参照します
            rarity: 'uber'
        }
    };
}