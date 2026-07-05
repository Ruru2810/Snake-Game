/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Track {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  duration: number; // in seconds
  genre: string;
  energy: 'high' | 'low' | 'intense';
}

export const TRACKS: Track[] = [
  {
    id: 'cyber-pulse',
    title: 'Cyber Pulse',
    artist: 'Synthetic Intelligence',
    bpm: 128,
    duration: 120, // 2 minutes
    genre: 'Synthwave',
    energy: 'high',
  },
  {
    id: 'neon-void',
    title: 'Neon Void',
    artist: 'Quantum Core',
    bpm: 105,
    duration: 150, // 2.5 minutes
    genre: 'Ambient Synth',
    energy: 'low',
  },
  {
    id: 'glitch-symphony',
    title: 'Glitch Symphony',
    artist: 'Neural Mesh',
    bpm: 145,
    duration: 90, // 1.5 minutes
    genre: 'Chiptune / Cybercore',
    energy: 'intense',
  }
];

class AudioEngine {
  private ctx: AudioContext | null = null;
  private mainVolumeNode: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedbackNode: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  public analyser: AnalyserNode | null = null;

  // State variables
  private isPlaying: boolean = false;
  private currentTrackIndex: number = 0;
  private tempo: number = 120;
  private stepDuration: number = 0.125; // in seconds (for 16th note)
  private currentStep: number = 0;
  private nextNoteTime: number = 0.0;
  private lookAhead: number = 0.1; // 100ms
  private scheduleInterval: number = 30; // 30ms timer
  private timerId: any = null;
  
  // Track playback state
  private playbackStartTime: number = 0;
  private pausedTimeOffset: number = 0;
  private trackTimer: any = null;
  private trackElapsed: number = 0;

  // Callbacks
  private onTrackEndCallback: (() => void) | null = null;
  private onStateChangeCallback: (() => void) | null = null;

  constructor() {
    // Lazy initialisation on first user gesture
  }

  public init() {
    if (this.ctx) return;

    try {
      // Create context
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtxClass();
      
      // Main volume node
      this.mainVolumeNode = this.ctx.createGain();
      this.mainVolumeNode.gain.setValueAtTime(0.5, this.ctx.currentTime); // default volume 50%

      // Analyser for the visualizer
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64; // Small size for responsive, simple visualizer bars

      // Filter node
      this.filterNode = this.ctx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.setValueAtTime(1500, this.ctx.currentTime);

      // Delay effect for ambient cyber echoes
      this.delayNode = this.ctx.createDelay(1.0);
      this.delayFeedbackNode = this.ctx.createGain();
      
      this.delayNode.delayTime.setValueAtTime(0.35, this.ctx.currentTime);
      this.delayFeedbackNode.gain.setValueAtTime(0.3, this.ctx.currentTime);

      // Connections:
      // Synth nodes -> FilterNode -> MainVolumeNode -> Analyser -> Destination
      // Feed filter into delay node loop
      this.filterNode.connect(this.mainVolumeNode);
      this.mainVolumeNode.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      // Setup Delay Feedback loop
      this.filterNode.connect(this.delayNode);
      this.delayNode.connect(this.delayFeedbackNode);
      this.delayFeedbackNode.connect(this.delayNode); // feedback loop
      this.delayFeedbackNode.connect(this.mainVolumeNode); // output delay to main

    } catch (e) {
      console.error('Failed to initialize Web Audio API engine:', e);
    }
  }

  public setCallbacks(onTrackEnd: () => void, onStateChange: () => void) {
    this.onTrackEndCallback = onTrackEnd;
    this.onStateChangeCallback = onStateChange;
  }

