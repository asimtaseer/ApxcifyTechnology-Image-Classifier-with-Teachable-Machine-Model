# APEXCIFY TECHNOLOGYS Image Classifier

## Introduction
This project is a real-time web-based Facial Expression Classifier built with a Python Flask backend and an HTML/CSS/JS frontend. It utilizes a machine learning model trained via Google Teachable Machine to predict facial expressions (Happy, Sad, Neutral).

Users can run the application directly from their modern web browser to analyze static images, video files, or a live webcam feed.

## Installation

1. **Prerequisites**
   Ensure you have Python 3.10 (or a compatible version) installed on your system.

2. **Setup Project**
   If you have the source project in `.zip` format, extract the project files to your desired local directory and open it in your code editor (like VS Code).

3. **Install Required Libraries**
   Open your terminal in the project directory and install the necessary dependencies via `pip`:
   ```bash
   pip install flask flask-cors pillow tensorflow opencv-python numpy
   ```
   *(Note: The environment requires TensorFlow compatibility depending on your system drivers, but standard pip installation covers CPU-based learning easily for light models).*

## Usage

1. Start the Flask server:
   ```bash
   python app.py
   ```
2. Open your web browser and navigate to:
   ```
   http://127.0.0.1:5000/
   ```
3. Choose your input source (Image, Video, or Camera) and let the AI detect expressions in real-time.

## Other Requirements
- **Hardware**: A working computer camera is required if you wish to use the "Start Camera" feed feature.
- **Browser**: Use a modern browser (such as Google Chrome, Edge, or Firefox) to ensure HTML5 Video playback, `getUserMedia` support for live feeds, and CSS animation gradients work flawlessly.

## 🎥 Video of Complete Workflow 
Check out the video on YouTube:  

[![Watch the video](https://img.youtube.com/vi/YTkLFoZGVEE/hqdefault.jpg)](https://youtu.be/YTkLFoZGVEE)

---

## 👨‍💻 Author  
**Asim Taseer Qureshi**  
[GitHub](https://github.com/asimtaseer) | [LinkedIn](https://www.linkedin.com/in/asimtaseer/)

---