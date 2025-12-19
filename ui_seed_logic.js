/** @file ui_seed_logic.js @description SEED値の操作・同期ロジック */

function toggleSeedInput() {
    const container = document.getElementById('seed-input-container');
    const trigger = document.getElementById('seed-input-trigger');
    if (!container) return;

    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        if (trigger) {
            trigger.classList.remove('hidden');
            trigger.classList.add('active');
        }
        const input = document.getElementById('seed');
        if (input) input.focus();
    } else {
        cancelSeedInput();
    }
}

function applySeedInput() {
    if (typeof updateUrlParams === 'function') updateUrlParams();
    resetAndGenerateTable();
    const container = document.getElementById('seed-input-container');
    const trigger = document.getElementById('seed-input-trigger');
    if (container) container.classList.add('hidden');
    if (trigger) {
        trigger.classList.remove('hidden');
        trigger.classList.remove('active');
    }
}

function cancelSeedInput() {
    const container = document.getElementById('seed-input-container');
    const trigger = document.getElementById('seed-input-trigger');
    const input = document.getElementById('seed');
    const urlParams = new URLSearchParams(window.location.search);
    const currentSeed = urlParams.get('seed') || "12345";
    if (input) input.value = currentSeed;
    if (container) container.classList.add('hidden');
    if (trigger) {
        trigger.classList.remove('hidden');
        trigger.classList.remove('active');
    }
}

function copySeedToClipboard() {
    const seedInput = document.getElementById('seed');
    if (!seedInput) return;
    navigator.clipboard.writeText(seedInput.value).catch(err => {
        console.error('Failed to copy: ', err);
    });
}

/** * ルート（Config）と表示テキストをクリップボードへコピー 
 */
function copyTxtToClipboard() {
    const configInput = document.getElementById('sim-config');
    const txtDisplay = document.getElementById('txt-route-display');
    const notifEl = document.getElementById('sim-notif-msg');

    if (!configInput || !txtDisplay) return;

    // ルート入力値 + 改行 + テキストエリアの表示内容
    const textToCopy = configInput.value + "\n\n" + txtDisplay.innerText;

    navigator.clipboard.writeText(textToCopy).then(() => {
        if (notifEl) {
            notifEl.textContent = 'Copyed!';
            notifEl.style.display = 'inline';
            setTimeout(() => {
                notifEl.style.display = 'none';
            }, 2000);
        }
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}

function updateSeedAndRefresh(newSeed) {
    const seedInput = document.getElementById('seed');
    if(seedInput && newSeed) {
        seedInput.value = newSeed;
        currentRolls = 300;
        if (typeof generateRollsTable === 'function') generateRollsTable();
        updateMasterInfoView();
        if (typeof updateUrlParams === 'function') updateUrlParams();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function updateSeedFromSim() {
    if (finalSeedForUpdate) {
        document.getElementById('seed').value = finalSeedForUpdate;
        document.getElementById('sim-config').value = '';
        resetAndGenerateTable(); 
    }
}