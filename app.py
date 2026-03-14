import os
import cv2
import numpy as np
import base64
from flask import Flask, request, jsonify
from flask_cors import CORS
from tensorflow.keras.models import load_model

app = Flask(__name__, static_folder="static", static_url_path="/")
CORS(app)

# Load the model and labels globally
MODEL_PATH = "keras_model.h5" # Note: capitalization depends on precise file name. Project has keras_model.h5 or keras_Model.h5
LABELS_PATH = "labels.txt"

model = None
class_names = []

try:
    # Try multiple variations since file system case varies
    if os.path.exists("keras_model.h5"):
        model = load_model("keras_model.h5", compile=False)
    elif os.path.exists("keras_Model.h5"):
        model = load_model("keras_Model.h5", compile=False)
    else:
        print("Model file not found!")
        
    with open(LABELS_PATH, "r") as f:
        class_names = [line.strip() for line in f.readlines()]
    print("Model and labels loaded successfully.")
except Exception as e:
    print(f"Error loading model: {e}")

def process_frame(image_array):
    if model is None:
        return "Model Error", 0.0

    # Resize the raw image into (224-height,224-width) pixels
    image = cv2.resize(image_array, (224, 224), interpolation=cv2.INTER_AREA)
    
    # Optional: in the original ipynb they did cv2.flip(image, 1). 
    # For a web camera, it might be mirrored already or we mirror on canvas. 
    # The keras teachable machine model expects standard layout.
    
    # Make the image a numpy array and reshape it to the models input shape.
    image = np.asarray(image, dtype=np.float32).reshape(1, 224, 224, 3)
    
    # Normalize the image array
    image = (image / 127.5) - 1
    
    # Predicts the model
    prediction = model.predict(image, verbose=0)
    index = np.argmax(prediction[0])
    class_name = class_names[index]
    confidence_score = float(prediction[0][index])
    
    # Class format usually "0 Neutral" - strip the prefix digit
    if len(class_name.split(" ", 1)) > 1:
        pure_class = class_name.split(" ", 1)[1]
    else:
        pure_class = class_name
        
    return pure_class, confidence_score

@app.route("/")
def index():
    return app.send_static_file("index.html")

@app.route("/predict/image", methods=["POST"])
def predict_image():
    if "image" not in request.files:
        return jsonify({"error": "No image provided"}), 400
    
    try:
        file = request.files["image"]
        file_bytes = np.frombuffer(file.read(), np.uint8)
        image_array = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        
        if image_array is None:
            return jsonify({"error": "Invalid image"}), 400
            
        class_name, conf = process_frame(image_array)
        return jsonify({"class": class_name, "confidence": conf})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/predict/frame", methods=["POST"])
def predict_frame():
    data = request.json
    if not data or "image" not in data:
        return jsonify({"error": "No image provided"}), 400
    
    try:
        image_data = data["image"]
        # Strip data URI prefix if present
        if "," in image_data:
            image_data = image_data.split(",")[1]
            
        img_bytes = base64.b64decode(image_data)
        np_arr = np.frombuffer(img_bytes, np.uint8)
        image_array = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        
        class_name, conf = process_frame(image_array)
        return jsonify({"class": class_name, "confidence": conf})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

from flask import Response

camera_instance = None

def gen_frames():  
    global camera_instance
    if camera_instance is None or not camera_instance.isOpened():
        camera_instance = cv2.VideoCapture(0)
        
    while True:
        success, frame = camera_instance.read()
        if not success:
            break
        else:
            # Resize image to match model input for prediction
            class_name, conf = process_frame(frame)
            
            # Optional: Overlap text directly on the python frame
            text = f"{class_name} ({int(conf*100)}%)"
            cv2.putText(frame, text, (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2, cv2.LINE_AA)
            
            ret, buffer = cv2.imencode('.jpg', frame)
            frame_bytes = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.route('/video_feed')
def video_feed():
    return Response(gen_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/stop_video')
def stop_video():
    global camera_instance
    if camera_instance is not None:
        camera_instance.release()
        camera_instance = None
    return jsonify({"status": "Stopped"})

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
