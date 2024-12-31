import { GoalsManager, createGoalElement, initJsPlumb, hashContent } from './goals-util.js';

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
    try {
        // Load goals for each time period
        const [yearData, monthData, weekData] = await Promise.all([
            yearGoals.loadGoals(),
            monthGoals.loadGoals(),
            weekGoals.loadGoals()
        ]);

        console.log('Loaded goals:', { yearData, monthData, weekData });

        // Render goals
        renderGoals('year-list', yearData);
        renderGoals('month-list', monthData);
        renderGoals('week-list', weekData);

        // Load and render connections
        await loadConnections();
    } catch (error) {
        console.error('Error loading goals:', error);
    }
}

function renderGoals(containerId, goals) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container ${containerId} not found`);
        return;
    }

    container.innerHTML = '';
    if (!Array.isArray(goals)) {
        console.error(`Invalid goals data for ${containerId}:`, goals);
        return;
    }

    for (const goal of goals) {
        if (!goal || !goal.content) {
            console.error(`Invalid goal data:`, goal);
            continue;
        }

        const element = createGoalElement(goal);
        container.appendChild(element);
        makeElementDraggable(element);
        setupDragHandle(element.querySelector('.drag-handle'));
        makeElementTarget(element, containerId.split('-')[0]);
    }
}

function setupEventListeners() {
    // Add goal when pressing Enter in input fields
    document.getElementById('year-input')?.addEventListener('keypress', e => handleNewGoal(e, 'year'));
    document.getElementById('month-input')?.addEventListener('keypress', e => handleNewGoal(e, 'month'));
    document.getElementById('week-input')?.addEventListener('keypress', e => handleNewGoal(e, 'week'));

    // Add goal when clicking the "+" buttons
    document.getElementById('year-add')?.addEventListener('click', () => addGoal('year'));
    document.getElementById('month-add')?.addEventListener('click', () => addGoal('month'));
    document.getElementById('week-add')?.addEventListener('click', () => addGoal('week'));
}

async function handleNewGoal(event, type) {
    if (event.key === 'Enter' && event.target.value.trim()) {
        await addGoal(type);
    }
}

window.addGoal = async (type) => {
    const input = document.getElementById(`${type}-input`);
    if (!input) {
        console.error(`Input element for ${type} not found`);
        return;
    }

    const content = input.value.trim();
    if (!content) {
        alert('Please enter a goal');
        return;
    }

    const goal = {
        content,
        backgroundColor: '#f9f9f9',
        id: hashContent(content)
    };

    const manager = getManagerForType(type);
    if (!manager) {
        console.error(`No manager found for type: ${type}`);
        return;
    }

    try {
        const savedGoal = await manager.saveGoal(goal);
        const element = createGoalElement(savedGoal);
        const container = document.getElementById(`${type}-list`);
        if (container) {
            container.appendChild(element);
            makeElementDraggable(element);
            setupDragHandle(element.querySelector('.drag-handle'));
            makeElementTarget(element, type);
            input.value = '';
        }
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
            allowLoopback: false,
            maxConnections: -1
        });
    }
}

function setupDragAndDrop() {
    // Add connection validation
    jsPlumbInstance.bind('beforeDrop', (info) => {
        if (!info.source || !info.target) return false;
        
        const sourceGoalItem = info.source.closest('.goal-item');
        const targetGoalItem = info.target;
        
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
            color: getRandomColor()
        };

        try {
            await yearGoals.saveConnection(connection);
            // Update the connection color
            info.connection.setPaintStyle({ stroke: connection.color, strokeWidth: 2 });
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
    
    if (!sourceElement || !targetElement) {
        console.error('Connection elements not found:', connection);
        return;
    }

    const dragHandle = sourceElement.querySelector('.drag-handle');
    if (!dragHandle) {
        console.error('Drag handle not found for source element:', sourceElement);
        return;
    }

    jsPlumbInstance.connect({
        source: dragHandle,
        target: targetElement,
        paintStyle: { stroke: connection.color || getRandomColor(), strokeWidth: 2 },
        connector: ['Bezier', { curviness: 50 }],
        endpoints: [['Dot', { radius: 5 }], ['Dot', { radius: 5 }]],
        anchors: ['Right', 'Left']
    });
}

// Export functions for use in HTML
window.updateGoalColor = async (goalId, color) => {
    const element = document.getElementById(goalId);
    if (!element) {
        console.error('Element not found:', goalId);
        return;
    }

    const columnType = element.closest('.goal-column')?.id.split('-')[0];
    if (!columnType) {
        console.error('Column type not found for element:', element);
        return;
    }

    const manager = getManagerForType(columnType);
    if (!manager) {
        console.error('No manager found for type:', columnType);
        return;
    }

    try {
        const content = element.querySelector('.goal-content')?.textContent;
        if (!content) {
            console.error('Content not found in element:', element);
            return;
        }

        await manager.updateGoal(goalId, { 
            id: goalId,
            content: content,
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

    const element = document.getElementById(goalId);
    if (!element) {
        console.error('Element not found:', goalId);
        return;
    }

    const columnType = element.closest('.goal-column')?.id.split('-')[0];
    if (!columnType) {
        console.error('Column type not found for element:', element);
        return;
    }

    const manager = getManagerForType(columnType);
    if (!manager) {
        console.error('No manager found for type:', columnType);
        return;
    }

    try {
        await manager.deleteGoal(goalId);
        jsPlumbInstance.remove(element);
        element.remove();
    } catch (error) {
        console.error('Error deleting goal:', error);
        alert('Failed to delete goal');
    }
};

// Add helper function for random colors
function getRandomColor() {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD',
        '#D4A5A5', '#9B59B6', '#3498DB', '#E67E22', '#2ECC71'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
} 