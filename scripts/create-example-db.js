const sqlite3 = require('sqlite3').verbose();
const path = require('node:path');
const fs = require('fs');

// Source and target database paths
const sourceDbPath = path.join(__dirname, '..', 'data', 'jLab.db');
const exampleDbPath = path.join(__dirname, '..', 'data', 'example.db');

// Create example database
const exampleDb = new sqlite3.Database(exampleDbPath);
const sourceDb = new sqlite3.Database(sourceDbPath);

async function copyTable(tableName, limit = 20) {
    return new Promise((resolve, reject) => {
        // First, get the table schema
        sourceDb.get(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`, [tableName], (err, result) => {
            if (err) {
                console.error(`Error getting schema for ${tableName}:`, err);
                reject(err);
                return;
            }

            if (!result) {
                console.log(`Table ${tableName} not found in source database`);
                resolve();
                return;
            }

            // Create the table in example database
            exampleDb.run(result.sql, (err) => {
                if (err) {
                    console.error(`Error creating table ${tableName}:`, err);
                    reject(err);
                    return;
                }

                // Copy data
                sourceDb.all(`SELECT * FROM ${tableName} ORDER BY created_at DESC LIMIT ?`, [limit], (err, rows) => {
                    if (err) {
                        console.error(`Error reading data from ${tableName}:`, err);
                        reject(err);
                        return;
                    }

                    if (rows.length === 0) {
                        console.log(`No data to copy for ${tableName}`);
                        resolve();
                        return;
                    }

                    // Get column names from first row
                    const columns = Object.keys(rows[0]);
                    const placeholders = columns.map(() => '?').join(',');
                    const insertSql = `INSERT INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders})`;

                    // Insert each row
                    const stmt = exampleDb.prepare(insertSql);
                    rows.forEach(row => {
                        stmt.run(Object.values(row));
                    });
                    stmt.finalize();

                    console.log(`Copied ${rows.length} rows from ${tableName}`);
                    resolve();
                });
            });
        });
    });
}

async function createExampleDb() {
    try {
        // Remove existing example.db if it exists
        if (fs.existsSync(exampleDbPath)) {
            fs.unlinkSync(exampleDbPath);
            console.log('Removed existing example.db');
        }

        // Copy each table
        await copyTable('goals');
        await copyTable('links');
        await copyTable('cards');
        await copyTable('atomic_tasks');
        await copyTable('words');

        console.log('Example database created successfully');
    } catch (error) {
        console.error('Error creating example database:', error);
    } finally {
        sourceDb.close();
        exampleDb.close();
    }
}

createExampleDb(); 