let selectedFloors = [];
let currentDirection = 'down';
let okuFloor = null;
let traditionalQueue = [];
let elevaidQueue = [];
let traditionalStep = 0;
let elevaidStep = 0;
let traditionalElevatorPos = 0;
let elevaidElevatorPos = 0;
let isRunning = false;

// Configurable timing settings (in milliseconds)
let travelTimePerFloor = 1000; // Default 1 second per floor
let stoppageTime = 2000; // Default 2 seconds stoppage time

function initializeInterface() {
    createFloorButtons();
    createTimingControls();
    initializeBuildings();
    updateSelectedCalls();
}

function createFloorButtons() {
    const container = document.getElementById('floorButtons');
    container.innerHTML = '';
    
    // Create buttons for floors 1-14
    for (let i = 14; i >= 1; i--) {
        const button = document.createElement('button');
        button.className = 'floor-btn';
        button.textContent = i;
        button.onclick = () => toggleFloor(i);
        button.id = `btn-${i}`;
        
        // Add right-click context menu for OKU assignment
        button.oncontextmenu = (e) => {
            e.preventDefault();
            toggleOKUFloor(i);
        };
        
        // Add double-click for OKU assignment (alternative to right-click)
        button.ondblclick = () => toggleOKUFloor(i);
        
        container.appendChild(button);
    }
    
    // Add instruction text
    const instruction = document.createElement('div');
    instruction.className = 'floor-instruction';
    instruction.innerHTML = '<small>💡 <strong>Tip:</strong> Right-click or double-click on a selected floor to assign/remove OKU person</small>';
    container.appendChild(instruction);
}

// Add this function to handle video upload
function uploadVideo(file) {

    // Show loading state
    const uploadBox = document.querySelector('.upload-box');
    const originalContent = uploadBox.innerHTML;
    uploadBox.innerHTML = '<p>🤖 Analyzing video for wheelchair detection...</p><div class="loading-spinner"></div>';


    const formData = new FormData();
    formData.append('video', file);
    
    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            if (data.detection.detected) {
                // Update OKU detection message
                document.getElementById('okuMessage').textContent = 
                    `🤖 AI Detection: Wheelchair detected at floor ${okuFloor} (${(data.detection.confidence * 100).toFixed(1)}% confidence)`;
                
                // Show success feedback
                uploadBox.innerHTML = `
                    <p style="color: green;">✅ Wheelchair detected successfully!</p>
                    <p>Confidence: ${(data.detection.confidence * 100).toFixed(1)}%</p>
                    <p>Frames analyzed: ${data.details.frame_count}</p>
                `;
            }
            else {
                // No wheelchair detected
                uploadBox.innerHTML = `
                    <p style="color: orange;">⚠️ No wheelchair detected in video</p>
                    <p>Please try uploading a different video or manually assign OKU person</p>
                    <button onclick="resetVideoUpload()" class="select-video-btn">Try Another Video</button>
                `;
            }

        } else {
            uploadBox.innerHTML = `
                <p style="color: red;">❌ Upload failed: ${data.error}</p>
                <button onclick="resetVideoUpload()" class="select-video-btn">Try Again</button>
            `;
        }
    })
    .catch(error => {
        console.error('Error:', error);
        uploadBox.innerHTML = `
            <p style="color: red;">❌ Upload failed: Network error</p>
            <button onclick="resetVideoUpload()" class="select-video-btn">Try Again</button>
        `;
    });
}

function resetVideoUpload() {
    const uploadBox = document.querySelector('.upload-box');
    uploadBox.innerHTML = `
        <p>📹 Upload Video for OKU Detection</p>
        <p>Drag and drop a video file or click to upload</p>
        <input type="file" id="videoInput" accept="video/*" style="display: none;">
        <button onclick="document.getElementById('videoInput').click();" class="select-video-btn">Select Video File</button>
    `;
    
    // Re-attach event listener
    document.getElementById('videoInput').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            uploadVideo(file);
        }
    });
}

