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

// Import goals routes
const goalsRouter = require('./routes/goals');

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

// Mount goals routes
app.use('/api/goals', goalsRouter);

// Initialize
(async () => {
    try {
        await ensureDataDir();
        await initializeCsvFile();
        links = await loadLinksFromCsv(defaultCsvPath);
        console.log('Initial links loaded:', links);
    } catch (error) {
        console.error('Initialization error:', error);
    }
})();

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
}); 
