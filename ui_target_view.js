/** @file ui_target_view.js @description ターゲットリストのUI描画 */

function updateTargetListUI() {
    const container = document.getElementById('target-list-container');
    if (!container) return;

    if (searchTargets.length === 0) {
        container.innerHTML = '<div style="color: #999; font-size: 0.9em; padding: 5px;">ターゲットが選択されていません。「Find」からキャラを選択してください。</div>';
        return;
    }

    let html = '<div style="display: flex; flex-wrap: wrap; gap: 5px; padding: 5px;">';
    searchTargets.forEach(target => {
        const color = getRarityColor(target.rarity);
        html += `
            <div class="target-tag" style="background: ${color}22; border: 1px solid ${color}; padding: 2px 8px; border-radius: 12px; font-size: 0.85em; display: flex; align-items: center; gap: 5px;">
                <span style="font-weight: bold; color: ${color};">${target.name}</span>
                <span style="cursor: pointer; color: #666; font-weight: bold;" onclick="toggleTarget('${target.id}', '${target.name}', '${target.rarity}')">×</span>
            </div>`;
    });
    html += '<button onclick="clearAllTargets()" style="font-size: 0.8em; padding: 2px 8px; margin-left: 5px;">クリア</button>';
    html += '</div>';
    container.innerHTML = html;
}

function getRarityColor(rarity) {
    switch (rarity) {
        case 'legend': return '#ff55cc';
        case 'uber': return '#ffaa00';
        case 'limited': return '#00bbff';
        default: return '#666';
    }
}