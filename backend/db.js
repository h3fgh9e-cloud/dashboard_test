const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 어떤 환경에서도 backend 폴더 안의 db 파일을 찾도록 절대 경로를 설정합니다.
const dbPath = path.resolve(__dirname, 'transport_v6.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
  }
});

db.serialize(() => {
  // 테이블이 없을 경우에만 생성 (기존 데이터 보존)
  db.run(`CREATE TABLE IF NOT EXISTS 운송비기준 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    차량톤수 TEXT UNIQUE,
    적재함_장 INTEGER,
    적재함_폭 INTEGER,
    적재함_고 INTEGER,
    유효적재중량 REAL,
    계수_60이하 REAL,
    고정_60이하 INTEGER,
    계수_60초과 REAL,
    고정_60초과 INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS 부품별_DB (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    차종 TEXT,
    품명 TEXT,
    용기_장 INTEGER,
    용기_폭 INTEGER,
    용기_고 INTEGER,
    적입수량 INTEGER,
    UNIQUE(차종, 품명)
  )`);

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
    일회_운송비 INTEGER,
    용기_장 INTEGER,
    용기_폭 INTEGER,
    용기_고 INTEGER,
    적입수량 INTEGER,
    장기준_PLT INTEGER,
    폭기준_PLT INTEGER,
    상차_PLT INTEGER,
    추천_상차방법 TEXT,
    상차수량_EA INTEGER,
    개당_운송비 REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

module.exports = db;
