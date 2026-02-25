const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public', 'contoh.xls');
console.log('Reading file:', filePath);

try {
  const buf = fs.readFileSync(filePath);
  const wb = XLSX.read(buf, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws);
  
  console.log('First 3 rows:');
  console.log(JSON.stringify(data.slice(0, 3), null, 2));
  
  // Check headers of first row
  if (data.length > 0) {
    console.log('Headers:', Object.keys(data[0]));
    
    // Check Status column specifically
    data.forEach((row, i) => {
      const status = row['Status'] || row['status'];
      if (status) {
        console.log(`Row ${i} Status:`, status);
      }
    });
  }
} catch (e) {
  console.error('Error:', e);
}
