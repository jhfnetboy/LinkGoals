const express = require('express');
const path = require('node:path');
const { goalsDb, linksDb, cardsDb } = require('./db/database');

const app = express();
const port = 3086;

app.use(express.json());
app.use(express.static('public'));

// Serve links.html as the root page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'links.html'));
});

// Serve node_modules directory for client-side imports
app.use('/node_modules', express.static('node_modules'));

// Links API routes
app.get('/api/load', async (req, res) => {
    try {
        const links = await linksDb.getLinks();
        res.json(links);
    } catch (error) {
        console.error('Error loading links:', error);
        res.status(500).json({ error: 'Failed to load links' });
    }
});

app.post('/api/links', async (req, res) => {
    try {
        const { name } = req.body;
        const [linkName, url, tag] = name.split(',').map(s => s.trim());
        if (!linkName || !url) {
            res.status(400).json({ error: 'Invalid link format' });
            return;
        }

        // Add https:// if not present
        const fullUrl = url.match(/^https?:\/\//) ? url : `https://${url}`;

        const links = await linksDb.saveLink({ 
            name: linkName, 
            url: fullUrl, 
            notes: tag || '' 
        });
        res.json({ success: true, links });
    } catch (error) {
        console.error('Error saving link:', error);
        res.status(500).json({ error: 'Failed to save link' });
    }
});

app.put('/api/links/:index', async (req, res) => {
    try {
        const { index } = req.params;
        const { name, url, notes } = req.body;
        const links = await linksDb.updateLink(Number.parseInt(index, 10), { name, url, notes });
        res.json({ success: true, links });
    } catch (error) {
        console.error('Error updating link:', error);
        res.status(500).json({ error: 'Failed to update link' });
    }
});

app.delete('/api/links/:index', async (req, res) => {
    try {
        const { index } = req.params;
        const result = await linksDb.deleteLink(Number.parseInt(index, 10));
        res.json(result);
    } catch (error) {
        console.error('Error deleting link:', error);
        res.status(500).json({ error: 'Failed to delete link' });
    }
});

// Goals API routes
app.get('/api/goals/:type', async (req, res) => {
    try {
        const goals = await goalsDb.getGoals(req.params.type);
        res.json(goals);
    } catch (error) {
        console.error('Error getting goals:', error);
        res.status(500).json({ error: 'Failed to get goals' });
    }
});

app.post('/api/goals/:type', async (req, res) => {
    try {
        const goal = await goalsDb.saveGoal(req.body, req.params.type);
        res.json(goal);
    } catch (error) {
        console.error('Error saving goal:', error);
        res.status(500).json({ error: 'Failed to save goal' });
    }
});

app.put('/api/goals/:type/:id', async (req, res) => {
    try {
        const goal = await goalsDb.updateGoal(req.params.id, req.body, req.params.type);
        res.json(goal);
    } catch (error) {
        console.error('Error updating goal:', error);
        res.status(500).json({ error: 'Failed to update goal' });
    }
});

app.delete('/api/goals/:type/:id', async (req, res) => {
    try {
        const result = await goalsDb.deleteGoal(req.params.id, req.params.type);
        res.json(result);
    } catch (error) {
        console.error('Error deleting goal:', error);
        res.status(500).json({ error: 'Failed to delete goal' });
    }
});

// Cards API routes
app.get('/api/cards', async (req, res) => {
    try {
        const cards = await cardsDb.getCards();
        res.json(cards);
    } catch (error) {
        console.error('Error getting cards:', error);
        res.status(500).json({ error: 'Failed to get cards' });
    }
});

app.post('/api/cards', async (req, res) => {
    try {
        const card = await cardsDb.saveCard(req.body);
        res.json(card);
    } catch (error) {
        console.error('Error saving card:', error);
        res.status(500).json({ error: 'Failed to save card' });
    }
});

app.put('/api/cards/:id', async (req, res) => {
    try {
        const result = await cardsDb.updateCard(req.params.id, req.body.content);
        res.json(result);
    } catch (error) {
        console.error('Error updating card:', error);
        res.status(500).json({ error: 'Failed to update card' });
    }
});

app.put('/api/cards/:id/color', async (req, res) => {
    try {
        const result = await cardsDb.updateCardColor(req.params.id, req.body.backgroundColor);
        res.json(result);
    } catch (error) {
        console.error('Error updating card color:', error);
        res.status(500).json({ error: 'Failed to update card color' });
    }
});

app.delete('/api/cards/:id', async (req, res) => {
    try {
        const result = await cardsDb.deleteCard(req.params.id);
        res.json(result);
    } catch (error) {
        console.error('Error deleting card:', error);
        res.status(500).json({ error: 'Failed to delete card' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
}); 
