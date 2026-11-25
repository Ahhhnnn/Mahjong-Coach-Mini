#!/usr/bin/env python3
"""
Procedural audio synthesizer for Mahjong Coach Showcase Video.
Generates a warm, upbeat pentatonic modern-guofeng BGM + 7 tactile SFX WAVs.
Zero external dependencies (Python stdlib only).
"""

import math
import os
import random
import struct
import wave

SAMPLE_RATE = 48000
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "audio")
os.makedirs(OUT_DIR, exist_ok=True)


def write_wav_stereo(path: str, left: list[float], right: list[float]) -> None:
    n = min(len(left), len(right))
    buf = bytearray(n * 4)
    for i in range(n):
        l = max(-1.0, min(1.0, math.tanh(left[i])))
        r = max(-1.0, min(1.0, math.tanh(right[i])))
        struct.pack_into("<hh", buf, i * 4, int(l * 32000), int(r * 32000))
    with wave.open(path, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(buf)


def midi_to_hz(midi: float) -> float:
    return 440.0 * (2.0 ** ((midi - 69.0) / 12.0))


def add_pluck(
    left: list[float],
    right: list[float],
    start_s: float,
    midi: float,
    dur_s: float,
    amp: float,
    pan: float = 0.0,
    bright: float = 1.0,
) -> None:
    """Warm bamboo-marimba / guzheng inspired pluck."""
    freq = midi_to_hz(midi)
    start_i = int(start_s * SAMPLE_RATE)
    n = int(dur_s * SAMPLE_RATE)
    end_i = min(len(left), start_i + n)
    if start_i >= len(left):
        return
    gain_l = amp * math.cos((pan + 1.0) * math.pi / 4.0)
    gain_r = amp * math.sin((pan + 1.0) * math.pi / 4.0)
    two_pi_f = 2.0 * math.pi * freq
    for i in range(start_i, end_i):
        t = (i - start_i) / SAMPLE_RATE
        attack = min(1.0, t / 0.004)
        env1 = math.exp(-t * 5.2)
        env2 = math.exp(-t * 11.0)
        env3 = math.exp(-t * 22.0)
        sig = (
            math.sin(two_pi_f * t) * env1
            + 0.36 * bright * math.sin(2.0 * two_pi_f * t) * env2
            + 0.14 * bright * math.sin(3.0 * two_pi_f * t) * env3
            + 0.06 * bright * math.sin(4.0 * two_pi_f * t) * env3
        ) * attack
        left[i] += sig * gain_l
        right[i] += sig * gain_r


def add_pad_chord(
    left: list[float],
    right: list[float],
    start_s: float,
    midis: list[float],
    dur_s: float,
    amp: float,
) -> None:
    """Warm electric-piano / felt pad chord with subtle stereo chorus."""
    start_i = int(start_s * SAMPLE_RATE)
    n = int(dur_s * SAMPLE_RATE)
    end_i = min(len(left), start_i + n)
    if start_i >= len(left):
        return
    freqs = [midi_to_hz(m) for m in midis]
    inv_cnt = 1.0 / max(1, len(freqs))
    for i in range(start_i, end_i):
        t = (i - start_i) / SAMPLE_RATE
        atk = min(1.0, t / 0.14)
        rel = min(1.0, max(0.0, (dur_s - t) / 0.25))
        decay = 0.65 + 0.35 * math.exp(-t * 1.4)
        env = atk * rel * decay * amp * inv_cnt
        sl = 0.0
        sr = 0.0
        for idx, f in enumerate(freqs):
            det = 1.0018 if idx % 2 == 0 else 0.9982
            w = 2.0 * math.pi * f * t
            sl += math.sin(w) + 0.16 * math.sin(2.0 * w)
            sr += math.sin(w * det) + 0.16 * math.sin(2.0 * w * det)
        left[i] += sl * env
        right[i] += sr * env


def add_bass(
    left: list[float],
    right: list[float],
    start_s: float,
    midi: float,
    dur_s: float,
    amp: float,
) -> None:
    freq = midi_to_hz(midi)
    start_i = int(start_s * SAMPLE_RATE)
    n = int(dur_s * SAMPLE_RATE)
    end_i = min(len(left), start_i + n)
    two_pi_f = 2.0 * math.pi * freq
    for i in range(start_i, end_i):
        t = (i - start_i) / SAMPLE_RATE
        atk = min(1.0, t / 0.02)
        rel = min(1.0, max(0.0, (dur_s - t) / 0.08))
        env = atk * rel * math.exp(-t * 1.8) * amp
        sig = (math.sin(two_pi_f * t) + 0.22 * math.sin(2.0 * two_pi_f * t)) * env
        left[i] += sig
        right[i] += sig


def add_kick(left: list[float], right: list[float], start_s: float, amp: float) -> None:
    start_i = int(start_s * SAMPLE_RATE)
    dur_s = 0.22
    end_i = min(len(left), start_i + int(dur_s * SAMPLE_RATE))
    phase = 0.0
    for i in range(start_i, end_i):
        t = (i - start_i) / SAMPLE_RATE
        f = 44.0 + 72.0 * math.exp(-t * 28.0)
        phase += 2.0 * math.pi * f / SAMPLE_RATE
        env = math.exp(-t * 14.0) * min(1.0, t / 0.003)
        sig = math.sin(phase) * env * amp
        left[i] += sig
        right[i] += sig


def add_wood_rim(left: list[float], right: list[float], start_s: float, amp: float, pan: float = 0.1) -> None:
    """Crisp bamboo/mahjong wooden rim click."""
    start_i = int(start_s * SAMPLE_RATE)
    dur_s = 0.055
    end_i = min(len(left), start_i + int(dur_s * SAMPLE_RATE))
    gl = amp * math.cos((pan + 1.0) * math.pi / 4.0)
    gr = amp * math.sin((pan + 1.0) * math.pi / 4.0)
    for i in range(start_i, end_i):
        t = (i - start_i) / SAMPLE_RATE
        env = math.exp(-t * 75.0)
        sig = (
            math.sin(2.0 * math.pi * 1280.0 * t)
            + 0.55 * math.sin(2.0 * math.pi * 2460.0 * t)
            + 0.25 * math.sin(2.0 * math.pi * 3820.0 * t)
        ) * env
        left[i] += sig * gl
        right[i] += sig * gr


def add_shaker(left: list[float], right: list[float], start_s: float, amp: float, rng: random.Random) -> None:
    start_i = int(start_s * SAMPLE_RATE)
    dur_s = 0.045
    end_i = min(len(left), start_i + int(dur_s * SAMPLE_RATE))
    prev = 0.0
    for i in range(start_i, end_i):
        t = (i - start_i) / SAMPLE_RATE
        n_val = rng.uniform(-1.0, 1.0)
        hp = n_val - 0.85 * prev
        prev = n_val
        env = math.sin(min(1.0, t / dur_s) * math.pi) * math.exp(-t * 40.0)
        sig = hp * env * amp
        left[i] += sig * 0.9
        right[i] += sig * 1.1


def apply_stereo_delay(left: list[float], right: list[float], delay_s: float, feedback: float, mix: float) -> None:
    d_l = int(delay_s * SAMPLE_RATE)
    d_r = int(delay_s * 1.33 * SAMPLE_RATE)
    n = len(left)
    buf_l = [0.0] * n
    buf_r = [0.0] * n
    for i in range(n):
        dl = buf_l[i - d_l] if i >= d_l else 0.0
        dr = buf_r[i - d_r] if i >= d_r else 0.0
        buf_l[i] = left[i] + dr * feedback
        buf_r[i] = right[i] + dl * feedback
        left[i] = left[i] * (1.0 - mix) + buf_l[i] * mix
        right[i] = right[i] * (1.0 - mix) + buf_r[i] * mix


def generate_bgm() -> None:
    dur_s = 54.0
    n = int(dur_s * SAMPLE_RATE)
    left = [0.0] * n
    right = [0.0] * n
    rng = random.Random(42)

    bpm = 112.0
    beat = 60.0 / bpm
    bar = beat * 4.0
    total_bars = int(dur_s / bar) + 1

    # C major pentatonic warm progression: Fmaj9 -> G6 -> Em7 -> Am9
    chords = [
        ([53, 57, 60, 64, 67], 41),  # Fmaj9, F2
        ([55, 62, 64, 67, 69], 43),  # G6add9, G2
        ([52, 55, 60, 62, 67], 40),  # Em7/sus, E2
        ([57, 60, 64, 67, 72], 45),  # Am7, A2
    ]

    # Tasteful pentatonic melody motifs (step in 8th notes, midi note, velocity)
    motif_a = [
        (0, 76, 0.20), (1.5, 79, 0.17), (3, 76, 0.18), (4, 72, 0.20), (6, 74, 0.16),
    ]
    motif_b = [
        (0, 79, 0.21), (1.5, 81, 0.18), (3, 79, 0.17), (4, 76, 0.20), (5.5, 74, 0.16), (6.5, 72, 0.15),
    ]
    motif_c = [
        (0, 76, 0.19), (2, 74, 0.17), (3, 72, 0.19), (4.5, 74, 0.16), (6, 76, 0.18),
    ]
    motif_d = [
        (0, 72, 0.20), (1.5, 76, 0.18), (3, 79, 0.21), (5, 76, 0.17), (6.5, 74, 0.14),
    ]
    motifs = [motif_a, motif_b, motif_c, motif_d]

    mel_l = [0.0] * n
    mel_r = [0.0] * n

    for b in range(total_bars):
        t0 = b * bar
        if t0 >= dur_s - 1.5:
            break
        chord_notes, bass_note = chords[b % 4]
        is_intro = b < 2
        is_outro = t0 > 46.5

        # Warm electric piano pad
        add_pad_chord(left, right, t0, chord_notes, bar * 1.02, 0.24 if not is_outro else 0.18)

        # Gentle bass
        if not is_intro:
            add_bass(left, right, t0, bass_note, beat * 2.2, 0.22 if not is_outro else 0.14)
            add_bass(left, right, t0 + beat * 2.5, bass_note + 7, beat * 1.4, 0.15 if not is_outro else 0.09)

        # Crisp modern groove percussion (skip intro bar 0 and outro tail)
        if b >= 1 and not is_outro:
            add_kick(left, right, t0, 0.26)
            add_kick(left, right, t0 + beat * 2.5, 0.20)
            add_wood_rim(left, right, t0 + beat * 1.0, 0.12, pan=-0.22)
            add_wood_rim(left, right, t0 + beat * 3.0, 0.13, pan=0.22)
            for s in range(8):
                sh_amp = 0.032 if s % 2 == 0 else 0.018
                add_shaker(left, right, t0 + s * (beat * 0.5), sh_amp, rng)

        # Pentatonic bamboo-marimba melody
        if not is_outro:
            m_seq = motifs[b % 4]
            # Slight octave lift during peak scenes (Scenes 4-5)
            lift = 12 if (10 <= b <= 18 and b % 2 == 1) else 0
            for idx, (step8, midi_n, vel) in enumerate(m_seq):
                if is_intro and idx > 2:
                    continue
                pan = -0.35 if idx % 2 == 0 else 0.35
                add_pluck(
                    mel_l,
                    mel_r,
                    t0 + step8 * (beat * 0.5),
                    midi_n + lift,
                    0.85,
                    vel * (0.78 if is_intro else 1.0),
                    pan=pan,
                    bright=0.95,
                )
        else:
            # Gentle resolution arpeggio on outro
            for idx, m in enumerate([60, 64, 67, 72, 76]):
                add_pluck(mel_l, mel_r, t0 + idx * (beat * 0.5), m, 1.4, 0.13, pan=(idx - 2) * 0.22, bright=0.75)

    # Add spacious ping-pong delay to melody bus before summing
    apply_stereo_delay(mel_l, mel_r, delay_s=beat * 0.75, feedback=0.28, mix=0.26)
    for i in range(n):
        left[i] += mel_l[i]
        right[i] += mel_r[i]

    # Smooth fade in (0.8s) and fade out (3.2s)
    fi = int(0.8 * SAMPLE_RATE)
    fo = int(3.2 * SAMPLE_RATE)
    for i in range(fi):
        g = i / fi
        left[i] *= g
        right[i] *= g
    for i in range(fo):
        idx = n - 1 - i
        g = (i / fo) ** 1.4
        left[idx] *= g
        right[idx] *= g

    write_wav_stereo(os.path.join(OUT_DIR, "bgm.wav"), left, right)
    print("[audio] generated bgm.wav")


def generate_sfx_shuffle() -> None:
    dur_s = 1.4
    n = int(dur_s * SAMPLE_RATE)
    left = [0.0] * n
    right = [0.0] * n
    rng = random.Random(101)

    # 11 staggered mahjong tile rack/clack transients
    hits = [0.05, 0.13, 0.21, 0.28, 0.36, 0.45, 0.54, 0.65, 0.76, 0.89, 1.04]
    for idx, t0 in enumerate(hits):
        start_i = int(t0 * SAMPLE_RATE)
        hit_n = int(0.055 * SAMPLE_RATE)
        pan = -0.55 + (idx / max(1, len(hits) - 1)) * 1.1
        gl = math.cos((pan + 1.0) * math.pi / 4.0)
        gr = math.sin((pan + 1.0) * math.pi / 4.0)
        f1 = 1750.0 + rng.uniform(-160, 220)
        f2 = 3350.0 + rng.uniform(-250, 320)
        amp = 0.34 + 0.12 * (idx / len(hits))
        for j in range(min(hit_n, n - start_i)):
            t = j / SAMPLE_RATE
            env = math.exp(-t * 95.0)
            click = (
                0.55 * math.sin(2.0 * math.pi * f1 * t)
                + 0.35 * math.sin(2.0 * math.pi * f2 * t)
                + 0.45 * rng.uniform(-1.0, 1.0) * math.exp(-t * 220.0)
            ) * env * amp
            left[start_i + j] += click * gl
            right[start_i + j] += click * gr

    write_wav_stereo(os.path.join(OUT_DIR, "sfx-shuffle.wav"), left, right)
    print("[audio] generated sfx-shuffle.wav")


def generate_sfx_discard() -> None:
    """Tactile Mahjong tile discard clack + felt table thud."""
    dur_s = 0.32
    n = int(dur_s * SAMPLE_RATE)
    left = [0.0] * n
    right = [0.0] * n
    rng = random.Random(202)
    phase_low = 0.0
    for i in range(n):
        t = i / SAMPLE_RATE
        # Sharp ivory/bamboo click
        clack = (
            0.55 * math.sin(2.0 * math.pi * 2180.0 * t)
            + 0.35 * math.sin(2.0 * math.pi * 3920.0 * t)
            + 0.50 * rng.uniform(-1.0, 1.0) * math.exp(-t * 260.0)
        ) * math.exp(-t * 88.0)
        # Table felt thump
        f_low = 120.0 + 75.0 * math.exp(-t * 50.0)
        phase_low += 2.0 * math.pi * f_low / SAMPLE_RATE
        thud = 0.48 * math.sin(phase_low) * math.exp(-t * 26.0)
        sig = (clack + thud) * 0.72
        left[i] = sig * 0.96
        right[i] = sig * 1.04
    write_wav_stereo(os.path.join(OUT_DIR, "sfx-discard.wav"), left, right)
    print("[audio] generated sfx-discard.wav")


def generate_sfx_pop() -> None:
    dur_s = 0.32
    n = int(dur_s * SAMPLE_RATE)
    left = [0.0] * n
    right = [0.0] * n
    add_pluck(left, right, 0.0, 79, 0.22, 0.28, pan=-0.12, bright=0.8)
    add_pluck(left, right, 0.055, 84, 0.25, 0.32, pan=0.12, bright=0.9)
    write_wav_stereo(os.path.join(OUT_DIR, "sfx-pop.wav"), left, right)
    print("[audio] generated sfx-pop.wav")


def generate_sfx_badge() -> None:
    dur_s = 1.25
    n = int(dur_s * SAMPLE_RATE)
    left = [0.0] * n
    right = [0.0] * n
    notes = [(0.0, 72, -0.35), (0.06, 76, -0.18), (0.12, 79, 0.0), (0.18, 84, 0.18), (0.25, 88, 0.35)]
    for t0, m, pan in notes:
        add_pluck(left, right, t0, m, 0.95, 0.26, pan=pan, bright=1.15)
    write_wav_stereo(os.path.join(OUT_DIR, "sfx-badge.wav"), left, right)
    print("[audio] generated sfx-badge.wav")


def generate_sfx_tick() -> None:
    dur_s = 0.08
    n = int(dur_s * SAMPLE_RATE)
    left = [0.0] * n
    right = [0.0] * n
    add_wood_rim(left, right, 0.0, 0.42, pan=0.15)
    write_wav_stereo(os.path.join(OUT_DIR, "sfx-tick.wav"), left, right)
    print("[audio] generated sfx-tick.wav")


def generate_sfx_stamp() -> None:
    """Heavy vermilion seal stamp impact onto rice paper."""
    dur_s = 0.45
    n = int(dur_s * SAMPLE_RATE)
    left = [0.0] * n
    right = [0.0] * n
    rng = random.Random(303)
    phase = 0.0
    prev = 0.0
    for i in range(n):
        t = i / SAMPLE_RATE
        f = 46.0 + 105.0 * math.exp(-t * 36.0)
        phase += 2.0 * math.pi * f / SAMPLE_RATE
        body = math.sin(phase) * math.exp(-t * 13.0) * 0.72
        noise = rng.uniform(-1.0, 1.0)
        lp = 0.7 * prev + 0.3 * noise
        prev = lp
        paper = lp * math.exp(-t * 70.0) * 0.45
        wood = math.sin(2.0 * math.pi * 620.0 * t) * math.exp(-t * 48.0) * 0.22
        sig = (body + paper + wood) * min(1.0, t / 0.002)
        left[i] = sig
        right[i] = sig
    write_wav_stereo(os.path.join(OUT_DIR, "sfx-stamp.wav"), left, right)
    print("[audio] generated sfx-stamp.wav")


def generate_sfx_whoosh() -> None:
    dur_s = 0.42
    n = int(dur_s * SAMPLE_RATE)
    left = [0.0] * n
    right = [0.0] * n
    rng = random.Random(404)
    lp1 = 0.0
    lp2 = 0.0
    for i in range(n):
        t = i / SAMPLE_RATE
        p = t / dur_s
        env = math.sin(p * math.pi) ** 1.6
        cutoff = 0.05 + 0.22 * math.sin(p * math.pi)
        w = rng.uniform(-1.0, 1.0)
        lp1 += cutoff * (w - lp1)
        lp2 += cutoff * (lp1 - lp2)
        sig = (lp1 - lp2) * env * 0.55
        left[i] = sig * (1.15 - 0.3 * p)
        right[i] = sig * (0.85 + 0.3 * p)
    write_wav_stereo(os.path.join(OUT_DIR, "sfx-whoosh.wav"), left, right)
    print("[audio] generated sfx-whoosh.wav")


if __name__ == "__main__":
    generate_bgm()
    generate_sfx_shuffle()
    generate_sfx_discard()
    generate_sfx_pop()
    generate_sfx_badge()
    generate_sfx_tick()
    generate_sfx_stamp()
    generate_sfx_whoosh()
    print("[audio] all audio assets synthesized successfully")