function createTimingControls() {
    const controlsSection = document.querySelector('.controls-section');
    
    // Create timing controls container
    const timingContainer = document.createElement('div');
    timingContainer.className = 'timing-controls';
    timingContainer.innerHTML = `
        <h4>⚙️ Timing Configuration</h4>
        <div class="timing-row">
            <div class="timing-control">
                <label for="travelTimeSlider">Travel Time per Floor:</label>
                <input type="range" id="travelTimeSlider" min="500" max="3000" step="100" value="1000">
                <span id="travelTimeValue">1.0s</span>
            </div>
            <div class="timing-control">
                <label for="stoppageTimeSlider">Stoppage Time:</label>
                <input type="range" id="stoppageTimeSlider" min="1000" max="5000" step="200" value="2000">
                <span id="stoppageTimeValue">2.0s</span>
            </div>
        </div>
        <div class="timing-info">
            <small>🏢 Travel time: Time to move between floors | ⏱️ Stoppage time: Time elevator stops at each floor</small>
        </div>
    `;
    
    // Insert before the controls div
    const controlsDiv = controlsSection.querySelector('.controls');
    controlsSection.insertBefore(timingContainer, controlsDiv);
    
    // Add event listeners for timing controls
    document.getElementById('travelTimeSlider').addEventListener('input', function(e) {
        if (isRunning) {
            e.target.value = travelTimePerFloor;
            return;
        }
        travelTimePerFloor = parseInt(e.target.value);
        document.getElementById('travelTimeValue').textContent = (travelTimePerFloor / 1000).toFixed(1) + 's';
    });
    
    document.getElementById('stoppageTimeSlider').addEventListener('input', function(e) {
        if (isRunning) {
            e.target.value = stoppageTime;
            return;
        }
        stoppageTime = parseInt(e.target.value);
        document.getElementById('stoppageTimeValue').textContent = (stoppageTime / 1000).toFixed(1) + 's';
    });
}

function initializeBuildings() {
    ['traditional', 'elevaid'].forEach(system => {
        const building = document.getElementById(`${system}Building`);
        building.innerHTML = '';
        
        // Create 15 floors (0-14)
        for (let i = 0; i <= 14; i++) {
            const floor = document.createElement('div');
            floor.className = 'floor';
            floor.id = `${system}-floor-${i}`;
            
            const floorNumber = document.createElement('div');
            floorNumber.className = 'floor-number';
            floorNumber.textContent = i === 0 ? 'G' : i;
            
            floor.appendChild(floorNumber);
            building.appendChild(floor);
        }
        
        // Add elevator at ground floor
        const elevator = document.createElement('div');
        elevator.className = 'elevator';
        elevator.id = `${system}-elevator`;
        elevator.textContent = '🚪';
        document.getElementById(`${system}-floor-0`).appendChild(elevator);
    });
}

function toggleFloor(floor) {
    if (isRunning) return;
    
    const button = document.getElementById(`btn-${floor}`);
    const index = selectedFloors.indexOf(floor);
    
    if (index === -1) {
        // Add floor to selection
        selectedFloors.push(floor);
        button.classList.add('selected');
    } else {
        // Remove floor from selection
        selectedFloors.splice(index, 1);
        button.classList.remove('selected');
        
        // If this was the OKU floor, reset OKU assignment
        if (floor === okuFloor) {
            removeOKUAssignment();
        }
    }
    
    updateSelectedCalls();
    generateQueues();
}

function toggleOKUFloor(floor) {
    if (isRunning) return;
    
    // Check if the floor is selected first
    if (!selectedFloors.includes(floor)) {
        alert('Please select the floor first before assigning OKU person');
        return;
    }
    
    const button = document.getElementById(`btn-${floor}`);
    
    if (okuFloor === floor) {
        // Remove OKU assignment from this floor
        removeOKUAssignment();
    } else {
        // Assign OKU to this floor
        assignOKUFloor(floor);
        // Show video upload section
        document.getElementById('videoUploadSection').style.display = 'block';
    }
    
    updateSelectedCalls();
    generateQueues();
}

function assignOKUFloor(floor) {
    // Remove OKU from previous floor if exists
    if (okuFloor !== null) {
        const prevButton = document.getElementById(`btn-${okuFloor}`);
        if (prevButton) {
            prevButton.classList.remove('oku');
        }
    }
    
    // Assign new OKU floor
    okuFloor = floor;
    const button = document.getElementById(`btn-${floor}`);
    button.classList.add('oku');
    
    // Show OKU detection message (will be updated by AI if video uploaded)
    document.getElementById('okuMessage').textContent = `OKU person assigned to floor ${okuFloor} - Upload video for AI verification`;
    document.getElementById('okuDetection').style.display = 'block';
}

