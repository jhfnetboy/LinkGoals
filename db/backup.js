const sqlite3 = require('sqlite3').verbose();
const path = require('node:path');
const fs = require('node:fs');

// Database paths
const dbPath = path.join(__dirname, '..', 'data', 'jLab.db');
const backupDir = path.join(__dirname, '..', 'data', 'backups');

// Ensure backup directory exists
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

// Table configurations
const TABLE_CONFIGS = {
    links: {
        name: 'links',
        file: 'links_backup.db',
        tables: ['links']
    },
    goals: {
        name: 'goals',
        file: 'goals_backup.db',
        tables: ['goals', 'atomic_tasks']
    },
    read: {
        name: 'read',
        file: 'read_backup.db',
        tables: ['cards']
    },
    music: {
        name: 'music',
        file: 'music_backup.db',
        tables: ['music_files']
    }
};

// Backup specific tables
async function backupTables(appName) {
    const config = TABLE_CONFIGS[appName];
    if (!config) {
        throw new Error(`Unknown app: ${appName}`);
    }

    const backupPath = path.join(backupDir, config.file);
    const sourceDb = new sqlite3.Database(dbPath);
    const backupDb = new sqlite3.Database(backupPath);

    try {
        console.log(`Starting backup for ${appName}...`);

        // Get table schemas and data
        for (const table of config.tables) {
            // Get table schema
            const schema = await new Promise((resolve, reject) => {
                sourceDb.get(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`, [table], (err, row) => {
                    if (err) reject(err);
                    else resolve(row?.sql);
                });
            });

            if (!schema) {
                console.log(`Table ${table} not found, skipping...`);
                continue;
            }

            // Create table in backup database
            await new Promise((resolve, reject) => {
                backupDb.run(schema, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Copy data
            const rows = await new Promise((resolve, reject) => {
                sourceDb.all(`SELECT * FROM ${table}`, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            if (rows.length > 0) {
                const columns = Object.keys(rows[0]);
                const placeholders = columns.map(() => '?').join(',');
                const stmt = backupDb.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`);

                for (const row of rows) {
                    await new Promise((resolve, reject) => {
                        stmt.run(...columns.map(col => row[col]), (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                }
                stmt.finalize();
            }
        }

        console.log(`Backup completed for ${appName}`);
        return backupPath;
    } finally {
        sourceDb.close();
        backupDb.close();
    }
}

// Restore specific tables
async function restoreTables(appName, backupPath) {
    const config = TABLE_CONFIGS[appName];
    if (!config) {
        throw new Error(`Unknown app: ${appName}`);
    }

    if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup file not found: ${backupPath}`);
    }

    const sourceDb = new sqlite3.Database(backupPath);
    const targetDb = new sqlite3.Database(dbPath);

    try {
        console.log(`Starting restore for ${appName}...`);

        for (const table of config.tables) {
            // Get table schema from backup
            const schema = await new Promise((resolve, reject) => {
                sourceDb.get(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`, [table], (err, row) => {
                    if (err) reject(err);
                    else resolve(row?.sql);
                });
            });

            if (!schema) {
                console.log(`Table ${table} not found in backup, skipping...`);
                continue;
            }

            // Get current table schema
            const currentSchema = await new Promise((resolve, reject) => {
                targetDb.get(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`, [table], (err, row) => {
                    if (err) reject(err);
                    else resolve(row?.sql);
                });
            });

            // Compare schemas to ensure compatibility
            if (currentSchema && !isSchemaCompatible(currentSchema, schema)) {
                throw new Error(`Schema incompatible for table ${table}`);
            }

            // Copy data
            const rows = await new Promise((resolve, reject) => {
                sourceDb.all(`SELECT * FROM ${table}`, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            if (rows.length > 0) {
                // Begin transaction
                await new Promise((resolve, reject) => {
                    targetDb.run('BEGIN TRANSACTION', (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });

                try {
                    // Clear existing data
                    await new Promise((resolve, reject) => {
                        targetDb.run(`DELETE FROM ${table}`, (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });

                    // Insert new data
                    const columns = Object.keys(rows[0]);
                    const placeholders = columns.map(() => '?').join(',');
                    const stmt = targetDb.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`);

                    for (const row of rows) {
                        await new Promise((resolve, reject) => {
                            stmt.run(...columns.map(col => row[col]), (err) => {
                                if (err) reject(err);
                                else resolve();
                            });
                        });
                    }
                    stmt.finalize();

                    // Commit transaction
                    await new Promise((resolve, reject) => {
                        targetDb.run('COMMIT', (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                } catch (error) {
                    // Rollback on error
                    await new Promise((resolve) => {
                        targetDb.run('ROLLBACK', () => resolve());
                    });
                    throw error;
                }
            }
        }

        console.log(`Restore completed for ${appName}`);
    } finally {
        sourceDb.close();
        targetDb.close();
    }
}

// Helper function to check schema compatibility
function isSchemaCompatible(currentSchema, backupSchema) {
    // Extract column definitions
    const getCurrentColumns = (schema) => {
        const match = schema.match(/\((.*)\)/s);
        if (!match) return [];
        return match[1].split(',').map(col => {
            const colDef = col.trim().split(' ')[0].toLowerCase();
            return colDef.replace(/["\[\]]/g, '');
        });
    };

    const currentColumns = getCurrentColumns(currentSchema);
    const backupColumns = getCurrentColumns(backupSchema);

    // Check if all backup columns exist in current schema
    return backupColumns.every(col => currentColumns.includes(col));
}

module.exports = {
    backupTables,
    restoreTables,
    TABLE_CONFIGS
}; 