// Add hash function
function hashContent(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString();
}

function createGoalElement(goal) {
    const div = document.createElement('div');
    div.className = 'goal-item';
    div.id = goal.id || hashContent(goal.content);
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
    }

    async loadGoals() {
        try {
            const response = await fetch(`/api/goals/${this.type}`);
            if (!response.ok) throw new Error('Failed to load goals');
            return await response.json();
        } catch (error) {
            console.error('Error loading goals:', error);
            return [];
        }
    }

    async saveGoal(goal) {
        try {
            // Use content hash as ID if not provided
            if (!goal.id) {
                goal.id = hashContent(goal.content);
            }

            const response = await fetch(`/api/goals/${this.type}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(goal)
            });
            
            if (!response.ok) throw new Error('Failed to save goal');
            return await response.json();
        } catch (error) {
            console.error('Error saving goal:', error);
            throw error;
        }
    }

    async updateGoal(id, goal) {
        try {
            const response = await fetch(`/api/goals/${this.type}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(goal)
            });
            
            if (!response.ok) throw new Error('Failed to update goal');
            return await response.json();
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