function removeOKUAssignment() {
    if (okuFloor !== null) {
        const button = document.getElementById(`btn-${okuFloor}`);
        if (button) {
            button.classList.remove('oku');
        }
        okuFloor = null;
        document.getElementById('okuDetection').style.display = 'none';
        // Hide video upload section and reset selections
        document.getElementById('videoUploadSection').style.display = 'none';
        document.getElementById('okuTypeSelection').style.display = 'block';
        document.getElementById('videoUploadContent').style.display = 'none';
    }
}

// Add event listener for video file selection
document.getElementById('videoInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        uploadVideo(file);
    }
});



function updateSelectedCalls() {
    const callsElement = document.getElementById('selectedCalls');
    currentDirection = document.querySelector('input[name="direction"]:checked').value;
    
    if (selectedFloors.length === 0) {
        callsElement.textContent = 'Selected Calls: None';
        document.getElementById('startBtn').disabled = true;
        removeOKUAssignment();
    } else {
        const sortedFloors = [...selectedFloors].sort((a, b) => a - b);
        let callText = `Selected Calls (${currentDirection.toUpperCase()}): ${sortedFloors.join(', ')}`;
        
        if (okuFloor !== null) {
            callText += ` | OKU: Floor ${okuFloor}`;
        }
        
        callsElement.textContent = callText;
        document.getElementById('startBtn').disabled = false;
    }
}

function generateQueues() {
    if (selectedFloors.length === 0) return;
    
    // Clear previous indicators
    ['traditional', 'elevaid'].forEach(system => {
        document.querySelectorAll(`#${system}Building .hall-call, #${system}Building .oku-indicator`).forEach(el => el.remove());
        document.querySelectorAll(`#${system}Building .floor`).forEach(el => {
            el.classList.remove('waiting', 'served', 'oku-waiting');
        });
    });
    
    // Generate traditional queue
    if (currentDirection === 'down') {
        traditionalQueue = [...selectedFloors].sort((a, b) => b - a);
        traditionalQueue.push(0);
    } else {
        traditionalQueue = [...selectedFloors].sort((a, b) => a - b);
        if (!traditionalQueue.includes(14)) {
            traditionalQueue.push(14);
        }
    }
    
    // Generate ElevAid priority queue
    if (okuFloor !== null) {
        elevaidQueue = [okuFloor, 0]; // Direct to OKU floor then ground
    } else {
        elevaidQueue = [...traditionalQueue]; // Fallback to traditional if no OKU assigned
    }
    
    // Add visual indicators
    selectedFloors.forEach(floor => {
        ['traditional', 'elevaid'].forEach(system => {
            const floorElement = document.getElementById(`${system}-floor-${floor}`);
            
            if (floor === okuFloor) {
                const indicator = document.createElement('div');
                indicator.className = 'oku-indicator';
                indicator.textContent = '👨‍🦽';
                floorElement.appendChild(indicator);
                floorElement.classList.add('oku-waiting');
            } else {
                const hallCall = document.createElement('div');
                hallCall.className = 'hall-call';
                hallCall.textContent = currentDirection === 'down' ? '↓' : '↑';
                floorElement.appendChild(hallCall);
                floorElement.classList.add('waiting');
            }
        });
    });
    
    // Display queues
    displayQueues();

    // Add this at the end of the existing generateQueues function
    if (okuFloor !== null) {
        calculateOKUJourneyTime();
    }
}

