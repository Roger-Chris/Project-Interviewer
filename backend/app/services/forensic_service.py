import logging
from typing import Any, List, Dict, Tuple
import cv2
import numpy as np

logger = logging.getLogger(__name__)

class ForensicService:
    # Default threshold configurations matching SkillForge settings
    BASELINE_SHIFT_THRESHOLD = 0.015
    FONT_SCALE_VARIANCE_THRESHOLD = 0.20
    ELA_JPEG_QUALITY = 90
    ELA_VARIANCE_THRESHOLD = 20.0

    @staticmethod
    def _neighbor_lines(line_blocks: List[Dict[str, Any]], target_top: float, limit: int = 5) -> List[Dict[str, Any]]:
        ordered = sorted(line_blocks, key=lambda x: abs(float(x.get("bounding_box", {}).get("Top", 0.0)) - target_top))
        return ordered[:limit]

    @staticmethod
    def _bbox_to_pixels(bbox: Dict[str, float], width: int, height: int) -> Tuple[int, int, int, int]:
        left = max(0, int(float(bbox.get("Left", 0.0)) * width))
        top = max(0, int(float(bbox.get("Top", 0.0)) * height))
        w = max(1, int(float(bbox.get("Width", 0.0)) * width))
        h = max(1, int(float(bbox.get("Height", 0.0)) * height))
        x2 = min(width, left + w)
        y2 = min(height, top + h)
        return left, top, x2, y2

    def analyze(self, image_bytes: bytes, student_name: str, line_blocks: List[Dict[str, Any]]) -> List[str]:
        """
        Runs geometric & pixel-level Error Level Analysis (ELA) around the student name bounding box.
        """
        flags: List[str] = []
        
        # 1. Locate student name in Textract blocks to retrieve bounding box
        target_bbox = None
        for block in line_blocks:
            if student_name.lower() in block.get("text", "").lower():
                target_bbox = block.get("bounding_box")
                break
                
        if not target_bbox:
            flags.append("STUDENT_NAME_GEOMETRY_NOT_FOUND")
            return flags

        target_top = float(target_bbox.get("Top", 0.0))
        target_height = float(target_bbox.get("Height", 0.0))

        # 2. Geometric alignment analysis
        neighbors = self._neighbor_lines(line_blocks, target_top)
        neighbor_tops = [float(n.get("bounding_box", {}).get("Top", 0.0)) for n in neighbors if n.get("bounding_box")]
        neighbor_heights = [float(n.get("bounding_box", {}).get("Height", 0.0)) for n in neighbors if n.get("bounding_box")]

        if neighbor_tops:
            baseline_variance = float(np.mean([abs(t - target_top) for t in neighbor_tops]))
            if baseline_variance > self.BASELINE_SHIFT_THRESHOLD:
                flags.append(f"BASELINE_SHIFT_ANOMALY:{baseline_variance:.6f}")

        if neighbor_heights:
            median_height = float(np.median(neighbor_heights))
            if median_height > 0:
                scale_variance = abs(target_height - median_height) / median_height
                if scale_variance > self.FONT_SCALE_VARIANCE_THRESHOLD:
                    flags.append(f"FONT_SCALE_ANOMALY:{scale_variance:.6f}")

        # 3. Pixel-level Error Level Analysis (ELA)
        np_img = np.frombuffer(image_bytes, dtype=np.uint8)
        image = cv2.imdecode(np_img, cv2.IMREAD_COLOR)
        if image is None:
            flags.append("IMAGE_DECODE_FAILED")
            return flags

        h, w = image.shape[:2]
        x1, y1, x2, y2 = self._bbox_to_pixels(target_bbox, w, h)
        crop = image[y1:y2, x1:x2]

        if crop.size == 0:
            flags.append("EMPTY_NAME_CROP")
            return flags

        ok, recompressed = cv2.imencode(
            ".jpg",
            crop,
            [int(cv2.IMWRITE_JPEG_QUALITY), self.ELA_JPEG_QUALITY],
        )
        if not ok:
            flags.append("ELA_RECOMPRESS_FAILED")
            return flags

        jpeg_crop = cv2.imdecode(recompressed, cv2.IMREAD_COLOR)
        if jpeg_crop is None or jpeg_crop.shape != crop.shape:
            flags.append("ELA_RELOAD_FAILED")
            return flags

        ela_diff = cv2.absdiff(crop, jpeg_crop)
        ela_variance = float(np.var(ela_diff))
        if ela_variance > self.ELA_VARIANCE_THRESHOLD:
            flags.append(f"ELA_INSERTION_ANOMALY:{ela_variance:.3f}")

        return flags
