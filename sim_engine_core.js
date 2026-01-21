/**
 * @file sim_engine_core.js
 * @description 単一セグメント(11連等)のシミュレーションとトラック遷移(lastA/B)の同期
 * @managed_state trackStates {lastA, lastB, lastAction} (トラック整合性の維持)
 * @output_data {nextIndex, trackStates}
 */

/**
 * 単一のガチャセグメント（例：11回連続で引く）をシミュレートし、終了時の状態を返す
 * @param {Object} segment - アクション情報 {id, rolls, g}
 * @param {number} startIdx - このセグメントの開始SEEDインデックス
 * @param {Object|null} initialStates - 前のセグメントから引き継ぐ状態 {lastA, lastB, lastAction}
 * @param {Array} seeds - 乱数配列
 * @returns {Object} {nextIndex, trackStates} 次の開始地点と最終的なトラック状態
 */
function simulateSingleSegment(segment, startIdx, initialStates, seeds) {
    let currentIdx = startIdx;
    const config = gachaMasterData.gachas[segment.id];
    
    // 状態管理オブジェクトの初期化
    // 前のセグメントの結果（initialStates）があれば継承し、なければ新規作成
    let trackStates = initialStates ? { ...initialStates } : {
        lastA: null,      // トラックAの物理的直上
        lastB: null,      // トラックBの物理的直上
        lastAction: null  // 全トラックを通じて「直前に実行されたロール」の最終結果
    };

    if (!config) return { nextIndex: currentIdx, trackStates: trackStates };

    let rollsToPerform = segment.rolls;
    let isGuaranteed = false;

    // 確定枠（11G/15G/7G等）がある場合の、通常枠としての計算回数を算出
    if (segment.g) {
        if (segment.rolls === 15) { rollsToPerform = 14; isGuaranteed = true; }
        else if (segment.rolls === 7) { rollsToPerform = 6; isGuaranteed = true; }
        else if (segment.rolls === 11) { rollsToPerform = 10; isGuaranteed = true; }
        else { rollsToPerform = Math.max(0, segment.rolls - 1); isGuaranteed = true; }
    }

    // --- 1. 通常枠（または確定枠の前のロール）のシミュレーション ---
    for (let i = 0; i < rollsToPerform; i++) {
        if (currentIdx >= seeds.length) break;

        const isTrackB = (currentIdx % 2 !== 0);
        
        // 物理的な「直上のセル」の情報を取得（レア被り判定の物理チェック用）
        const drawAbove = isTrackB ? trackStates.lastB : trackStates.lastA;

        // 判定コンテキストの構築
        // originalIdAbove: テーブル上の物理的な直上ID（物理的な重なりチェック用）
        // finalIdSource: 直前のロールで「最終的に確定した」ID（インデックス線形遷移のチェック用）
        const drawContext = {
            originalIdAbove: drawAbove ? String(drawAbove.charId) : null,
            finalIdSource: trackStates.lastAction ? String(trackStates.lastAction.charId) : null
        };

        // ロールの実行
        const rr = rollWithSeedConsumptionFixed(currentIdx, config, seeds, drawContext);
        if (rr.seedsConsumed === 0) break;

        // 実行結果を整理
        const result = {
            rarity: rr.rarity,
            charId: rr.charId, // 再抽選後のIDがここに入る
            originalCharId: rr.originalChar ? String(rr.originalChar.id) : String(rr.charId),
            trackB: isTrackB
        };

        // 物理トラック履歴の更新
        if (isTrackB) {
            trackStates.lastB = result;
        } else {
            trackStates.lastA = result;
        }
        
        // 「直前に行われたアクション」として、再抽選後を含む結果を保存
        // これが次のループの drawContext.finalIdSource に受け渡される
        trackStates.lastAction = result;

        // インデックスを線形に加算（再抽選があれば3以上、なければ2加算される）
        currentIdx += rr.seedsConsumed;
    }

    // --- 2. 確定枠（11連の最後など）がある場合の処理 ---
    if (isGuaranteed && currentIdx < seeds.length) {
        const isTrackB = (currentIdx % 2 !== 0);
        const gr = rollGuaranteedUber(currentIdx, config, seeds);
        
        const result = { 
            rarity: 'uber', 
            charId: gr.charId, 
            originalCharId: gr.charId,
            trackB: isTrackB
        };

        if (isTrackB) {
            trackStates.lastB = result;
        } else {
            trackStates.lastA = result;
        }
        
        trackStates.lastAction = result;

        // 確定枠は常に1つのSEEDを消費する
        currentIdx += gr.seedsConsumed;
    }

    return { nextIndex: currentIdx, trackStates: trackStates };
}

/**
 * ルート配列をシミュレーション用Config形式の文字列に圧縮する
 * （連続する同一ガチャのロールをまとめるが、確定枠は個別に扱う）
 */
function compressRoute(route) {
    if (!route || route.length === 0) return "";
    const segments = [];
    let current = null;

    for (const step of route) {
        // 同じガチャID、かつ確定枠でない場合は回数を合算可能
        if (current && current.id === step.id && current.g === step.g && !step.g) {
            current.rolls += step.rolls;
        } else {
            if (current) segments.push(current);
            current = { ...step };
        }
    }
    if (current) segments.push(current);

    // sim_config_helpers.js の関数を使用して文字列化
    return stringifySimConfig(segments);
}