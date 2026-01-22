/** @file logic_xorshift.js @description 乱数生成（Xorshift32） */
class Xorshift32 {
    constructor(seed) {
        this.seed = (seed >>> 0) || 1;
    }
    next() {
        let x = this.seed;
        x ^= (x << 13);
        x ^= (x >>> 17);
        x ^= (x << 15);
        this.seed = x >>> 0;
        return this.seed;
    }
}