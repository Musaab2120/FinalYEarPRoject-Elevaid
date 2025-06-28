from flask import Flask, render_template, request, jsonify
import os
from werkzeug.utils import secure_filename
from models.wheelchair_detector import WheelchairDetector
app = Flask(__name__)

# Configure upload folder for video files
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'}

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size

# Initialize wheelchair detector
detector = WheelchairDetector('models/best.pt')



@app.route('/')
def index():
    """Main page route"""
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_video():
    if 'video' not in request.files:
        return jsonify({'success': False, 'error': 'No video file provided'})
    
    file = request.files['video']
    if file.filename == '':
        return jsonify({'success': False, 'error': 'No file selected'})
    
    if file:
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Run wheelchair detection
        result = detector.detect_in_video(filepath, confidence_threshold=0.3)
        
        # Clean up uploaded file (optional)
        os.remove(filepath)
        
        return jsonify({
            'success': True,
            'detection': {
                'type': 'wheelchair' if result['detected'] else 'none',
                'confidence': result['confidence'],
                'detected': result['detected']
            },
            'details': {
                'frame_count': result['frame_count'],
                'detection_frames': len(result['detection_frames'])
            }
        })

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def simulate_oku_detection(filepath):
    """Simulate OKU person detection in video
    In a real implementation, this would use computer vision/ML models
    """
    # Placeholder for actual AI detection logic
    return {
        'detected': True,
        'confidence': 0.95,
        'type': 'wheelchair',  # or 'elderly'
        'timestamp': '00:02:15'
    }

@app.route('/api/simulation_data', methods=['POST'])
def handle_simulation_data():
    """Handle simulation configuration data"""
    data = request.get_json()
    
    # Extract simulation parameters
    selected_floors = data.get('selectedFloors', [])
    oku_floor = data.get('okuFloor')
    direction = data.get('direction', 'down')
    travel_time = data.get('travelTime', 1000)
    stoppage_time = data.get('stoppageTime', 2000)
    
    # Generate queues based on the logic from your JavaScript
    traditional_queue = generate_traditional_queue(selected_floors, direction)
    elevaid_queue = generate_elevaid_queue(selected_floors, oku_floor, direction)
    
    return jsonify({
        'traditionalQueue': traditional_queue,
        'elevaidQueue': elevaid_queue,
        'success': True
    })

def generate_traditional_queue(selected_floors, direction):
    """Generate traditional elevator queue"""
    if direction == 'down':
        queue = sorted(selected_floors, reverse=True)
        queue.append(0)  # Return to ground floor
    else:
        queue = sorted(selected_floors)
        if 14 not in queue:
            queue.append(14)  # Go to top floor
    return queue

def generate_elevaid_queue(selected_floors, oku_floor, direction):
    """Generate ElevAid priority queue"""
    if oku_floor is not None:
        return [oku_floor, 0]  # Priority to OKU floor, then ground
    else:
        # Fallback to traditional queue if no OKU detected
        return generate_traditional_queue(selected_floors, direction)

@app.route('/api/calculate_times', methods=['POST'])
def calculate_journey_times():
    """Calculate journey times for both systems"""
    data = request.get_json()
    
    selected_floors = data.get('selectedFloors', [])
    oku_floor = data.get('okuFloor')
    travel_time_per_floor = data.get('travelTime', 1000)
    stoppage_time = data.get('stoppageTime', 2000)
    direction = data.get('direction', 'down')
    
    if oku_floor is None:
        return jsonify({'error': 'No OKU floor specified'}), 400
    
    # Calculate traditional system times
    traditional_times = calculate_traditional_times(
        selected_floors, oku_floor, travel_time_per_floor, stoppage_time, direction
    )
    
    # Calculate ElevAid system times
    elevaid_times = calculate_elevaid_times(
        oku_floor, travel_time_per_floor, stoppage_time
    )
    
    return jsonify({
        'traditional': traditional_times,
        'elevaid': elevaid_times,
        'timeSaved': traditional_times['totalTime'] - elevaid_times['totalTime']
    })

def calculate_traditional_times(selected_floors, oku_floor, travel_time, stoppage_time, direction):
    """Calculate journey times for traditional system"""
    # Generate traditional queue
    traditional_queue = generate_traditional_queue(selected_floors, direction)
    
    waiting_time = 0
    
    # Calculate time to reach OKU floor
    for i, floor in enumerate(traditional_queue):
        if i == 0:
            waiting_time += abs(floor - 0) * travel_time
        else:
            prev_floor = traditional_queue[i - 1]
            waiting_time += abs(floor - prev_floor) * travel_time
        
        waiting_time += stoppage_time
        
        if floor == oku_floor:
            break
    
    # Travel time from OKU floor to ground
    travel_time_to_ground = abs(oku_floor - 0) * travel_time
    
    return {
        'waitingTime': waiting_time,
        'travelTime': travel_time_to_ground,
        'totalTime': waiting_time + travel_time_to_ground
    }

def calculate_elevaid_times(oku_floor, travel_time, stoppage_time):
    """Calculate journey times for ElevAid system"""
    # Direct service to OKU floor
    waiting_time = abs(oku_floor - 0) * travel_time + stoppage_time
    travel_time_to_ground = abs(oku_floor - 0) * travel_time
    
    return {
        'waitingTime': waiting_time,
        'travelTime': travel_time_to_ground,
        'totalTime': waiting_time + travel_time_to_ground
    }

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)