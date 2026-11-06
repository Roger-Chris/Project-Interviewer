import zipfile
import shutil
from pathlib import Path
from typing import List

class SafeExtractor:
    """
    ZIP archive extraction utility that safeguards against path traversal attacks.
    """
    
    @staticmethod
    def is_safe_path(base_dir: Path, target_path: Path) -> bool:
        """
        Validates that target_path is nested inside base_dir to block path traversal exploits.
        """
        try:
            resolved_base = base_dir.resolve()
            resolved_target = target_path.resolve()
            # Verify base_dir is a parent of target_path (or is target_path itself)
            return resolved_base == resolved_target or resolved_base in resolved_target.parents
        except Exception:
            return False

    @staticmethod
    def is_library_file(filename: str) -> bool:
        """
        Detects if a path belongs to library files (e.g. node_modules, venv) to exclude them.
        """
        normalized = filename.replace('\\', '/')
        parts = normalized.lower().split('/')
        library_dirs = {'node_modules', 'venv', '.venv', 'env', '__pycache__', 'dist', 'build', '.git', '.github'}
        return any(p in library_dirs for p in parts)

    @classmethod
    def extract_zip(cls, zip_path: Path, target_dir: Path) -> List[Path]:
        """
        Safely extracts all files from a ZIP archive.
        """
        extracted_files: List[Path] = []
        
        # Clean destination directory if pre-existing to keep extraction isolate
        if target_dir.exists():
            try:
                shutil.rmtree(target_dir)
            except Exception as e:
                # Fallback to ignore lock issues in local workspace
                pass
                
        target_dir.mkdir(parents=True, exist_ok=True)
        resolved_target_dir = target_dir.resolve()
        
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            for member in zip_ref.infolist():
                if cls.is_library_file(member.filename):
                    continue
                
                # Formulate target path
                target_file_path = (resolved_target_dir / member.filename).resolve()
                
                # Intercept Zip-Slip traversal vectors
                if not cls.is_safe_path(resolved_target_dir, target_file_path):
                    raise ValueError(f"Security Warning: Unsafe path traversal detected in ZIP member: {member.filename}")
                
                # Skip direct directory entries, write files only
                if not member.is_dir():
                    # Ensure parent folder hierarchy exists
                    target_file_path.parent.mkdir(parents=True, exist_ok=True)
                    
                    # Read member bytes and copy to files
                    with zip_ref.open(member) as source, open(target_file_path, 'wb') as dest:
                        shutil.copyfileobj(source, dest)
                        
                    extracted_files.append(target_file_path)
                    
        return extracted_files
