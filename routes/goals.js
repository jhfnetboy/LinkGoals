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
            { id: 'id', title: 'ID' },
            { id: 'content', title: 'CONTENT' },
            { id: 'backgroundColor', title: 'BACKGROUND_COLOR' }
        ]
    }),
    month: createCsvWriter({
        path: csvFiles.month,
        header: [
            { id: 'id', title: 'ID' },
            { id: 'content', title: 'CONTENT' },
            { id: 'backgroundColor', title: 'BACKGROUND_COLOR' }
        ]
    }),
    week: createCsvWriter({
        path: csvFiles.week,
        header: [
            { id: 'id', title: 'ID' },
            { id: 'content', title: 'CONTENT' },
            { id: 'backgroundColor', title: 'BACKGROUND_COLOR' }
        ]
    })
};

// Connections CSV writer
const connectionsWriter = createCsvWriter({
    path: path.join(__dirname, '..', 'data', 'connections.csv'),
    header: [
        { id: 'sourceId', title: 'SOURCE_ID' },
        { id: 'targetId', title: 'TARGET_ID' },
        { id: 'color', title: 'COLOR' }
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

// Routes
router.get('/:type', async (req, res) => {
    try {
        const { type } = req.params;
        if (!csvFiles[type]) {
            return res.status(400).json({ error: 'Invalid goal type' });
        }

        const goals = await readCsvFile(csvFiles[type]);
        res.json(goals);
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

        const goal = req.body;
        await csvWriters[type].writeRecords([goal]);
        res.json(goal);
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
        const index = goals.findIndex(g => g.id === id);
        
        if (index === -1) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        const updatedGoal = { ...goals[index], ...req.body };
        goals[index] = updatedGoal;
        
        await csvWriters[type].writeRecords(goals);
        res.json(updatedGoal);
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
        const filteredGoals = goals.filter(g => g.id !== id);
        
        await csvWriters[type].writeRecords(filteredGoals);
        res.json({ message: 'Goal deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete goal' });
    }
});

// Connection routes
router.get('/connections/:type', async (req, res) => {
    try {
        const connections = await readCsvFile(path.join(__dirname, '..', 'data', 'connections.csv'));
        res.json(connections);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get connections' });
    }
});

router.post('/connections', async (req, res) => {
    try {
        const connection = req.body;
        await connectionsWriter.writeRecords([connection]);
        res.json(connection);
    } catch (error) {
        res.status(500).json({ error: 'Failed to save connection' });
    }
});

// Initialize CSV files
ensureCsvFiles().catch(console.error);

module.exports = router; 