const express = require('express');
const cors = require('cors');
const fs = require('node:fs').promises;
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('node:path');

const app = express();
const PORT = 3086;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize empty links array
let links = [];

// CSV file configuration
const defaultCsvPath = path.join(__dirname, 'data', 'default.csv');
const csvWriter = createCsvWriter({
    path: defaultCsvPath,
    header: [
        { id: 'name', title: 'NAME' },
        { id: 'url', title: 'URL' },
        { id: 'notes', title: 'NOTES' }
    ]
});

// Add this at the top with other constants
const defaultHeader = 'NAME,URL,NOTES\n';

// Add this function to initialize the CSV file if it doesn't exist
async function initializeCsvFile() {
    try {
        // Check if file exists
        try {
            await fs.access(defaultCsvPath);
            console.log('CSV file exists');
        } catch {
            // Create file with header if it doesn't exist
            console.log('Creating new CSV file with header');
            await fs.writeFile(defaultCsvPath, defaultHeader);
        }

        // Read file content
        const content = await fs.readFile(defaultCsvPath, 'utf-8');
        if (!content.includes('NAME,URL,NOTES')) {
            console.log('Adding header to CSV file');
            await fs.writeFile(defaultCsvPath, defaultHeader + content);
        }
    } catch (error) {
        console.error('Error initializing CSV file:', error);
    }
}