function displayQueues() {
    // Traditional queue
    const traditionalQueueItems = document.getElementById('traditionalQueueItems');
    traditionalQueueItems.innerHTML = '';
    traditionalQueue.forEach((floor, index) => {
        const item = document.createElement('div');
        item.className = 'queue-item';
        item.id = `traditional-queue-${index}`;
        item.textContent = floor === 0 ? 'G' : floor;
        traditionalQueueItems.appendChild(item);
    });
    document.getElementById('traditionalQueue').style.display = 'block';
    
    // ElevAid queue
    const elevaidQueueItems = document.getElementById('elevaidQueueItems');
    elevaidQueueItems.innerHTML = '';
    elevaidQueue.forEach((floor, index) => {
        const item = document.createElement('div');
        item.className = 'queue-item';
        if (floor === okuFloor) {
            item.classList.add('priority');
        }
        item.id = `elevaid-queue-${index}`;
        item.textContent = floor === 0 ? 'G' : floor;
        elevaidQueueItems.appendChild(item);
    });
    document.getElementById('elevaidQueue').style.display = 'block';
}

function updateQueue(system, step, queue) {
    queue.forEach((floor, index) => {
        const queueItem = document.getElementById(`${system}-queue-${index}`);
        if (index < step) {
            queueItem.classList.add('completed');
            queueItem.classList.remove('current');
        } else if (index === step) {
            queueItem.classList.add('current');
            queueItem.classList.remove('completed');
        } else {
            queueItem.classList.remove('current', 'completed');
        }
    });
}

function calculateOKUJourneyTime() {
    if (okuFloor === null) return;
    
    // Calculate Traditional System Journey Time
    const traditionalTimes = calculateTraditionalOKUTime();
    const elevaidTimes = calculateElevAidOKUTime();
    
    // Display results
    displayJourneyTimes(traditionalTimes, elevaidTimes);
}

function calculateTraditionalOKUTime() {
    // Traditional system serves floors in order
    // Calculate when OKU floor will be reached in the traditional queue
    
    let waitingTime = 0;
    let foundOKU = false;
    
    // Calculate waiting time - time to reach OKU floor in traditional queue
    for (let i = 0; i < traditionalQueue.length; i++) {
        const floor = traditionalQueue[i];
        
        if (i === 0) {
            // Time to reach first floor from ground
            waitingTime += Math.abs(floor - 0) * travelTimePerFloor;
        } else {
            // Time to move between floors in queue
            const prevFloor = traditionalQueue[i - 1];
            waitingTime += Math.abs(floor - prevFloor) * travelTimePerFloor;
        }
        
        // Add stoppage time for each floor
        waitingTime += stoppageTime;
        
        if (floor === okuFloor) {
            foundOKU = true;
            break;
        }
    }
    
    // Travel time from OKU floor to ground floor
    const travelTime = Math.abs(okuFloor - 0) * travelTimePerFloor;
    
    return {
        waitingTime: waitingTime,
        travelTime: travelTime,
        totalTime: waitingTime + travelTime
    };
}

function calculateElevAidOKUTime() {
    // ElevAid system prioritizes OKU floor first
    
    // Waiting time = time to reach OKU floor directly from ground
    const waitingTime = Math.abs(okuFloor - 0) * travelTimePerFloor + stoppageTime;
    
    // Travel time from OKU floor to ground floor
    const travelTime = Math.abs(okuFloor - 0) * travelTimePerFloor;
    
    return {
        waitingTime: waitingTime,
        travelTime: travelTime,
        totalTime: waitingTime + travelTime
    };
}

function displayJourneyTimes(traditionalTimes, elevaidTimes) {
    // Show the timing results section
    document.getElementById('timingResults').style.display = 'block';
    
    // Display Traditional System times
    document.getElementById('traditionalWaitingTime').textContent = 
        formatTime(traditionalTimes.waitingTime);
    document.getElementById('traditionalTravelTime').textContent = 
        formatTime(traditionalTimes.travelTime);
    document.getElementById('traditionalTotalTime').textContent = 
        formatTime(traditionalTimes.totalTime);
    
    // Display ElevAid System times
    document.getElementById('elevaidWaitingTime').textContent = 
        formatTime(elevaidTimes.waitingTime);
    document.getElementById('elevaidTravelTime').textContent = 
        formatTime(elevaidTimes.travelTime);
    document.getElementById('elevaidTotalTime').textContent = 
        formatTime(elevaidTimes.totalTime);
    
    // Calculate and display time savings
    const timeSaved = traditionalTimes.totalTime - elevaidTimes.totalTime;
    const percentageSaved = ((timeSaved / traditionalTimes.totalTime) * 100).toFixed(1);
    
    if (timeSaved > 0) {
        document.getElementById('timeSavings').style.display = 'block';
        document.getElementById('savedTime').textContent = formatTime(timeSaved);
        document.getElementById('savedPercentage').textContent = percentageSaved;
    } else {
        document.getElementById('timeSavings').style.display = 'none';
    }
}

