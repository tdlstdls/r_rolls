/** @file sim_engine.js @description 経路探索の統合制御・インターフェース */

/**
 * 経路探索エントリポイント
 * 指定されたセル（targetSeedIndex）までの最短または最適な経路を計算します。
 */
function calculateRouteToCell(targetSeedIndex, targetGachaId, visibleGachaIds, currentConfigStr, finalActionOverride = null, primaryTargetId = null) {
    console.log(`%c[calculateRouteToCell] Start: target=${targetSeedIndex}, config="${currentConfigStr}"`, 'color: #007bff; font-weight: bold;');

    const simSeeds = generateSeedsForSim(targetSeedIndex + 500); // 探索の余裕分を増やす
    
    const { startIdx, initialLastDraw, baseConfigStr } = calculateInitialState(currentConfigStr, targetSeedIndex, simSeeds);
    console.log(`[calculateRouteToCell] Initial state: startIdx=${startIdx}`, { initialLastDraw, baseConfigStr });
    
    const usableConfigs = visibleGachaIds.map(idStr => {
        const id = idStr.replace(/[gfs]$/, '');
        const config = gachaMasterData.gachas[id] || null;
        if (config) config._fullId = idStr;
        return config;
    }).filter(c => c !== null);
    
    if (usableConfigs.length === 0) {
        console.error("[calculateRouteToCell] No usable gacha configs found.");
        return null;
    }

    const maxPlat = parseInt(document.getElementById('sim-max-plat')?.value || 0, 10);
    const maxGuar = parseInt(document.getElementById('sim-max-guar')?.value || 0, 10);
    
    console.log(`[calculateRouteToCell] Calling findPathBeamSearch with: start=${startIdx}, target=${targetSeedIndex}`);
    let route = findPathBeamSearch(startIdx, targetSeedIndex, targetGachaId, usableConfigs, simSeeds, initialLastDraw, primaryTargetId, 0, 0);
    if (!route && maxGuar > 0) {
        console.log('[calculateRouteToCell] Retrying with maxGuar=' + maxGuar);
        route = findPathBeamSearch(startIdx, targetSeedIndex, targetGachaId, usableConfigs, simSeeds, initialLastDraw, primaryTargetId, 0, maxGuar);
    }
    if (!route && maxPlat > 0) {
        console.log('[calculateRouteToCell] Retrying with maxPlat=' + maxPlat);
        route = findPathBeamSearch(startIdx, targetSeedIndex, targetGachaId, usableConfigs, simSeeds, initialLastDraw, primaryTargetId, maxPlat, maxGuar);
    }
    
    console.log('[calculateRouteToCell] findPathBeamSearch returned:', route ? `Route with ${route.length} segments` : 'null', route);

    if (route) {
        // findPathBeamSearchが返した完全な経路を元に、最終ステップを安全に差し替える
        let finalRoute = [...route];

        // 確定枠指定のクリックなど、特別なオーバーライドがない場合
        if (!finalActionOverride) {
            const pathToLastStep = [...route];
            if (pathToLastStep.length > 0) {
                pathToLastStep.pop(); // 最後のステップを一旦取り除く

                // 最終ステップの手前までの状態を正確に再計算する
                let lastStateIdx = startIdx;
                let lastStateDraw = initialLastDraw;
                for (const segment of pathToLastStep) {
                    const res = simulateSingleSegment(segment, lastStateIdx, lastStateDraw, simSeeds);
                    lastStateIdx = res.nextIndex;
                    lastStateDraw = res.lastDraw;
                }

                // 正しい最終アクションを準備
                const finalSegment = {
                    id: targetGachaId.replace(/[gfs]$/, ""),
                    rolls: 1,
                    fullId: targetGachaId,
                    g: false
                };
                
                // 再計算した状態から最終アクションを実行した経路を最終版とする
                finalRoute = [...pathToLastStep, finalSegment];
            } else {
                 // ルートが空（開始地点がゴール）の場合
                const baseId = targetGachaId.replace(/[gfs]$/, "");
                finalRoute = [{ id: baseId, rolls: 1, fullId: targetGachaId, g: false }];
            }
        } else {
             // 確定枠オーバーライドがある場合は、単純に末尾に追加する
             finalRoute.push(finalActionOverride);
        }
        
        const finalCompressedRoute = (baseConfigStr ? baseConfigStr + " " : "") + compressRoute(finalRoute);
        console.log('%c[calculateRouteToCell] Success: Final route built.', 'color: #28a745; font-weight: bold;', { finalRoute, finalCompressedRoute });

        return finalCompressedRoute;
    }

    console.error('[calculateRouteToCell] Failed to find any valid route.');
    return null;
}

/**
 * 探索用の乱数シード配列を生成
 */
function generateSeedsForSim(targetSeedIndex) {
    const seedEl = document.getElementById('seed');
    const initialSeed = parseInt(seedEl ? seedEl.value : 12345);
    const rng = new Xorshift32(initialSeed);
    const tempSeeds = [];
    // 探索ターゲットよりも余裕を持たせた長さのシード配列を確保
    const limit = Math.max(targetSeedIndex, 1000) + 500;
    for (let i = 0; i < limit; i++) tempSeeds.push(rng.next());
    return tempSeeds;
}

/**
 * 現在のルート入力値（sim-config）から、探索を開始すべき正確なインデックスと直前状態を算出
 */
function calculateInitialState(currentConfigStr, targetSeedIndex, simSeeds) {
    let startIdx = 0, initialLastDraw = null, validConfigParts = [];
    if (currentConfigStr && currentConfigStr.trim() !== "") {
        const existingConfigs = parseSimConfig(currentConfigStr);
        let tempIdx = 0, tempLastDraw = null;
        for (const segment of existingConfigs) {
            // 単一セグメントをシミュレートして到達地点を確認
            const res = simulateSingleSegment(segment, tempIdx, tempLastDraw, simSeeds);
            // 目的のセルを追い越してしまう設定は無視（クリックしたセルへ再計算するため）
            if (res.nextIndex > targetSeedIndex) break;
            
            validConfigParts.push(segment);
            tempIdx = res.nextIndex; 
            tempLastDraw = res.lastDraw;
            
            // 既に目的地に到達している場合はそこで停止
            if (tempIdx === targetSeedIndex) break;
        }
        startIdx = tempIdx; 
        initialLastDraw = tempLastDraw;
    }
    // 圧縮された既存ルートの文字列と、そこからの開始状態を返す
    return { startIdx, initialLastDraw, baseConfigStr: stringifySimConfig(validConfigParts) };
}