const sqlite3 = require('sqlite3').verbose();
const path = require('node:path');

// Create database connection
const dbPath = path.join(__dirname, '..', 'data', 'goals.db');
console.log('Initializing SQLite database at:', dbPath);
const db = new sqlite3.Database(dbPath);

// Initialize database
function initDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Create goals table with parent_id field
            db.run(`CREATE TABLE IF NOT EXISTS goals (
                id TEXT PRIMARY KEY,
                content TEXT UNIQUE NOT NULL,
                background_color TEXT DEFAULT '#f9f9f9',
                type TEXT NOT NULL,
                parent_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (parent_id) REFERENCES goals(id) ON DELETE CASCADE
            )`, (err) => {
                if (err) {
                    console.error('Error creating goals table:', err);
                    reject(err);
                    return;
                }
                console.log('Goals table initialized');
                resolve();
            });
        });
    });
}

// Helper functions for goals
const goalsDb = {
    // Get all goals of a specific type
    getGoals: (type) => {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM goals WHERE type = ? ORDER BY created_at DESC', [type], (err, rows) => {
                if (err) {
                    console.error('Error getting goals:', err);
                    reject(err);
                    return;
                }
                resolve(rows.map(row => ({
                    id: row.id,
                    content: row.content,
                    backgroundColor: row.background_color,
                    parentId: row.parent_id
                })));
            });
        });
    },

    // Save a new goal
    saveGoal: (goal, type) => {
        return new Promise((resolve, reject) => {
            const { id, content, backgroundColor = '#f9f9f9', parentId = null } = goal;
            const normalizedContent = content.trim().toLowerCase();
            
            // First check if goal with same content exists
            db.get('SELECT * FROM goals WHERE content = ? AND type = ?', 
                [normalizedContent, type], 
                (err, row) => {
                    if (err) {
                        console.error('Error checking existing goal:', err);
                        reject(err);
                        return;
                    }
                    
                    if (row) {
                        console.log('Found existing goal with same content:', row);
                        resolve({
                            id: row.id,
                            content: row.content,
                            backgroundColor: row.background_color,
                            parentId: row.parent_id
                        });
                        return;
                    }

                    // If parent_id is provided, get parent's background color
                    if (parentId) {
                        db.get('SELECT background_color FROM goals WHERE id = ?', [parentId], (err, parentRow) => {
                            if (err) {
                                console.error('Error getting parent goal:', err);
                                reject(err);
                                return;
                            }

                            const inheritedColor = parentRow ? parentRow.background_color : backgroundColor;

                            // Insert new goal with inherited color
                            db.run(
                                'INSERT INTO goals (id, content, background_color, type, parent_id) VALUES (?, ?, ?, ?, ?)',
                                [id, normalizedContent, inheritedColor, type, parentId],
                                (err) => {
                                    if (err) {
                                        console.error('Error saving goal:', err);
                                        reject(err);
                                        return;
                                    }
                                    resolve({
                                        id,
                                        content: normalizedContent,
                                        backgroundColor: inheritedColor,
                                        parentId
                                    });
                                }
                            );
                        });
                    } else {
                        // Insert new goal without parent
                        db.run(
                            'INSERT INTO goals (id, content, background_color, type) VALUES (?, ?, ?, ?)',
                            [id, normalizedContent, backgroundColor, type],
                            (err) => {
                                if (err) {
                                    console.error('Error saving goal:', err);
                                    reject(err);
                                    return;
                                }
                                resolve({
                                    id,
                                    content: normalizedContent,
                                    backgroundColor,
                                    parentId: null
                                });
                            }
                        );
                    }
                }
            );
        });
    },

    // Update an existing goal
    updateGoal: (id, goal, type) => {
        return new Promise((resolve, reject) => {
            console.log('Database updating goal:', { id, goal, type });
            
            const { content, backgroundColor = '#f9f9f9', parentId } = goal;
            
            // First get the current goal data
            db.get('SELECT * FROM goals WHERE id = ? AND type = ?', [id, type], (err, currentGoal) => {
                if (err) {
                    console.error('Error getting current goal:', err);
                    reject(err);
                    return;
                }
                
                if (!currentGoal) {
                    console.error('Goal not found:', id);
                    reject(new Error('Goal not found'));
                    return;
                }
                
                // If content is provided, normalize it
                const normalizedContent = content ? content.trim().toLowerCase() : currentGoal.content;
                
                // Update the goal
                db.run(
                    'UPDATE goals SET content = ?, background_color = ?, parent_id = ? WHERE id = ? AND type = ?',
                    [normalizedContent, backgroundColor, parentId, id, type],
                    (err) => {
                        if (err) {
                            console.error('Error updating goal:', err);
                            reject(err);
                            return;
                        }

                        // Function to recursively update child goals' colors
                        const updateChildColors = (parentId, color) => {
                            return new Promise((resolve, reject) => {
                                // First get all direct child goals
                                db.all('SELECT id, type FROM goals WHERE parent_id = ?', [parentId], (err, children) => {
                                    if (err) {
                                        if (err.message.includes('no such column: parent_id')) {
                                            resolve();
                                            return;
                                        }
                                        reject(err);
                                        return;
                                    }

                                    if (!children || children.length === 0) {
                                        resolve();
                                        return;
                                    }

                                    // Update each child and their children
                                    const updatePromises = children.map(child => {
                                        return new Promise((resolve, reject) => {
                                            // Update this child's color
                                            db.run(
                                                'UPDATE goals SET background_color = ? WHERE id = ?',
                                                [color, child.id],
                                                async (err) => {
                                                    if (err) {
                                                        reject(err);
                                                        return;
                                                    }
                                                    // Recursively update this child's children
                                                    try {
                                                        await updateChildColors(child.id, color);
                                                        resolve();
                                                    } catch (err) {
                                                        reject(err);
                                                    }
                                                }
                                            );
                                        });
                                    });

                                    Promise.all(updatePromises)
                                        .then(() => resolve())
                                        .catch(err => reject(err));
                                });
                            });
                        };

                        // Update all child goals recursively
                        updateChildColors(id, backgroundColor)
                            .then(() => {
                                resolve({
                                    id,
                                    content: normalizedContent,
                                    backgroundColor,
                                    parentId
                                });
                            })
                            .catch(err => {
                                console.error('Error updating child colors:', err);
                                // Even if updating child colors fails, return the updated goal
                                resolve({
                                    id,
                                    content: normalizedContent,
                                    backgroundColor,
                                    parentId
                                });
                            });
                    }
                );
            });
        });
    },

    // Delete a goal
    deleteGoal: (id, type) => {
        return new Promise((resolve, reject) => {
            // First delete all child goals
            db.run('DELETE FROM goals WHERE parent_id = ?', [id], (err) => {
                if (err) {
                    console.error('Error deleting child goals:', err);
                    reject(err);
                    return;
                }

                // Then delete the goal itself
                db.run('DELETE FROM goals WHERE id = ? AND type = ?', [id, type], (err) => {
                    if (err) {
                        console.error('Error deleting goal:', err);
                        reject(err);
                        return;
                    }
                    resolve({ success: true });
                });
            });
        });
    }
};

// Initialize database on module load
console.log('Initializing database...');
initDatabase()
    .then(() => console.log('Database initialization complete'))
    .catch(err => {
        console.error('Failed to initialize database:', err);
        process.exit(1);
    });

module.exports = { goalsDb }; 