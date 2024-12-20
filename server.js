const express = require('express');
const cors = require('cors');
const fs = require('node:fs').promises;
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('node:path');

const app = express();
const PORT = 3000;

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
        // Check if file exists first
        await fs.access(filePath);
        
        const fileContent = await fs.readFile(filePath, 'utf-8');
        // If file is empty, return empty array
        if (!fileContent.trim()) {
            console.log('CSV file is empty');
            return [];
        }

        const results = [];
        return new Promise((resolve, reject) => {
            const stream = require('stream');
            const bufferStream = new stream.PassThrough();
            bufferStream.end(fileContent);
            
            bufferStream
                .pipe(csv())
                .on('data', (data) => {
                    // Only add valid entries
                    if (data.name && data.url) {
                        results.push(data);
                    }
                })
                .on('end', () => resolve(results))
                .on('error', (error) => {
                    console.error('CSV parsing error:', error);
                    reject(error);
                });
        });
    } catch (error) {
        console.log('Error reading CSV:', error);
        return []; // Return empty array if file doesn't exist or can't be read
    }
}

// API Endpoints
app.get('/api/links', async (req, res) => {
    try {
        res.json(links);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get links' });
    }
});

app.post('/api/links', async (req, res) => {
    try {
        const { name, url, notes = '' } = req.body;
        console.log('Received new link:', { name, url, notes });

        if (!name || !url) {
            return res.status(400).json({ error: 'Name and URL are required' });
        }

        const newLink = { name, url, notes };
        links.push(newLink);
        console.log('Current links array:', links);
        res.json(newLink);
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
        console.log('Attempting to save links:', links);
        // Filter out invalid links
        const validLinks = links.filter(link => link && link.name && link.url);
        console.log('Filtered valid links to save:', validLinks);

        if (validLinks.length === 0) {
            console.log('No valid links to save');
            return res.json({ message: 'No valid links to save' });
        }

        await ensureDataDir(); // Ensure data directory exists
        await csvWriter.writeRecords(validLinks);
        console.log('Links saved successfully');
        res.json({ message: 'Links saved successfully' });
    } catch (error) {
        console.error('Error saving links:', error);
        res.status(500).json({ error: `Failed to save links: ${error.message}` });
    }
});

app.get('/api/load', async (req, res) => {
    try {
        const loadedLinks = await loadLinksFromCsv(defaultCsvPath);
        if (loadedLinks.length > 0) {
            links = loadedLinks; // Only update if we loaded something
        }
        console.log('Current links after load:', links);
        res.json(links);
    } catch (error) {
        console.error('Load error:', error);
        res.json(links); // Return current links instead of empty array
    }
});

// Start server
async function start() {
    await ensureDataDir();
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

start(); 