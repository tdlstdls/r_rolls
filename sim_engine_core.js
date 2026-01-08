/** @file sim_engine_core.js @description 経路探索用の単一セグメント計算（トラック遷移整合性強化版） */

/**
 * 単一のガチャセグメント（例：ガチャID:123で5回回す）をシミュレートする
 * トラック遷移（レア被り）を考慮し、最終的なインデックスと直前の状態を返します。
 */
function simulateSingleSegment(segment, startIdx, initialLastDraw, seeds) {
    let currentIdx = startIdx;
    let lastRoll = initialLastDraw;
    const config = gachaMasterData.gachas[segment.id];
    
    if (!config) return { nextIndex: currentIdx, lastDraw: lastRoll };

    let rollsToPerform = segment.rolls;
    let isGuaranteed = false;

    // 確定枠（11G/15G/7G等）の判定と、通常枠としての計算回数の調整
    if (segment.g) {
        if (segment.rolls === 15) { rollsToPerform = 14; isGuaranteed = true; }
        else if (segment.rolls === 7) { rollsToPerform = 6; isGuaranteed = true; }
        else if (segment.rolls === 11) { rollsToPerform = 10; isGuaranteed = true; }
        else { rollsToPerform = segment.rolls - 1; isGuaranteed = true; }
    }

    // 通常枠のシミュレーション実行
    for (let i = 0; i < rollsToPerform; i++) {
        // トラック（A=偶数, B=奇数）に応じた物理情報のコンテキストを構築
        const isTrackB = (currentIdx % 2 !== 0);
        
        // 探索中のレア被り判定において、直前の結果が「現在と同じトラック」から来たものかを検証
        // （テーブル上の直上のキャラIDと比較するため）
        const drawContext = {
            originalIdAbove: (lastRoll && lastRoll.trackB === isTrackB) ? lastRoll.originalCharId : null,
            finalIdSource: lastRoll ? lastRoll.charId : null
        };

        const rr = rollWithSeedConsumptionFixed(currentIdx, config, seeds, drawContext);
        if (rr.seedsConsumed === 0) break;

        lastRoll = {
            rarity: rr.rarity,
            charId: rr.charId,
            originalCharId: rr.originalChar ? rr.originalChar.id : rr.charId,
            trackB: isTrackB // どのトラックでの結果かを保持
        };
        
        // インデックスを更新（通常+2、レア被り時+3または+1）
        currentIdx += rr.seedsConsumed;
    }

    // 確定枠がある場合の最後の1枠の処理
    if (isGuaranteed) {
        const isTrackB = (currentIdx % 2 !== 0);
        const gr = rollGuaranteedUber(currentIdx, config, seeds);
        
        lastRoll = { 
            rarity: 'uber', 
            charId: gr.charId, 
            originalCharId: gr.charId,
            trackB: isTrackB
        };
        currentIdx += gr.seedsConsumed;
    }

    return { nextIndex: currentIdx, lastDraw: lastRoll };
}

/**
 * ルート配列を文字列（sim-config形式、例 "123:5 456:11g"）に圧縮・変換する
 */
function compressRoute(route) {
    if (!route || route.length === 0) return "";
    const segments = [];
    let current = null;

    for (const step of route) {
        // 同じガチャID、かつ確定枠フラグが一致する場合は回数を合算
        if (current && current.id === step.id && current.g === step.g) {
            current.rolls += step.rolls;
        } else {
            if (current) segments.push(current);
            current = { ...step };
        }
    }
    if (current) segments.push(current);

    return stringifySimConfig(segments);
}

/**
 * セグメントオブジェクトの配列を sim-config 用の文字列にシリアライズする
 */
function stringifySimConfig(segments) {
    return segments.map(s => {
        let suffix = "";
        if (s.g) {
            // 回数から適切なサフィックス（g/f/s）を決定
            if (s.rolls >= 10) suffix = "g";
            else if (s.rolls >= 14) suffix = "f";
            else if (s.rolls >= 6) suffix = "s";
            else suffix = "g"; // デフォルト
        }
        // 表示上の回数は、内部の計算回数+確定枠の1回分
        const displayRolls = s.g ? (s.rolls + (s.rolls >= 10 ? 1 : 0)) : s.rolls;
        // 11g等の特殊表記の場合、入力値を維持するために調整
        let finalRolls = s.rolls;
        if (s.g) {
            if (s.rolls === 10) finalRolls = 11;
            else if (s.rolls === 14) finalRolls = 15;
            else if (s.rolls === 6) finalRolls = 7;
        }
        return `${s.id}:${finalRolls}${suffix}`;
    }).join(" ");
}

/**
 * sim-config 文字列をセグメントオブジェクトの配列に逆シリアル化する
 */
function parseSimConfig(configStr) {
    if (!configStr) return [];
    return configStr.split(/\s+/).filter(s => s.includes(":")).map(s => {
        const [id, val] = s.split(":");
        const gMatch = val.match(/[gfs]$/);
        const rolls = parseInt(val, 10);
        return {
            id: id,
            rolls: rolls,
            g: !!gMatch,
            suffix: gMatch ? gMatch[0] : ""
        };
    });
}