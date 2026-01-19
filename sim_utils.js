/** @file sim_utils.js @description シミュレーション結果の圧縮 */

/** 経路をConfig形式に圧縮 [cite: 356-361] */
function compressRoute(path) {
    if (!path || path.length === 0) return "";
    let compressed = [];
    let currentId = path[0].id;
    let isG = path[0].g || false;
    let count = path[0].rolls || 1;
    for (let i = 1; i < path.length; i++) {
        const step = path[i];
        const stepG = step.g || false;
        if (step.id === currentId && stepG === isG && !isG) {
            count += (step.rolls || 1);
        } else {
            compressed.push(`${currentId} ${count}${isG ? 'g' : ''}`);
            currentId = step.id;
            isG = stepG;
            count = step.rolls || 1;
        }
    }
    compressed.push(`${currentId} ${count}${isG ? 'g' : ''}`);
    return compressed.join(" ");
}