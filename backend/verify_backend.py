import sys
import zipfile
import io
import json
from fastapi.testclient import TestClient

# Ensure backend directory is in python path
from app.main import app

client = TestClient(app)

def generate_dummy_zip():
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
        zip_file.writestr("model/attention.py", "import torch\nimport numpy as np\nprint('attention mechanism')\n")
        zip_file.writestr("model/optimizer.py", "import torch\n# CUDA optimization routines\n")
        zip_file.writestr("package.json", '{"dependencies": {"react": "18.2.0"}}')
        zip_file.writestr("README.md", "# Deep attention model\nThis project implements attention.")
    zip_buffer.seek(0)
    return zip_buffer.getvalue()

def run_tests():
    print("========================================")
    print("Starting AIPSA Backend Verification Tests")
    print("========================================")
    
    # 1. Test Health Check Endpoint
    print("\n[Test 1] Health check endpoint...")
    response = client.get("/")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    data = response.json()
    print("Health check response:", data)
    assert data["status"] == "healthy"
    
    # 2. Test Submission Analysis Endpoint
    print("\n[Test 2] ZIP Submission analysis endpoint...")
    zip_data = generate_dummy_zip()
    response = client.post(
        "/api/analyze-submission",
        data={
            "title": "Attention Model Project",
            "description": "Deep neural attention matrix multiplication optimization",
            "outcomes": json.dumps(["Implement custom attention layers", "Optimize tensor operations"]),
            "questionsCount": 3,
            "focusAreas": json.dumps(["PyTorch", "Performance"])
        },
        files={"file": ("project.zip", zip_data, "application/zip")}
    )
    
    if response.status_code != 200:
        print(f"Error details: {response.text}")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    report = response.json()
    print("Analysis success! Summary findings:")
    print(f"- Title: {report['title']}")
    print(f"- Files Count: {report['files_count']}")
    print(f"- Languages: {report['languages']}")
    print(f"- Confidence: {report['confidence_score']}% ({report['confidence_label']})")
    print(f"- Authenticity Score: {report['authenticity']['score']}% ({report['authenticity']['classification']})")
    print(f"- Suggested Skills Count: {len(report['suggested_skills'])}")
    print(f"- Viva Questions Count: {len(report['viva_questions'])}")
    print(f"- Audit Strengths Count: {len(report['audit']['strengths'])}")
    
    # Assert fields structure
    assert report["title"] == "Attention Model Project"
    assert report["files_count"] > 0
    assert "Python" in report["languages"]
    assert len(report["viva_questions"]) == 3
    
    # 3. Test Viva Evaluation Endpoint
    print("\n[Test 3] Viva evaluation endpoint...")
    viva_req = {
        "question": "Describe the mathematical formulation of your custom attention mechanism, and why it cuts down visual latency.",
        "expectedPoints": [
            "Calculates Query, Key, and Value matrices from input visual tensors.",
            "Applies Scaled Dot-Product Attention: Softmax(QK^T / sqrt(d_k))V."
        ],
        "candidateAnswer": "It calculates Q, K, and V matrices and then calculates the dot product scaled by Softmax to yield attention weights."
    }
    
    response = client.post(
        "/api/evaluate-answer",
        json=viva_req
    )
    
    if response.status_code != 200:
        print(f"Error details: {response.text}")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    eval_result = response.json()
    print("Viva Evaluation response:", eval_result)
    assert "grade" in eval_result
    assert "feedback" in eval_result

    # 4. Test Certificate Analysis Endpoint
    print("\n[Test 4] Certificate analysis endpoint...")
    dummy_image = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00\x3f\x00\x37\xff\xd9" # Smallest valid 1x1 JPEG
    response = client.post(
        "/api/analyze-certificate",
        data={"studentName": "John Doe"},
        files={"file": ("certificate.jpg", dummy_image, "image/jpeg")}
    )
    if response.status_code != 200:
        print(f"Error details: {response.text}")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    cert_result = response.json()
    print("Certificate Analysis response:", cert_result)
    assert "is_authentic" in cert_result
    assert "score" in cert_result
    assert "classification" in cert_result
    assert "summary" in cert_result
    assert "findings" in cert_result

    # 5. Test Skill Suggester Endpoint
    print("\n[Test 5] Skill suggester endpoint...")
    response = client.post(
        "/api/suggest-skills",
        json={
            "title": "Machine Learning Forensics",
            "description": "Deep learning and computer vision pipeline for security audits",
            "outcomes": ["Implemented custom networks", "Processed video feeds using OpenCV"]
        }
    )
    if response.status_code != 200:
        print(f"Error details: {response.text}")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    skills_result = response.json()
    print("Skill Suggester response:", skills_result)
    assert "suggested_skills" in skills_result
    assert len(skills_result["suggested_skills"]) > 0

    # 6. Test Chatbot Endpoint
    print("\n[Test 6] Chatbot message turn endpoint...")
    response = client.post(
        "/api/student",
        json={
            "message": "Hi, what is the best way to get started with machine learning?",
            "session_id": "test_session_123"
        },
        headers={
            "X-Tenant-Id": "tenant_test",
            "X-Student-Id": "student_test"
        }
    )
    if response.status_code != 200:
        print(f"Error details: {response.text}")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    chat_result = response.json()
    print("Chatbot turn response:", chat_result)
    assert "reply" in chat_result
    assert chat_result["session_id"] == "test_session_123"

    # 7. Test Student Profile Endpoint
    print("\n[Test 7] Student profile metadata endpoint...")
    response = client.get(
        "/api/student/profile",
        headers={
            "X-Tenant-Id": "tenant_test",
            "X-Student-Id": "student_test"
        }
    )
    if response.status_code != 200:
        print(f"Error details: {response.text}")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    profile_result = response.json()
    print("Student Profile response:", profile_result)
    assert profile_result["student_id"] == "student_test"
    assert profile_result["tenant_id"] == "tenant_test"
    
    print("\n========================================")
    print("All tests completed successfully!")
    print("========================================")

if __name__ == "__main__":
    try:
        run_tests()
        sys.exit(0)
    except AssertionError as e:
        print(f"\n[FAIL] Assertion failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[FAIL] Unexpected error: {e}")
        sys.exit(1)
