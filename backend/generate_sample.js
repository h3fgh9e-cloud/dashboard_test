const ExcelJS = require('exceljs');
const path = require('path');

async function generateTemplate() {
  const workbook = new ExcelJS.Workbook();

  const addSheet = (name, title, columns) => {
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
  };

  addSheet('운송비관리', '운송비관리', [
    { header: 'NO' }, { header: '기록일시' }, { header: '차종' }, { header: '품명' }, 
    { header: '출발지' }, { header: '목적지' }, { header: '거리(km)' },
    { header: '납품차량' }, { header: '1회 운송비' }, { header: '용기 장(mm)' }, 
    { header: '용기 폭(mm)' }, { header: '용기 고(mm)' }, { header: '적입수량(EA/PLT)' }, 
    { header: '상차PLT(최종)' }, { header: '추천 상차방법' }, { header: '개당 운송비(원/EA)' }
  ]);

  addSheet('부품별 DB', '부품별 DB', [
    { header: '차종' }, { header: '품명' }, { header: '용기 장(mm)' }, 
    { header: '용기 폭(mm)' }, { header: '용기 고(mm)' }, { header: '적입수량(EA/PLT)' }
  ]);

  addSheet('운송비기준', '운송비기준', [
    { header: '차량톤수' }, { header: '적재함 장(mm)' }, { header: '적재함 폭(mm)' }, 
    { header: '적재함 고(mm)' }, { header: '유효 적재중량(TON)' }, { header: '60km 이하 계수' }, 
    { header: '60km 이하 고정금액' }, { header: '60km 초과 계수' }, { header: '60km 초과 고정금액' }
  ]);

  const filePath = path.join(__dirname, '표준 운송비 DB 템플릿.xlsx');
  await workbook.xlsx.writeFile(filePath);
  console.log(`Template v6 created at: ${filePath}`);
}

generateTemplate();
