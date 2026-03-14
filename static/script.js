const API_URL = 'http://127.0.0.1:5000';

// Elements
const optionBtns = document.querySelectorAll('.option-btn');
const inputSections = document.querySelectorAll('.input-section');

// Preview Elements
const mediaContainer = document.getElementById('media-container');
const placeholderText = document.getElementById('placeholder-text');
const imagePreview = document.getElementById('image-preview');
const videoPreview = document.getElementById('video-preview');
const cameraPreview = document.getElementById('camera-preview');
const frameCanvas = document.getElementById('frame-canvas');

// Input Elements
const imageUpload = document.getElementById('image-upload');
const videoUpload = document.getElementById('video-upload');
const startCameraBtn = document.getElementById('start-camera');
const stopCameraBtn = document.getElementById('stop-camera');

// Drag & Drop Areas
const imageDrop = document.getElementById('image-drop');
const videoDrop = document.getElementById('video-drop');

// Result Elements
const predictionText = document.getElementById('prediction-text');
const confidenceBar = document.getElementById('confidence-bar');
const confidenceText = document.getElementById('confidence-text');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');

// State Variables
let currentSource = 'image';
let cameraStream = null;
let inferenceInterval = null;
let isPredicting = false;

// Initialize
init();

function init() {
    setupDragAndDrop();
    setupInputs();
}

