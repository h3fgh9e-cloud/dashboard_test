const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'transport_v6.db');
const db = new sqlite3.Database(dbPath);
const calculator = require('./calculator');

const carModels = ['JK1', 'JX1', 'MX5', 'LX3', 'NE'];
const partNames = [
  'PNL&MBR ASSY-RR FLR',
  'PNL ASSY-F/APRN&MBR COMPL,LH'
];
const destinations = [
  { name: '울산', distance: 60 },
  { name: '아산', distance: 250 }
];
const vehicles = ['5TON', '8TON', '9.5TON', '11TON'];

const truckSpecs = {
  '5TON': { 적재함_장: 6200, 적재함_폭: 2350 },
  '8TON': { 적재함_장: 8100, 적재함_폭: 2350 },
  '9.5TON': { 적재함_장: 9100, 적재함_폭: 2350 },
  '11TON': { 적재함_장: 9600, 적재함_폭: 2350 }
};

const costCriteria = {
  '5TON': { 계수_60이하: 719, 고정_60이하: 46726, 계수_60초과: 599, 고정_60초과: 53915 },
  '8TON': { 계수_60이하: 1111, 고정_60이하: 72186, 계수_60초과: 926, 고정_60초과: 83292 },
  '9.5TON': { 계수_60이하: 1451, 고정_60이하: 94314, 계수_60초과: 1209, 고정_60초과: 108824 },
  '11TON': { 계수_60이하: 1729, 고정_60이하: 112356, 계수_60초과: 1441, 고정_60초과: 129641 }
};

// 요청하신 현실적인 제원 반영
const mockPartMaster = {
  'PNL&MBR ASSY-RR FLR': { 용기_장: 1850, 용기_폭: 2250, 용기_고: 2680, 적입수량: 5 },
  'PNL ASSY-F/APRN&MBR COMPL,LH': { 용기_장: 2330, 용기_폭: 1800, 용기_고: 1380, 적입수량: 9 }
};

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomDate() {
  const day = getRandomInt(1, 8);
  const hour = getRandomInt(9, 18);
  const min = getRandomInt(0, 59);
  const sec = getRandomInt(0, 59);
  return `2026-05-0${day} ${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

db.serialize(() => {
  db.run("DELETE FROM 운송비관리");
  db.run("DELETE FROM 부품별_DB");

  const stmtPart = db.prepare("INSERT INTO 부품별_DB (차종, 품명, 용기_장, 용기_폭, 용기_고, 적입수량) VALUES (?, ?, ?, ?, ?, ?)");
  carModels.forEach(model => {
    partNames.forEach(name => {
      const spec = mockPartMaster[name];
      stmtPart.run(model, name, spec.용기_장, spec.용기_폭, spec.용기_고, spec.적입수량);
    });
  });
  stmtPart.finalize();

  const stmtHistory = db.prepare(`
    INSERT INTO 운송비관리 
    (기록일시, 차종, 품명, 출발지, 목적지, 거리, 납품차량, 일회_운송비, 상차_PLT, 개당_운송비, 추천_상차방법) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  console.log("현실적인 부품 제원 기반 데이터 생성 중...");

  for (let i = 0; i < 40; i++) {
    const model = carModels[getRandomInt(0, carModels.length - 1)];
    const name = partNames[getRandomInt(0, partNames.length - 1)];
    const dest = destinations[getRandomInt(0, destinations.length - 1)];
    const vehicle = vehicles[getRandomInt(0, vehicles.length - 1)];
    const date = getRandomDate();
    const spec = mockPartMaster[name];

    const totalCost = calculator.calculateOneTimeCost(costCriteria[vehicle], dest.distance);
    const loading = calculator.calculateLoadingStats(truckSpecs[vehicle], spec);
    
    // 만약 적재가 불가능한 상황(용기가 트럭보다 큼)이 발생할 경우를 대비한 안전 로직
    const finalPlt = loading.상차_PLT || 1; 
    const costPerEa = totalCost / (finalPlt * spec.적입수량);

    stmtHistory.run(
      date, model, name, "영천", dest.name, dest.distance, vehicle,
      totalCost, finalPlt, costPerEa, loading.비고
    );
  }

  stmtHistory.finalize(() => {
    console.log("✅ 현실적인 제원이 반영된 40건의 데이터로 업데이트되었습니다.");
    db.close();
  });
});
