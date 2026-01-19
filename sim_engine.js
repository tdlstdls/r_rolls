/** @file sim_engine.js @description 経路探索の統合制御・インターフェース */

/**
 * 経路探索エントリポイント
 * 指定されたセル（targetSeedIndex）までの最短または最適な経路を計算します。
 */
function calculateRouteToCell(targetSeedIndex, targetGachaId, visibleGachaIds, currentConfigStr, finalActionOverride = null, primaryTargetId = null) {
    const simSeeds = generateSeedsForSim(targetSeedIndex);
    // 現在のルート設定を考慮した、有効な開始地点を計算
    const { startIdx, initialLastDraw, baseConfigStr } = calculateInitialState(currentConfigStr, targetSeedIndex, simSeeds);
    
    // 現在テーブルに表示されている（利用可能な）ガチャ設定のリストを作成
    const usableConfigs = visibleGachaIds.map(idStr => {
        const id = idStr.replace(/[gfs]$/, '');
        const config = gachaMasterData.gachas[id] || null;
        if (config) config._fullId = idStr;
        return config;
    }).filter(c => c !== null);
    
    if (usableConfigs.length === 0) return null;

    // UIのMax設定（プラチナチケット・確定枠の使用回数上限）を取得
    const maxPlat = parseInt(document.getElementById('sim-max-plat')?.value || 0, 10);
    const maxGuar = parseInt(document.getElementById('sim-max-guar')?.value || 0, 10);
    
    // ビームサーチの実行（段階的に制限を緩和して探索）
    let route = findPathBeamSearch(startIdx, targetSeedIndex, targetGachaId, usableConfigs, simSeeds, initialLastDraw, primaryTargetId, 0, 0);
    if (!route && maxGuar > 0) route = findPathBeamSearch(startIdx, targetSeedIndex, targetGachaId, usableConfigs, simSeeds, initialLastDraw, primaryTargetId, 0, maxGuar);
    if (!route && maxPlat > 0) route = findPathBeamSearch(startIdx, targetSeedIndex, targetGachaId, usableConfigs, simSeeds, initialLastDraw, primaryTargetId, maxPlat, maxGuar);
    
    if (route) {
        // 探索成功時、目的のセルでのアクションを追加して経路を完結させる
        if (finalActionOverride) {
            route.push(finalActionOverride);
        } else {
            // 通常セルの場合は1回引くアクション。表示上の整合性のために fullId を保持
            const baseId = targetGachaId.replace(/[gfs]$/, "");
            route.push({ id: baseId, rolls: 1, fullId: targetGachaId, g: false });
        }
        // 固定済みルートと新ルートを結合し、重複を圧縮して返す
        return (baseConfigStr ? baseConfigStr + " " : "") + compressRoute(route);
    }
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