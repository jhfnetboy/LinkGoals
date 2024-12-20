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
            const stream = require('stream');
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

// API Endpoints
app.get('/api/links', async (req, res) => {
    try {
        res.json(links);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get links' });
    }
});

// Add this helper function at the top
function logSeparator(message = '') {
    console.log('\n' + '='.repeat(50));
    if (message) console.log(message);
    console.log('='.repeat(50) + '\n');
}

// Helper function to check if two links are duplicates
function isDuplicateLink(link1, link2) {
    return link1.name === link2.name && 
           link1.url === link2.url && 
           link1.notes === link2.notes;
}

// Update the add link endpoint to properly handle notes
app.post('/api/links', async (req, res) => {
    try {
        logSeparator('NEW LINK REQUEST RECEIVED');
        let newLink;
        const { name } = req.body;
        console.log('Received raw input:', req.body);

        // Handle name::url::notes format
        if (name && name.includes('::')) {
            const parts = name.split('::').map(part => part.trim());
            console.log('Parsing input with format name::url::notes');
            console.log('Split parts:', parts);
            
            const newName = parts[0];
            let newUrl = parts[1] || '';
            const newNotes = parts[2] || '';

            if (newUrl && !newUrl.match(/^https?:\/\//)) {
                newUrl = 'https://' + newUrl;
            }

            newLink = { 
                name: newName, 
                url: newUrl, 
                notes: newNotes 
            };
        } else {
            return res.status(400).json({ error: 'Please use format: name::url::notes' });
        }

        console.log('Processed new link:', newLink);

        // Validate required fields
        if (!newLink.name || !newLink.url) {
            return res.status(400).json({ error: 'Name and URL are required' });
        }

        // Read existing links from CSV to check for duplicates
        const existingLinks = await loadLinksFromCsv(defaultCsvPath);
        const isDuplicate = existingLinks.some(link => 
            link.name === newLink.name && 
            link.url === newLink.url
        );

        if (isDuplicate) {
            console.log('Duplicate link detected:', newLink);
            return res.status(400).json({ error: 'Link already exists' });
        }

        // Add to links array and save to CSV
        links = [...existingLinks, newLink];
        await ensureDataDir();
        await csvWriter.writeRecords(links);
        console.log('Links saved to CSV automatically');

        logSeparator('LINK ADDED AND SAVED SUCCESSFULLY');
        res.json({ success: true, links: links });
    } catch (error) {
        console.error('Error adding link:', error);
        logSeparator('ERROR ADDING LINK');
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

// Update the save endpoint to prevent duplicates
app.post('/api/save', async (req, res) => {
    try {
        logSeparator('SAVING LINKS TO CSV');
        await ensureDataDir();

        // Get existing links from file
        const existingLinks = await loadLinksFromCsv(defaultCsvPath);
        console.log('Existing links:', existingLinks);

        // Create a map to store unique links based on name and url
        const uniqueLinks = new Map();
        
        // Process existing links first
        existingLinks.forEach(link => {
            const key = `${link.name}::${link.url}`;
            uniqueLinks.set(key, link);
        });

        // Add new links, overwriting duplicates if they exist
        links.forEach(link => {
            const key = `${link.name}::${link.url}`;
            uniqueLinks.set(key, link);
        });

        // Convert map back to array
        const finalLinks = Array.from(uniqueLinks.values());
        console.log('Unique links to save:', finalLinks);

        if (finalLinks.length > 0) {
            await csvWriter.writeRecords(finalLinks);
            links = finalLinks; // Update the in-memory array
            console.log('Links saved successfully');
            logSeparator('SAVE OPERATION COMPLETED');
            res.json({ message: 'Links saved successfully', links: finalLinks });
        } else {
            console.log('No links to save');
            logSeparator('NO LINKS TO SAVE');
            res.json({ message: 'No links to save' });
        }
    } catch (error) {
        console.error('Error saving links:', error);
        logSeparator('ERROR SAVING LINKS');
        res.status(500).json({ error: `Failed to save links: ${error.message}` });
    }
});

// Update the load endpoint to refresh the links array
app.get('/api/load', async (req, res) => {
    try {
        logSeparator('LOADING LINKS FROM CSV');
        const loadedLinks = await loadLinksFromCsv(defaultCsvPath);
        links = loadedLinks; // Always update the links array
        console.log('Current links after load:', links);
        logSeparator('LOAD OPERATION COMPLETED');
        res.json(links);
    } catch (error) {
        console.error('Load error:', error);
        logSeparator('ERROR LOADING LINKS');
        res.json(links);
    }
});

// Start server
async function start() {
    await ensureDataDir();
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

// Initialize links array on server start
(async () => {
    try {
        await initializeCsvFile();
        links = await loadLinksFromCsv(defaultCsvPath);
        console.log('Initial links loaded:', links);
    } catch (error) {
        console.error('Error during initialization:', error);
        links = [];
    }
})();

start(); 