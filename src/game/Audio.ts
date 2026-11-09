export class GameAudio {
  private context?: AudioContext;
  muted = false;
  start() {
    this.context ??= new AudioContext();
    void this.context.resume();
  }
  play(kind: string) {
    if (!this.context || this.muted) return;
    const notes: Record<string, number[]> = { plant: [330, 494], water: [630, 480, 780], harvest: [523, 659, 784], deliver: [392, 523, 784], won: [523, 659, 784, 1047], drought: [220, 196, 220], lost: [330, 247, 196] };
    notes.till = [190, 130]; notes.clear = [520, 690];
    (notes[kind] ?? [440]).forEach((freq, i) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      const time = this.context!.currentTime + i * 0.085;
      oscillator.type = kind === 'water' ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(0.055, time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
      oscillator.connect(gain); gain.connect(this.context!.destination);
      oscillator.start(time); oscillator.stop(time + 0.2);
    });
  }
}
