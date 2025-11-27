from orpheus_tts import OrpheusModel
import wave
import time
import struct
from flask import Response

model = OrpheusModel(model_name="canopylabs/orpheus-tts-0.1-finetune-prod")

def create_wav_header(sample_rate=24000, bits_per_sample=16, channels=1):
    byte_rate = sample_rate * channels * bits_per_sample // 8
    block_align = channels * bits_per_sample // 8

    data_size = 0

    header = struct.pack(
        '<4sI4s4sIHHIIHH4sI',
        b'RIFF',
        36 + data_size,       
        b'WAVE',
        b'fmt ',
        16,                  
        1,             
        channels,
        sample_rate,
        byte_rate,
        block_align,
        bits_per_sample,
        b'data',
        data_size
    )
    return header

def stream_speech(prompt="You forgot to say something", voice="tara"):
    def generate_audio_stream():
        yield create_wav_header()

        syn_tokens = model.generate_speech(
            prompt=prompt,
            voice=voice,
            repetition_penalty=1.1,
            stop_token_ids=[128258],
            max_tokens=6000,
            temperature=0.6,
            top_p=0.9
        )
        for chunk in syn_tokens:
            yield chunk
    
        # for idx, audio_chunk in enumerate(syn_tokens):
        #     yield audio_chunk

    return Response(generate_audio_stream(), mimetype='audio/wav')

def generate_speech(prompt="You forgot to say something", voice="tara"):
    
    start_time = time.monotonic()
    syn_tokens = model.generate_speech(prompt=prompt, voice=voice)

    with wave.open("output.wav", "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(24000)

        total_frames = 0
        for audio_chunk in syn_tokens:  # output streaming
            frame_count = len(audio_chunk) // (wf.getsampwidth() * wf.getnchannels())
            total_frames += frame_count
            wf.writeframes(audio_chunk)

        duration = total_frames / wf.getframerate()
        end_time = time.monotonic()
        print(f"It took {end_time - start_time} seconds to generate {duration:.2f} seconds of audio")
