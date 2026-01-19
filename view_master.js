/** @file view_master.js @description ガチャマスタ（キャラリスト）の詳細情報のHTML生成を担当 @dependency data_loader.js */

function toggleMasterSection(gachaId) {
    const section = document.getElementById(`master-section-${gachaId}`);
    const toggle = document.getElementById(`master-toggle-${gachaId}`);
    if (section && toggle) {
        if (section.style.display === 'none') {
            section.style.display = 'block';
            toggle.textContent = '[-]';
        } else {
            section.style.display = 'none';
            toggle.textContent = '[+]';
        }
    }
}

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
        html += `<h4 style="margin: 0 0 8px 0; font-size: 1em;">
            <span id="master-toggle-${id}" style="cursor:pointer; font-family:monospace; display: inline-block; width: 20px;" onclick="toggleMasterSection('${id}')">[-]</span>
            ${config.name} (ID: ${id})
        </h4>`;

        const rates = configClone.rarity_rates || {};
        const pool = configClone.pool || {};
        
        html += `<div id="master-section-${id}" style="display: block; padding-left: 20px;">`;

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
                
                // --- 状態チェック ---
                const isHidden = hiddenFindIds.has(cid) || (typeof cid === 'number' && hiddenFindIds.has(cid));
                const isManual = userTargetIds.has(cid) || (typeof cid === 'number' && userTargetIds.has(cid));
                const isPrioritized = userPrioritizedTargets.includes(cid) || (typeof cid === 'number' && userPrioritizedTargets.includes(cid));

                // ハイライト条件:
                const isFindTarget = ((isAutomaticTarget(cid) && !isHidden) || isManual);

                let style = '';
                let titleText = 'クリックで優先表示に登録/解除';

                if (isPrioritized) {
                    style = 'background-color: #6EFF72; border: 1px solid #28a745; padding: 1px 3px; border-radius: 3px; font-weight: bold;';
                    titleText = '優先表示を解除';
                } else if (isFindTarget) {
                    style = 'background-color: #ffffcc; border: 1px solid #ff9800; padding: 1px 3px; border-radius: 3px; font-weight: bold;';
                }

                return `<span style="cursor:pointer; ${style}" onclick="prioritizeChar('${cid}')" title="${titleText}">${idx}&nbsp;${c.name}</span>`;
            }).join(', ');

            html += `<div style="margin-bottom: 3px;">`;
            html += `<strong>${r.label}:</strong> ${rateStr} (${count} cats) `;
            html += `<span style="color: #555; line-height: 1.6;">${listStr}</span>`;
            html += `</div>`;
        });

        html += `</div>`; // master-section-${id} の閉じタグ

        html += `</div>`;
    });

    return html;
}