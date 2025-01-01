const express = require('express');
const fs = require('node:fs').promises;
const path = require('node:path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const router = express.Router();

// CSV file paths
const csvFiles = {
    year: path.join(__dirname, '..', 'data', 'year.csv'),
    month: path.join(__dirname, '..', 'data', 'month.csv'),
    week: path.join(__dirname, '..', 'data', 'week.csv')
};

// CSV writers
const csvWriters = {
    year: createCsvWriter({
        path: csvFiles.year,
        header: [
            { id: 'ID', title: 'ID' },
            { id: 'CONTENT', title: 'CONTENT' },
            { id: 'BACKGROUND_COLOR', title: 'BACKGROUND_COLOR' }
        ]
    }),
    month: createCsvWriter({
        path: csvFiles.month,
        header: [
            { id: 'ID', title: 'ID' },
            { id: 'CONTENT', title: 'CONTENT' },
            { id: 'BACKGROUND_COLOR', title: 'BACKGROUND_COLOR' }
        ]
    }),
    week: createCsvWriter({
        path: csvFiles.week,
        header: [
            { id: 'ID', title: 'ID' },
            { id: 'CONTENT', title: 'CONTENT' },
            { id: 'BACKGROUND_COLOR', title: 'BACKGROUND_COLOR' }
        ]
    })
};

// Connections CSV writer
const connectionsWriter = createCsvWriter({
    path: path.join(__dirname, '..', 'data', 'connections.csv'),
    header: [
        { id: 'SOURCE_ID', title: 'SOURCE_ID' },
        { id: 'TARGET_ID', title: 'TARGET_ID' },
        { id: 'COLOR', title: 'COLOR' }
    ]
});

// Helper function to ensure CSV files exist
async function ensureCsvFiles() {
    const header = 'ID,CONTENT,BACKGROUND_COLOR\n';
    for (const [type, filePath] of Object.entries(csvFiles)) {
        try {
            await fs.access(filePath);
        } catch {
            await fs.writeFile(filePath, header);
        }
    }

    // Ensure connections file exists
    const connectionsPath = path.join(__dirname, '..', 'data', 'connections.csv');
    try {
        await fs.access(connectionsPath);
    } catch {
        await fs.writeFile(connectionsPath, 'SOURCE_ID,TARGET_ID,COLOR\n');
    }
}

// Helper function to read CSV file
async function readCsvFile(filePath) {
    try {
        // Check if file exists
        try {
            await fs.access(filePath);
        } catch {
            console.log(`CSV file ${filePath} does not exist, returning empty array`);
            return [];
        }

        const content = await fs.readFile(filePath, 'utf-8');
        if (!content.trim()) {
            console.log(`CSV file ${filePath} is empty`);
            return [];
        }

        return new Promise((resolve) => {
            const results = [];
            const stream = require('node:stream');
            const bufferStream = new stream.PassThrough();
            bufferStream.end(content);
            
            bufferStream
                .pipe(csv())
                .on('data', (data) => {
                    // Only include valid data with all required fields
                    if (data.ID && data.ID.trim() && data.CONTENT && data.CONTENT.trim()) {
                        results.push({
                            ID: data.ID.trim(),
                            CONTENT: data.CONTENT.trim(),
                            BACKGROUND_COLOR: data.BACKGROUND_COLOR || '#f9f9f9'
                        });
                    }
                })
                .on('end', () => {
                    console.log(`Read ${results.length} valid records from ${filePath}`);
                    resolve(results);
                });
        });
    } catch (error) {
        console.error(`Error reading CSV file ${filePath}:`, error);
        return [];
    }
}

// Helper function to write to CSV file
async function writeGoalsToCsv(type, goals) {
    try {
        // Ensure all goals have required fields with default values
        const cleanedGoals = goals.map(goal => ({
            ID: goal?.ID?.trim() || '',
            CONTENT: goal?.CONTENT?.trim() || '',
            BACKGROUND_COLOR: goal?.BACKGROUND_COLOR || '#f9f9f9'
        })).filter(goal => goal.ID && goal.CONTENT); // Filter out any invalid goals

        // Create a new writer for each write operation
        const writer = createCsvWriter({
            path: csvFiles[type],
            header: [
                { id: 'ID', title: 'ID' },
                { id: 'CONTENT', title: 'CONTENT' },
                { id: 'BACKGROUND_COLOR', title: 'BACKGROUND_COLOR' }
            ]
        });
        
        // Write all goals at once
        await writer.writeRecords(cleanedGoals);
        console.log(`Successfully wrote ${cleanedGoals.length} goals to ${csvFiles[type]}`);
    } catch (error) {
        console.error(`Error writing to CSV file ${csvFiles[type]}:`, error);
        throw error;
    }
}

// Connection routes (place these before the type-specific routes)
router.get('/connections/:type', async (req, res) => {
    try {
        const connections = await readCsvFile(path.join(__dirname, '..', 'data', 'connections.csv'));
        res.json(connections.map(conn => ({
            sourceId: conn.SOURCE_ID,
            targetId: conn.TARGET_ID,
            color: conn.COLOR
        })));
    } catch (error) {
        res.status(500).json({ error: 'Failed to get connections' });
    }
});

router.post('/connections', async (req, res) => {
    try {
        const connections = await readCsvFile(path.join(__dirname, '..', 'data', 'connections.csv'));
        const connection = req.body;

        // Check if connection already exists
        const existingConnection = connections.find(c => 
            c.SOURCE_ID === connection.sourceId && 
            c.TARGET_ID === connection.targetId
        );

        if (existingConnection) {
            // Update existing connection color
            existingConnection.COLOR = connection.color;
            await connectionsWriter.writeRecords(connections);
        } else {
            // Add new connection
            await connectionsWriter.writeRecords([...connections, {
                SOURCE_ID: connection.sourceId,
                TARGET_ID: connection.targetId,
                COLOR: connection.color
            }]);
        }
        
        res.json(connection);
    } catch (error) {
        res.status(500).json({ error: 'Failed to save connection' });
    }
});

// Type-specific routes
router.get('/:type', async (req, res) => {
    try {
        const { type } = req.params;
        if (!csvFiles[type]) {
            return res.status(400).json({ error: 'Invalid goal type' });
        }

        const goals = await readCsvFile(csvFiles[type]);
        res.json(goals.map(goal => ({
            id: goal.ID,
            content: goal.CONTENT,
            backgroundColor: goal.BACKGROUND_COLOR
        })));
    } catch (error) {
        res.status(500).json({ error: 'Failed to get goals' });
    }
});

router.post('/:type', async (req, res) => {
    try {
        const { type } = req.params;
        if (!csvFiles[type]) {
            return res.status(400).json({ error: 'Invalid goal type' });
        }

        // Read existing goals
        const existingGoals = await readCsvFile(csvFiles[type]);
        const newGoal = req.body;

        // Validate required fields
        if (!newGoal.id || !newGoal.content) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Strictly check for existing ID
        const hasExistingId = existingGoals.some(goal => goal.ID === newGoal.id);
        if (hasExistingId) {
            console.log(`Goal with ID ${newGoal.id} already exists, skipping save`);
            const existingGoal = existingGoals.find(g => g.ID === newGoal.id);
            return res.json({
                id: existingGoal.ID,
                content: existingGoal.CONTENT,
                backgroundColor: existingGoal.BACKGROUND_COLOR
            });
        }

        // Check for duplicate content
        const duplicateContent = existingGoals.some(goal => 
            goal.CONTENT.trim().toLowerCase() === newGoal.content.trim().toLowerCase()
        );
        if (duplicateContent) {
            console.log(`Goal with content "${newGoal.content}" already exists, skipping save`);
            const existingGoal = existingGoals.find(g => 
                g.CONTENT.trim().toLowerCase() === newGoal.content.trim().toLowerCase()
            );
            return res.json({
                id: existingGoal.ID,
                content: existingGoal.CONTENT,
                backgroundColor: existingGoal.BACKGROUND_COLOR
            });
        }

        // If no duplicates found, create new goal
        console.log(`Adding new ${type} goal with ID:`, newGoal.id);
        const goalToSave = {
            ID: newGoal.id,
            CONTENT: newGoal.content.trim(),
            BACKGROUND_COLOR: newGoal.backgroundColor || '#f9f9f9'
        };

        // Add to existing goals array
        existingGoals.push(goalToSave);
        
        // Write updated goals back to file
        await writeGoalsToCsv(type, existingGoals);
        
        // Return the newly saved goal
        return res.json({
            id: goalToSave.ID,
            content: goalToSave.CONTENT,
            backgroundColor: goalToSave.BACKGROUND_COLOR
        });
    } catch (error) {
        console.error(`Error saving ${req.params.type} goal:`, error);
        res.status(500).json({ error: 'Failed to save goal' });
    }
});

router.put('/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        if (!csvFiles[type]) {
            return res.status(400).json({ error: 'Invalid goal type' });
        }

        const goals = await readCsvFile(csvFiles[type]);
        const existingIndex = goals.findIndex(g => g.ID === id);
        
        if (existingIndex === -1) {
            // If goal doesn't exist, create it
            const newGoal = {
                ID: id,
                CONTENT: req.body.content,
                BACKGROUND_COLOR: req.body.backgroundColor || '#f9f9f9'
            };
            goals.push(newGoal);
            await writeGoalsToCsv(type, goals);
            
            return res.json({
                id: newGoal.ID,
                content: newGoal.CONTENT,
                backgroundColor: newGoal.BACKGROUND_COLOR
            });
        }

        // Update existing goal in the array
        goals[existingIndex] = {
            ID: id,
            CONTENT: req.body.content,
            BACKGROUND_COLOR: req.body.backgroundColor || '#f9f9f9'
        };
        
        // Write all goals back to file
        await writeGoalsToCsv(type, goals);
        
        res.json({
            id: goals[existingIndex].ID,
            content: goals[existingIndex].CONTENT,
            backgroundColor: goals[existingIndex].BACKGROUND_COLOR
        });
    } catch (error) {
        console.error(`Error updating ${req.params.type} goal:`, error);
        res.status(500).json({ error: 'Failed to update goal' });
    }
});

router.delete('/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        if (!csvFiles[type]) {
            return res.status(400).json({ error: 'Invalid goal type' });
        }

        const goals = await readCsvFile(csvFiles[type]);
        const filteredGoals = goals.filter(g => g.ID !== id);
        
        // Write filtered goals back to file
        await writeGoalsToCsv(type, filteredGoals);
        
        res.json({ message: 'Goal deleted successfully' });
    } catch (error) {
        console.error(`Error deleting ${req.params.type} goal:`, error);
        res.status(500).json({ error: 'Failed to delete goal' });
    }
});

// Initialize CSV files
ensureCsvFiles().catch(console.error);

module.exports = router; 