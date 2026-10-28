import cv2
import mediapipe as mp

def main():
    print("OpenCV:", cv2.__version__)
    print("MediaPipe:", mp.__version__)

    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    if not cap.isOpened():
        cap.release()
        cap = cv2.VideoCapture(0)

    print("Camera opened:", cap.isOpened())

    if not cap.isOpened():
        print("ERROR: Cannot open webcam. Check camera permissions.")
        return

    try:
        hands_api = mp.solutions.hands
        draw = mp.solutions.drawing_utils

        with hands_api.Hands(
            max_num_hands=2,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        ) as hands:
            previous_detection = False

            while True:
                success, frame = cap.read()
                if not success:
                    print("ERROR: Could not read webcam frame.")
                    break

                frame = cv2.flip(frame, 1)
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                result = hands.process(rgb)

                detected = bool(result.multi_hand_landmarks)

                if detected:
                    for landmarks in result.multi_hand_landmarks:
                        draw.draw_landmarks(
                            frame, landmarks, hands_api.HAND_CONNECTIONS
                        )

                    cv2.putText(
                        frame, "HAND DETECTED", (20, 40),
                        cv2.FONT_HERSHEY_SIMPLEX, 1,
                        (0, 255, 0), 2
                    )
                else:
                    cv2.putText(
                        frame, "NO HAND DETECTED", (20, 40),
                        cv2.FONT_HERSHEY_SIMPLEX, 1,
                        (0, 0, 255), 2
                    )

                if detected != previous_detection:
                    print("Hand detected:", detected)
                    previous_detection = detected

                cv2.imshow("AirDoodle Hand Detection Test", frame)

                key = cv2.waitKey(1) & 0xFF
                if key == ord("q") or key == 27:
                    break

    finally:
        cap.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
