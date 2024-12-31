class GoalsManager {
    constructor(type) {
        this.type = type; // 'year', 'month', or 'week'
        this.goals = [];
        this.connections = [];
    }

    async loadGoals() {
        try {
            const response = await fetch(`/api/goals/${this.type}`);
            if (response.ok) {
                this.goals = await response.json();
                return this.goals;
            }
            return [];
        } catch (error) {
            console.error(`Error loading ${this.type} goals:`, error);
            return [];
        }
    }

    async saveGoal(goal) {
        try {
            const response = await fetch(`/api/goals/${this.type}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(goal)
            });
            if (response.ok) {
                const result = await response.json();
                this.goals.push(result);
                return result;
            }
            throw new Error('Failed to save goal');
        } catch (error) {
            console.error(`Error saving ${this.type} goal:`, error);
            throw error;
        }
    }

    async updateGoal(id, updates) {
        try {
            const response = await fetch(`/api/goals/${this.type}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            if (response.ok) {
                const updatedGoal = await response.json();
                const index = this.goals.findIndex(g => g.id === id);
                if (index !== -1) {
                    this.goals[index] = updatedGoal;
                }
                return updatedGoal;
            }
            throw new Error('Failed to update goal');
        } catch (error) {
            console.error(`Error updating ${this.type} goal:`, error);
            throw error;
        }
    }

    async deleteGoal(id) {
        try {
            const response = await fetch(`/api/goals/${this.type}/${id}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                this.goals = this.goals.filter(g => g.id !== id);
                return true;
            }
            throw new Error('Failed to delete goal');
        } catch (error) {
            console.error(`Error deleting ${this.type} goal:`, error);
            throw error;
        }
    }

    async saveConnection(connection) {
        try {
            const response = await fetch('/api/connections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(connection)
            });
            if (response.ok) {
                const result = await response.json();
                this.connections.push(result);
                return result;
            }
            throw new Error('Failed to save connection');
        } catch (error) {
            console.error('Error saving connection:', error);
            throw error;
        }
    }

    async loadConnections() {
        try {
            const response = await fetch(`/api/connections/${this.type}`);
            if (response.ok) {
                this.connections = await response.json();
                return this.connections;
            }
            return [];
        } catch (error) {
            console.error(`Error loading ${this.type} connections:`, error);
            return [];
        }
    }
}

// Helper functions for UI
const createGoalElement = (goal) => {
    const div = document.createElement('div');
    div.className = 'goal-item';
    div.id = goal.id;
    div.style.backgroundColor = goal.backgroundColor || '#f9f9f9';
    
    div.innerHTML = `
        <div class="goal-content">${goal.content}</div>
        <div class="goal-actions">
            <input type="color" class="color-picker" value="${goal.backgroundColor || '#f9f9f9'}" 
                onchange="updateGoalColor('${goal.id}', this.value)">
            <button onclick="deleteGoal('${goal.id}')">Delete</button>
            <span class="drag-handle" data-goal-id="${goal.id}">&gt;</span>
        </div>
    `;
    
    return div;
};

const initJsPlumb = (instance) => {
    instance.setContainer(document.querySelector('.goals-container'));
    
    instance.importDefaults({
        Connector: ['Bezier', { curviness: 50 }],
        Anchors: ['Right', 'Left'],
        Endpoint: ['Dot', { radius: 5 }],
        PaintStyle: { stroke: '#5c96bc', strokeWidth: 2 },
        HoverPaintStyle: { stroke: '#1e8151', strokeWidth: 3 }
    });
    
    return instance;
};

export { GoalsManager, createGoalElement, initJsPlumb }; 