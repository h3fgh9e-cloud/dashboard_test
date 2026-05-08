const express = require('express');
const cors = require('cors');
const multer = require('multer');
const ExcelJS = require('exceljs');
const xlsx = require('xlsx');
const path = require('path');
const db = require('./db');
const { calculateLoadingStats, calculateOneTimeCost } = require('./calculator');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const query = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) { err ? reject(err) : resolve(this); });
});

// API 경로를 최상단으로 올립니다 (404 방지)
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toLocaleString() }));

app.get('/api/history', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM 운송비관리 ORDER BY created_at ASC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/parts', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM 부품별_DB');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// [그다음] 프론트엔드 빌드 파일 서비스
app.use(express.static(path.join(__dirname, '../frontend/dist')));

app.post('/api/db/upload', upload.single('file'), async (req, res) => {
  const { password, mode } = req.body;
  if (password !== "sewonsafe!") return res.status(403).json({ error: '비밀번호가 틀렸습니다.' });
  if (!req.file) return res.status(400).json({ error: '파일이 없습니다.' });

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    if (mode === 'overwrite') {
      await run('DELETE FROM 부품별_DB');
      await run('DELETE FROM 운송비관리');
    }

    const getDataFromSheet = (sheetName, keywords) => {
      if (!workbook.SheetNames.includes(sheetName)) return [];
      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      let headerIdx = -1;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i] && keywords.every(k => rows[i].includes(k))) {
          headerIdx = i; break;
        }
      }
      return headerIdx === -1 ? [] : xlsx.utils.sheet_to_json(sheet, { range: headerIdx, cellDates: true });
    };

    let partsCount = 0;
    const partsData = getDataFromSheet("부품별 DB", ["차종", "품명"]);
    for (const row of partsData) {
      if (row['차종'] && row['품명']) {
        await run(`INSERT OR REPLACE INTO 부품별_DB (차종, 품명, 용기_장, 용기_폭, 용기_고, 적입수량) VALUES (?, ?, ?, ?, ?, ?)`,
          [row['차종'], row['품명'], row['용기 장(mm)'], row['용기 폭(mm)'], row['용기 고(mm)'], row['적입수량(EA/PLT)']]);
        partsCount++;
      }
    }

    let historyCount = 0;
    const historyData = getDataFromSheet("운송비관리", ["기록일시", "품명"]);
    for (const row of historyData) {
      if (row['기록일시'] && row['품명']) {
        let dateStr = "";
        const rawDate = row['기록일시'];
        if (rawDate instanceof Date) {
          const d = rawDate;
          dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
        } else if (!isNaN(rawDate) && typeof rawDate !== 'string') {
          const d = new Date((rawDate - 25569) * 86400 * 1000);
          dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
        } else { dateStr = String(rawDate); }

        await run(`INSERT INTO 운송비관리 
          (기록일시, 차종, 품명, 출발지, 목적지, 거리, 납품차량, 일회_운송비, 용기_장, 용기_폭, 용기_고, 적입수량, 상차_PLT, 추천_상차방법, 개당_운송비) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [dateStr, row['차종'], row['품명'], row['출발지'], row['목적지'], row['거리(km)'], row['납품차량'], row['1회 운송비'], row['용기 장(mm)'], row['용기 폭(mm)'], row['용기 고(mm)'], row['적입수량(EA/PLT)'], row['상차_PLT'], row['추천_상차방법'], row['개당_운송비']]);
        historyCount++;
      }
    }
    res.json({ message: `업로드 완료! (마스터 ${partsCount}건, 이력 ${historyCount}건 저장됨)` });
  } catch (err) {
    res.status(400).json({ error: `파일 처리 중 오류: ${err.message}` });
  }
});

// 모든 경로에 대해 화면(index.html)을 반환합니다. (Express 5.x 문법 적용)
app.get(/^(.*)$/, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at port ${port}`);
});