// Create data directory if it doesn't exist
async function ensureDataDir() {
    const dataDir = path.join(__dirname, 'data');
    try {
        await fs.mkdir(dataDir, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
}

// Load links from CSV file
async function loadLinksFromCsv(filePath) {
    try {
        await fs.access(filePath);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        
        if (!fileContent.trim()) {
            console.log('CSV file is empty');
            return [];
        }

        return new Promise((resolve) => {
            const results = [];
            const stream = require('node:stream');
            const bufferStream = new stream.PassThrough();
            bufferStream.end(fileContent);
            
            bufferStream
                .pipe(csv())
                .on('data', (data) => {
                    if (data.NAME && data.URL) {
                        results.push({
                            name: data.NAME,
                            url: data.URL,
                            notes: data.NOTES || ''
                        });
                    }
                })
                .on('end', () => {
                    console.log('Loaded existing links:', results);
                    resolve(results);
                });
        });
    } catch (error) {
        console.log('Error reading CSV:', error);
        return [];
    }
}

// API Endpoints for links
app.get('/api/links', async (req, res) => {
    try {
        res.json(links);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get links' });
    }
});

// Add new endpoint to clear CSV file
app.post('/api/clear', async (req, res) => {
    try {
        await ensureDataDir();
        await csvWriter.writeRecords([]);
        console.log('CSV file cleared');
        res.json({ success: true });
    } catch (error) {
        console.error('Error clearing CSV:', error);
        res.status(500).json({ error: 'Failed to clear CSV file' });
    }
});

app.post('/api/links', async (req, res) => {
    try {
        let newLink;
        const { name } = req.body;

        // Handle name::url::notes format
        if (name && name.includes('::')) {
            const parts = name.split('::').map(part => part.trim());
            
            const newName = parts[0];
            let newUrl = parts[1] || '';
            const newNotes = parts[2] || '';

            if (newUrl && !newUrl.match(/^https?:\/\//)) {
                newUrl = `https://${newUrl}`;
            }

            newLink = { 
                name: newName, 
                url: newUrl, 
                notes: newNotes 
            };
        } else {
            return res.status(400).json({ error: 'Please use format: name::url::notes' });
        }

        // Validate required fields
        if (!newLink.name || !newLink.url) {
            return res.status(400).json({ error: 'Name and URL are required' });
        }

        // Check for duplicates in current links array
        const isDuplicate = links.some(link => 
            link.name === newLink.name && 
            link.url === newLink.url
        );

        if (isDuplicate) {
            console.log('Duplicate link detected:', newLink);
            return res.status(400).json({ error: 'Link already exists' });
        }

        // Add to existing links array
        links.push(newLink);
        
        try {
            await csvWriter.writeRecords(links);
            console.log('All links saved to CSV successfully');
        } catch (writeError) {
            console.error('Error writing to CSV:', writeError);
            throw writeError;
        }

        res.json({ success: true, links: links });
    } catch (error) {
        console.error('Error adding link:', error);
        res.status(500).json({ error: 'Failed to add link' });
    }
});

app.put('/api/links/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, url, notes } = req.body;
        links[id] = { name, url, notes };
        res.json(links[id]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update link' });
    }
});

app.delete('/api/links/:id', async (req, res) => {
    try {
        const { id } = req.params;
        links.splice(id, 1);
        res.json({ message: 'Link deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete link' });
    }
});

app.post('/api/save', async (req, res) => {
    try {
        await ensureDataDir();
        await csvWriter.writeRecords(links);
        res.json({ message: 'Links saved successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save links' });
    }
});

app.get('/api/load', async (req, res) => {
    try {
        links = await loadLinksFromCsv(defaultCsvPath);
        res.json(links);
    } catch (error) {
        res.json(links);
    }
});

// Goals routes
const goalsRouter = express.Router();

// CSV file paths for goals
const goalsCsvFiles = {
    year: path.join(__dirname, 'data', 'year.csv'),
    month: path.join(__dirname, 'data', 'month.csv'),
    week: path.join(__dirname, 'data', 'week.csv')
};

// CSV writers for goals
const goalsWriters = {
    year: createCsvWriter({
        path: goalsCsvFiles.year,
        header: [
            { id: 'id', title: 'ID' },
            { id: 'content', title: 'CONTENT' },
            { id: 'backgroundColor', title: 'BACKGROUND_COLOR' }
        ]
    }),
    month: createCsvWriter({
        path: goalsCsvFiles.month,
        header: [
            { id: 'id', title: 'ID' },
            { id: 'content', title: 'CONTENT' },
            { id: 'backgroundColor', title: 'BACKGROUND_COLOR' }
        ]
    }),
    week: createCsvWriter({
        path: goalsCsvFiles.week,
        header: [
            { id: 'id', title: 'ID' },
            { id: 'content', title: 'CONTENT' },
            { id: 'backgroundColor', title: 'BACKGROUND_COLOR' }
        ]
    })
};

// Connections CSV writer
const connectionsWriter = createCsvWriter({
    path: path.join(__dirname, 'data', 'connections.csv'),
    header: [
        { id: 'sourceId', title: 'SOURCE_ID' },
        { id: 'targetId', title: 'TARGET_ID' },
        { id: 'color', title: 'COLOR' }
    ]
});

// Helper function to read goals CSV file
async function readGoalsCsv(filePath) {
    try {
        await fs.access(filePath);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        
        if (!fileContent.trim()) {
            console.log('CSV file is empty');
            return [];
        }

        return new Promise((resolve) => {
            const results = [];
            const stream = require('node:stream');
            const bufferStream = new stream.PassThrough();
            bufferStream.end(fileContent);
            
            bufferStream
                .pipe(csv())
                .on('data', (data) => {
                    if (data.ID && data.CONTENT) {
                        results.push({
                            id: data.ID,
                            content: data.CONTENT,
                            backgroundColor: data.BACKGROUND_COLOR || '#f9f9f9'
                        });
                    }
                })
                .on('end', () => resolve(results));
        });
    } catch (error) {
        console.log('Error reading CSV:', error);
        return [];
    }
}

// Helper function to read connections CSV file
async function readConnectionsCsv(filePath) {
    try {
        await fs.access(filePath);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        
        if (!fileContent.trim()) {
            console.log('CSV file is empty');
            return [];
        }

        return new Promise((resolve) => {
            const results = [];
            const stream = require('node:stream');
            const bufferStream = new stream.PassThrough();
            bufferStream.end(fileContent);
            
            bufferStream
                .pipe(csv())
                .on('data', (data) => {
                    if (data.SOURCE_ID && data.TARGET_ID) {
                        results.push({
                            sourceId: data.SOURCE_ID,
                            targetId: data.TARGET_ID,
                            color: data.COLOR || '#5c96bc'
                        });
                    }
                })
                .on('end', () => resolve(results));
        });
    } catch (error) {
        console.log('Error reading CSV:', error);
        return [];
    }
}

// Update the goals routes
goalsRouter.get('/:type', async (req, res) => {
    try {
        const { type } = req.params;
        if (!goalsCsvFiles[type]) {
            return res.status(400).json({ error: 'Invalid goal type' });
        }

        const goals = await readGoalsCsv(goalsCsvFiles[type]);
        res.json(goals);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get goals' });
    }
});

goalsRouter.post('/:type', async (req, res) => {
    try {
        const { type } = req.params;
        if (!goalsCsvFiles[type]) {
            return res.status(400).json({ error: 'Invalid goal type' });
        }

        const goals = await readGoalsCsv(goalsCsvFiles[type]);
        const goal = req.body;
        goals.push(goal);
        
        await goalsWriters[type].writeRecords(goals);
        res.json(goal);
    } catch (error) {
        res.status(500).json({ error: 'Failed to save goal' });
    }
});

goalsRouter.put('/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        if (!goalsCsvFiles[type]) {
            return res.status(400).json({ error: 'Invalid goal type' });
        }

        const goals = await readGoalsCsv(goalsCsvFiles[type]);
        const index = goals.findIndex(g => g.id === id);
        
        if (index === -1) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        const updatedGoal = { ...goals[index], ...req.body };
        goals[index] = updatedGoal;
        
        await goalsWriters[type].writeRecords(goals);
        res.json(updatedGoal);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update goal' });
    }
});

