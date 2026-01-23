/**
 * @file data_loader.js
 * @description 外部リソース(CSV/TSV)の非同期取得とgachaMasterDataの構築を担当
 * @input_data GatyaDataSetR1.csv, GatyaData_Option_SetR.tsv, gatya.tsv
 * @managed_state gachaMasterData (マスタ全体), loadedTsvContent (スケジュール生データ)
 * @output_data gachaMasterData.cats, gachaMasterData.gachas
 * @dependency cats.js, gacha_series.js
 */

/**
 * [gatya.tsv Data Structure Memo]
 * * ■ 基本構造
 * ・1-10列目 (Idx 0-9): 年月日・時刻情報
 * Idx 0: 開始年月日 (YYYYMMDD)
 * Idx 1: 開始時刻 (HHMM)
 * Idx 2: 終了年月日 (YYYYMMDD)
 * Idx 3: 終了時刻 (HHMM)
 * Idx 8: レアロールズ対象フラグ (1以外は除外)
 * * ・11列目以降 (Idx 10~): ガチャ情報ブロック (15列/ブロック の繰り返し)
 * ブロック開始インデックスを i (10, 25, 40...) とすると:
 * i+0  : ガチャID (Gacha ID)
 * i+3  : ステップアップフラグ (4=ステップアップ)
 * i+6  : レアレート (Rare Rate)
 * i+8  : 激レアレート (Super Rare Rate)
 * i+10 : 超激レアレート (Uber Rare Rate)
 * i+11 : 超激レア確定フラグ (Guaranteed Flag, 1=確定)
 * i+12 : 伝説レアレート (Legend Rare Rate)
 * i+14 : 日本語説明文 (Description)
 */

// グローバル変数 (データ保持用)
let gachaMasterData = { cats: {}, gachas: {} };
let loadedTsvContent = null; // スケジュールデータ (gatya.tsv)

// 全データのロードと構築を行うメイン関数
async function loadAllData() {
    console.log("Loading data with remote check...");
    processCatsData();

    const REMOTE_URL = 'https://bc-event.vercel.app/token/gatya.tsv';

    try {
        // 1. ローカルファイルと外部ファイルを並列で取得
        // 外部取得に失敗してもアプリが止まらないよう、.catch() でエラーを処理します
        const [csvRes, tsvRes, localGatyaRes, remoteGatyaRes] = await Promise.all([
            fetch('data/GatyaDataSetR1.csv'),
            fetch('data/GatyaData_Option_SetR.tsv'),
            fetch('data/gatya.tsv'),
            fetch(REMOTE_URL).catch(e => {
                console.warn("External gatya.tsv fetch failed (CORS or Network error):", e);
                return { ok: false };
            })
        ]);

        if (!csvRes.ok || !tsvRes.ok) throw new Error("Master CSV/TSV fetch failed");

        const csvText = await csvRes.text();
        const tsvText = await tsvRes.text();

        // 2. ガチャ日程データの比較と選別
        let localGatyaText = localGatyaRes.ok ? await localGatyaRes.text() : null;
        let remoteGatyaText = remoteGatyaRes.ok ? await remoteGatyaRes.text() : null;
        
        // どちらを採用するか決定する
        let selectedGatyaText = localGatyaText;

        if (remoteGatyaText) {
            const localMax = getLatestStartDate(localGatyaText);
            const remoteMax = getLatestStartDate(remoteGatyaText);

            console.log(`Date comparison - Local Max: ${localMax}, Remote Max: ${remoteMax}`);

            if (remoteMax > localMax) {
                console.log("Remote gatya.tsv contains newer schedules. Using remote.");
                selectedGatyaText = remoteGatyaText;
            } else {
                console.log("Local gatya.tsv is up-to-date or newer.");
            }
        }

        // 採用されたデータをグローバル変数に保持
        loadedTsvContent = selectedGatyaText;

        // 3. マスタデータの構築
        const gachasMaster = buildGachaMaster(gachaMasterData.cats, csvText, tsvText);
        
        // 選別されたデータからレート情報を反映
        if (selectedGatyaText) {
            applyTsvRates(gachasMaster, selectedGatyaText);
        }

        gachaMasterData.gachas = gachasMaster;
        console.log("Master Data Built:", Object.keys(gachasMaster).length, "gachas loaded.");
        return true;

    } catch (e) {
        console.error("Critical Data Load Error:", e);
        return false;
    }
}

/**
 * TSVテキスト内から最新の開始日(YYYYMMDD)を抽出するヘルパー関数
 * @param {string} tsvText 
 * @returns {number} 
 */
function getLatestStartDate(tsvText) {
    if (!tsvText) return 0;
    const lines = tsvText.split('\n');
    let maxDate = 0;
    for (const line of lines) {
        if (line.trim().startsWith('[') || !line.trim()) continue;
        const cols = line.split('\t');
        if (cols.length > 0) {
            const date = parseInt(cols[0]);
            // 「永続(20300101)」は比較対象から除外し、純粋なスケジュール更新を判定
            if (!isNaN(date) && date < 20300101) {
                if (date > maxDate) maxDate = date;
            }
        }
    }
    return maxDate;
}

