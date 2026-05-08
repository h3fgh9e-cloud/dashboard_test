const express = require('express');
const cors = require('cors');
const multer = require('multer');
const ExcelJS = require('exceljs');
const xlsx = require('xlsx');
const db = require('./db');
const { calculateLoadingStats, calculateOneTimeCost } = require('./calculator');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const query = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) { err ? reject(err) : resolve(this); });
});

// 1. 이력 조회
app.get('/api/history', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM 운송비관리 ORDER BY created_at ASC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 이력 삭제
app.post('/api/history/delete', async (req, res) => {
  const { ids } = req.body;
  try {
    const placeholders = ids.map(() => '?').join(',');
    await run(`DELETE FROM 운송비관리 WHERE id IN (${placeholders})`, ids);
    res.json({ message: '삭제되었습니다.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. 부품별 DB 목록 조회
app.get('/api/parts', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM 부품별_DB');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 부품 삭제
app.post('/api/parts/delete', async (req, res) => {
  const { ids } = req.body;
  try {
    const placeholders = ids.map(() => '?').join(',');
    await run(`DELETE FROM 부품별_DB WHERE id IN (${placeholders})`, ids);
    res.json({ message: '삭제되었습니다.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. 부품 저장
app.post('/api/parts', async (req, res) => {
  const { 차종, 품명, 용기_장, 용기_폭, 용기_고, 적입수량 } = req.body;
  try {
    await run(`INSERT OR REPLACE INTO 부품별_DB (차종, 품명, 용기_장, 용기_폭, 용기_고, 적입수량) 
               VALUES (?, ?, ?, ?, ?, ?)`, [차종, 품명, 용기_장, 용기_폭, 용기_고, 적입수량]);
    res.json({ message: '저장되었습니다.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. 산출 및 저장
app.post('/api/calculate', async (req, res) => {
  const { 차종, 품명, 납품차량, 출발지, 목적지, 거리, isManualCost, manualCost } = req.body;
  try {
    const partRows = await query('SELECT * FROM 부품별_DB WHERE 차종 = ? AND 품명 = ?', [차종, 품명]);
    if (partRows.length === 0) return res.status(404).json({ error: '부품DB에 정보가 없습니다.' });
    const part = partRows[0];
    const criteriaRows = await query('SELECT * FROM 운송비기준 WHERE 차량톤수 = ?', [납품차량]);
    if (criteriaRows.length === 0) return res.status(404).json({ error: '차량 기준이 없습니다.' });
    
    const stats = calculateLoadingStats(criteriaRows[0], part);
    const oneTimeCost = isManualCost ? parseFloat(manualCost) : calculateOneTimeCost(criteriaRows[0], 거리);
    const loadingQtyTotal = stats.상차_PLT * part.적입수량;
    const unitCost = loadingQtyTotal > 0 ? oneTimeCost / loadingQtyTotal : 0;
    const recommendMethod = stats.장기준_PLT >= stats.폭기준_PLT ? '장 기준 / ' + stats.적재단수 + '단 적재' : '폭 기준 / ' + stats.적재단수 + '단 적재';
    
    const now = new Date();
    const timestamp = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    await run(`INSERT INTO 운송비관리 
      (날짜, 기록일시, 차종, 품명, 출발지, 목적지, 거리, 납품차량, 일회_운송비, 용기_장, 용기_폭, 용기_고, 적입수량, 장기준_PLT, 폭기준_PLT, 상차_PLT, 추천_상차방법, 상차수량_EA, 개당_운송비) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [now.toISOString().split('T')[0], timestamp, 차종, 품명, 출발지, 목적지, 거리, 납품차량, oneTimeCost, part.용기_장, part.용기_폭, part.용기_고, part.적입수량, stats.장기준_PLT, stats.폭기준_PLT, stats.상차_PLT, recommendMethod, loadingQtyTotal, unitCost]
    );
    res.json({ message: '산출 완료' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 5. DB 업로드 (덮어쓰기/추가 모드 대응)
app.post('/api/db/upload', upload.single('file'), async (req, res) => {
  const { password, mode } = req.body; // mode: 'overwrite' or 'append'
  if (password !== "sewonsafe!") return res.status(403).json({ error: '비밀번호가 틀렸습니다.' });
  if (!req.file) return res.status(400).json({ error: '파일이 없습니다.' });

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    
    // 덮어쓰기 모드일 경우 기존 데이터 초기화
    if (mode === 'overwrite') {
      await run('DELETE FROM 부품별_DB');
      await run('DELETE FROM 운송비관리');
      // 운송비기준은 마스터 데이터이므로 유지하거나 필요시 초기화
    }

    // 부품별 DB
    if (workbook.SheetNames.includes("부품별 DB")) {
      const partsData = xlsx.utils.sheet_to_json(workbook.Sheets["부품별 DB"], { range: 3 });
      for (const row of partsData) {
        if (row['차종'] && row['품명']) {
          await run(`INSERT OR REPLACE INTO 부품별_DB (차종, 품명, 용기_장, 용기_폭, 용기_고, 적입수량) VALUES (?, ?, ?, ?, ?, ?)`,
            [row['차종'], row['품명'], row['용기 장(mm)'], row['용기 폭(mm)'], row['용기 고(mm)'], row['적입수량(EA/PLT)']]);
        }
      }
    }

    let historyCount = 0;
    if (workbook.SheetNames.includes("운송비관리")) {
      const sheet = workbook.Sheets["운송비관리"];
      const historyData = xlsx.utils.sheet_to_json(sheet, { range: 3, cellDates: true });
      for (const row of historyData) {
        if (row['기록일시'] && row['품명']) {
          // ... (날짜 변환 로직 동일)
          let dateStr = "";
          if (row['기록일시'] instanceof Date) {
            const d = row['기록일시'];
            dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
          } else if (!isNaN(row['기록일시']) && typeof row['기록일시'] !== 'string') {
            const d = new Date((row['기록일시'] - 25569) * 86400 * 1000);
            dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
          } else {
            dateStr = String(row['기록일시']);
          }

          await run(`INSERT INTO 운송비관리 
            (기록일시, 차종, 품명, 출발지, 목적지, 거리, 납품차량, 일회_운송비, 용기_장, 용기_폭, 용기_고, 적입수량, 상차_PLT, 추천_상차방법, 개당_운송비) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [dateStr, row['차종'], row['품명'], row['출발지'], row['목적지'], row['거리(km)'], row['납품차량'], row['1회 운송비'], row['용기 장(mm)'], row['용기 폭(mm)'], row['용기 고(mm)'], row['적입수량(EA/PLT)'], row['상차PLT(최종)'], row['추천 상차방법'], row['개당 운송비(원/EA)']]);
          historyCount++;
        }
      }
    }

    res.json({ message: `성공적으로 처리되었습니다. (이력 ${historyCount}건 저장됨)` });
  } catch (err) {
    console.error("Upload Error Details:", err);
    res.status(400).json({ error: `파일 처리 중 오류: ${err.message}` });
  }
});

// 6. DB 다운로드
app.get('/api/db/download', async (req, res) => {
  try {
    const history = await query('SELECT * FROM 운송비관리 ORDER BY created_at ASC');
    const parts = await query('SELECT * FROM 부품별_DB');
    const criteria = await query('SELECT * FROM 운송비기준');
    const workbook = new ExcelJS.Workbook();

    const addSheet = (name, title, columns, data) => {
      const sheet = workbook.addWorksheet(name);
      sheet.mergeCells(1, 1, 1, columns.length);
      const titleCell = sheet.getCell(1, 1);
      titleCell.value = title;
      titleCell.font = { name: '맑은 고딕', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D5D62' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      titleCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      sheet.getRow(1).height = 40;

      const headerRow = sheet.getRow(4);
      columns.forEach((col, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = col.header;
        cell.font = { name: '맑은 고딕', bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D5D62' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });

      data.forEach((item, rIdx) => {
        const row = sheet.getRow(rIdx + 5);
        columns.forEach((col, cIdx) => {
          const cell = row.getCell(cIdx + 1);
          cell.value = item[col.key];
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          if (col.format === 'currency') cell.numFmt = '#,##0';
          else if (col.format === 'decimal1') cell.numFmt = '#,##0.0';
          else if (col.format === 'date') {
            cell.numFmt = 'yyyy-mm-dd hh:mm:ss';
            let dateVal = new Date(item[col.key]);
            // 만약 유효한 날짜가 아니고 숫자 형태라면 (엑셀 시리얼 대응)
            if (isNaN(dateVal.getTime())) {
              const num = Number(item[col.key]);
              if (!isNaN(num) && num > 40000) {
                dateVal = new Date((num - 25569) * 86400 * 1000);
              }
            }
            if (!isNaN(dateVal.getTime())) cell.value = dateVal;
          }
        });
      });

      columns.forEach((col, idx) => {
        let maxLen = col.header.length + 5;
        data.forEach(item => {
          const val = String(item[col.key] || '');
          if (val.length > maxLen) maxLen = val.length;
        });
        sheet.getColumn(idx + 1).width = maxLen + 2;
      });
    };

    addSheet('운송비관리', '운송비관리', [
      { header: 'NO', key: 'no' }, { header: '기록일시', key: '기록일시', format: 'date' },
      { header: '차종', key: '차종' }, { header: '품명', key: '품명' },
      { header: '출발지', key: '출발지' }, { header: '목적지', key: '목적지' }, { header: '거리(km)', key: '거리' },
      { header: '납품차량', key: '납품차량' }, { header: '1회 운송비', key: '일회_운송비', format: 'currency' },
      { header: '용기 장(mm)', key: '용기_장' }, { header: '용기 폭(mm)', key: '용기_폭' },
      { header: '용기 고(mm)', key: '용기_고' }, { header: '적입수량(EA/PLT)', key: '적입수량' },
      { header: '상차PLT(최종)', key: '상차_PLT' }, { header: '추천 상차방법', key: '추천_상차방법' },
      { header: '개당 운송비(원/EA)', key: '개당_운송비', format: 'decimal1' }
    ], history.map((h, i) => ({ ...h, no: i + 1 })));

    addSheet('부품별 DB', '부품별 DB', [
      { header: '차종', key: '차종' }, { header: '품명', key: '품명' },
      { header: '용기 장(mm)', key: '용기_장' }, { header: '용기 폭(mm)', key: '용기_폭' },
      { header: '용기 고(mm)', key: '용기_고' }, { header: '적입수량(EA/PLT)', key: '적입수량' }
    ], parts);

    addSheet('운송비기준', '운송비기준', [
      { header: '차량톤수', key: '차량톤수' }, { header: '적재함 장(mm)', key: '적재함_장' },
      { header: '적재함 폭(mm)', key: '적재함_폭' }, { header: '적재함 고(mm)', key: '적재함_고' },
      { header: '유효 적재중량(TON)', key: '유효적재중량' }, 
      { header: '60km 이하 계수', key: '계수_60이하' }, { header: '60km 이하 고정금액', key: '고정_60이하', format: 'currency' }, 
      { header: '60km 초과 계수', key: '계수_60초과' }, { header: '60km 초과 고정금액', key: '고정_60초과', format: 'currency' }
    ], criteria);

    const filename = encodeURIComponent("표준 운송비 DB.xlsx");
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(port, () => { console.log(`Server running at http://localhost:${port}`); });
