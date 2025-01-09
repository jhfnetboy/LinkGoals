function hashContent(content) {
    return Math.random().toString(36).substring(2, 15);
}

class AtomicTasksManager {
    constructor() {
        this.tasks = new Map();
        this.intervals = new Map();
        this.completedTasks = new Map();
        this.init();
    }

    async init() {
        await this.loadTasks();
        this.updateWeekGoalsSelect();
        this.setupEventListeners();
        this.updateWeekSummary();
    }

    setupEventListeners() {
        document.getElementById('task-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask();
        });
    }

    async loadTasks() {
        try {
            const response = await fetch('/api/atomic-tasks');
            if (!response.ok) throw new Error('Failed to load tasks');
            const tasks = await response.json();
            
            // Store current running states before updating
            const runningStates = new Map();
            this.tasks.forEach((task, id) => {
                if (task.status === 'running') {
                    runningStates.set(id, {
                        elapsed_since_start: task.elapsed_since_start,
                        start_time: task.start_time
                    });
                }
            });
            
            this.tasks.clear();
            this.completedTasks.clear();
            
            for (const task of tasks) {
                if (task.status === 'completed') {
                    this.completedTasks.set(task.id, task);
                } else {
                    // Restore running state if exists
                    if (task.status === 'running' && runningStates.has(task.id)) {
                        const state = runningStates.get(task.id);
                        task.elapsed_since_start = state.elapsed_since_start;
                        task.start_time = state.start_time;
                    }
                    this.tasks.set(task.id, task);
                }
            }
            
            this.displayTasks();
            this.updateWeekSummary();
        } catch (error) {
            console.error('Error loading tasks:', error);
        }
    }

    async updateWeekGoalsSelect() {
        try {
            const response = await fetch('/api/goals/week');
            if (!response.ok) throw new Error('Failed to load week goals');
            const goals = await response.json();
            
            const select = document.getElementById('parent-week-goal');
            select.innerHTML = '<option value="">Select week goal</option>';
            for (const goal of goals) {
                const option = document.createElement('option');
                option.value = goal.id;
                option.textContent = goal.content;
                option.dataset.backgroundColor = goal.backgroundColor || '#f9f9f9';
                select.appendChild(option);
            }
        } catch (error) {
            console.error('Error loading week goals:', error);
        }
    }

    async addTask() {
        const input = document.getElementById('task-input');
        const select = document.getElementById('parent-week-goal');
        const content = input.value.trim();
        const parentId = select.value;

        if (!content) {
            alert('Please enter a task content');
            return;
        }

        if (!parentId) {
            alert('Please select a week goal');
            return;
        }

        try {
            // Get parent goal's background color
            const selectedOption = select.options[select.selectedIndex];
            const backgroundColor = selectedOption.dataset.backgroundColor;

            const task = {
                id: hashContent(content),
                content,
                parent_id: parentId,
                background_color: backgroundColor,
                total_time: 0, // Start with 0 time
                status: 'running', // Start task automatically
                start_time: Date.now() // Set initial start time
            };

            const response = await fetch('/api/atomic-tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(task)
            });

            if (!response.ok) throw new Error('Failed to save task');
            
            input.value = '';
            await this.loadTasks();
        } catch (error) {
            console.error('Error adding task:', error);
            alert('Failed to add task');
        }
    }

    formatTime(milliseconds) {
        const hours = Math.floor(milliseconds / (1000 * 60 * 60));
        const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m`;
    }

    parseTime(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
            return null;
        }
        return (hours * 60 * 60 * 1000) + (minutes * 60 * 1000);
    }

    async updateTaskTime(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) return;

        const timeInput = document.querySelector(`#task-${taskId} .time-input`);
        if (!timeInput) return;

        const newTime = this.parseTime(timeInput.value);
        if (newTime === null) {
            alert('Please enter a valid time in HH:mm format');
            return;
        }

        try {
            // If task is running, stop the timer first
            if (task.status === 'running') {
                if (this.intervals.has(taskId)) {
                    clearInterval(this.intervals.get(taskId));
                    this.intervals.delete(taskId);
                }
            }

            const response = await fetch(`/api/atomic-tasks/${taskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    status: task.status,
                    totalTime: newTime,
                    start_time: task.status === 'running' ? Date.now() : null
                })
            });

            if (!response.ok) throw new Error('Failed to update task time');
            
            const updateButton = document.querySelector(`#task-${taskId} .task-time button`);
            if (updateButton) {
                const originalText = updateButton.textContent;
                updateButton.textContent = '✓ Updated';
                updateButton.style.backgroundColor = '#4CAF50';
                setTimeout(() => {
                    updateButton.textContent = originalText;
                    updateButton.style.backgroundColor = '';
                }, 2000);
            }

            // Update task in memory
            task.total_time = newTime;
            task.elapsed_since_start = 0;
            
            if (task.status === 'running') {
                task.start_time = Date.now();
                this.startTimer(taskId, task.start_time);
            }
            
            // Update display without reloading all tasks
            this.displayTasks();
            this.updateWeekSummary();
        } catch (error) {
            console.error('Error updating task time:', error);
            alert('Failed to update task time');
        }
    }

    startTimer(taskId, startTime) {
        if (this.intervals.has(taskId)) {
            clearInterval(this.intervals.get(taskId));
            this.intervals.delete(taskId);
        }

        const task = this.tasks.get(taskId);
        if (!task) return;

        // Update the display immediately
        const timeElement = document.querySelector(`#task-${taskId} .task-time span`);
        if (timeElement) {
            timeElement.textContent = this.formatTime(task.total_time || 0);
        }

        // Only start interval if task is running
        if (task.status === 'running') {
            const startTimeStamp = startTime || Date.now();
            task.start_time = startTimeStamp;
            if (!task.elapsed_since_start) {
                task.elapsed_since_start = 0;
            }

            const updateTime = () => {
                const currentTask = this.tasks.get(taskId);
                if (!currentTask || currentTask.status !== 'running') {
                    clearInterval(this.intervals.get(taskId));
                    this.intervals.delete(taskId);
                    return;
                }

                currentTask.elapsed_since_start = Date.now() - startTimeStamp;
                const displayTime = (currentTask.total_time || 0) + currentTask.elapsed_since_start;

                const timeElement = document.querySelector(`#task-${taskId} .task-time span`);
                if (timeElement) {
                    timeElement.textContent = this.formatTime(displayTime);
                }
            };

            this.intervals.set(taskId, setInterval(updateTime, 1000));
            updateTime();
        }
    }

    async updateTaskStatus(taskId, status) {
        try {
            const task = this.tasks.get(taskId);
            if (!task) return;

            // Clear interval first to prevent any ongoing updates
            if (this.intervals.has(taskId)) {
                clearInterval(this.intervals.get(taskId));
                this.intervals.delete(taskId);
            }

            let totalTime = task.total_time || 0;
            
            // Only update total_time if we're pausing or completing a running task
            if (status !== 'running' && task.status === 'running' && task.elapsed_since_start) {
                totalTime += task.elapsed_since_start;
                task.elapsed_since_start = 0;
            }

            const response = await fetch(`/api/atomic-tasks/${taskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    status, 
                    totalTime,
                    start_time: status === 'running' ? Date.now() : null,
                    completed_at: status === 'completed' ? Date.now() : null
                })
            });

            if (!response.ok) throw new Error('Failed to update task');
            
            if (status === 'completed') {
                task.completed_at = Date.now();
                this.completedTasks.set(taskId, task);
                this.tasks.delete(taskId);
            } else {
                task.status = status;
                task.total_time = totalTime;
                
                if (status === 'running') {
                    task.start_time = Date.now();
                    task.elapsed_since_start = 0;
                    this.startTimer(taskId, task.start_time);
                }
            }
            
            // Update display without reloading all tasks
            this.displayTasks();
            this.updateWeekSummary();
        } catch (error) {
            console.error('Error updating task:', error);
            alert('Failed to update task');
        }
    }

    async deleteTask(taskId) {
        if (!confirm('Are you sure you want to delete this task?')) return;

        try {
            const response = await fetch(`/api/atomic-tasks/${taskId}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Failed to delete task');
            
            if (this.intervals.has(taskId)) {
                clearInterval(this.intervals.get(taskId));
                this.intervals.delete(taskId);
            }
            
            await this.loadTasks();
        } catch (error) {
            console.error('Error deleting task:', error);
            alert('Failed to delete task');
        }
    }

    displayTasks() {
        const container = document.getElementById('atomic-tasks-list');
        container.innerHTML = '';

        for (const task of Array.from(this.tasks.values())) {
            const taskElement = document.createElement('div');
            taskElement.className = `atomic-task${task.status === 'completed' ? ' completed' : ''}${task.status === 'paused' ? ' paused' : ''}`;
            taskElement.id = `task-${task.id}`;
            if (task.background_color) {
                taskElement.style.backgroundColor = task.background_color;
            }

            const content = document.createElement('div');
            content.className = 'task-content';
            content.textContent = task.content;

            const time = document.createElement('div');
            time.className = 'task-time';
            
            const timeDisplay = document.createElement('span');
            timeDisplay.textContent = this.formatTime(task.total_time || 0);
            
            const timeInput = document.createElement('input');
            timeInput.type = 'text';
            timeInput.className = 'time-input';
            timeInput.placeholder = 'HH:mm';
            const hours = Math.floor((task.total_time || 0) / (1000 * 60 * 60));
            const minutes = Math.floor(((task.total_time || 0) % (1000 * 60 * 60)) / (1000 * 60));
            timeInput.value = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            timeInput.disabled = task.status === 'completed';
            
            const updateButton = document.createElement('button');
            updateButton.textContent = 'Update';
            updateButton.disabled = task.status === 'completed';
            updateButton.onclick = () => this.updateTaskTime(task.id);

            time.appendChild(timeDisplay);
            if (task.status !== 'completed') {
                time.appendChild(timeInput);
                time.appendChild(updateButton);
            }

            const actions = document.createElement('div');
            actions.className = 'task-actions';

            if (task.status !== 'completed') {
                if (task.status === 'running') {
                    const pauseButton = document.createElement('button');
                    pauseButton.className = 'task-button pause-button';
                    pauseButton.textContent = '⏸️ Pause';
                    pauseButton.onclick = () => this.updateTaskStatus(task.id, 'paused');
                    actions.appendChild(pauseButton);
                } else {
                    const startButton = document.createElement('button');
                    startButton.className = 'task-button start-button';
                    startButton.textContent = '▶️ Start';
                    startButton.onclick = () => this.updateTaskStatus(task.id, 'running');
                    actions.appendChild(startButton);
                }

                const completeButton = document.createElement('button');
                completeButton.className = 'task-button complete-button';
                completeButton.textContent = '✓ Complete';
                completeButton.onclick = () => this.updateTaskStatus(task.id, 'completed');
                actions.appendChild(completeButton);
            }

            const deleteButton = document.createElement('button');
            deleteButton.className = 'task-button delete-button';
            deleteButton.textContent = '× Delete';
            deleteButton.onclick = () => this.deleteTask(task.id);
            actions.appendChild(deleteButton);

            taskElement.appendChild(content);
            taskElement.appendChild(time);
            taskElement.appendChild(actions);
            container.appendChild(taskElement);
        }
    }

    updateWeekSummary() {
        const totalTasks = this.tasks.size + this.completedTasks.size;
        const completedCount = this.completedTasks.size;
        let totalTime = 0;

        // Calculate total time from both active and completed tasks
        for (const task of this.tasks.values()) {
            totalTime += task.total_time || 0;
        }
        for (const task of this.completedTasks.values()) {
            totalTime += task.total_time || 0;
        }

        // Update statistics
        document.getElementById('total-tasks').textContent = totalTasks;
        document.getElementById('completed-tasks').textContent = completedCount;
        document.getElementById('total-time').textContent = this.formatTime(totalTime);

        // Update completed tasks grid
        const grid = document.getElementById('completed-tasks-grid');
        grid.innerHTML = '';

        // Create 20 cells
        for (let i = 0; i < 20; i++) {
            const cell = document.createElement('div');
            cell.className = 'task-cell';
            
            const completedTask = Array.from(this.completedTasks.values())[i];
            if (completedTask) {
                cell.className += ' has-task';
                cell.textContent = (i + 1).toString();
                cell.onclick = () => this.showTaskSummary(completedTask);
            }
            
            grid.appendChild(cell);
        }
    }

    showTaskSummary(task) {
        const dialog = document.getElementById('task-summary-dialog');
        const content = document.getElementById('task-summary-content');
        
        content.innerHTML = `
            <div class="task-summary-item">
                <strong>Task:</strong> ${task.content}
            </div>
            <div class="task-summary-item">
                <strong>Total Time:</strong> ${this.formatTime(task.total_time || 0)}
            </div>
            <div class="task-summary-item">
                <strong>Completed:</strong> ${new Date(task.completed_at || Date.now()).toLocaleString()}
            </div>
        `;
        
        dialog.style.display = 'block';
    }

    closeTaskSummary() {
        document.getElementById('task-summary-dialog').style.display = 'none';
    }
}

// Initialize atomic tasks manager when page loads
let atomicTasksManager;
document.addEventListener('DOMContentLoaded', () => {
    atomicTasksManager = new AtomicTasksManager();
});

// Make addAtomicTask function available globally
window.addAtomicTask = () => atomicTasksManager.addTask(); 