/* The Stunt Wheels soundtrack: original, hypnotic synth loops made live with Web Audio (no sound files).
   Every song is four bars round and round: a kick, hats and claps, a pumping bass, a bouncing arpeggio
   through an echo, and a soft pad, with a filter that slowly opens and closes over 16 bars so it keeps
   pulling you along. Each Stunt Wheels world has its own song (SONGS below). Plus the engine hum.
     const m = WheelsMusic()   m.start(), m.stop(), m.song(i) (0..4), m.engine(speed 0..1, on)   (start only after a tap or key)
   Race Off also uses: m.wake() (sound without the music), m.engine(speed, on, voice, throttle) with a voice per
   car, m.loop(name, volume) for steady noises (squeal, rain, boost) and m.sting() for a crash. */
(function(){
  "use strict";
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  // roots: the bass note of each bar (MIDI), chords: four notes per bar for the arpeggio and pad,
  // bass/arp: the 16-step patterns, kick/clap/hat: "x" marks a hit, sweep: the filter's lowest Hz and how far it opens
  const SONGS = [
    { name: "Starter Tracks: A minor, steady and bouncy", bpm: 126, roots: [45, 45, 41, 43],
      chords: [[69, 72, 76, 81], [69, 72, 76, 81], [65, 69, 72, 77], [67, 71, 74, 79]],
      bass: [0, 0, 12, 0, 7, 0, 12, 0, 0, 0, 12, 0, 7, 0, 10, 0], arp: [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 1, 3, 2],
      kick: "x...x...x...x...", clap: "....x.......x...", hat: "..x...x...x...x.", lead: "square", pad: "sawtooth", sweep: [700, 4800], echo: 3 },
    { name: "Desert Dash: a hot, snaky D with a hand-drum beat", bpm: 112, roots: [50, 51, 50, 48],
      chords: [[74, 78, 81, 86], [75, 79, 82, 87], [74, 78, 81, 86], [72, 76, 79, 84]],
      bass: [0, 0, 0, 12, 0, 0, 7, 0, 0, 0, 0, 12, 0, 1, 0, 0], arp: [0, 1, 2, 1, 3, 2, 1, 0, 0, 1, 2, 1, 3, 2, 3, 1],
      kick: "x..x..x...x..x..", clap: "....x.......x..x", hat: "x.xx.xx.x.xx.xx.", lead: "triangle", pad: "triangle", sweep: [900, 3200], echo: 3 },
    { name: "Neon Nights: E minor synthwave, big pads and octave bass", bpm: 104, roots: [40, 36, 43, 38],
      chords: [[71, 74, 79, 83], [72, 76, 79, 84], [71, 74, 79, 83], [69, 74, 78, 81]],
      bass: [0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 7, 12], arp: [0, 2, 1, 3, 0, 2, 1, 3, 0, 2, 1, 3, 2, 1, 3, 0],
      kick: "x...x...x...x...", clap: "....x.......x...", hat: "x.x.x.x.x.x.x.x.", lead: "sawtooth", pad: "sawtooth", sweep: [500, 3800], echo: 4 },
    { name: "Volcano Valley: a fast, heavy C minor rumble", bpm: 142, roots: [48, 48, 44, 46],
      chords: [[72, 75, 79, 84], [72, 75, 79, 84], [68, 72, 75, 80], [70, 74, 77, 82]],
      bass: [0, 0, 0, 0, 12, 0, 0, 0, 0, 0, 3, 0, 12, 0, 5, 0], arp: [0, 0, 2, 0, 1, 0, 3, 0, 0, 0, 2, 0, 3, 2, 1, 0],
      kick: "x...x...x...x.x.", clap: "....x.......x...", hat: "..x...x...x...xx", lead: "square", pad: "sawtooth", sweep: [400, 2600], echo: 3 },
    { name: "Frozen Space: a slow, sparkly B minor drift", bpm: 96, roots: [47, 43, 50, 45],
      chords: [[83, 86, 90, 95], [79, 83, 86, 91], [86, 90, 93, 98], [81, 85, 88, 93]],
      bass: [0, 0, 0, 0, 0, 0, 12, 0, 0, 0, 0, 0, 7, 0, 0, 0], arp: [0, 2, 3, 1, 2, 0, 3, 2, 1, 3, 0, 2, 3, 1, 2, 0],
      kick: "x.......x.......", clap: "........x.......", hat: "..x...x...x...x.", lead: "sine", pad: "triangle", sweep: [1200, 4200], echo: 6 }
  ];
  const stepOf = S => 60 / S.bpm / 4;

  // steady noises: filtered noise that fades in and out
  const LOOPS = { squeal: { type: "bandpass", f: 2900, q: 14 }, rain: { type: "highpass", f: 1500, q: 0.4 }, boost: { type: "bandpass", f: 520, q: 1.2 } };

  window.WheelsMusic = function(){
    const loops = {};
    let ac = null, master = null, sweep = null, delay = null, timer = 0, next = 0, step = 0, noise = null, eng = null, S = SONGS[0];
    function setup(){
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ac = new AC();
      const comp = ac.createDynamicsCompressor();
      master = ac.createGain(); master.gain.value = 0.55;
      sweep = ac.createBiquadFilter(); sweep.type = "lowpass"; sweep.frequency.value = 2400; sweep.Q.value = 4;
      master.connect(comp); comp.connect(ac.destination);
      const n = ac.sampleRate, buf = ac.createBuffer(1, n, n), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      noise = buf;
      // the echo the arpeggio goes through: three steps late, fading
      delay = ac.createDelay(1); delay.delayTime.value = stepOf(S) * S.echo;
      const fb = ac.createGain(); fb.gain.value = 0.38;
      sweep.connect(master); sweep.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(master);
      return true;
    }
    function tone(type, freq, t, dur, vol, dest, attack){
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (attack || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + dur + 0.02);
      return o;
    }
    function hiss(t, dur, vol, type, freq){
      const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noise; f.type = type; f.frequency.value = freq;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur);
    }
    function kick(t){
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.22);
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.32);
    }
    function schedule(){
      while (next < ac.currentTime + 0.15) {
        const t = next, s = step % 16, bar = Math.floor(step / 16) % 4, root = S.roots[bar], chord = S.chords[bar], STEP = stepOf(S);
        if (S.kick[s] === "x") kick(t);
        if (S.hat[s] === "x") hiss(t, 0.05, 0.12, "highpass", 7500);
        if (S.clap[s] === "x") hiss(t, 0.16, 0.22, "bandpass", 1600);
        if (s % 2 === 1) hiss(t, 0.025, 0.04, "highpass", 9000);
        // the bass, ducking under the kick for that pumping feel
        const bf = ac.createBiquadFilter(); bf.type = "lowpass"; bf.frequency.value = 520; bf.connect(master);
        tone("sawtooth", midi(root + S.bass[s] - 12), t + (S.kick[s] === "x" ? 0.03 : 0), STEP * 0.9, S.kick[s] === "x" ? 0.16 : 0.24, bf);
        // the arpeggio into the slowly sweeping filter
        tone(S.lead, midi(chord[S.arp[s]]), t, STEP * 0.8, S.lead === "sine" || S.lead === "triangle" ? 0.09 : 0.05, sweep);
        // a soft pad on the first step of each bar
        if (s === 0) chord.slice(0, 3).forEach(n => { tone(S.pad, midi(n - 12) * 1.003, t, STEP * 15, 0.022, sweep, 0.4); tone(S.pad, midi(n - 12) * 0.997, t, STEP * 15, 0.022, sweep, 0.4); });
        // over 16 bars the filter opens wide and closes again
        const phase = (step % 256) / 256;
        sweep.frequency.setValueAtTime(S.sweep[0] + S.sweep[1] * (0.5 - 0.5 * Math.cos(phase * Math.PI * 2)), t);
        next += STEP; step++;
      }
    }
    return {
      start(){
        if (!ac && !setup()) return;
        if (ac.state === "suspended") ac.resume();
        if (timer) return;
        next = ac.currentTime + 0.08;
        timer = setInterval(schedule, 25);
      },
      // pick the song (one per Stunt Wheels world); a new song starts from its first bar
      song(i){
        const pick = SONGS[i] || SONGS[0];
        if (pick === S) return;
        S = pick; step = 0;
        if (delay) delay.delayTime.setValueAtTime(stepOf(S) * S.echo, ac.currentTime);
      },
      stop(){
        if (timer) { clearInterval(timer); timer = 0; }
        if (eng) { eng.g.gain.setTargetAtTime(0, ac.currentTime, 0.05); }
        Object.keys(loops).forEach(k => loops[k].setTargetAtTime(0, ac.currentTime, 0.05));
      },
      // the music stays off, but the engine and the noises can play
      wake(){
        if (!ac && !setup()) return false;
        if (ac.state === "suspended") ac.resume();
        return true;
      },
      loop(name, vol){
        if (!ac || !LOOPS[name]) return;
        if (!loops[name]) {
          const c = LOOPS[name], src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
          src.buffer = noise; src.loop = true; f.type = c.type; f.frequency.value = c.f; f.Q.value = c.q; g.gain.value = 0;
          src.connect(f); f.connect(g); g.connect(ac.destination); src.start();
          loops[name] = g.gain;
        }
        loops[name].setTargetAtTime(vol, ac.currentTime, 0.06);
      },
      // a crash: a falling growl and a crunch
      sting(){
        if (!ac) return;
        const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
        o.type = "sawtooth"; o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.7);
        g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
        o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.8);
        const src = ac.createBufferSource(), f = ac.createBiquadFilter(), ng = ac.createGain();
        src.buffer = noise; f.type = "lowpass"; f.frequency.value = 900; ng.gain.setValueAtTime(0.5, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
        src.connect(f); f.connect(ng); ng.connect(ac.destination); src.start(t); src.stop(t + 0.5);
      },
      // the engine: a low growl that rises with speed
      // voice: { base, span, type } (Hz at rest, Hz added at top speed, wave); throttle 0..1 revs it up
      engine(speed, on, voice, throttle){
        if (!ac) return;
        const v = voice || { base: 48, span: 140, type: "sawtooth" }, th = throttle || 0;
        if (!eng) {
          const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
          o.type = "sawtooth"; f.type = "lowpass"; f.frequency.value = 600; g.gain.value = 0;
          o.connect(f); f.connect(g); g.connect(ac.destination); o.start();
          eng = { o, f, g };
        }
        if (eng.o.type !== v.type) eng.o.type = v.type;
        const t = ac.currentTime;
        eng.o.frequency.setTargetAtTime((v.base + speed * v.span) * (1 + 0.14 * th), t, 0.08);
        eng.f.frequency.setTargetAtTime(380 + speed * 900 + th * 300, t, 0.1);
        eng.g.gain.setTargetAtTime(on ? 0.035 + speed * 0.03 + th * 0.012 : 0, t, 0.08);
      }
    };
  };
})();
