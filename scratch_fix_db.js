const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'backend', 'database.sqlite');
const db = new sqlite3.Database(dbPath);
const { calculateLoadingStats, calculateOneTimeCost } = require('./backend/calculator');

const query = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});
const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) { err ? reject(err) : resolve(this); });
});

async function main() {
  const criteriaRows = await query('SELECT * FROM 운송비기준');
  const criteriaMap = {};
  criteriaRows.forEach(c => { criteriaMap[c.차량톤수] = c; });
  
  const history = await query('SELECT * FROM 운송비관리');
  for (const row of history) {
    let truck = criteriaMap[row['납품차량']];
    let part = { 용기_장: row['용기_장'], 용기_폭: row['용기_폭'], 용기_고: row['용기_고'], 적입수량: row['적입수량'] };
    
    if (truck && part.용기_장) {
      const stats = calculateLoadingStats(truck, part);
      if (stats) {
        let finalJangPLT = stats.장기준_PLT;
        let finalPokPLT = stats.폭기준_PLT;
        let finalSangPLT = stats.상차_PLT;
        let recommendMethod = stats.장기준_PLT >= stats.폭기준_PLT ? '장 기준 / ' + stats.적재단수 + '단 적재' : '폭 기준 / ' + stats.적재단수 + '단 적재';
        let totalQty = finalSangPLT * part.적입수량;
        
        let unitCost = totalQty > 0 ? row['일회_운송비'] / totalQty : 0;
        
        await run(`UPDATE 운송비관리 SET 장기준_PLT = ?, 폭기준_PLT = ?, 상차수량_EA = ?, 상차_PLT = ?, 추천_상차방법 = ?, 개당_운송비 = ? WHERE id = ?`, 
          [finalJangPLT, finalPokPLT, totalQty, finalSangPLT, recommendMethod, unitCost, row.id]);
      }
    }
  }
  console.log('DB Update Complete!');
}
main();
