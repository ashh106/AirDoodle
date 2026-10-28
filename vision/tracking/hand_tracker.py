# vision/tracking/hand_tracker.py

import cv2
import mediapipe as mp
import time

class HandTracker:
    def __init__(
        self,
        static_mode=False,
        max_hands=2,
        detection_confidence=0.5,
        tracking_confidence=0.5,
    ):
        self.static_mode = static_mode
        self.max_hands = max_hands
        self.available = False

        if hasattr(mp, "solutions") and hasattr(mp.solutions, "hands"):
            self.mp_hands = mp.solutions.hands
            self.hands = self.mp_hands.Hands(
                static_image_mode=static_mode,
                max_num_hands=max_hands,
                min_detection_confidence=detection_confidence,
                min_tracking_confidence=tracking_confidence,
            )
            self.mp_draw = mp.solutions.drawing_utils
            self.available = True
        else:
            self.mp_hands = None
            self.hands = None
            self.mp_draw = None

        self.results = None
        self.prev_time = 0
        self.curr_time = 0

    def process(self, img, draw=True):
        """Process a BGR image, returns list of hands with landmarks + handedness."""
        if not self.available or self.hands is None:
            return []

        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        self.results = self.hands.process(img_rgb)
        hands_data = []

        h, w, _ = img.shape

        if self.results and self.results.multi_hand_landmarks:
            for idx, handLms in enumerate(self.results.multi_hand_landmarks):
                landmarks = []
                for id, lm in enumerate(handLms.landmark):
                    cx, cy = int(lm.x * w), int(lm.y * h)
                    landmarks.append((id, cx, cy))

                handedness_label = "Unknown"
                handedness_score = 0.0
                if self.results.multi_handedness and idx < len(self.results.multi_handedness):
                    classification = self.results.multi_handedness[idx].classification[0]
                    handedness_label = classification.label  # 'Left' or 'Right'
                    handedness_score = float(classification.score)

                if draw and self.mp_draw and self.mp_hands:
                    self.mp_draw.draw_landmarks(
                        img,
                        handLms,
                        self.mp_hands.HAND_CONNECTIONS,
                    )

                hands_data.append(
                    {
                        "landmarks": landmarks,
                        "handedness": handedness_label,
                        "score": round(handedness_score, 3),
                    }
                )

        return hands_data

    def get_fps(self):
        self.curr_time = time.time()
        fps = 1 / (self.curr_time - self.prev_time) if self.prev_time != 0 else 0
        self.prev_time = self.curr_time
        return fps
