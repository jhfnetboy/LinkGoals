const sqlite3 = require('sqlite3').verbose();
const path = require('node:path');
const { existsSync } = require('node:fs');

// Database paths
const oldDbPath = path.join(__dirname, '..', 'data', 'goals.db');
const newDbPath = path.join(__dirname, '..', 'data', 'jLab.db');

// Create database connections
const newDb = new sqlite3.Database(newDbPath);

async function migrateGoals() {
    if (!existsSync(oldDbPath)) {
        console.log('Old goals database not found, skipping goals migration');
        return;
    }

    const oldDb = new sqlite3.Database(oldDbPath);

    try {
        return new Promise((resolve, reject) => {
            oldDb.all('SELECT * FROM goals', [], async (err, rows) => {
                if (err) {
                    console.error('Error reading old goals:', err);
                    reject(err);
                    return;
                }

                console.log('Found goals to migrate:', rows.length);

                // Insert goals into new database
                for (const goal of rows) {
                    await new Promise((resolve, reject) => {
                        newDb.run(
                            'INSERT INTO goals (id, content, background_color, type, parent_id) VALUES (?, ?, ?, ?, ?)',
                            [goal.id, goal.content, goal.background_color, goal.type, goal.parent_id],
                            (err) => {
                                if (err) {
                                    console.error('Error inserting goal:', err);
                                    reject(err);
                                    return;
                                }
                                resolve();
                            }
                        );
                    });
                }

                console.log('Goals migration completed');
                resolve();
            });
        });
    } catch (error) {
        console.error('Error migrating goals:', error);
        throw error;
    } finally {
        oldDb.close();
    }
}

// Run migrations
async function runMigrations() {
    try {
        await migrateGoals();
        console.log('Goals migration completed successfully');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        newDb.close();
    }
}

runMigrations(); 