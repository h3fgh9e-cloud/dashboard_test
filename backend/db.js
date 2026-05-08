const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'transport_v6.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // 1. 운송비기준
  db.run(`CREATE TABLE IF NOT EXISTS 운송비기준 (
    차량톤수 TEXT PRIMARY KEY,
    적재함_장 REAL,
    적재함_폭 REAL,
    적재함_고 REAL,
    유효적재중량 REAL,
    계수_60이하 REAL,
    고정_60이하 REAL,
    계수_60초과 REAL,
    고정_60초과 REAL
  )`);

  // 2. 부품별_DB
  db.run(`CREATE TABLE IF NOT EXISTS 부품별_DB (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    차종 TEXT,
    품명 TEXT,
    용기_장 REAL,
    용기_폭 REAL,
    용기_고 REAL,
    적입수량 REAL,
    UNIQUE(차종, 품명)
  )`);

  // 3. 운송비관리 (출발지, 목적지, 거리 컬럼 명시적 추가)
  db.run(`CREATE TABLE IF NOT EXISTS 운송비관리 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    날짜 TEXT,
    기록일시 TEXT,
    차종 TEXT,
    품명 TEXT,
    출발지 TEXT,
    목적지 TEXT,
    거리 REAL,
    납품차량 TEXT,
    일회_운송비 REAL,
    용기_장 REAL,
    용기_폭 REAL,
    용기_고 REAL,
    적입수량 REAL,
    장기준_PLT INTEGER,
    폭기준_PLT INTEGER,
    상차_PLT INTEGER,
    추천_상차방법 TEXT,
    상차수량_EA INTEGER,
    개당_운송비 REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // 초기 데이터 입력
  const vehicles = [
    ['5TON', 8400, 2350, 2750, 4.2, 1195, 46726, 1158, 53225],
    ['8TON', 8900, 2340, 2750, 6.8, 1321, 47064, 1287, 53511],
    ['9.5TON', 10100, 2340, 2750, 8.3, 1451, 49469, 1411, 56296],
    ['11TON', 9250, 2340, 2520, 9.9, 1513, 49116, 1504, 54973]
  ];
  const stmt = db.prepare(`INSERT OR REPLACE INTO 운송비기준 (차량톤수, 적재함_장, 적재함_폭, 적재함_고, 유효적재중량, 계수_60이하, 고정_60이하, 계수_60초과, 고정_60초과) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  vehicles.forEach(v => stmt.run(v));
  stmt.finalize();
});

module.exports = db;
