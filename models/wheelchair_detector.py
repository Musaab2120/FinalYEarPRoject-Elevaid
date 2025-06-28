import cv2
import torch
import numpy as np
from ultralytics import YOLO
import os

class WheelchairDetector:
    def __init__(self, model_path='models/best.pt'):
        """
        Initialize the wheelchair detector
        
        Args:
            model_path (str): Path to the trained model file
        """
        self.model = None
        self.model_path = model_path
        self.load_model()
    
    def load_model(self):
        """Load the pretrained wheelchair detection model"""
        try:
            if not os.path.exists(self.model_path):
                raise FileNotFoundError(f"Model file not found: {self.model_path}")
            
            self.model = YOLO(self.model_path)
            print(f"Model loaded successfully from {self.model_path}")
            return True
        except Exception as e:
            print(f"Error loading model: {e}")
            self.model = None
            return False
    
    def is_model_loaded(self):
        """Check if model is loaded successfully"""
        return self.model is not None
    
    def detect_in_frame(self, frame, confidence_threshold=0.1):
        """
        Detect wheelchair in a single frame
        
        Args:
            frame: OpenCV frame (numpy array)
            confidence_threshold (float): Minimum confidence for detection
            
        Returns:
            tuple: (detected, confidence, bounding_boxes)
        """
        if not self.is_model_loaded():
            return False, 0.0, []
        
        try:
            # Run inference
            results = self.model(frame, conf=confidence_threshold)
            
            wheelchair_detected = False
            max_confidence = 0.0
            detection_boxes = []
            
            for result in results:
                boxes = result.boxes
                if boxes is not None:
                    for box in boxes:
                        class_id = int(box.cls[0])
                        confidence = float(box.conf[0])
                        class_name = self.model.names[class_id]
                        
                        # Check if detected object is wheelchair
                        if self._is_wheelchair_class(class_name):
                            wheelchair_detected = True
                            max_confidence = max(max_confidence, confidence)
                            
                            # Get bounding box coordinates
                            bbox = box.xyxy[0].cpu().numpy()
                            detection_boxes.append({
                                'bbox': bbox,
                                'confidence': confidence,
                                'class_name': class_name
                            })
            
            return wheelchair_detected, max_confidence, detection_boxes
            
        except Exception as e:
            print(f"Error during frame detection: {e}")
            return False, 0.0, []
    
    def detect_in_video(self, video_path, confidence_threshold=0.5, sample_rate=1):
        """
        Detect wheelchair in video
        
        Args:
            video_path (str): Path to video file
            confidence_threshold (float): Minimum confidence for detection
            sample_rate (int): Process every nth frame (1 = every frame)
            
        Returns:
            dict: Detection results with details
        """
        if not self.is_model_loaded():
            return {
                'detected': False,
                'confidence': 0.0,
                'error': 'Model not loaded',
                'frame_count': 0,
                'detection_frames': []
            }
        
        try:
            cap = cv2.VideoCapture(video_path)
            if not cap.isOpened():
                return {
                    'detected': False,
                    'confidence': 0.0,
                    'error': 'Could not open video file',
                    'frame_count': 0,
                    'detection_frames': []
                }
            
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = cap.get(cv2.CAP_PROP_FPS)
            
            wheelchair_detected = False
            max_confidence = 0.0
            detection_frames = []
            frame_number = 0
            
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                
                # Sample frames based on sample_rate
                if frame_number % sample_rate == 0:
                    detected, confidence, boxes = self.detect_in_frame(
                        frame, confidence_threshold
                    )
                    
                    if detected:
                        wheelchair_detected = True
                        max_confidence = max(max_confidence, confidence)
                        
                        # Store frame information
                        timestamp = frame_number / fps if fps > 0 else 0
                        detection_frames.append({
                            'frame_number': frame_number,
                            'timestamp': timestamp,
                            'confidence': confidence,
                            'boxes': boxes
                        })
                        
                        # Optional: Stop after first detection for faster processing
                        # break
                
                frame_number += 1
            
            cap.release()
            
            return {
                'detected': wheelchair_detected,
                'confidence': max_confidence,
                'error': None,
                'frame_count': total_frames,
                'detection_frames': detection_frames,
                'video_info': {
                    'fps': fps,
                    'duration': total_frames / fps if fps > 0 else 0
                }
            }
            
        except Exception as e:
            return {
                'detected': False,
                'confidence': 0.0,
                'error': str(e),
                'frame_count': 0,
                'detection_frames': []
            }
    
    def _is_wheelchair_class(self, class_name):
        """
        Check if detected class is wheelchair
        Modify this method based on your model's class names
        """
        wheelchair_keywords = ['wheelchair', 'wheel_chair', 'mobility_chair', 'chair']
        return any(keyword in class_name.lower() for keyword in wheelchair_keywords)
    
    def get_model_info(self):
        """Get information about the loaded model"""
        if not self.is_model_loaded():
            return None
        
        try:
            return {
                'model_path': self.model_path,
                'class_names': list(self.model.names.values()) if hasattr(self.model, 'names') else [],
                'model_type': type(self.model).__name__
            }
        except Exception as e:
            print(f"Error getting model info: {e}")
            return None