// Source Selection Logic
function selectSource(source) {
    if (source === currentSource) return;
    
    // Stop any ongoing processes
    stopInference();
    if (cameraStream) stopCamera();
    
    currentSource = source;
    
    // Update UI
    optionBtns.forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${source}`).classList.add('active');
    
    inputSections.forEach(sec => sec.classList.remove('active-section'));
    document.getElementById(`${source}-input`).classList.add('active-section');
    
    resetPredictions();
    hideAllPreviews();
}

// Drag & Drop Handlers
function setupDragAndDrop() {
    [imageDrop, videoDrop].forEach(dropArea => {
        dropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropArea.classList.add('dragover');
        });
        
        ['dragleave', 'dragend'].forEach(type => {
            dropArea.addEventListener(type, () => {
                dropArea.classList.remove('dragover');
            });
        });
        
        dropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            dropArea.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                const fileInput = dropArea.querySelector('input');
                fileInput.files = e.dataTransfer.files;
                // Trigger change event
                const event = new Event('change');
                fileInput.dispatchEvent(event);
            }
        });
    });
}

// Input Handlers
function setupInputs() {
    // Image Upload
    imageUpload.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            showPreview(imagePreview, url);
            predictImage(file);
        }
    });

    // Video Upload
    videoUpload.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            showPreview(videoPreview, url);
            
            // Wait for video to be loaded to know its dimensions
            videoPreview.onloadedmetadata = () => {
                setupCanvas(videoPreview.videoWidth, videoPreview.videoHeight);
            };
            
            videoPreview.onplay = () => startInference(videoPreview);
            videoPreview.onpause = () => stopInference();
            videoPreview.onended = () => stopInference();
        }
    });
    
    // Camera Controls
    startCameraBtn.addEventListener('click', startCamera);
    stopCameraBtn.addEventListener('click', stopCamera);
}

// Main Prediction logic for a static image file
async function predictImage(file) {
    setStatus('processing', 'Analyzing image...');
    
    const formData = new FormData();
    formData.append('image', file);
    
    try {
        const response = await fetch(`${API_URL}/predict/image`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('API Error');
        
        const result = await response.json();
        updateResults(result.class, result.confidence);
        setStatus('idle', 'Analysis complete');
    } catch (error) {
        console.error("Prediction Error:", error);
        setStatus('error', 'Error analyzing image');
    }
}

// Main Prediction loop for Video / Camera
function startInference(videoElement) {
    if (inferenceInterval) clearInterval(inferenceInterval);
    
    // Setup canvas dimensions if not already set
    if (frameCanvas.width === 0) {
        setupCanvas(videoElement.videoWidth || 640, videoElement.videoHeight || 480);
    }
    
    setStatus('processing', 'Analyzing stream...');
    
    // Extract a frame every 250ms (4 FPS) to avoid overloading the browser/server
    inferenceInterval = setInterval(async () => {
        if (isPredicting || videoElement.paused || videoElement.ended) return;
        
        try {
            isPredicting = true;
            
            // Draw current video frame to canvas
            const ctx = frameCanvas.getContext('2d');
            ctx.drawImage(videoElement, 0, 0, frameCanvas.width, frameCanvas.height);
            
            // Get base64 representation of the frame
            const base64Image = frameCanvas.toDataURL('image/jpeg', 0.8);
            
            // Check if frame is pure black/empty (sometimes happens before stream is fully ready)
            if (base64Image.length < 1000) {
                isPredicting = false;
                return;
            }
            
            // Send to API
            const response = await fetch(`${API_URL}/predict/frame`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ image: base64Image })
            });
            
            if (!response.ok) throw new Error('API Error');
            
            const result = await response.json();
            updateResults(result.class, result.confidence);
            
        } catch (error) {
            console.error("Frame Prediction Error:", error);
        } finally {
            isPredicting = false;
        }
        
    }, 250);
}

function stopInference() {
    if (inferenceInterval) {
        clearInterval(inferenceInterval);
        inferenceInterval = null;
    }
    isPredicting = false;
    if (currentSource !== 'image') {
        setStatus('idle', 'Stream paused');
    }
}

// Camera Specific Logic
async function startCamera() {
    try {
        // Since browser camera permissions are blocked or bugged, 
        // we will fetch the camera stream directly from the Python backend!
        showPreview(imagePreview); // We repurpose the image tag to hold the Python MJPEG stream
        
        // Add timestamp to prevent caching
        imagePreview.src = `${API_URL}/video_feed?t=${new Date().getTime()}`;
        
        startCameraBtn.classList.add('hidden');
        stopCameraBtn.classList.remove('hidden');
        
        setStatus('processing', 'Python Camera stream active. Check browser UI.');
        predictionText.textContent = "See Video Feed";
        confidenceBar.style.width = `100%`;
        confidenceText.textContent = "Active";
        document.body.setAttribute('data-emotion', 'happy');
        
    } catch (err) {
        console.error("Error accessing camera: ", err);
        alert(`App Error: ${err.message}`);
        setStatus('error', 'Camera access failed');
    }
}

async function stopCamera() {
    // Tell python backend to release cv2 camera
    try {
        await fetch(`${API_URL}/stop_video`);
    } catch (e) { console.warn(e) }
    
    imagePreview.src = "";
    stopInference();
    hideAllPreviews();
    
    startCameraBtn.classList.remove('hidden');
    stopCameraBtn.classList.add('hidden');
    resetPredictions();
}

// UI Helpers
function showPreview(element, url = null) {
    placeholderText.style.display = 'none';
    
    // Hide all
    imagePreview.style.display = 'none';
    videoPreview.style.display = 'none';
    cameraPreview.style.display = 'none';
    
    // Show specific
    element.style.display = 'block';
    if (url) {
        element.src = url;
    }
}

function hideAllPreviews() {
    imagePreview.style.display = 'none';
    imagePreview.src = "";
    
    videoPreview.style.display = 'none';
    videoPreview.src = "";
    
    cameraPreview.style.display = 'none';
    
    placeholderText.style.display = 'flex';
}

function setupCanvas(width, height) {
    if (width && height) {
        frameCanvas.width = width;
        frameCanvas.height = height;
    } else {
        frameCanvas.width = 640;
        frameCanvas.height = 480;
    }
}

function updateResults(className, confidence) {
    // Default cases based on common teachable machine labels
    let emotion = className.toLowerCase().trim();
    if (emotion.includes('happy')) emotion = 'happy';
    else if (emotion.includes('sad')) emotion = 'sad';
    else if (emotion.includes('neutral')) emotion = 'neutral';
    
    predictionText.textContent = className;
    
    const confPercent = Math.round(confidence * 100);
    confidenceBar.style.width = `${confPercent}%`;
    confidenceText.textContent = `${confPercent}%`;
    
    // Apply theme
    document.body.setAttribute('data-emotion', emotion);
}

function resetPredictions() {
    predictionText.textContent = 'Waiting...';
    confidenceBar.style.width = '0%';
    confidenceText.textContent = '0%';
    document.body.removeAttribute('data-emotion');
    setStatus('idle', 'Select input and begin');
}

function setStatus(state, msg) {
    statusIndicator.className = `status ${state}`;
    statusText.textContent = msg;
}
