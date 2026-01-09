/** @file sim_engine_core.js @description 経路探索用の単一セグメント計算（トラック遷移整合性・物理配置同期強化版） */

/**
 * 単一のガチャセグメント（例：ガチャID:123で5回回す）をシミュレートする
 * トラック遷移（レア被り）を考慮し、最終的なインデックスと直前の状態を返します。
 */
function simulateSingleSegment(segment, startIdx, initialStates, seeds) {
    let currentIdx = startIdx;
    const config = gachaMasterData.gachas[segment.id];
    
    // 状態管理オブジェクトの初期化
    // initialStates が A/B 両方の状態を持っていることを想定
    let trackStates = initialStates ? { ...initialStates } : {
        lastA: null,
        lastB: null,
        lastAction: null // 最後に実行されたロールの結果
    };

    if (!config) return { nextIndex: currentIdx, trackStates: trackStates };

    let rollsToPerform = segment.rolls;
    let isGuaranteed = false;

    // 確定枠（11G/15G/7G等）の判定と、通常枠としての計算回数の調整
    if (segment.g) {
        if (segment.rolls === 15) { rollsToPerform = 14; isGuaranteed = true; }
        else if (segment.rolls === 7) { rollsToPerform = 6; isGuaranteed = true; }
        else if (segment.rolls === 11) { rollsToPerform = 10; isGuaranteed = true; }
        else { rollsToPerform = Math.max(0, segment.rolls - 1); isGuaranteed = true; }
    }

    // 通常枠のシミュレーション実行
    for (let i = 0; i < rollsToPerform; i++) {
        if (currentIdx >= seeds.length) break;
        
        const isTrackB = (currentIdx % 2 !== 0);
        
        // 物理的な「直上のセル」の情報を取得
        // そのトラック（A or B）で最後に排出されたキャラが、テーブル上の物理的な直上となる
        const drawAbove = isTrackB ? trackStates.lastB : trackStates.lastA;

        // 判定コンテキストの構築
        // originalIdAbove: テーブル上の物理的な直上ID（物理チェック用）
        // finalIdSource: 直前のロール（遷移元）で実際に排出されたID（遷移チェック用）
        const drawContext = {
            originalIdAbove: drawAbove ? String(drawAbove.charId) : null,
            finalIdSource: trackStates.lastAction ? String(trackStates.lastAction.charId) : null
        };

        // ロールの実行（ロジック層の rollWithSeedConsumptionFixed を使用）
        const rr = rollWithSeedConsumptionFixed(currentIdx, config, seeds, drawContext);
        if (rr.seedsConsumed === 0) break;

        // 状態の更新
        const result = {
            rarity: rr.rarity,
            charId: rr.charId,
            originalCharId: rr.originalChar ? String(rr.originalChar.id) : String(rr.charId),
            trackB: isTrackB
        };

        // 物理トラック履歴と最後のアクションを更新
        if (isTrackB) {
            trackStates.lastB = result;
        } else {
            trackStates.lastA = result;
        }
        trackStates.lastAction = result;

        currentIdx += rr.seedsConsumed;
    }

    // 確定枠がある場合の最後の1枠の処理
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

        currentIdx += gr.seedsConsumed;
    }

    return { nextIndex: currentIdx, trackStates: trackStates };
}

/**
 * ルート配列を文字列（sim-config形式）に圧縮・変換する
 * （連続した同一ガチャのロールをまとめる）
 */
function compressRoute(route) {
    if (!route || route.length === 0) return "";
    const segments = [];
    let current = null;

    for (const step of route) {
        // 同じガチャID、かつ確定枠フラグが一致する場合は回数を合算
        // ただし、確定枠(g)の場合は合算せず個別のセグメントとして保持
        if (current && current.id === step.id && current.g === step.g && !step.g) {
            current.rolls += step.rolls;
        } else {
            if (current) segments.push(current);
            current = { ...step };
        }
    }
    if (current) segments.push(current);

    return stringifySimConfig(segments);
}