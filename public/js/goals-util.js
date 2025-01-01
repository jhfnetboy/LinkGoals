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

function createGoalElement(goal) {
    const div = document.createElement('div');
    div.className = 'goal-item';
    // Always use the provided ID for existing goals
    div.id = goal.id;
    div.style.backgroundColor = goal.backgroundColor || '#f9f9f9';
    
    div.innerHTML = `
        <span class="goal-content" contenteditable="true">${goal.content}</span>
        <div class="goal-actions">
            <input type="color" value="${goal.backgroundColor || '#f9f9f9'}" 
                onchange="updateGoalColor('${div.id}', this.value)">
            <button onclick="deleteGoal('${div.id}')">×</button>
            <span class="drag-handle">></span>
        </div>
    `;

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

    async saveGoal(goal) {
        try {
            // For new goals, generate a unique hash ID
            const id = goal.id || hashContent(goal.content);
            console.log('Saving goal with hash:', { id, content: goal.content });

            // Check if goal with this ID already exists in cache
            if (this.goals.has(id)) {
                console.log('Goal with this ID already exists:', id);
                return this.goals.get(id);
            }

            // Check if goal with same content exists
            for (const [existingId, existingGoal] of this.goals) {
                if (existingGoal.content.trim().toLowerCase() === goal.content.trim().toLowerCase()) {
                    console.log('Goal with same content already exists:', existingId);
                    return existingGoal;
                }
            }

            const goalToSave = {
                ...goal,
                id,
                backgroundColor: goal.backgroundColor || '#f9f9f9'
            };

            const response = await fetch(`/api/goals/${this.type}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(goalToSave)
            });
            
            if (!response.ok) throw new Error('Failed to save goal');
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
            
            if (!response.ok) throw new Error('Failed to update goal');
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
            
            if (!response.ok) throw new Error('Failed to delete goal');
            
            // Remove from cache
            this.goals.delete(id);
            
            return await response.json();
        } catch (error) {
            console.error('Error deleting goal:', error);
            throw error;
        }
    }

    async loadConnections() {
        try {
            const response = await fetch(`/api/goals/connections/${this.type}`);
            if (!response.ok) throw new Error('Failed to load connections');
            return await response.json();
        } catch (error) {
            console.error('Error loading connections:', error);
            return [];
        }
    }

    async saveConnection(connection) {
        try {
            const response = await fetch('/api/goals/connections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(connection)
            });
            
            if (!response.ok) throw new Error('Failed to save connection');
            return await response.json();
        } catch (error) {
            console.error('Error saving connection:', error);
            throw error;
        }
    }
}

// Helper function for jsPlumb initialization
function initJsPlumb(instance) {
    instance.setContainer(document.querySelector('.goals-container'));
    
    instance.importDefaults({
        Connector: ['Bezier', { curviness: 50 }],
        Anchors: ['Right', 'Left'],
        Endpoint: ['Dot', { radius: 5 }],
        PaintStyle: { stroke: '#5c96bc', strokeWidth: 2 },
        HoverPaintStyle: { stroke: '#1e8151', strokeWidth: 3 }
    });
    
    return instance;
}

export { GoalsManager, createGoalElement, initJsPlumb, hashContent }; 