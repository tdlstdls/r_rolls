/** @file logic_rarity.js @description レアリティ判定ロジック */
function determineRarity(seed, rates) {
    const rarityRoll = seed % 10000;
    const defaultRates = { rare: 6970, super: 2500, uber: 500, legend: 30 };
    const r = rates || defaultRates;

    if (rarityRoll < r.rare) return 'rare';
    if (rarityRoll < r.rare + r.super) return 'super';
    if (rarityRoll < r.rare + r.super + r.uber) return 'uber';
    if (rarityRoll < r.rare + r.super + r.uber + r.legend) return 'legend';
    return 'rare';
}