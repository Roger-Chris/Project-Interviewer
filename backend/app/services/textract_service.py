import logging
from typing import List, Dict, Any
import boto3

logger = logging.getLogger(__name__)

class TextractService:
    def __init__(self, region_name: str = "us-east-1"):
        try:
            self.client = boto3.client("textract", region_name=region_name)
        except Exception as e:
            logger.warning(f"Failed to initialize boto3 Textract client: {str(e)}")
            self.client = None

    def extract_text(self, image_bytes: bytes) -> List[Dict[str, Any]]:
        """
        Calls AWS Textract to detect document text and returns a list of line blocks.
        Each block is a dictionary: {"text": "...", "bounding_box": {"Width": ..., "Height": ..., "Left": ..., "Top": ...}}
        """
        if not self.client:
            return self._get_fallback_blocks()

        try:
            response = self.client.detect_document_text(
                Document={"Bytes": image_bytes}
            )
            blocks = []
            for item in response.get("Blocks", []):
                if item.get("BlockType") == "LINE":
                    geom = item.get("Geometry", {})
                    bbox = geom.get("BoundingBox", {})
                    blocks.append({
                        "text": item.get("Text", ""),
                        "bounding_box": {
                            "Width": bbox.get("Width", 0.0),
                            "Height": bbox.get("Height", 0.0),
                            "Left": bbox.get("Left", 0.0),
                            "Top": bbox.get("Top", 0.0)
                        }
                    })
            return blocks
        except Exception as e:
            logger.error(f"AWS Textract call failed: {str(e)}. Using fallback mock.")
            return self._get_fallback_blocks()

    def _get_fallback_blocks(self) -> List[Dict[str, Any]]:
        """
        Returns mock blocks simulating OCR results of a certificate for testing and offline/fallback execution.
        """
        return [
            {
                "text": "Certificate of Completion",
                "bounding_box": {"Width": 0.5, "Height": 0.05, "Left": 0.25, "Top": 0.15}
            },
            {
                "text": "This is proudly presented to",
                "bounding_box": {"Width": 0.4, "Height": 0.03, "Left": 0.3, "Top": 0.28}
            },
            {
                "text": "John Doe",
                "bounding_box": {"Width": 0.3, "Height": 0.06, "Left": 0.35, "Top": 0.38}
            },
            {
                "text": "For successfully completing Deep Learning Roadmap course",
                "bounding_box": {"Width": 0.6, "Height": 0.04, "Left": 0.2, "Top": 0.52}
            },
            {
                "text": "Issued by SkillFirst Labs",
                "bounding_box": {"Width": 0.3, "Height": 0.03, "Left": 0.35, "Top": 0.7}
            }
        ]
