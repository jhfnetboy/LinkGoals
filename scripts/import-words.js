const xlsx = require('xlsx');
const sqlite3 = require('sqlite3').verbose();
const path = require('node:path');

// 连接数据库
const db = new sqlite3.Database(path.join(__dirname, '../data/jlab.db'), (err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        process.exit(1);
    }
    console.log('Connected to database');
});

// 创建单词表
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS words (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        english TEXT NOT NULL,
        chinese TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('Error creating table:', err);
            process.exit(1);
        }
        console.log('Table created or already exists');
    });

    // 清空现有数据
    db.run('DELETE FROM words', (err) => {
        if (err) {
            console.error('Error clearing table:', err);
            process.exit(1);
        }
        console.log('Cleared existing words');
    });

    // 导入单词
    try {
        // 读取 Excel 文件
        const excelPath = path.join(__dirname, './oxford-88973.xlsx');
        console.log('Reading Excel file:', excelPath);
        
        const workbook = xlsx.readFile(excelPath);
        console.log('Available sheets:', workbook.SheetNames);
        
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);
        
        console.log('Total rows in Excel:', data.length);
        if (data.length > 0) {
            console.log('Sample row:', data[0]);
        }

        // 准备插入语句
        const stmt = db.prepare('INSERT INTO words (english, chinese) VALUES (?, ?)');

        // 插入数据
        let count = 0;
        for (const row of data) {
            if (row['英文'] && row['中文']) {
                stmt.run(row['英文'], row['中文'], (err) => {
                    if (err) {
                        console.error('Error inserting row:', err, row);
                    }
                });
                count++;
            }
        }
        stmt.finalize();

        console.log(`Successfully imported ${count} words`);
    } catch (error) {
        console.error('Error importing words:', error);
        process.exit(1);
    }

    // 关闭数据库连接
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
            process.exit(1);
        }
        console.log('Database connection closed');
    });
}); 