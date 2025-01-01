const express = require('express');
const { goalsDb } = require('../db/database');

const router = express.Router();

// Goals routes using SQLite
router.get('/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const goals = await goalsDb.getGoals(type);
        res.json(goals);
    } catch (error) {
        console.error('Error getting goals:', error);
        res.status(500).json({ error: 'Failed to get goals' });
    }
});

router.post('/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const goal = req.body;

        if (!goal.id || !goal.content) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const savedGoal = await goalsDb.saveGoal(goal, type);
        res.json(savedGoal);
    } catch (error) {
        console.error('Error saving goal:', error);
        res.status(500).json({ error: 'Failed to save goal' });
    }
});

router.put('/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        const updatedGoal = await goalsDb.updateGoal(id, req.body, type);
        res.json(updatedGoal);
    } catch (error) {
        console.error('Error updating goal:', error);
        res.status(500).json({ error: 'Failed to update goal' });
    }
});

router.delete('/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        await goalsDb.deleteGoal(id, type);
        res.json({ message: 'Goal deleted successfully' });
    } catch (error) {
        console.error('Error deleting goal:', error);
        res.status(500).json({ error: 'Failed to delete goal' });
    }
});

module.exports = router; 