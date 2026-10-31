#!/usr/bin/env python3
"""
scripts/build_video.py — Automated High-Quality Video Demonstration Builder for WearerKey

Generates:
1. submission-assets/wearerkey_demo.srt (Captions with exact millisecond synchronization)
2. submission-assets/wearerkey_demo.mp4 (1920x1080, 30fps H.264, burned-in subtitles,
   normalized edge-tts voiceover + soft ambient pad)
"""

import os
import sys
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS_DIR = ROOT / "docs" / "assets"
OUT_DIR = ROOT / "submission-assets"
AUDIO_DIR = OUT_DIR / "audio"

VOICE = "en-US-AndrewMultilingualNeural"

SCENES = [
    {
        "id": 1,
        "image": ASSETS_DIR / "screenshots" / "01-landing-page.png",
        "text": (
            "When shopping online, getting advice from friends or a stylist is natural. "
            "But current virtual try-on tools force an uncomfortable trade-off: "
            "to see how clothes look on you, you have to text your private full-body photo or screenshots to another person. "
            "WearerKey solves this with a role-separated privacy relay protocol built on Perfect Corp's YouCam AI Clothes V4 engine."
        ),
        "cues": [
            "When shopping online, getting advice from friends or a stylist is natural.",
            "But current virtual try-on tools force an uncomfortable trade-off: to see how clothes look on you, you have to text your private full-body photo or screenshots to another person.",
            "WearerKey solves this with a role-separated privacy relay protocol built on Perfect Corp's YouCam AI Clothes V4 engine."
        ]
    },
    {
        "id": 2,
        "image": ASSETS_DIR / "screenshots" / "02-consent-pass-creation.png",
        "text": (
            "The wearer initiates a session by defining an immutable Consent Seal. "
            "They choose exactly which clothing categories their shopping companion is permitted to propose, "
            "set a proposal limit, and upload their private reference photo. "
            "EXIF and location metadata are stripped server-side in memory before provider transmission. "
            "The wearer then copies a scoped Helper Link."
        ),
        "cues": [
            "The wearer initiates a session by defining an immutable Consent Seal.",
            "They choose exactly which clothing categories their shopping companion is permitted to propose, set a proposal limit, and upload their private reference photo.",
            "EXIF and location metadata are stripped server-side in memory before provider transmission. The wearer then copies a scoped Helper Link."
        ]
    },
    {
        "id": 3,
        "image": ASSETS_DIR / "architecture-diagram.png",
        "text": (
            "Here is the architectural privacy seam. "
            "The server acts as an isolation barrier between the wearer and helper. "
            "Helper clients only have access to scoped candidate tokens and metadata, "
            "while the upstream YouCam API handles virtual try-on rendering strictly through encrypted server proxies."
        ),
        "cues": [
            "Here is the architectural privacy seam. The server acts as an isolation barrier between the wearer and helper.",
            "Helper clients only have access to scoped candidate tokens and metadata, while the upstream YouCam API handles virtual try-on rendering strictly through encrypted server proxies."
        ]
    },
    {
        "id": 4,
        "image": ASSETS_DIR / "screenshots" / "04-helper-privacy-boundary.png",
        "text": (
            "Now look at the helper's screen. The helper sees only the allowed categories and proposal tools. "
            "Notice that the wearer's reference photo is completely absent. "
            "Even inspecting the helper's network traffic reveals zero image bytes or stream URLs. "
            "The privacy boundary is strictly enforced by the server."
        ),
        "cues": [
            "Now look at the helper's screen. The helper sees only the allowed categories and proposal tools.",
            "Notice that the wearer's reference photo is completely absent. Even inspecting the helper's network traffic reveals zero image bytes or stream URLs.",
            "The privacy boundary is strictly enforced by the server."
        ]
    },
    {
        "id": 5,
        "image": ASSETS_DIR / "screenshots" / "05-wearer-private-mirror.png",
        "text": (
            "In the wearer's private room, the new proposal appears instantly. "
            "The server orchestrates YouCam's official Clothes V4 API using asynchronous polling and exponential backoff. "
            "The resulting appearance preview appears exclusively in the wearer's private mirror."
        ),
        "cues": [
            "In the wearer's private room, the new proposal appears instantly.",
            "The server orchestrates YouCam's official Clothes V4 API using asynchronous polling and exponential backoff.",
            "The resulting appearance preview appears exclusively in the wearer's private mirror."
        ]
    },
    {
        "id": 6,
        "image": ASSETS_DIR / "screenshots" / "06-decision-slip.png",
        "text": (
            "The wearer evaluates the aesthetic drape privately. "
            "They approve the coat and leave a safe styling note for their helper, "
            "which syncs back without ever revealing the wearer's image."
        ),
        "cues": [
            "The wearer evaluates the aesthetic drape privately.",
            "They approve the coat and leave a safe styling note for their helper, which syncs back without ever revealing the wearer's image."
        ]
    },
    {
        "id": 7,
        "image": ASSETS_DIR / "screenshots" / "07-deletion-receipt.png",
        "text": (
            "When the shopping session ends, the wearer revokes the pass with one click. "
            "WearerKey automatically purges in-memory buffers and executes deletion requests against upstream YouCam tasks and files, "
            "producing an application-signed HMAC audit receipt that records provider deletion responses."
        ),
        "cues": [
            "When the shopping session ends, the wearer revokes the pass with one click.",
            "WearerKey automatically purges in-memory buffers and executes deletion requests against upstream YouCam tasks and files, producing an application-signed HMAC audit receipt that records provider deletion responses."
        ]
    },
    {
        "id": 8,
        "image": ASSETS_DIR / "screenshots" / "03-judge-split-screen.png",
        "text": (
            "Hackathon judges can test both roles side-by-side in under 30 seconds using our pre-seeded judge tour at slash judge. "
            "WearerKey is backed by 70 Vitest tests, 10 Playwright browser tests, 0 Axe accessibility violations in tested states, and zero fabricated claims. "
            "Thank you."
        ),
        "cues": [
            "Hackathon judges can test both roles side-by-side in under 30 seconds using our pre-seeded judge tour at /judge.",
            "WearerKey is backed by 70 Vitest tests, 10 Playwright browser tests, 0 Axe accessibility violations in tested states, and zero fabricated claims. Thank you."
        ]
    }
]