  private notifyStateChange() {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback();
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getCurrentTrack(): Track {
    return TRACKS[this.currentTrackIndex];
  }

  public getCurrentTrackIndex(): number {
    return this.currentTrackIndex;
  }

  public getElapsedSeconds(): number {
    if (!this.isPlaying) return this.trackElapsed;
    if (!this.ctx) return 0;
    return this.trackElapsed + (this.ctx.currentTime - this.playbackStartTime);
  }

  public setVolume(vol: number) {
    this.init();
    if (!this.mainVolumeNode || !this.ctx) return;
    // vol is 0 to 1
    this.mainVolumeNode.gain.setValueAtTime(vol, this.ctx.currentTime);
  }

  public getVolume(): number {
    return this.mainVolumeNode ? this.mainVolumeNode.gain.value : 0.5;
  }

  // Play a specific track or toggle play
  public async play(trackIndex?: number) {
    this.init();
    if (!this.ctx) return;

    // Resume context if suspended (browser security policies)
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    if (trackIndex !== undefined && trackIndex !== this.currentTrackIndex) {
      this.stopSequencer();
      this.currentTrackIndex = trackIndex;
      this.trackElapsed = 0;
      this.pausedTimeOffset = 0;
    }

    if (this.isPlaying) {
      // Toggle play/pause if playing current track
      if (trackIndex === undefined || trackIndex === this.currentTrackIndex) {
        this.pause();
        return;
      }
    }

    this.isPlaying = true;
    const currentTrack = this.getCurrentTrack();
    this.tempo = currentTrack.bpm;
    this.stepDuration = 60.0 / this.tempo / 4; // 16th note

    this.playbackStartTime = this.ctx.currentTime;
    
    // Resume sequencer
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.startSequencer();

    // Track timer to watch duration and update progress
    this.startTrackProgressionWatcher();
    
    this.notifyStateChange();
  }

  public pause() {
    if (!this.isPlaying || !this.ctx) return;
    this.isPlaying = false;
    this.stopSequencer();
    
    // Save how long we played
    this.trackElapsed += (this.ctx.currentTime - this.playbackStartTime);
    
    this.stopTrackProgressionWatcher();
    this.notifyStateChange();
  }

  public skipNext() {
    const nextIndex = (this.currentTrackIndex + 1) % TRACKS.length;
    this.play(nextIndex);
  }

  public skipPrev() {
    const prevIndex = (this.currentTrackIndex - 1 + TRACKS.length) % TRACKS.length;
    this.play(prevIndex);
  }

  private startSequencer() {
    if (this.timerId) return;
    this.timerId = setInterval(() => this.scheduler(), this.scheduleInterval);
  }

  private stopSequencer() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private startTrackProgressionWatcher() {
    this.stopTrackProgressionWatcher();
    this.trackTimer = setInterval(() => {
      const elapsed = this.getElapsedSeconds();
      const duration = this.getCurrentTrack().duration;
      if (elapsed >= duration) {
        // Track completed! Go to next track
        this.stopTrackProgressionWatcher();
        this.stopSequencer();
        this.trackElapsed = 0;
        this.pausedTimeOffset = 0;
        
        if (this.onTrackEndCallback) {
          this.onTrackEndCallback();
        } else {
          this.skipNext();
        }
      } else {
        this.notifyStateChange();
      }
    }, 250); // check 4 times a second
  }

  private stopTrackProgressionWatcher() {
    if (this.trackTimer) {
      clearInterval(this.trackTimer);
      this.trackTimer = null;
    }
  }

  private scheduler() {
    if (!this.ctx) return;
    while (this.nextNoteTime < this.ctx.currentTime + this.lookAhead) {
      this.scheduleNote(this.currentStep, this.nextNoteTime);
      this.nextNote();
    }
  }

  private nextNote() {
    this.nextNoteTime += this.stepDuration;
    this.currentStep = (this.currentStep + 1) % 16; // 16 steps total
  }

  // Scheduling notes procedurally based on current track logic and step
  private scheduleNote(step: number, time: number) {
    if (!this.ctx || !this.filterNode) return;

    const track = this.getCurrentTrack();

    // 1. Kick Drum (rhythm engine)
    // Cyber Pulse and Glitch Symphony have heavy kicks. Neon Void has minimalist slow kicks.
    let playKick = false;
    if (track.energy === 'high') {
      // 4 on the floor: steps 0, 4, 8, 12
      playKick = step % 4 === 0;
    } else if (track.energy === 'intense') {
      // High energy chiptune beats: 0, 4, 6, 8, 12, 14
      playKick = (step % 4 === 0) || (step === 6) || (step === 14);
    } else if (track.energy === 'low') {
      // Ambient slow kick: only on step 0 and 8
      playKick = step === 0 || step === 8;
    }

    if (playKick) {
      this.triggerKick(time);
    }

    // 2. Hi-Hat (high metallic sound)
    let playHat = false;
    if (track.energy === 'high') {
      // Offbeat hihat: 2, 6, 10, 14
      playHat = step % 4 === 2;
    } else if (track.energy === 'intense') {
      // Rapid cyber hi-hat: every even step
      playHat = step % 2 === 0;
    } else if (track.energy === 'low') {
      // Airy slow hat: step 4 and 12
      playHat = step === 4 || step === 12;
    }

    if (playHat) {
      this.triggerHat(time, track.energy === 'low' ? 0.08 : 0.04);
    }

    // 3. Bassline / Melody
    this.triggerMelody(step, time, track);
  }

  private triggerKick(time: number) {
    if (!this.ctx || !this.filterNode) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.filterNode);

    // Kick Sweep: fast pitch descent
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.12);

