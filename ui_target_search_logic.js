/** @file ui_target_search_logic.js @description キャラクター出現位置の計算ロジック */

function searchInAllGachas(targetId, targetName) {
    const seedEl = document.getElementById('seed');
    if (!seedEl) return;
    const initialSeed = parseInt(seedEl.value);
    const maxSearch = 10000;
    const results = [];
    const allGachaIds = Object.keys(gachaMasterData.gachas);

    allGachaIds.forEach(gachaId => {
        const gacha = gachaMasterData.gachas[gachaId];
        const findRes = findCharacterInGacha(gacha, targetId, initialSeed, maxSearch);
        if (findRes) {
            results.push({
                gachaName: gacha.name,
                gachaId: gachaId,
                distance: findRes.distance,
                track: findRes.track
            });
        }
    });

    results.sort((a, b) => a.distance - b.distance);
    displayOtherSearchResults(targetName, results);
}

function findCharacterInGacha(gacha, targetId, initialSeed, maxSearch) {
    const rng = new Xorshift32(initialSeed);
    const seeds = [];
    for (let i = 0; i < maxSearch * 2 + 100; i++) seeds.push(rng.next());

    let lastDraw = null;
    for (let i = 0; i < maxSearch; i++) {
        const resA = rollWithSeedConsumptionFixed(i * 2, gacha, seeds, lastDraw);
        if (String(resA.charId) === String(targetId)) return { distance: i + 1, track: 'A' };
        
        const resB = rollWithSeedConsumptionFixed(i * 2 + 1, gacha, seeds, lastDraw);
        if (String(resB.charId) === String(targetId)) return { distance: i + 1, track: 'B' };
    }
    return null;
}