/** @file view_analysis.js @description レア被り位置（黄色・オレンジ）のハイライト判定を担当 @dependency なし */

const RowAnalysis = {
    // 常設レア被り（黄色）: n+1とn+3のスロットが同じ
    isSimpleYellow: function(currIdx, seeds) {
        if (currIdx < 2) return false;
        const n = currIdx - 2; 
        if (n + 3 >= seeds.length) return false;
        // レア(7000未満)以外が含まれる場合は除外
        if (seeds[n] % 10000 > 6969 || seeds[n+2] % 10000 > 6969) return false;
        return (seeds[n+1] % 25) === (seeds[n+3] % 25);
    },

    // 波動バスターズ等レア被り（オレンジ）: n+1とn+3のスロットが逆順
    isSimpleOrange: function(currIdx, seeds) {
        if (currIdx < 2) return false;
        const n = currIdx - 2; 
        if (n + 3 >= seeds.length) return false;
        if (seeds[n] % 10000 > 6969 || seeds[n+2] % 10000 > 6969) return false;
        return (seeds[n+1] % 25) === (24 - (seeds[n+3] % 25));
    },

    // 連続被り判定（黄色）
    isConsecutiveYellow: function(currIdx, seeds) {
        if (currIdx < 5) return false;
        const n = currIdx - 5;
        if (currIdx + 1 >= seeds.length) return false;
        if (seeds[n] % 10000 > 6969) return false;
        if (seeds[n+2] % 10000 > 6969) return false;
        if (seeds[currIdx] % 10000 > 6969) return false;
        if (seeds[n+1] % 25 !== seeds[n+3] % 25) return false;
        return seeds[n+4] % 24 === seeds[currIdx+1] % 25;
    },

    // 連続被り判定（オレンジ）
    isConsecutiveOrange: function(currIdx, seeds) {
        if (currIdx < 5) return false;
        const n = currIdx - 5;
        if (currIdx + 1 >= seeds.length) return false;
        if (seeds[n] % 10000 > 6969) return false;
        if (seeds[n+2] % 10000 > 6969) return false;
        if (seeds[currIdx] % 10000 > 6969) return false;
        if (seeds[n+1] % 25 !== seeds[n+3] % 25) return false;
        return seeds[n+4] % 24 === (24 - (seeds[currIdx+1] % 25));
    }
};