    // Envelope
    gain.gain.setValueAtTime(0.4, time);
    gain.gain.linearRampToValueAtTime(0.001, time + 0.15);

    osc.start(time);
    osc.stop(time + 0.16);
  }

  private triggerHat(time: number, duration: number = 0.05) {
    if (!this.ctx || !this.filterNode) return;

    // Simple synthesized retro metal hat: very high sine wave with fast decay
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.filterNode);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(8500, time);

    // Dynamic metallic decay
    gain.gain.setValueAtTime(0.06, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.start(time);
    osc.stop(time + duration + 0.01);
  }

  private triggerMelody(step: number, time: number, track: Track) {
    if (!this.ctx || !this.filterNode) return;

    // Frequency map of retro synth frequencies
    const notes: Record<string, number> = {
      // Octave 2
      A2: 110.00, C3: 130.81, D3: 146.83, E3: 164.81, G3: 196.00,
      // Octave 3
      A3: 220.00, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.00,
      // Octave 4
      A4: 440.00, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.00
    };

    let bassNote: string | null = null;
    let melodyNote: string | null = null;
    let synthType: OscillatorType = 'triangle';
    let filterFreq = 1200;

    if (track.id === 'cyber-pulse') {
      // Key: A Minor (A, C, D, E, G)
      // Bass pattern
      const bassSequence = ['A2', 'A2', 'C3', 'A2', 'D3', 'A2', 'G3', 'E3', 'A2', 'A2', 'C3', 'A2', 'E3', 'E3', 'D3', 'C3'];
      bassNote = bassSequence[step];
      synthType = 'sawtooth';
      filterFreq = 800;

      // Melody pattern: play on specific steps for syncopation
      const melodySteps: Record<number, string> = {
        0: 'A4',
        3: 'C5',
        6: 'E5',
        8: 'G5',
        11: 'A5',
        14: 'E5'
      };
      if (melodySteps[step]) {
        melodyNote = melodySteps[step];
      }
    } else if (track.id === 'neon-void') {
      // Key: E Minor (E, G, A, B, D)
      // Slow pulsing bass: changes every 8 steps
      const bassSequence = ['E2', 'E2', 'E2', 'E2', 'G2', 'G2', 'G2', 'G2', 'A2', 'A2', 'A2', 'A2', 'D2', 'D2', 'D2', 'D2'];
      bassNote = bassSequence[Math.floor(step / 2) % 16];
      synthType = 'sine';
      filterFreq = 600;

      // Slow ambient melodies on selected beats
      const melodySteps: Record<number, string> = {
        2: 'E4',
        6: 'G4',
        10: 'B4',
        14: 'D5'
      };
      if (melodySteps[step] && Math.random() > 0.3) {
        melodyNote = melodySteps[step];
      }
    } else if (track.id === 'glitch-symphony') {
      // Key: D Minor (D, F, G, A, C)
      // High speed double-time bass
      const bassSequence = ['D3', 'D3', 'F3', 'D3', 'G3', 'D3', 'C3', 'A3'];
      bassNote = bassSequence[step % 8];
      synthType = 'square';
      filterFreq = 1400;

      // Rapid glitchy chiptune melody
      if (step % 2 === 0 && Math.random() > 0.2) {
        const melodyPool = ['D4', 'F4', 'G4', 'A4', 'C5', 'D5', 'F5', 'A5'];
        melodyNote = melodyPool[Math.floor(Math.random() * melodyPool.length)];
      }
    }

    // Play Bass Note
    if (bassNote && notes[bassNote]) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = synthType;
      osc.frequency.setValueAtTime(notes[bassNote], time);
      
      // Low pass filter envelope
      this.filterNode.frequency.setValueAtTime(filterFreq, time);
      this.filterNode.frequency.exponentialRampToValueAtTime(filterFreq * 0.4, time + this.stepDuration * 0.9);

      osc.connect(gain);
      gain.connect(this.filterNode);

      // Gain envelope
      gain.gain.setValueAtTime(0.12, time);
      gain.gain.linearRampToValueAtTime(0.001, time + this.stepDuration * 0.95);

      osc.start(time);
      osc.stop(time + this.stepDuration);
    }

    // Play Melody Lead
    if (melodyNote && notes[melodyNote]) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Lead style: square wave or triangle for neon brightness
      osc.type = track.id === 'glitch-symphony' ? 'square' : 'triangle';
      osc.frequency.setValueAtTime(notes[melodyNote], time);

      // Retro chiptune pitch glide effect for glitchy track
      if (track.id === 'glitch-symphony' && Math.random() > 0.5) {
        osc.frequency.exponentialRampToValueAtTime(notes[melodyNote] * 1.5, time + 0.1);
      }

      osc.connect(gain);
      gain.connect(this.filterNode);

      // Soft bright volume envelope
      gain.gain.setValueAtTime(0.07, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + this.stepDuration * 2); // longer ring for melody

      osc.start(time);
      osc.stop(time + this.stepDuration * 2);
    }
  }

  // --- INTERACTIVE GAME SFX ---

  public playEatSound() {
    this.init();
    if (!this.ctx) return;

    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    if (this.mainVolumeNode) {
      gain.connect(this.mainVolumeNode);
    } else {
      gain.connect(this.ctx.destination);
    }

    osc.type = 'square';
    
    // Quick retro chiptune double-tone (like arcade collection)
    osc.frequency.setValueAtTime(523.25, time); // C5
    osc.frequency.setValueAtTime(659.25, time + 0.06); // E5
    osc.frequency.setValueAtTime(783.99, time + 0.12); // G5
    osc.frequency.setValueAtTime(1046.50, time + 0.18); // C6

    gain.gain.setValueAtTime(0.15, time);
    gain.gain.linearRampToValueAtTime(0.001, time + 0.25);

    osc.start(time);
    osc.stop(time + 0.26);
  }

  public playGameOverSound() {
    this.init();
    if (!this.ctx) return;

    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    if (this.mainVolumeNode) {
      gain.connect(this.mainVolumeNode);
    } else {
      gain.connect(this.ctx.destination);
    }

    osc.type = 'sawtooth';
    
    // Low sliding down pitch sweep
    osc.frequency.setValueAtTime(300, time);
    osc.frequency.linearRampToValueAtTime(60, time + 0.6);

    gain.gain.setValueAtTime(0.2, time);
    gain.gain.linearRampToValueAtTime(0.001, time + 0.65);

    osc.start(time);
    osc.stop(time + 0.7);
  }
}

export const audioEngine = new AudioEngine();