function formatTime(milliseconds) {
    const seconds = milliseconds / 1000;
    return seconds >= 60 ? 
        `${Math.floor(seconds / 60)}m ${(seconds % 60).toFixed(1)}s` : 
        `${seconds.toFixed(1)}s`;
}

function moveElevator(system, targetFloor, currentPos) {
    return new Promise(async (resolve) => {
        const elevator = document.getElementById(`${system}-elevator`);
        const currentFloor = document.getElementById(`${system}-floor-${currentPos}`);
        const targetFloorElement = document.getElementById(`${system}-floor-${targetFloor}`);
        
        // Calculate travel distance and time
        const floorDistance = Math.abs(targetFloor - currentPos);
        const totalTravelTime = floorDistance * travelTimePerFloor;
        
        // Update status to show elevator is moving
        const statusElement = document.getElementById(`${system}Status`);
        const originalStatus = statusElement.textContent;
        statusElement.textContent = `Moving from floor ${currentPos === 0 ? 'G' : currentPos} to floor ${targetFloor === 0 ? 'G' : targetFloor}...`;
        
        // Animate movement through intermediate floors if moving more than 1 floor
        if (floorDistance > 1) {
            const direction = targetFloor > currentPos ? 1 : -1;
            
            for (let i = currentPos + direction; i !== targetFloor; i += direction) {
                await new Promise(resolve => setTimeout(resolve, travelTimePerFloor));
                
                // Move elevator to intermediate floor
                const intermediateFloor = document.getElementById(`${system}-floor-${i}`);
                if (currentFloor.contains(elevator)) {
                    currentFloor.removeChild(elevator);
                }
                intermediateFloor.appendChild(elevator);
                
                // Brief visual indication of passing through
                intermediateFloor.classList.add('passing');
                setTimeout(() => intermediateFloor.classList.remove('passing'), 200);
            }
        }
        
        // Final movement to target floor
        await new Promise(resolve => setTimeout(resolve, travelTimePerFloor));
        
        // Remove elevator from current floor
        const elevatorParent = elevator.parentElement;
        if (elevatorParent) {
            elevatorParent.removeChild(elevator);
        }
        
        // Add elevator to target floor
        targetFloorElement.appendChild(elevator);
        
        // Visual feedback for arrival
        targetFloorElement.classList.add('active');
        statusElement.textContent = `Arrived at floor ${targetFloor === 0 ? 'G' : targetFloor} - Opening doors...`;
        
        // Stoppage time simulation
        setTimeout(() => {
            targetFloorElement.classList.remove('active');
            
            // Mark floor as served if it was in the call list
            if (selectedFloors.includes(targetFloor)) {
                targetFloorElement.classList.remove('waiting', 'oku-waiting');
                targetFloorElement.classList.add('served');
                // Remove indicators
                const indicators = targetFloorElement.querySelectorAll('.hall-call, .oku-indicator');
                indicators.forEach(indicator => indicator.remove());
                
                statusElement.textContent = `Served floor ${targetFloor === 0 ? 'G' : targetFloor} - Doors closing...`;
            } else {
                statusElement.textContent = originalStatus;
            }
            
            resolve();
        }, stoppageTime);
    });
}

async function startSimulation() {
    if (isRunning || selectedFloors.length === 0) return;
    
    isRunning = true;
    document.getElementById('startBtn').disabled = true;
    traditionalStep = 0;
    elevaidStep = 0;
    
    // Start both simulations simultaneously
    Promise.all([
        runTraditionalSimulation(),
        runElevAidSimulation()
    ]).then(() => {
        document.getElementById('startBtn').disabled = false;
        isRunning = false;
    });
}

