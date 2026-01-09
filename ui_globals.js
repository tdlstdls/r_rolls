/** @file ui_globals.js @description アプリケーション全体で共有されるグローバルな状態変数の定義 @dependency なし */

// UI状態変数 (Global)
let tableGachaIds = [];
let currentRolls = 300;
let showSeedColumns = false;
let showResultDisplay = false;
let showFindInfo = false; // Findエリア（予報＋マスター情報）の表示フラグ
let finalSeedForUpdate = null;
let isSimulationMode = false;
let isTxtMode = false; // Txtボタンの状態
let isScheduleMode = false;
let isDescriptionMode = false;
// 追加: 概要表示モードフラグ
let activeGuaranteedIds = new Set();
let isScheduleAnalyzed = false;

// Find機能の状態管理
let hiddenFindIds = new Set();
// 自動ターゲットのうち、非表示にするID
let userTargetIds = new Set();
let prioritizedFindIds = []; // クリックされたターゲットの履歴を保持する配列
let prioritizedTargetId = null; // メインテーブルハイライト用の単一ターゲット
let userPrioritizedTargets = []; // ユーザーが優先指定したターゲットリスト
let isFindListCleared = false;
let globalSearchResults = null; // 他ガチャでの検索結果を保持する

// ルート探索の上限設定
let simMaxPlat = 0;
let simMaxGuar = 0;

// 超激レア追加シミュレーション用
let uberAdditionCounts = [];