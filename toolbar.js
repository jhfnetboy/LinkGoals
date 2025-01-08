// Update the player style
const playerStyle = {
    position: 'fixed',
    bottom: '20px',
    left: '20px',  // Moved further left to avoid overlap
    zIndex: 99,
    width: '400px'
};

// Add music count display
const musicCountDiv = document.createElement('div');
musicCountDiv.className = 'music-count';
musicCountDiv.id = 'musicCount';
musicCountDiv.style.cssText = `
    position: fixed;
    bottom: 65px;
    left: 20px;
    font-size: 12px;
    color: #666;
    background: rgba(255, 255, 255, 0.8);
    padding: 2px 6px;
    border-radius: 3px;
    z-index: 99;
`;
document.body.appendChild(musicCountDiv);

// Simplified function to update music count
async function updateMusicCount() {
    try {
        const response = await fetch('/api/music-count');
        const data = await response.json();
        const countElement = document.getElementById('musicCount');
        if (countElement) {
            countElement.textContent = `Music files: ${data.count}`;
        }
    } catch (error) {
        console.error('Error fetching music count:', error);
    }
}

// Call this after player initialization
updateMusicCount(); 