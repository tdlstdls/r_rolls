/** @file view_forecast_core.js @description Find機能のメインエントリーポイント */

function generateFastForecast(initialSeed, columnConfigs) {
    const scanRows = 2000;
    const extendedScanRows = 10000;
    const requiredSeeds = extendedScanRows * 2 + 10;
    const seeds = generateSeedsForForecast(initialSeed, requiredSeeds);
    
    const visibilityClass = (typeof showFindInfo !== 'undefined' && showFindInfo) ? '' : 'hidden';
    const specialSlots = getSpecialSlotsInfo(seeds, scanRows * 2);
    const specialTargetStatus = getAvailableSpecialTargets(columnConfigs);
    
    let summaryHtml = `<div id="forecast-summary-area" class="forecast-summary-container ${visibilityClass}" style="margin-bottom: 0; padding: 10px; background: #fdfdfd; border: 1px solid #ddd; border-bottom: none; border-radius: 4px 4px 0 0;">`;
    summaryHtml += generateForecastHeader(specialSlots, specialTargetStatus);

    columnConfigs.forEach((config) => {
        if (!config) return;
        const gachaHtml = processGachaForecast(config, seeds, scanRows, extendedScanRows);
        if (gachaHtml) summaryHtml += gachaHtml;
    });

    if (globalSearchResults) summaryHtml += renderGlobalSearchResults();

    summaryHtml += '</div>';
    return summaryHtml;
}