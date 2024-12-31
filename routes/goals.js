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
        const content = await fs.readFile(filePath, 'utf-8');
        return new Promise((resolve) => {
            const results = [];
            const stream = require('node:stream');
            const bufferStream = new stream.PassThrough();
            bufferStream.end(content);
            
            bufferStream
                .pipe(csv())
                .on('data', (data) => results.push(data))
                .on('end', () => resolve(results));
        });
    } catch (error) {
        console.error(`Error reading CSV file ${filePath}:`, error);
        return [];
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

        const goals = await readCsvFile(csvFiles[type]);
        const goal = req.body;

        // Check if goal already exists by ID (content hash)
        const existingGoal = goals.find(g => g.ID === goal.id);
        if (existingGoal) {
            // Update existing goal
            existingGoal.CONTENT = goal.content;
            existingGoal.BACKGROUND_COLOR = goal.backgroundColor;
            await csvWriters[type].writeRecords(goals);
        } else {
            // Add new goal
            await csvWriters[type].writeRecords([...goals, {
                ID: goal.id,
                CONTENT: goal.content,
                BACKGROUND_COLOR: goal.backgroundColor
            }]);
        }
        
        res.json({
            id: goal.id,
            content: goal.content,
            backgroundColor: goal.backgroundColor
        });
    } catch (error) {
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
        const existingGoal = goals.find(g => g.ID === id);
        
        if (!existingGoal) {
            // If goal doesn't exist, create it
            const newGoal = {
                ID: id,
                CONTENT: req.body.content,
                BACKGROUND_COLOR: req.body.backgroundColor
            };
            await csvWriters[type].writeRecords([...goals, newGoal]);
            return res.json({
                id: newGoal.ID,
                content: newGoal.CONTENT,
                backgroundColor: newGoal.BACKGROUND_COLOR
            });
        }

        // Update existing goal
        existingGoal.CONTENT = req.body.content;
        existingGoal.BACKGROUND_COLOR = req.body.backgroundColor;
        
        await csvWriters[type].writeRecords(goals);
        res.json({
            id: existingGoal.ID,
            content: existingGoal.CONTENT,
            backgroundColor: existingGoal.BACKGROUND_COLOR
        });
    } catch (error) {
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
        
        await csvWriters[type].writeRecords(filteredGoals);
        res.json({ message: 'Goal deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete goal' });
    }
});

// Initialize CSV files
ensureCsvFiles().catch(console.error);

module.exports = router; 