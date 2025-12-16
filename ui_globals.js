/**
 * ui_globals.js
 * アプリケーション全体で共有される状態変数の定義
 */

// UI状態変数 (Global)
let tableGachaIds = [];
let currentRolls = 300;
let showSeedColumns = false;
let showResultDisplay = false;
let showFindInfo = false; // Findエリア（予報＋マスター情報）の表示フラグ
let finalSeedForUpdate = null;

let isSimulationMode = false;
let isScheduleMode = false;
let isDescriptionMode = false; // 追加: 概要表示モードフラグ
let activeGuaranteedIds = new Set();
let isScheduleAnalyzed = false;

// Find機能の状態管理
let hiddenFindIds = new Set(); // 自動ターゲットのうち、非表示にするID
let userTargetIds = new Set(); // 自動ターゲット以外で、表示するID (手動ターゲット)
let isFindListCleared = false;

// 超激レア追加シミュレーション用
let uberAdditionCounts = [];