async function runTraditionalSimulation() {
    document.getElementById('traditionalStatus').textContent = 'Running traditional algorithm...';
    document.getElementById('traditionalStatus').className = 'status processing';
    
    // Move to first floor
    const firstFloor = traditionalQueue[0];
    await moveElevator('traditional', firstFloor, traditionalElevatorPos);
    traditionalElevatorPos = firstFloor;
    
    // Process queue
    for (let i = 0; i < traditionalQueue.length; i++) {
        traditionalStep = i;
        updateQueue('traditional', traditionalStep, traditionalQueue);
        
        const floor = traditionalQueue[i];
        
        if (i > 0) {
            await moveElevator('traditional', floor, traditionalElevatorPos);
            traditionalElevatorPos = floor;
        }
        
        await new Promise(resolve => setTimeout(resolve, stoppageTime / 2)); // Reduced wait between queue items
    }
    
    document.getElementById('traditionalStatus').textContent = 'Traditional simulation complete';
    document.getElementById('traditionalStatus').className = 'status completed';
}

async function runElevAidSimulation() {
    if (okuFloor !== null) {
        document.getElementById('elevaidStatus').textContent = 'ElevAid: Prioritizing OKU person...';
        document.getElementById('elevaidStatus').className = 'status priority';
    } else {
        document.getElementById('elevaidStatus').textContent = 'ElevAid: No OKU person detected, using standard algorithm...';
        document.getElementById('elevaidStatus').className = 'status processing';
    }
    
    // Move to first floor
    const firstFloor = elevaidQueue[0];
    await moveElevator('elevaid', firstFloor, elevaidElevatorPos);
    elevaidElevatorPos = firstFloor;
    
    // Process priority queue
    for (let i = 0; i < elevaidQueue.length; i++) {
        elevaidStep = i;
        updateQueue('elevaid', elevaidStep, elevaidQueue);
        
        const floor = elevaidQueue[i];
        
        if (i > 0) {
            await moveElevator('elevaid', floor, elevaidElevatorPos);
            elevaidElevatorPos = floor;
        }
        
        await new Promise(resolve => setTimeout(resolve, stoppageTime / 2)); // Reduced wait between queue items
    }
    
    if (okuFloor !== null) {
        document.getElementById('elevaidStatus').textContent = 'ElevAid: OKU person served first!';
    } else {
        document.getElementById('elevaidStatus').textContent = 'ElevAid: Simulation complete';
    }
    document.getElementById('elevaidStatus').className = 'status completed';
}

function selectOKUType(type) {
    // Hide type selection and show video upload
    document.getElementById('okuTypeSelection').style.display = 'none';
    document.getElementById('videoUploadContent').style.display = 'block';
    
    // Update OKU message with selected type
    const emoji = type === 'wheelchair' ? '🦽' : '👴';
    const typeName = type === 'wheelchair' ? 'Wheelchair user' : 'Elderly person';
    document.getElementById('okuMessage').textContent = `${typeName} assigned to floor ${okuFloor}`;
}

function resetSimulation() {
    if (isRunning) return;
    
    selectedFloors = [];
    okuFloor = null;
    traditionalQueue = [];
    elevaidQueue = [];
    traditionalStep = 0;
    elevaidStep = 0;
    traditionalElevatorPos = 0;
    elevaidElevatorPos = 0;
    
    // Reset buttons
    document.querySelectorAll('.floor-btn').forEach(btn => {
        btn.classList.remove('selected', 'oku');
    });
    
    // Reset buildings
    initializeBuildings();
    
    // Reset interface
    updateSelectedCalls();
    document.getElementById('traditionalQueue').style.display = 'none';
    document.getElementById('elevaidQueue').style.display = 'none';
    document.getElementById('startBtn').disabled = true;
    document.getElementById('okuDetection').style.display = 'none';
    
    document.getElementById('traditionalStatus').textContent = 'Ready to start';
    document.getElementById('traditionalStatus').className = 'status ready';
    document.getElementById('elevaidStatus').textContent = 'Ready to start';
    document.getElementById('elevaidStatus').className = 'status ready';

    // Add this line at the end of the existing resetSimulation function
    document.getElementById('timingResults').style.display = 'none';
}

// Listen for direction changes
document.addEventListener('change', function(e) {
    if (e.target.name === 'direction') {
        updateSelectedCalls();
        generateQueues();
    }
});

// Initialize on page load
window.onload = function() {
    initializeInterface();
};