// cats.js のデータを gachaMasterData.cats に変換
function processCatsData() {
    const fallbackCats = [{id:31, name:"ネコぼさつ", rarity:3}];
    let catsData = (typeof cats !== 'undefined') ? cats : fallbackCats;
    const rarityMap = { 0: "nomal", 1: "ex", 2: "rare", 3: "super", 4: "uber", 5: "legend" };
    const catsMaster = {};
    
    for (const cat of catsData) {
        catsMaster[cat.id] = { ...cat, rarity: rarityMap[cat.rarity] || "rare" };
    }
    gachaMasterData.cats = catsMaster;
}

// マスタデータ構築ロジック (CSV行番号 = ID)
function buildGachaMaster(catsMaster, csvText, tsvText) {
    const gachasMaster = {};
    // 1. CSVを行ごとに分割 (1行目=ID:0, 2行目=ID:1...)
    const gachaPools = csvText.split(/\r?\n/);
    // 2. Option TSVをパースして GatyaSetID -> seriesID のマップを作成
    const tsvLines = tsvText.split(/\r?\n/);
    const headers = tsvLines[0].split('\t').map(h => h.trim());
    const idIdx = headers.indexOf('GatyaSetID');
    const seriesIdx = headers.indexOf('seriesID');

    const gachaSeriesMap = {};
    if (idIdx !== -1 && seriesIdx !== -1) {
        for (let i = 1; i < tsvLines.length; i++) {
            const line = tsvLines[i];
            if (!line.trim()) continue;
            const cols = line.split('\t');
            const gID = parseInt(cols[idIdx]);
            const sID = parseInt(cols[seriesIdx]);
            if (!isNaN(gID) && !isNaN(sID)) {
                gachaSeriesMap[gID] = sID;
            }
        }
    }

    // gacha_series.js のデータ
    let seriesList = (typeof gacha_series !== 'undefined') ? gacha_series : [];

    // 3. 全結合して gachasMaster を構築
    gachaPools.forEach((line, index) => {
        if (!line.trim()) return;

        // CSVの行番号(index) = ガチャID
        const gachaID = index;
        const poolCats = line.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));

        const seriesID = gachaSeriesMap[gachaID];

        // デフォルト情報
        let seriesInfo = { 
            name: `Gacha ID: ${gachaID}`, 
            rare: 0, supa: 0, uber: 0, legend: 0, sort: 999 
        };
        
        // gacha_series.js から名前とレートを引く
        if (seriesID !== undefined) {
            const found = seriesList.find(s => s.series_id === seriesID);
            if (found) {
                seriesInfo = found;
            }
        }

        // キャラクタープール構築
        const pool = { rare: [], super: [], uber: [], legend: [], nomal: [], ex: [] };
        for (const catId of poolCats) {
            const catInfo = catsMaster[catId];
            if (catInfo && pool[catInfo.rarity] !== undefined) {
                pool[catInfo.rarity].push({ id: catInfo.id, name: catInfo.name });
            }
        }

        gachasMaster[gachaID] = {
            id: gachaID.toString(),
            name: seriesInfo.name, // ガチャ名称
            rarity_rates: { 
                rare: seriesInfo.rare || 0, 
                super: seriesInfo.supa || 0,
                uber: seriesInfo.uber || 0, 
                legend: seriesInfo.legend || 0 
            },
            pool: pool,
            sort: seriesInfo.sort || 999,
            series_id: seriesID,
            guaranteed: false, // デフォルトはfalse
            stepUp: false      // デフォルトはfalse
        };
    });

    return gachasMaster;
}

function applyTsvRates(gachasMaster, tsvContent) {
    const lines = tsvContent.split('\n');
    lines.forEach(line => {
        if (line.trim().startsWith('[') || !line.trim()) return;
        const cols = line.split('\t');
        if (cols.length < 15) return;

        if (cols[8] !== '1') return;

        for (let i = 10; i < cols.length; i += 15) {
            if (i + 14 >= cols.length) break;

            const gachaId = parseInt(cols[i]);
            if (isNaN(gachaId) || gachaId < 0) continue;

            // フラグ判定
            const isGuaranteed = cols[i + 11] === '1';
            const isStepUp = cols[i + 3] === '4'; // ステップアップ判定
            
            // IDの決定: ステップアップなら 'f'、確定なら 'g'、それ以外はそのまま
            let storageId = `${gachaId}`;
            if (isStepUp) {
                storageId += 'f';
            } else if (isGuaranteed) {
                storageId += 'g';
            }

            const rateRare = parseInt(cols[i + 6]) || 0;
            const rateSupa = parseInt(cols[i + 8]) || 0;
            const rateUber = parseInt(cols[i + 10]) || 0;
            const rateLegend = parseInt(cols[i + 12]) || 0;

            if (gachasMaster[gachaId]) {
                gachasMaster[storageId] = JSON.parse(JSON.stringify(gachasMaster[gachaId]));
                gachasMaster[storageId].id = storageId.toString();
                gachasMaster[storageId].rarity_rates = {
                    rare: rateRare, super: rateSupa, uber: rateUber, legend: rateLegend
                };
                gachasMaster[storageId].guaranteed = isGuaranteed || isStepUp;
                gachasMaster[storageId].stepup = isStepUp;

                // 名称の付与
                if (isStepUp && !gachasMaster[storageId].name.includes("[StepUp]")) {
                    gachasMaster[storageId].name += " [StepUp]";
                } else if (isGuaranteed && !gachasMaster[storageId].name.includes("[確定]")) {
                    gachasMaster[storageId].name += " [確定]";
                }
            }
        }
    });
}