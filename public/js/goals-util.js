// Hash function for consistent ID generation
function hashContent(content) {
    // Normalize content by trimming and converting to lowercase
    const normalizedContent = content.trim().toLowerCase();
    // Add timestamp to ensure uniqueness
    const timestamp = Date.now();
    const contentWithTimestamp = `${normalizedContent}_${timestamp}`;
    
    let hash = 0;
    for (let i = 0; i < contentWithTimestamp.length; i++) {
        const char = contentWithTimestamp.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString();
}

function createGoalElement(goal, type) {
    const div = document.createElement('div');
    div.className = 'goal-item';
    div.id = goal.id;
    div.style.backgroundColor = goal.backgroundColor || '#f9f9f9';
    
    // Add goal content
    const contentSpan = document.createElement('span');
    contentSpan.className = 'goal-content';
    contentSpan.contentEditable = 'true';
    contentSpan.textContent = goal.content;
    contentSpan.addEventListener('blur', async () => {
        const newContent = contentSpan.textContent.trim();
        if (newContent && newContent !== goal.content) {
            try {
                const manager = getManagerForType(type);
                await manager.updateGoal(goal.id, { 
                    ...goal,
                    content: newContent 
                });
            } catch (error) {
                console.error('Error updating goal content:', error);
                contentSpan.textContent = goal.content; // Revert on error
            }
        }
    });
    div.appendChild(contentSpan);
    
    // Add parent selection for month and week goals
    if (type === 'month' || type === 'week') {
        const parentDiv = document.createElement('div');
        parentDiv.className = 'parent-selection';
        const select = document.createElement('select');
        select.disabled = !!goal.parentId;
        select.innerHTML = `<option value="">Select ${type === 'month' ? 'year' : 'month'} goal</option>`;
        select.addEventListener('change', (e) => selectParent(goal.id, e.target.value, type));
        parentDiv.appendChild(select);
        div.appendChild(parentDiv);
    }
    
    // Add goal actions
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'goal-actions';
    
    // Color picker
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = goal.backgroundColor || '#f9f9f9';
    colorInput.addEventListener('change', (e) => updateGoalColor(goal.id, e.target.value));
    actionsDiv.appendChild(colorInput);
    
    // Delete button
    const deleteButton = document.createElement('button');
    deleteButton.textContent = '×';
    deleteButton.onclick = () => deleteGoal(goal.id);
    actionsDiv.appendChild(deleteButton);
    
    div.appendChild(actionsDiv);
    return div;
}

class GoalsManager {
    constructor(type) {
        this.type = type;
        this.goals = new Map(); // Cache for goals
    }

    async loadGoals() {
        try {
            const response = await fetch(`/api/goals/${this.type}`);
            if (!response.ok) throw new Error('Failed to load goals');
            const goals = await response.json();
            
            // Clear and update cache
            this.goals.clear();
            for (const goal of goals) {
                this.goals.set(goal.id, goal);
            }
            
            return Array.from(this.goals.values());
        } catch (error) {
            console.error('Error loading goals:', error);
            return [];
        }
    }

    async saveGoal(goal, parentId = null) {
        try {
            // For new goals, generate a unique hash ID
            const id = goal.id || hashContent(goal.content);
            console.log('Saving goal with hash:', { id, content: goal.content, parentId });

            const goalToSave = {
                ...goal,
                id,
                parentId,
                backgroundColor: goal.backgroundColor || '#f9f9f9'
            };

            const response = await fetch(`/api/goals/${this.type}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(goalToSave)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save goal');
            }

            const savedGoal = await response.json();
            
            // Update cache
            this.goals.set(savedGoal.id, savedGoal);
            
            return savedGoal;
        } catch (error) {
            console.error('Error saving goal:', error);
            throw error;
        }
    }

    async updateGoal(id, goal) {
        try {
            console.log('Updating goal:', { id, content: goal.content });

            const response = await fetch(`/api/goals/${this.type}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(goal)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update goal');
            }

            const updatedGoal = await response.json();
            
            // Update cache
            this.goals.set(updatedGoal.id, updatedGoal);
            
            return updatedGoal;
        } catch (error) {
            console.error('Error updating goal:', error);
            throw error;
        }
    }

    async deleteGoal(id) {
        try {
            const response = await fetch(`/api/goals/${this.type}/${id}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete goal');
            }
            
            // Remove from cache
            this.goals.delete(id);
            
            return await response.json();
        } catch (error) {
            console.error('Error deleting goal:', error);
            throw error;
        }
    }

    // Get parent goals for selection
    async getParentGoals() {
        if (this.type === 'year') return [];
        
        const parentType = this.type === 'month' ? 'year' : 'month';
        try {
            const response = await fetch(`/api/goals/${parentType}`);
            if (!response.ok) throw new Error('Failed to load parent goals');
            return await response.json();
        } catch (error) {
            console.error('Error loading parent goals:', error);
            return [];
        }
    }
}

// Helper function to get manager for type
function getManagerForType(type) {
    const managers = {
        year: new GoalsManager('year'),
        month: new GoalsManager('month'),
        week: new GoalsManager('week')
    };
    return managers[type];
}

export { GoalsManager, createGoalElement, hashContent }; 