goalsRouter.delete('/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        if (!goalsCsvFiles[type]) {
            return res.status(400).json({ error: 'Invalid goal type' });
        }

        const goals = await readGoalsCsv(goalsCsvFiles[type]);
        const filteredGoals = goals.filter(g => g.id !== id);
        
        await goalsWriters[type].writeRecords(filteredGoals);
        res.json({ message: 'Goal deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete goal' });
    }
});

// Update the connection routes
goalsRouter.get('/connections/:type', async (req, res) => {
    try {
        const connections = await readConnectionsCsv(path.join(__dirname, 'data', 'connections.csv'));
        res.json(connections);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get connections' });
    }
});

goalsRouter.post('/connections', async (req, res) => {
    try {
        const connectionsPath = path.join(__dirname, 'data', 'connections.csv');
        const connections = await readConnectionsCsv(connectionsPath);
        const connection = req.body;
        connections.push(connection);
        
        await connectionsWriter.writeRecords(connections);
        res.json(connection);
    } catch (error) {
        res.status(500).json({ error: 'Failed to save connection' });
    }
});

// Mount goals router
app.use('/api/goals', goalsRouter);

// Initialize goals CSV files
async function initializeGoalsFiles() {
    const header = 'ID,CONTENT,BACKGROUND_COLOR\n';
    for (const [type, filePath] of Object.entries(goalsCsvFiles)) {
        try {
            await fs.access(filePath);
        } catch {
            await fs.writeFile(filePath, header);
        }
    }

    // Initialize connections file
    const connectionsPath = path.join(__dirname, 'data', 'connections.csv');
    try {
        await fs.access(connectionsPath);
    } catch {
        await fs.writeFile(connectionsPath, 'SOURCE_ID,TARGET_ID,COLOR\n');
    }
}

// Start server
async function start() {
    await ensureDataDir();
    await initializeCsvFile();
    await initializeGoalsFiles();
    
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

// Initialize links array on server start
(async () => {
    try {
        links = await loadLinksFromCsv(defaultCsvPath);
        console.log('Initial links loaded:', links);
    } catch (error) {
        console.error('Error during initialization:', error);
        links = [];
    }
})();

start(); 
