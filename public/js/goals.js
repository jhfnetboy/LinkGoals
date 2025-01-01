import { GoalsManager, createGoalElement } from './goals-util.js';

// Initialize managers for each type
const yearManager = new GoalsManager('year');
const monthManager = new GoalsManager('month');
const weekManager = new GoalsManager('week');

// Initialize the page
async function initializePage() {
    console.log('Initializing page...');
    await loadAllGoals();
    await updateParentSelections();
    console.log('Page initialization complete');
}

// Load all goals
async function loadAllGoals() {
    console.log('Loading all goals...');
    try {
        const yearGoals = await yearManager.loadGoals();
        const monthGoals = await monthManager.loadGoals();
        const weekGoals = await weekManager.loadGoals();

        console.log('Loaded goals:', { yearGoals, monthGoals, weekGoals });

        updateGoalsList('year-list', yearGoals, 'year');
        updateGoalsList('month-list', monthGoals, 'month');
        updateGoalsList('week-list', weekGoals, 'week');
    } catch (error) {
        console.error('Error loading goals:', error);
    }
}

// Update goals list in a column
function updateGoalsList(containerId, goals, type) {
    console.log(`Updating ${type} goals list...`);
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container not found: ${containerId}`);
        return;
    }

    container.innerHTML = '';
    for (const goal of goals) {
        if (!goal || !goal.content) {
            console.warn('Invalid goal data:', goal);
            continue;
        }
        console.log(`Adding goal to ${type}:`, goal);
        container.appendChild(createGoalElement(goal, type));
    }
}

// Add new goal
async function addGoal(type) {
    const input = document.querySelector(`#${type}-input`);
    const content = input.value.trim();
    if (!content) return;

    try {
        console.log(`Adding new ${type} goal:`, content);
        const manager = getManagerForType(type);
        const goal = await manager.saveGoal({ content });
        console.log('Goal saved:', goal);
        await loadAllGoals();
        input.value = '';
    } catch (error) {
        console.error('Error adding goal:', error);
        alert('Failed to add goal');
    }
}

// Update goal color
async function updateGoalColor(id, color) {
    try {
        console.log('Updating goal color:', { id, color });
        const type = getTypeFromId(id);
        const manager = getManagerForType(type);
        
        // Get the current goal data first
        const goal = manager.goals.get(id);
        if (!goal) {
            console.error('Goal not found:', id);
            return;
        }
        
        // Update the goal with all existing data plus new color
        await manager.updateGoal(id, {
            ...goal,
            backgroundColor: color
        });
        
        await loadAllGoals();
    } catch (error) {
        console.error('Error updating goal color:', error);
        alert('Failed to update goal color');
    }
}

// Delete goal
async function deleteGoal(id) {
    if (!confirm('Are you sure you want to delete this goal?')) return;

    try {
        console.log('Deleting goal:', id);
        const type = getTypeFromId(id);
        const manager = getManagerForType(type);
        await manager.deleteGoal(id);
        await loadAllGoals();
    } catch (error) {
        console.error('Error deleting goal:', error);
        alert('Failed to delete goal');
    }
}

// Select parent goal
async function selectParent(goalId, parentId, type) {
    if (!parentId) return;

    try {
        console.log('Selecting parent:', { goalId, parentId, type });
        const manager = getManagerForType(type);
        const parentManager = getManagerForType(type === 'month' ? 'year' : 'month');
        
        // Get parent goal
        const parent = parentManager.goals.get(parentId);
        if (!parent) {
            console.error('Parent goal not found:', parentId);
            return;
        }

        // Get current goal
        const goal = manager.goals.get(goalId);
        if (!goal) {
            console.error('Goal not found:', goalId);
            return;
        }

        // Update the goal with parent ID and inherit parent's color
        await manager.updateGoal(goalId, {
            ...goal,
            parentId,
            backgroundColor: parent.backgroundColor
        });

        // Reload all goals and update parent selections
        await loadAllGoals();
        await updateParentSelections();
    } catch (error) {
        console.error('Error selecting parent:', error);
        alert('Failed to set parent goal');
    }
}

// Update parent selections in dropdowns
async function updateParentSelections() {
    console.log('Updating parent selections...');
    try {
        // Load all goals
        const yearGoals = await yearManager.loadGoals();
        const monthGoals = await monthManager.loadGoals();

        console.log('Parent goals loaded:', { yearGoals, monthGoals });

        // Update month goals' parent selections
        const monthSelects = document.querySelectorAll('#month-goals .parent-selection select');
        console.log('Found month selects:', monthSelects.length);
        
        for (const select of monthSelects) {
            // Get the goal ID from the parent goal item
            const goalItem = select.closest('.goal-item');
            const goalId = goalItem?.id;
            const currentGoal = goalId ? monthManager.goals.get(goalId) : null;
            
            // Build options HTML
            let optionsHtml = '<option value="">Select year goal</option>';
            for (const yearGoal of yearGoals) {
                const selected = currentGoal?.parentId === yearGoal.id ? 'selected' : '';
                optionsHtml += `<option value="${yearGoal.id}" ${selected}>${yearGoal.content}</option>`;
            }
            select.innerHTML = optionsHtml;
            
            // Disable if already has a parent
            select.disabled = Boolean(currentGoal?.parentId);
        }

        // Update week goals' parent selections
        const weekSelects = document.querySelectorAll('#week-goals .parent-selection select');
        console.log('Found week selects:', weekSelects.length);
        
        for (const select of weekSelects) {
            // Get the goal ID from the parent goal item
            const goalItem = select.closest('.goal-item');
            const goalId = goalItem?.id;
            const currentGoal = goalId ? weekManager.goals.get(goalId) : null;
            
            // Build options HTML
            let optionsHtml = '<option value="">Select month goal</option>';
            for (const monthGoal of monthGoals) {
                const selected = currentGoal?.parentId === monthGoal.id ? 'selected' : '';
                optionsHtml += `<option value="${monthGoal.id}" ${selected}>${monthGoal.content}</option>`;
            }
            select.innerHTML = optionsHtml;
            
            // Disable if already has a parent
            select.disabled = Boolean(currentGoal?.parentId);
        }
    } catch (error) {
        console.error('Error updating parent selections:', error);
    }
}

// Helper functions
function getManagerForType(type) {
    switch (type) {
        case 'year': return yearManager;
        case 'month': return monthManager;
        case 'week': return weekManager;
        default: throw new Error(`Invalid type: ${type}`);
    }
}

function getTypeFromId(id) {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Element not found: ${id}`);
    
    if (element.closest('#year-goals')) return 'year';
    if (element.closest('#month-goals')) return 'month';
    if (element.closest('#week-goals')) return 'week';
    throw new Error(`Could not determine type for element: ${id}`);
}

// Initialize page when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePage);

// Make functions available globally
window.addGoal = addGoal;
window.updateGoalColor = updateGoalColor;
window.deleteGoal = deleteGoal;
window.selectParent = selectParent; 