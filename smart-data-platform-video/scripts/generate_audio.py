"""Synthesises the soundtrack and sound effects used by the video.

Everything is generated from scratch (no samples), so the audio is royalty free.
Run from the project root:  python3 scripts/generate_audio.py
Requires numpy and scipy.
"""
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, lfilter, sosfilt

SR = 44100
BPM = 120
BEAT = 60 / BPM  # 0.5 s = 15 video frames at 30 fps
BAR = BEAT * 4
DURATION = 45.0
OUT = Path(__file__).resolve().parent.parent / "public" / "audio"
rng = np.random.default_rng(7)


def t_axis(sec):
    return np.arange(int(sec * SR)) / SR


def lowpass(x, cutoff, order=2):
    return sosfilt(butter(order, cutoff, "low", fs=SR, output="sos"), x)


def highpass(x, cutoff, order=2):
    return sosfilt(butter(order, cutoff, "high", fs=SR, output="sos"), x)


def bandpass(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def note_hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def saw(freq, t):
    return 2 * ((freq * t) % 1.0) - 1


def add(buf, sig, start):
    i = int(start * SR)
    if i >= len(buf):
        return
    end = min(len(buf), i + len(sig))
    buf[i:end] += sig[: end - i]


# ---------------------------------------------------------------- instruments
def kick():
    t = t_axis(0.45)
    freq = 45 + 110 * np.exp(-t * 28)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    body = np.sin(phase) * np.exp(-t * 7)
    click = highpass(rng.standard_normal(len(t)), 2000) * np.exp(-t * 300) * 0.3
    return np.tanh((body + click) * 1.6) * 0.95


def clap():
    t = t_axis(0.3)
    noise = bandpass(rng.standard_normal(len(t)), 900, 5000)
    env = np.exp(-t * 18)
    for d in (0.0, 0.012, 0.024):  # a few quick re-triggers make it sound like a clap
        env += np.where(t >= d, np.exp(-(t - d) * 90), 0) * 0.6
    return noise * env * 0.35


def hat(open_=False):
    t = t_axis(0.25 if open_ else 0.06)
    noise = highpass(rng.standard_normal(len(t)), 7000)
    return noise * np.exp(-t * (14 if open_ else 70)) * (0.16 if open_ else 0.12)


def pluck(midi, length=0.22):
    t = t_axis(length)
    f = note_hz(midi)
    sig = saw(f, t) * 0.6 + np.sign(np.sin(2 * np.pi * f * 2 * t)) * 0.2
    sig = lowpass(sig, 3200)
    return sig * np.exp(-t * 16) * 0.22


def bass(midi, length):
    t = t_axis(length)
    f = note_hz(midi)
    sig = saw(f, t) * 0.7 + np.sin(2 * np.pi * f / 2 * t) * 0.6
    sig = lowpass(sig, 420)
    env = np.minimum(1, t / 0.005) * np.exp(-t * 3)
    return np.tanh(sig * env * 1.4) * 0.34


def pad(midis, length):
    t = t_axis(length)
    sig = np.zeros_like(t)
    for m in midis:
        for det in (-0.12, 0.0, 0.13):
            sig += saw(note_hz(m + det), t + rng.random())
    sig = lowpass(sig / (len(midis) * 3), 1400)
    env = np.minimum(1, t / 0.25) * np.minimum(1, (length - t) / 0.3)
    return sig * env * 0.32


# A minor: Am - F - C - G
CHORDS = [
    (45, [57, 60, 64]),  # Am
    (41, [53, 57, 60]),  # F
    (48, [55, 60, 64]),  # C
    (43, [55, 59, 62]),  # G
]
ARP_PATTERN = [0, 1, 2, 1, 2, 3, 2, 1]


def build_music():
    n = int(DURATION * SR)
    drums = np.zeros(n)
    bassline = np.zeros(n)
    pads = np.zeros(n)
    arps = np.zeros(n)

    k, c, h, ho = kick(), clap(), hat(), hat(True)
    groove_start, groove_end = BAR * 1, BAR * 21  # 2 s .. 42 s
    n_bars = int(np.ceil(DURATION / BAR))

    for bar in range(n_bars):
        t0 = bar * BAR
        root, chord = CHORDS[bar % 4]
        pads_len = BAR
        if t0 < groove_end:
            add(pads, pad(chord + [chord[0] + 12], pads_len + 0.3), t0)
        in_groove = groove_start <= t0 < groove_end
        # Arpeggio in 16ths (filtered during intro/outro)
        if t0 < groove_end:
            tones = chord + [chord[0] + 12]
            for i in range(16):
                m = tones[ARP_PATTERN[i % 8] % len(tones)] + 12
                add(arps, pluck(m) * (1.0 if in_groove else 0.55), t0 + i * BEAT / 4)
        if not in_groove:
            continue
        fill = bar % 8 == 7
        for beat in range(4):
            tb = t0 + beat * BEAT
            add(drums, k, tb)
            if beat in (1, 3):
                add(drums, c, tb)
            add(drums, ho if beat == 3 and bar % 2 else h, tb + BEAT / 2)
            add(drums, h * 0.5, tb + BEAT / 4)
            add(drums, h * 0.5, tb + 3 * BEAT / 4)
            # Offbeat bass (pumping 8ths)
            add(bassline, bass(root, BEAT / 2 - 0.02), tb + BEAT / 2)
            add(bassline, bass(root + 12 if beat == 3 else root, BEAT / 2 - 0.02) * 0.7, tb)
        if fill:
            for i in range(4):
                add(drums, c * (0.5 + i * 0.15), t0 + 3 * BEAT + i * BEAT / 4)

    # Sidechain pump on pads/bass/arps following the kick
    t = np.arange(n) / SR
    pump = np.ones(n)
    in_groove = (t >= groove_start) & (t < groove_end)
    phase = (t % BEAT) / BEAT
    pump[in_groove] = 0.35 + 0.65 * np.minimum(1, phase[in_groove] / 0.45)

    # Intro filter sweep on the arp
    arps = np.where(t < groove_start, lowpass(arps, 900), arps)

    mix = drums * 0.9 + bassline * pump + pads * pump * 0.9 + arps * pump * 0.8
    # Final hit on the outro chord
    add(mix, kick() * 1.1, groove_end)
    add(mix, pad([45, 57, 60, 64, 69], DURATION - groove_end) * 1.4, groove_end)

    # Fade out the tail
    fade = np.clip((DURATION - t) / 2.5, 0, 1)
    mix *= fade
    mix = np.tanh(mix * 1.1)
    return normalize(mix, 0.85)


# ---------------------------------------------------------------------- SFX
def whoosh(length=0.7):
    t = t_axis(length)
    noise = rng.standard_normal(len(t))
    # Sweep the band upwards by filtering in short chunks
    out = np.zeros_like(noise)
    chunk = 512
    for i in range(0, len(noise), chunk):
        p = i / len(noise)
        centre = 400 + 5000 * p
        seg = noise[max(0, i - chunk) : i + chunk]
        out[i : i + chunk] = bandpass(seg, centre * 0.6, min(centre * 1.6, SR / 2 - 100))[-len(noise[i : i + chunk]) :]
    env = np.sin(np.pi * np.clip(t / length, 0, 1)) ** 2
    return normalize(out * env, 0.7)


def click_sfx():
    t = t_axis(0.06)
    s = np.sin(2 * np.pi * 2200 * t) * np.exp(-t * 90) + highpass(rng.standard_normal(len(t)), 3000) * np.exp(-t * 400) * 0.6
    return normalize(s, 0.8)


def typing_sfx(length=3.0):
    buf = np.zeros(int(length * SR))
    pos = 0.0
    while pos < length - 0.05:
        t = t_axis(0.035)
        f = 1800 + rng.random() * 1600
        s = highpass(rng.standard_normal(len(t)), f) * np.exp(-t * 180) * (0.5 + rng.random() * 0.5)
        add(buf, s, pos)
        pos += 0.055 + rng.random() * 0.05
    return normalize(buf, 0.6)


def pop_sfx():
    t = t_axis(0.15)
    f = 500 + 700 * (1 - np.exp(-t * 40))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 25)
    return normalize(s, 0.7)


