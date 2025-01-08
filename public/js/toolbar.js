class Toolbar {
    constructor() {
        this.audio = null;
        this.isPlaying = false;
        this.currentMusic = null;
        this.musicFiles = [];
        this.currentMusicIndex = 0;
        this.isRepeat = false;
        this.alarms = [];
        this.speechSynth = window.speechSynthesis;
        this.dismissCount = 0;
        this.currentAlarmInterval = null;

        this.loadSavedSettings();
        this.initializeEventListeners();
        this.loadAlarms();

        // Add music count display
        this.createMusicCountDisplay();
        this.updateMusicPlayerStyle();
    }

    initializeEventListeners() {
        // Load music list when page loads
        this.loadMusicList();
    }

    async loadMusicList() {
        try {
            // Force server to rescan music directory
            const response = await fetch('/api/music?rescan=true');
            if (!response.ok) throw new Error('Failed to load music list');
            this.musicFiles = await response.json();
            this.displayMusicList();
            
            // Update music count display - show only number
            const countElement = document.getElementById('musicCount');
            if (countElement) {
                countElement.textContent = this.musicFiles.length;
            }
            
            // Initialize with first music file if available
            if (this.musicFiles.length > 0) {
                // Keep current music if it exists in the new list
                if (this.currentMusic && this.musicFiles.includes(this.currentMusic)) {
                    this.currentMusicIndex = this.musicFiles.indexOf(this.currentMusic);
                } else {
                    this.currentMusic = this.musicFiles[0];
                    this.currentMusicIndex = 0;
                }
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
        this.audio.addEventListener('ended', () => {
            if (this.isRepeat) {
                this.audio.currentTime = 0;
                this.audio.play();
            } else {
                this.playNext();
            }
        });
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
        if (controller && musicName) {
            controller.className = this.isPlaying ? 'music-controller show' : 'music-controller';
            musicName.textContent = this.currentMusic ? this.currentMusic.replace(/\.(mp3|wav)$/, '') : '';
            
            // Update repeat button
            let repeatBtn = controller.querySelector('.repeat-button');
            if (!repeatBtn) {
                repeatBtn = document.createElement('button');
                repeatBtn.className = 'repeat-button';
                repeatBtn.onclick = () => this.toggleRepeat();
                // Insert repeat button before the next button
                const nextBtn = controller.querySelector('button:last-child');
                controller.insertBefore(repeatBtn, nextBtn);
            }
            repeatBtn.className = `repeat-button${this.isRepeat ? ' active' : ''}`;
            repeatBtn.textContent = this.isRepeat ? '🔁' : '↪️';
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

    toggleRepeat() {
        this.isRepeat = !this.isRepeat;
        this.updateMusicController();
    }

    addAlarm() {
        const timeInput = document.getElementById('alarmTime');
        const noteInput = document.getElementById('alarmNote');
        
        const time = new Date(timeInput.value);
        const note = noteInput.value.trim();
        
        if (!time || !note) {
            alert('Please set both time and note for the alarm');
            return;
        }

        const alarm = {
            id: Date.now(),
            time: time,
            note: note
        };

        this.alarms.push(alarm);
        this.saveAlarms();
        this.displayAlarms();
        this.setAlarmTimeout(alarm);

        // Clear inputs
        timeInput.value = '';
        noteInput.value = '';
    }

    showAlarmModal(note) {
        const modal = document.getElementById('alarmModal');
        const message = document.getElementById('alarmMessage');
        const dismissBtn = document.getElementById('alarmDismiss');
        
        if (!modal || !message || !dismissBtn) return;
        
        message.textContent = note;
        modal.style.display = 'flex';
        this.dismissCount = 0;
        dismissBtn.textContent = 'Got it!';

        // Start repeating speech
        this.currentAlarmInterval = setInterval(() => {
            this.speakAlarm(note);
        }, 5000); // Repeat every 5 seconds

        dismissBtn.onclick = () => {
            this.dismissCount++;
            if (this.dismissCount >= 2) {
                modal.style.display = 'none';
                this.dismissCount = 0;
                clearInterval(this.currentAlarmInterval);
                this.speechSynth.cancel(); // Stop any ongoing speech
                dismissBtn.textContent = 'Got it!';
            } else {
                dismissBtn.textContent = 'Click once more to dismiss';
            }
        };
    }

    setAlarmTimeout(alarm) {
        const now = new Date();
        const timeUntilAlarm = alarm.time - now;
        
        if (timeUntilAlarm > 0) {
            setTimeout(() => {
                const prefixedNote = "It is time to " + alarm.note;
                this.showAlarmModal(prefixedNote);
                this.deleteAlarm(alarm.id);
            }, timeUntilAlarm);
        }
    }

    speakAlarm(text) {
        // Cancel any ongoing speech
        this.speechSynth.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Check if text contains Chinese characters
        if (/[\u4e00-\u9fa5]/.test(text)) {
            utterance.lang = 'zh-CN';
            utterance.rate = 0.9; // Slightly slower rate for Chinese
        } else {
            utterance.lang = 'en-US';
            utterance.rate = 1.0;
        }
        
        this.speechSynth.speak(utterance);
    }

    displayAlarms() {
        const list = document.getElementById('alarmList');
        if (!list) return;
        
        list.innerHTML = '';
        this.alarms.sort((a, b) => a.time - b.time).forEach(alarm => {
            const div = document.createElement('div');
            div.className = 'alarm-item';
            div.innerHTML = `
                <span>${new Date(alarm.time).toLocaleString()} - ${alarm.note}</span>
                <button onclick="toolbar.deleteAlarm(${alarm.id})">×</button>
            `;
            list.appendChild(div);
        });
    }

    deleteAlarm(id) {
        this.alarms = this.alarms.filter(alarm => alarm.id !== id);
        this.saveAlarms();
        this.displayAlarms();
    }

    saveAlarms() {
        localStorage.setItem('alarms', JSON.stringify(this.alarms));
    }

    loadAlarms() {
        const savedAlarms = localStorage.getItem('alarms');
        if (savedAlarms) {
            this.alarms = JSON.parse(savedAlarms).map(alarm => ({
                ...alarm,
                time: new Date(alarm.time)
            }));
            this.alarms.forEach(alarm => this.setAlarmTimeout(alarm));
            this.displayAlarms();
        }
    }

    async loadMusicFiles() {
        try {
            // Scan for new music files
            await fetch('/api/music/scan');
            
            // Get updated music list
            const response = await fetch('/api/music');
            if (!response.ok) throw new Error('Failed to load music files');
            
            const files = await response.json();
            this.musicFiles = files;
            
            // Update music list display
            const musicList = document.getElementById('musicList');
            if (musicList) {
                musicList.innerHTML = '';
                files.forEach(file => {
                    const li = document.createElement('li');
                    li.textContent = file;
                    li.onclick = () => this.playMusic(file);
                    musicList.appendChild(li);
                });
            }
        } catch (error) {
            console.error('Error loading music files:', error);
        }
    }

    // Add new method for creating music count display
    createMusicCountDisplay() {
        const musicCountDiv = document.createElement('div');
        musicCountDiv.className = 'music-count';
        musicCountDiv.id = 'musicCount';
        musicCountDiv.style.cssText = `
            display: inline-block;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.6);
            margin-right: 5px;
            vertical-align: middle;
        `;
        
        // Insert count at the beginning of the controller
        const musicController = document.getElementById('musicController');
        if (musicController) {
            musicController.insertBefore(musicCountDiv, musicController.firstChild);
        }
    }

    // Add new method for updating music player style
    updateMusicPlayerStyle() {
        const musicController = document.getElementById('musicController');
        if (musicController) {
            musicController.style.cssText = `
                position: fixed;
                top: 10px;
                right: 50px;
                z-index: 99;
                display: flex;
                align-items: center;
                background: transparent;
                padding: 2px 5px;
                border-radius: 3px;
                font-size: 14px;
                gap: 5px;
                border: 1px solid rgba(255, 255, 255, 0.3);
            `;
        }

        // Ensure all control buttons are visible and styled properly
        const buttons = musicController.querySelectorAll('button');
        buttons.forEach(button => {
            button.style.cssText = `
                margin: 0 2px;
                cursor: pointer;
                background: none;
                border: none;
                padding: 2px 5px;
            `;
        });

        // Style for current music name
        const musicName = document.getElementById('currentMusicName');
        if (musicName) {
            musicName.style.cssText = `
                margin: 0 5px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 200px;
            `;
        }
    }
}

// Initialize toolbar
let toolbar;
document.addEventListener('DOMContentLoaded', () => {
    toolbar = new Toolbar();
}); 