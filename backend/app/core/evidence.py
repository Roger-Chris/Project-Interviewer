import os
from pathlib import Path
from typing import Dict, Any, List

class EvidenceEngine:
    """
    Compiles raw repository scan statistics and file extracts into a structured,
    compact JSON Evidence Map, optimizing context size for local Qwen model calls.
    """
    
    # Maximum size of individual file content to include in full (2KB)
    MAX_FILE_SIZE_FULL = 2048
    
    # Maximum lines of code to capture from larger files (first 40 lines)
    MAX_LARGE_FILE_LINES = 40

    @classmethod
    def compile_evidence(cls, root_dir: Path, scan_results: Dict[str, Any]) -> Dict[str, Any]:
        resolved_root = root_dir.resolve()
        
        file_snippets: Dict[str, str] = {}
        critical_extensions = ['.py', '.js', '.jsx', '.ts', '.tsx', '.yml', '.yaml', '.json', '.md']

        total_snippet_chars = 0
        MAX_SNIPPET_CHARS = 1500 # Limit to ~600 tokens to fit 4096 context window

        # Extract file structural content
        for relative_path_str in scan_results.get("files_list", []):
            if total_snippet_chars >= MAX_SNIPPET_CHARS:
                break
                
            path = resolved_root / relative_path_str
            if not path.is_file():
                continue
                
            ext = path.suffix.lower()
            
            # Focus on source, config, and documentation files
            if ext in critical_extensions or path.name.lower() == 'dockerfile':
                try:
                    file_size = path.stat().st_size
                    content = ""
                    
                    if file_size <= cls.MAX_FILE_SIZE_FULL:
                        # File is small, load completely
                        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                            content = f.read()
                    else:
                        # File is large, extract only header and imports (first 40 lines)
                        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                            lines = [next(f) for _ in range(cls.MAX_LARGE_FILE_LINES)]
                            content = "".join(lines) + "\n\n... [Content Truncated] ..."
                    
                    if content:
                        file_snippets[relative_path_str] = content
                        total_snippet_chars += len(content)
                except Exception:
                    pass

        # Assemble clean JSON Map
        return {
            "summary": {
                "file_count": scan_results.get("file_count", 0),
                "languages": scan_results.get("languages", {}),
                "features": scan_results.get("features", {})
            },
            "manifest": {
                "dependencies": scan_results.get("dependencies", [])[:15], # Top 15 packages
                "config_files": scan_results.get("config_files", []),
                "api_routes": scan_results.get("api_routes", [])[:15]
            },
            "source_evidence": file_snippets
        }
