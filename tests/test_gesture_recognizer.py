import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from utils.gesture_recognizer import GestureRecognizer as LegacyGestureRecognizer
from vision.gestures.gesture_recognizer import GestureRecognizer


class GestureRecognizerTests(unittest.TestCase):
    def test_legacy_import_reexports_current_class(self):
        self.assertIs(LegacyGestureRecognizer, GestureRecognizer)

    def test_static_gestures_keep_existing_names(self):
        recognizer = GestureRecognizer()

        self.assertEqual(recognizer.get_static_gesture([0, 0, 0, 0, 0]), "Fist")
        self.assertEqual(recognizer.get_static_gesture([1, 1, 1, 1, 1]), "OpenPalm")
        self.assertEqual(recognizer.get_static_gesture([0, 1, 0, 0, 0]), "Point")
        self.assertEqual(recognizer.get_static_gesture([0, 1, 1, 0, 0]), "Peace")
        self.assertEqual(recognizer.get_static_gesture([1, 0, 0, 0, 0]), "ThumbsUp")

    def test_swipe_detection_uses_index_history(self):
        recognizer = GestureRecognizer(history_len=3)
        recognizer.update_index_history({"landmarks": [(8, 10, 20)]})
        recognizer.update_index_history({"landmarks": [(8, 100, 20)]})

        self.assertEqual(recognizer.get_swipe(min_disp=40), "SwipeRight")


if __name__ == "__main__":
    unittest.main()
