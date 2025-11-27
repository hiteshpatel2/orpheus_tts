from flask import Flask, request, render_template
from gen_speech import generate_speech, stream_speech
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route("/")
def hello_world():
    return "<p>Hello, World!</p>"

@app.route("/tts/<string:prompt>", methods=["GET"])
def tts_with_prompt(prompt):
    generate_speech(prompt=prompt)
    return "Audio generated successfully", 200

@app.route("/stream/<string:prompt>", methods=["GET"])
def stream_tts(prompt):
    # This endpoint is for streaming audio
    return stream_speech(prompt=prompt, voice="tara")

@app.route("/speak/<string:voiceId>/<string:prompt>", methods=["GET"])
def stream_audio(voiceId, prompt):
    # This endpoint is for streaming audio
    return stream_speech(prompt=prompt, voice=voiceId)

@app.route("/speak", methods=["POST"])
def stream_audio_post():
    # This endpoint is for streaming audio
    request_data = request.get_json()
    prompt = request_data.get("prompt", "You forgot to say something")
    return stream_speech(prompt=prompt, voice="tara")

@app.route("/demo/<name>", methods=["GET"])
def demo(name='Kat'):
    name = name
    items = [f"Hi my name is {name}, and..<chuckle> I am here for some help.", "No, really?<surprise> That's not happening", "No, really<crying>, That's not happening"]
    # This endpoint is for the demo page
    return render_template("demo.html", name=name, items=items)

if __name__ == "__main__":
    app.run(debug=True)