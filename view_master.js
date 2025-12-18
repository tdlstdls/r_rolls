/** @file view_master.js @description ガチャマスタ（キャラリスト）の詳細情報のHTML生成を担当 @dependency data_loader.js */

function generateMasterInfoHtml() {
    if (!gachaMasterData || !gachaMasterData.gachas) return '<p>データがありません</p>';
    
    // 現在選択中のユニークなガチャIDを抽出
    const uniqueIds = [...new Set(tableGachaIds.map(idStr => {
        let id = idStr;
        if (id.endsWith('f') || id.endsWith('s') || id.endsWith('g')) {
            id = id.slice(0, -1);
        }
        return id;
    }))];
    
    if (uniqueIds.length === 0) return '<p>ガチャが選択されていません</p>';

    // --- Findターゲット判定用のセットを準備 ---
    const limitedSet = new Set();
    if (typeof limitedCats !== 'undefined' && Array.isArray(limitedCats)) {
        limitedCats.forEach(id => {
            limitedSet.add(id);
            limitedSet.add(String(id));
        });
    }

    let html = '';
    uniqueIds.forEach(id => {
        const config = gachaMasterData.gachas[id];
        if (!config) return;

        // 超激レア追加設定があればプールを一時的に拡張
        const configClone = { ...config, pool: { ...config.pool } };
        if (configClone.pool.uber) configClone.pool.uber = [...configClone.pool.uber];

        const colIndex = tableGachaIds.findIndex(tid => tid.startsWith(id));
        const addCount = (colIndex >= 0 && uberAdditionCounts[colIndex]) ? uberAdditionCounts[colIndex] : 0;
        
        if (addCount > 0 && configClone.pool.uber) {
            for (let k = 1; k <= addCount; k++) {
                configClone.pool.uber.unshift({
                    id: `sim-new-${k}`,
                    name: `新規超激${k}`,
                    rarity: 'uber'
                });
            }
        }

        html += `<div style="margin-bottom: 15px; border-bottom: 1px solid #ccc; padding-bottom: 10px;">`;
        html += `<h4 style="margin: 0 0 5px 0;">${config.name} (ID: ${id})</h4>`;

        const rates = configClone.rarity_rates || {};
        const pool = configClone.pool || {};

        const rarities = [
            { key: 'legend', label: 'Legendary' },
            { key: 'uber', label: 'Uber' },
            { key: 'super', label: 'Super' },
            { key: 'rare', label: 'Rare' }
        ];

        rarities.forEach(r => {
            const rateVal = rates[r.key] || 0;
            const rateStr = (rateVal / 100) + '%';
            const charList = pool[r.key] || [];
            const count = charList.length;

            if (count === 0 && rateVal === 0) return;

            // キャラリスト生成
            const listStr = charList.map((c, idx) => {
                const cid = c.id;
                const cStr = String(cid);
                
                // --- Findターゲット判定 (自動) ---
                const isLegendRank = (r.key === 'legend');
                const isLimited = limitedSet.has(cid) || limitedSet.has(cStr);
                const isNew = cStr.startsWith('sim-new-');
                const isAuto = isAutomaticTarget(cid);

                // --- 状態チェック ---
                const isHidden = hiddenFindIds.has(cid) || (typeof cid === 'number' && hiddenFindIds.has(cid));
                const isManual = userTargetIds.has(cid) || (typeof cid === 'number' && userTargetIds.has(cid));

                // ハイライト条件:
                // 1. 自動ターゲット かつ 非表示でない
                // 2. 手動ターゲットである
                const shouldHighlight = (isAuto && !isHidden) || isManual;

                let style = '';
                if (shouldHighlight) {
                    style = 'background-color: #ffffcc; border: 1px solid #ff9800; padding: 1px 3px; border-radius: 3px; font-weight: bold;';
                }
                // 修正: 非表示状態（自動ターゲットだがisHidden=true）の場合でも、特別なスタイル（グレーアウト・取り消し線）を適用しない
                // else if (isAuto && isHidden) { ... } を削除

                // タイトル属性でアクションを示唆
                const titleText = shouldHighlight ? '非表示にする' : 'Findに追加する';

                return `<span style="cursor:pointer; ${style}" onclick="toggleCharVisibility('${cid}')" title="${titleText}">${idx}&nbsp;${c.name}</span>`;
            }).join(', ');

            html += `<div style="margin-bottom: 3px;">`;
            html += `<strong>${r.label}:</strong> ${rateStr} (${count} cats) `;
            html += `<span style="color: #555; line-height: 1.6;">${listStr}</span>`;
            html += `</div>`;
        });

        html += `</div>`;
    });

    return html;
}