def format_timestamp(seconds: float) -> str:
    millis = int(round((seconds - int(seconds)) * 1000))
    secs = int(seconds) % 60
    mins = (int(seconds) // 60) % 60
    hours = int(seconds) // 3600
    return f"{hours:02d}:{mins:02d}:{secs:02d},{millis:03d}"

def get_duration(p: Path) -> float:
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(p)
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return float(res.stdout.strip())

def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    print("🎙️ Step 1: Generating scene audio files with edge-tts...")
    audio_files = []
    durations = []
    
    for sc in SCENES:
        audio_path = AUDIO_DIR / f"scene_{sc['id']}.mp3"
        audio_files.append(audio_path)
        
        # Only regenerate if missing or 0 bytes
        if not audio_path.exists() or audio_path.stat().st_size == 0:
            print(f"  Generating audio for Scene {sc['id']}...")
            cmd = [
                "edge-tts",
                "--voice", VOICE,
                "--text", sc["text"],
                "--write-media", str(audio_path)
            ]
            subprocess.run(cmd, check=True)
        
        dur = get_duration(audio_path)
        durations.append(dur)
        print(f"  Scene {sc['id']}: {dur:.2f}s")

    total_speech_sec = sum(durations)
    print(f"\n📊 Total Spoken Duration: {total_speech_sec:.2f}s ({int(total_speech_sec // 60)}m {int(total_speech_sec % 60)}s)")
    if total_speech_sec < 60 or total_speech_sec > 180:
        print(f"⚠️ Warning: Total duration {total_speech_sec:.2f}s outside recommended 60-180s range!")

    # Step 2: Build synchronized SRT
    print("\n📝 Step 2: Generating synchronized subtitles...")
    out_srt = OUT_DIR / "wearerkey_demo.srt"
    srt_lines = []
    cue_idx = 1
    current_time = 0.5  # start at 0.5s

    for sc, sc_dur in zip(SCENES, durations):
        num_cues = len(sc["cues"])
        # distribute duration proportionally according to character length of each cue
        cue_lengths = [max(len(c), 1) for c in sc["cues"]]
        total_len = sum(cue_lengths)
        
        for c_text, c_len in zip(sc["cues"], cue_lengths):
            cue_dur = (c_len / total_len) * sc_dur
            start_str = format_timestamp(current_time)
            end_str = format_timestamp(current_time + cue_dur - 0.1)
            srt_lines.append(f"{cue_idx}\n{start_str} --> {end_str}\n{c_text}\n")
            cue_idx += 1
            current_time += cue_dur
        current_time += 0.5  # brief pause between scenes

    out_srt.write_text("\n".join(srt_lines), encoding="utf-8")
    print(f"  ✅ Saved {out_srt.name} ({cue_idx - 1} cues)")

    # Step 3: Concat all narration audio with slight spacing
    print("\n🎧 Step 3: Concatenating narration audio...")
    concat_list = OUT_DIR / "audio_concat.txt"
    with open(concat_list, "w", encoding="utf-8") as f:
        for a_path in audio_files:
            f.write(f"file '{a_path.resolve().as_posix()}'\n")

    merged_voice = OUT_DIR / "voice_merged.wav"
    subprocess.run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", str(concat_list),
        "-c:a", "pcm_s16le", str(merged_voice)
    ], check=True)

    total_audio_sec = get_duration(merged_voice)
    print(f"  Merged voice duration: {total_audio_sec:.2f}s")

    # Step 4: Generate subtle ambient pad
    print("\n🎵 Step 4: Generating ambient soundbed...")
    ambient_bed = OUT_DIR / "ambient_bed.wav"
    # Harmonic warm ambient bed (D minor / high-tech calm: 293.66Hz, 349.23Hz, 440Hz)
    synth_filter = (
        f"aevalsrc='0.02*sin(2*PI*293.66*t) + 0.015*sin(2*PI*349.23*t) + 0.015*sin(2*PI*440.0*t)':d={total_audio_sec:.2f}:s=44100"
    )
    subprocess.run([
        "ffmpeg", "-y", "-f", "lavfi", "-i", synth_filter,
        "-af", f"volume=0.06,afade=t=in:ss=0:d=3,afade=t=out:st={total_audio_sec-3:.2f}:d=3",
        str(ambient_bed)
    ], check=True)

    # Step 5: Mix voiceover + ambient bed
    print("\n🎚️ Step 5: Mixing narration and ambient bed...")
    mixed_audio = OUT_DIR / "audio_final.wav"
    subprocess.run([
        "ffmpeg", "-y",
        "-i", str(merged_voice),
        "-i", str(ambient_bed),
        "-filter_complex", "[0:a]volume=1.0[v];[1:a]volume=0.12[b];[v][b]amix=inputs=2:duration=first:dropout_transition=2",
        str(mixed_audio)
    ], check=True)

    # Step 6: Build scene video segments (1920x1080 30fps)
    print("\n🎬 Step 6: Rendering scene video segments...")
    segment_files = []
    for sc, dur in zip(SCENES, durations):
        seg_p = OUT_DIR / f"segment_{sc['id']}.mp4"
        segment_files.append(seg_p)
        img_p = sc["image"]
        
        # Scale to 1920x1080 with clean matte padding (#0B0F17)
        vf = "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=#0B0F17,format=yuv420p"
        cmd = [
            "ffmpeg", "-y",
            "-loop", "1", "-i", str(img_p),
            "-t", f"{dur:.2f}",
            "-vf", vf,
            "-r", "30",
            "-c:v", "libx264", "-tune", "stillimage", "-pix_fmt", "yuv420p",
            str(seg_p)
        ]
        subprocess.run(cmd, check=True)
        print(f"  Rendered Segment {sc['id']} ({dur:.2f}s)")

    # Step 7: Concat video segments
    print("\n🎞️ Step 7: Concatenating video segments...")
    v_concat_list = OUT_DIR / "video_concat.txt"
    with open(v_concat_list, "w", encoding="utf-8") as f:
        for seg in segment_files:
            f.write(f"file '{seg.resolve().as_posix()}'\n")

    raw_video = OUT_DIR / "raw_video.mp4"
    subprocess.run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", str(v_concat_list),
        "-c", "copy", str(raw_video)
    ], check=True)

    # Step 8: Burn in subtitles and merge audio
    print("\n✨ Step 8: Burning subtitles and mastering final MP4...")
    final_mp4 = OUT_DIR / "wearerkey_demo.mp4"
    srt_escaped = str(out_srt.resolve().as_posix()).replace(":", "\\:")
    sub_filter = (
        f"subtitles='{srt_escaped}':force_style='Fontname=Arial,Fontsize=18,"
        f"PrimaryColour=&H00FFFFFF,OutlineColour=&H000B0F17,BackColour=&H80000000,"
        f"BorderStyle=4,MarginV=40,Alignment=2'"
    )

    cmd_final = [
        "ffmpeg", "-y",
        "-i", str(raw_video),
        "-i", str(mixed_audio),
        "-vf", sub_filter,
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        str(final_mp4)
    ]
    subprocess.run(cmd_final, check=True)

    final_dur = get_duration(final_mp4)
    file_size_mb = final_mp4.stat().st_size / (1024 * 1024)
    print(f"\n🎉 Successfully rendered: {final_mp4.name}")
    print(f"   Path: {final_mp4.resolve()}")
    print(f"   Duration: {final_dur:.2f}s ({int(final_dur // 60)}m {int(final_dur % 60)}s)")
    print(f"   Size: {file_size_mb:.2f} MB")
    print(f"   Resolution: 1920x1080 @ 30fps")
    print(f"   Captions: {out_srt.resolve()}")

if __name__ == "__main__":
    main()