def ding_sfx():
    t = t_axis(1.0)
    s = (np.sin(2 * np.pi * 1318.5 * t) + 0.6 * np.sin(2 * np.pi * 1975.5 * t) + 0.3 * np.sin(2 * np.pi * 2637 * t)) * np.exp(-t * 5)
    s[: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
    return normalize(s, 0.55)


def impact_sfx():
    t = t_axis(2.0)
    boom = np.sin(2 * np.pi * np.cumsum(38 + 80 * np.exp(-t * 12)) / SR) * np.exp(-t * 2.2)
    crash = lowpass(highpass(rng.standard_normal(len(t)), 2500), 12000) * np.exp(-t * 3.5) * 0.35
    return normalize(np.tanh((boom + crash) * 1.5), 0.9)


def riser_sfx(length=1.3):
    t = t_axis(length)
    noise = rng.standard_normal(len(t))
    p = t / length
    s = highpass(noise, 1500) * p ** 2 * 0.6 + np.sin(2 * np.pi * np.cumsum(200 + 1400 * p ** 2) / SR) * p ** 2 * 0.4
    return normalize(s, 0.7)


def normalize(x, peak):
    m = np.max(np.abs(x))
    return x if m == 0 else x / m * peak


def save(name, mono):
    stereo = np.stack([mono, mono], axis=1)
    wavfile.write(OUT / name, SR, (stereo * 32767).astype(np.int16))
    print(f"{name}: {len(mono) / SR:.2f}s")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    save("music.wav", build_music())
    save("whoosh.wav", whoosh())
    save("click.wav", click_sfx())
    save("typing.wav", typing_sfx())
    save("pop.wav", pop_sfx())
    save("ding.wav", ding_sfx())
    save("impact.wav", impact_sfx())
    save("riser.wav", riser_sfx())
