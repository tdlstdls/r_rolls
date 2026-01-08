/** @file sim_engine.js @description 経路探索の統合制御（ターゲット精度・トラック同期強化版） */

/**
 * 経路探索エントリポイント
 * 指定されたセル（targetSeedIndex）まで、トラック（A/B）を違えずに到達する最短経路を計算します。
 */
function calculateRouteToCell(targetSeedIndex, targetGachaId, visibleGachaIds, currentConfigStr, finalActionOverride = null, primaryTargetId = null) {
    // 探索に必要な乱数配列を生成
    const simSeeds = generateSeedsForSim(targetSeedIndex);
    
    // 現在の入力（sim-config）から、ターゲットセルより手前までの有効なルートを抽出
    const { startIdx, initialLastDraw, baseConfigStr } = calculateInitialState(currentConfigStr, targetSeedIndex, simSeeds);
    
    // 現在表示されている有効なガチャ設定を取得
    const usableConfigs = visibleGachaIds.map(idStr => {
        const id = idStr.replace(/[gfs]$/, '');
        const config = gachaMasterData.gachas[id] || null;
        if (config) config._fullId = idStr;
        return config;
    }).filter(c => c !== null);
    
    if (usableConfigs.length === 0) return null;

    // UIの上限設定（MaxPlat/MaxG）を取得
    const maxPlat = parseInt(document.getElementById('sim-max-plat')?.value || 0, 10);
    const maxGuar = parseInt(document.getElementById('sim-max-guar')?.value || 0, 10);
    
    // ターゲットに「ピッタリ」到達するための探索を実行
    // 第1段階：確定・プラチナなしで探索
    let route = findPathBeamSearch(startIdx, targetSeedIndex, targetGachaId, usableConfigs, simSeeds, initialLastDraw, primaryTargetId, 0, 0);
    // 第2段階：確定枠を許可して探索
    if (!route && maxGuar > 0) {
        route = findPathBeamSearch(startIdx, targetSeedIndex, targetGachaId, usableConfigs, simSeeds, initialLastDraw, primaryTargetId, 0, maxGuar);
    }
    // 第3段階：プラチナチケットも許可して探索
    if (!route && maxPlat > 0) {
        route = findPathBeamSearch(startIdx, targetSeedIndex, targetGachaId, usableConfigs, simSeeds, initialLastDraw, primaryTargetId, maxPlat, maxGuar);
    }
    
    if (route) {
        // 見つかったルートをシミュレートし、最終的なインデックスがターゲットと一致するか再確認
        let checkIdx = startIdx;
        let checkLastDraw = initialLastDraw;
        for (const seg of route) {
            const res = simulateSingleSegment(seg, checkIdx, checkLastDraw, simSeeds);
            checkIdx = res.nextIndex;
            checkLastDraw = res.lastDraw;
        }

        // トラックの左右（A/B）がターゲットと一致している場合のみ、最後のアクションを結合
        if (checkIdx === targetSeedIndex) {
            if (finalActionOverride) {
                route.push(finalActionOverride);
            } else {
                const baseId = targetGachaId.replace(/[gfs]$/, "");
                route.push({ id: baseId, rolls: 1, fullId: targetGachaId, g: false });
            }
            // 既存の固定ルートと新しい探索ルートを結合して圧縮
            return (baseConfigStr ? baseConfigStr + " " : "") + compressRoute(route);
        }
    }
    
    // 到達ルートが見つからない、またはトラックが一致しない場合
    return null;
}

/**
 * 探索用の乱数シード配列を十分に長い範囲で生成
 */
function generateSeedsForSim(targetSeedIndex) {
    const seedEl = document.getElementById('seed');
    const initialSeed = parseInt(seedEl ? seedEl.value : 12345, 10);
    const rng = new Xorshift32(initialSeed);
    const tempSeeds = [];
    const limit = Math.max(targetSeedIndex, 1000) + 500;
    for (let i = 0; i < limit; i++) tempSeeds.push(rng.next());
    return tempSeeds;
}

/**
 * 現在のルート文字列を解析し、ターゲットセルより手前で停止する「有効な前段ルート」を計算
 */
function calculateInitialState(currentConfigStr, targetSeedIndex, simSeeds) {
    let startIdx = 0;
    let initialLastDraw = null;
    let validConfigParts = [];

    if (currentConfigStr && currentConfigStr.trim() !== "") {
        const existingConfigs = parseSimConfig(currentConfigStr);
        let tempIdx = 0;
        let tempLastDraw = null;

        for (const segment of existingConfigs) {
            const res = simulateSingleSegment(segment, tempIdx, tempLastDraw, simSeeds);
            
            // 重要：ターゲットインデックスを「超える」設定、またはターゲット「そのもの」の設定は、
            // 新規クリックによる再計算のために除外する
            if (res.nextIndex > targetSeedIndex) break;
            if (res.nextIndex === targetSeedIndex) {
                // ターゲットにぴったり重なる場合も、一度外して再計算（finalActionの重複防止）
                break;
            }
            
            validConfigParts.push(segment);
            tempIdx = res.nextIndex; 
            tempLastDraw = res.lastDraw;
        }
        startIdx = tempIdx; 
        initialLastDraw = tempLastDraw;
    }
    return { 
        startIdx, 
        initialLastDraw, 
        baseConfigStr: stringifySimConfig(validConfigParts) 
    };
}