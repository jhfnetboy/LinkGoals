import { GoalsManager, createGoalElement, initJsPlumb } from './goals-util.js';

// Initialize jsPlumb instance
const jsPlumbInstance = initJsPlumb(jsPlumb.getInstance());

// Initialize goal managers
const yearGoals = new GoalsManager('year');
const monthGoals = new GoalsManager('month');
const weekGoals = new GoalsManager('week');

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
    await loadAllGoals();
    setupEventListeners();
    setupDragAndDrop();
});

async function loadAllGoals() {
    // Load goals for each time period
    const [yearData, monthData, weekData] = await Promise.all([
        yearGoals.loadGoals(),
        monthGoals.loadGoals(),
        weekGoals.loadGoals()
    ]);

    // Render goals
    renderGoals('year-list', yearData);
    renderGoals('month-list', monthData);
    renderGoals('week-list', weekData);

    // Load and render connections
    await loadConnections();
}

function renderGoals(containerId, goals) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    for (const goal of goals) {
        const element = createGoalElement(goal);
        container.appendChild(element);
        makeElementDraggable(element);
        setupDragHandle(element.querySelector('.drag-handle'));
        makeElementTarget(element, containerId.split('-')[0]);
    }
}

function setupEventListeners() {
    // Add goal when pressing Enter in input fields
    document.getElementById('year-input').addEventListener('keypress', e => handleNewGoal(e, 'year'));
    document.getElementById('month-input').addEventListener('keypress', e => handleNewGoal(e, 'month'));
    document.getElementById('week-input').addEventListener('keypress', e => handleNewGoal(e, 'week'));
}

async function handleNewGoal(event, type) {
    if (event.key === 'Enter' && event.target.value.trim()) {
        await addGoal(type);
    }
}

window.addGoal = async (type) => {
    const input = document.getElementById(`${type}-input`);
    const content = input.value.trim();
    
    if (!content) {
        alert('Please enter a goal');
        return;
    }

    const goal = {
        content,
        backgroundColor: '#f9f9f9',
        id: Date.now().toString()
    };

    const manager = getManagerForType(type);

    try {
        const savedGoal = await manager.saveGoal(goal);
        const element = createGoalElement(savedGoal);
        document.getElementById(`${type}-list`).appendChild(element);
        makeElementDraggable(element);
        setupDragHandle(element.querySelector('.drag-handle'));
        makeElementTarget(element, type);
        input.value = '';
    } catch (error) {
        console.error('Error saving goal:', error);
        alert('Failed to save goal');
    }
};

function getManagerForType(type) {
    const managers = {
        year: yearGoals,
        month: monthGoals,
        week: weekGoals
    };
    return managers[type];
}

function setupDragHandle(handle) {
    if (!handle) return;

    jsPlumbInstance.makeSource(handle, {
        parent: handle.closest('.goal-item'),
        anchor: 'Right',
        connector: ['Bezier', { curviness: 50 }],
        maxConnections: -1,
        endpoint: ['Dot', { radius: 5 }]
    });
}

function makeElementTarget(element, type) {
    if (type === 'month' || type === 'week') {
        jsPlumbInstance.makeTarget(element, {
            dropOptions: { hoverClass: 'dragHover' },
            anchor: 'Left',
            allowLoopback: false
        });
    }
}

function setupDragAndDrop() {
    // Add connection validation
    jsPlumbInstance.bind('beforeDrop', (info) => {
        if (!info.source || !info.target) return false;
        
        const sourceGoalItem = info.source.closest('.goal-item');
        const targetGoalItem = info.target.closest('.goal-item');
        
        if (!sourceGoalItem || !targetGoalItem) return false;
        
        const sourceColumn = sourceGoalItem.closest('.goal-column');
        const targetColumn = targetGoalItem.closest('.goal-column');
        
        if (!sourceColumn || !targetColumn) return false;
        
        const sourceType = sourceColumn.id.split('-')[0];
        const targetType = targetColumn.id.split('-')[0];
        
        const validConnections = {
            year: ['month'],
            month: ['week']
        };

        return validConnections[sourceType]?.includes(targetType);
    });

    // Add connection created handler
    jsPlumbInstance.bind('connection', async (info) => {
        if (!info.source || !info.target) return;
        
        const sourceGoalItem = info.source.closest('.goal-item');
        const targetGoalItem = info.target;
        
        if (!sourceGoalItem || !targetGoalItem) {
            jsPlumbInstance.deleteConnection(info.connection);
            return;
        }

        const connection = {
            sourceId: sourceGoalItem.id,
            targetId: targetGoalItem.id,
            color: '#5c96bc'
        };

        try {
            await yearGoals.saveConnection(connection);
        } catch (error) {
            console.error('Error saving connection:', error);
            jsPlumbInstance.deleteConnection(info.connection);
        }
    });
}

function makeElementDraggable(element) {
    jsPlumbInstance.draggable(element, {
        containment: true,
        grid: [10, 10]
    });
}

async function loadConnections() {
    try {
        const connections = await yearGoals.loadConnections();
        for (const connection of connections) {
            renderConnection(connection);
        }
    } catch (error) {
        console.error('Error loading connections:', error);
    }
}

function renderConnection(connection) {
    const sourceElement = document.getElementById(connection.sourceId);
    const targetElement = document.getElementById(connection.targetId);
    
    if (!sourceElement || !targetElement) return;

    jsPlumbInstance.connect({
        source: sourceElement.querySelector('.drag-handle'),
        target: targetElement,
        paintStyle: { stroke: connection.color, strokeWidth: 2 },
        connector: ['Bezier', { curviness: 50 }],
        endpoints: [['Dot', { radius: 5 }], ['Dot', { radius: 5 }]],
        anchors: ['Right', 'Left']
    });
}

// Export functions for use in HTML
window.updateGoalColor = async (goalId, color) => {
    const element = document.getElementById(goalId);
    if (!element) return;

    const columnType = element.closest('.goal-column').id.split('-')[0];
    const manager = getManagerForType(columnType);

    try {
        await manager.updateGoal(goalId, { 
            id: goalId,
            content: element.querySelector('.goal-content').textContent,
            backgroundColor: color 
        });
        element.style.backgroundColor = color;
    } catch (error) {
        console.error('Error updating goal color:', error);
        alert('Failed to update goal color');
    }
};

window.deleteGoal = async (goalId) => {
    if (!confirm('Are you sure you want to delete this goal?')) return;

    const managers = [yearGoals, monthGoals, weekGoals];
    for (const manager of managers) {
        try {
            await manager.deleteGoal(goalId);
            const element = document.getElementById(goalId);
            if (element) {
                jsPlumbInstance.remove(element);
                element.remove();
            }
            break;
        } catch (error) {
            // Continue to next manager
        }
    }
}; 