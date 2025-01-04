class Toolbar {
    constructor() {
        this.audio = null;
        this.isPlaying = false;
        this.currentMusic = null;
        this.musicFiles = [];
        this.currentMusicIndex = 0;

        this.loadSavedSettings();
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Load music list when page loads
        this.loadMusicList();
    }

    async loadMusicList() {
        try {
            const response = await fetch('/api/music');
            if (!response.ok) throw new Error('Failed to load music list');
            this.musicFiles = await response.json();
            this.displayMusicList();
            if (this.musicFiles.length > 0) {
                this.currentMusic = this.musicFiles[0];
                this.currentMusicIndex = 0;
                this.initAudio(this.currentMusic);
            }
        } catch (error) {
            console.error('Error loading music list:', error);
        }
    }

    displayMusicList() {
        const list = document.getElementById('musicList');
        if (!list) return;
        
        list.innerHTML = '';
        for (const file of this.musicFiles) {
            const div = document.createElement('div');
            div.className = `music-item${file === this.currentMusic ? ' active' : ''}`;
            div.textContent = file.replace(/\.mp3$/, '');
            div.onclick = () => this.selectMusic(file);
            list.appendChild(div);
        }
    }

    initAudio(file) {
        if (this.audio) {
            this.audio.pause();
            this.audio = null;
        }
        this.audio = new Audio(`/music/${file}`);
        this.audio.loop = false; // Disable loop for auto-next
        this.audio.addEventListener('ended', () => this.playNext());
    }

    selectMusic(file) {
        this.currentMusic = file;
        this.initAudio(file);
        if (this.isPlaying) {
            this.audio.play();
        }
        this.displayMusicList();
        this.toggleMusicPicker();
    }

    toggleMusic() {
        if (!this.audio && this.currentMusic) {
            this.initAudio(this.currentMusic);
        }
        
        if (this.audio) {
            if (this.isPlaying) {
                this.audio.pause();
                document.querySelector('.music-control').textContent = '🔈';
            } else {
                this.audio.play();
                document.querySelector('.music-control').textContent = '🔊';
            }
            this.isPlaying = !this.isPlaying;
            this.updateMusicController();
        }
    }

    toggleMusicPicker() {
        const picker = document.getElementById('musicPicker');
        if (picker) {
            picker.style.display = picker.style.display === 'none' || !picker.style.display ? 'block' : 'none';
        }
    }

    toggleGradientPicker() {
        const picker = document.getElementById('gradientPicker');
        if (picker) {
            picker.style.display = picker.style.display === 'none' || !picker.style.display ? 'block' : 'none';
        }
    }

    updateMusicController() {
        const controller = document.getElementById('musicController');
        const musicName = document.getElementById('currentMusicName');
        if (!controller || !musicName) return;
        
        if (this.isPlaying) {
            controller.classList.add('show');
            if (this.currentMusic) {
                musicName.textContent = this.currentMusic.replace(/\.(mp3|wav)$/, '');
            }
        } else {
            controller.classList.remove('show');
        }
    }

    playPrevious() {
        if (this.musicFiles.length === 0) return;
        
        this.currentMusicIndex = (this.currentMusicIndex - 1 + this.musicFiles.length) % this.musicFiles.length;
        this.currentMusic = this.musicFiles[this.currentMusicIndex];
        this.initAudio(this.currentMusic);
        if (this.isPlaying) {
            this.audio.play();
        }
        this.updateMusicController();
    }

    playNext() {
        if (this.musicFiles.length === 0) return;
        
        this.currentMusicIndex = (this.currentMusicIndex + 1) % this.musicFiles.length;
        this.currentMusic = this.musicFiles[this.currentMusicIndex];
        this.initAudio(this.currentMusic);
        if (this.isPlaying) {
            this.audio.play();
        }
        this.updateMusicController();
    }

    loadSavedSettings() {
        // Load saved gradient colors for all pages
        const start = localStorage.getItem('gradientStart') || '#4CAF50';
        const end = localStorage.getItem('gradientEnd') || '#45a049';
        
        // Apply gradient background to all pages
        document.body.style.background = `linear-gradient(135deg, ${start} 0%, ${end} 100%)`;

        // Only set color picker values if we're on the read page
        const startInput = document.getElementById('gradientStart');
        const endInput = document.getElementById('gradientEnd');
        if (startInput && endInput) {
            startInput.value = start;
            endInput.value = end;
        }
    }

    updateGradient() {
        const start = document.getElementById('gradientStart')?.value || '#4CAF50';
        const end = document.getElementById('gradientEnd')?.value || '#45a049';
        document.body.style.background = `linear-gradient(135deg, ${start} 0%, ${end} 100%)`;
        
        // Save the gradient colors to localStorage for all pages
        localStorage.setItem('gradientStart', start);
        localStorage.setItem('gradientEnd', end);
    }

    toggleAlarmPicker() {
        const picker = document.getElementById('alarmPicker');
        if (picker) {
            picker.style.display = picker.style.display === 'none' || !picker.style.display ? 'block' : 'none';
        }
    }
}

// Initialize toolbar
let toolbar;
document.addEventListener('DOMContentLoaded', () => {
    toolbar = new Toolbar();
}); 