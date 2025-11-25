from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import torch
from torchvision import models, transforms
from PIL import Image
import io
import uvicorn
import torch.nn as nn
import os
import numpy as np
import cv2
import base64
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget
from pytorch_grad_cam.utils.image import show_cam_on_image

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
MODEL_PATH = os.path.join(project_root, "models", "model.pth")

CLASSES = ['Cataract', 'Conjunctivitis', 'Eyelid', 'Jaundice', 'Normal', 'Uveitis']
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

MEDICAL_INFO = {
    'Cataract': {
        'description': "Clouding of the normally clear lens of the eye.",
        'symptoms': ["Clouded, blurred or dim vision", "Increasing difficulty with vision at night", "Sensitivity to light and glare", "Need for brighter light for reading"],
        'treatment': ["New prescription glasses (early stage)", "Phacoemulsification (Surgery) is the only effective cure"],
        'severity': "Moderate",
        'advice': "Surgery is highly successful. Consult a specialist if daily activities are impacted."
    },
    'Conjunctivitis': {
        'description': "Inflammation of the transparent membrane (conjunctiva) lining the eyelid.",
        'symptoms': ["Redness in one or both eyes", "Itchiness", "A gritty feeling", "Discharge that forms a crust"],
        'treatment': ["Artificial tears", "Antibiotic eyedrops (if bacterial)", "Cold compresses"],
        'severity': "Low",
        'advice': "Highly contagious if viral/bacterial. Wash hands frequently and change towels daily."
    },
    'Eyelid': {
        'description': "Inflammation or infection of the eyelid (e.g., Stye, Chalazion, Blepharitis).",
        'symptoms': ["Red, painful lump near eyelid edge", "Swelling of the eyelid", "Crusting of eyelashes"],
        'treatment': ["Warm compresses (10-15 mins, 4x daily)", "Antibiotic ointment", "Eyelid scrubs"],
        'severity': "Low",
        'advice': "Most styes heal on their own. Do not squeeze or pop them."
    },
    'Jaundice': {
        'description': "Yellowing of the skin and whites of the eyes due to high bilirubin.",
        'symptoms': ["Yellow sclera (eyes)", "Dark urine", "Pale stools", "Fatigue"],
        'treatment': ["Treating the underlying liver/gallbladder condition", "Hydration"],
        'severity': "High (Systemic)",
        'advice': "This is a sign of liver dysfunction. See a General Practitioner or Internist immediately."
    },
    'Uveitis': {
        'description': "Inflammation of the middle layer of the eye (uvea).",
        'symptoms': ["Eye redness", "Eye pain", "Light sensitivity", "Blurred vision", "Dark floating spots"],
        'treatment': ["Corticosteroid eye drops", "Immunosuppressive drugs"],
        'severity': "High",
        'advice': "Can lead to permanent vision loss if untreated. Requires urgent ophthalmologist care."
    },
    'Normal': {
        'description': "No significant pathology detected.",
        'symptoms': ["None"],
        'treatment': ["Routine eye care"],
        'severity': "None",
        'advice': "Continue regular checkups every 1-2 years. Follow the 20-20-20 rule for screen time."
    }
}

def load_model():
    if not os.path.exists(MODEL_PATH): return None
    model = models.efficientnet_b3(weights=None)
    model.classifier[1] = nn.Linear(model.classifier[1].in_features, len(CLASSES))
    try:
        model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
        model.to(DEVICE)
        model.eval()
        return model
    except: return None

model = load_model()

target_layers = [model.features[-1]] if model else []

preprocess = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if model is None: return {"error": "Model not loaded"}

    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert('RGB')
    
    input_tensor = preprocess(image).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        output = model(input_tensor)
        probs = torch.nn.functional.softmax(output[0], dim=0)
    
    conf, idx = torch.max(probs, 0)
    diagnosis = CLASSES[idx.item()]

    img_resized = image.resize((224, 224))
    rgb_img = np.float32(img_resized) / 255
    
    cam = GradCAM(model=model, target_layers=target_layers)
    grayscale_cam = cam(input_tensor=input_tensor, targets=[ClassifierOutputTarget(idx.item())])
    grayscale_cam = grayscale_cam[0, :]
    
    visualization = show_cam_on_image(rgb_img, grayscale_cam, use_rgb=True)
    
    pil_viz = Image.fromarray(visualization)
    buff = io.BytesIO()
    pil_viz.save(buff, format="JPEG")
    heatmap_base64 = base64.b64encode(buff.getvalue()).decode("utf-8")

    return {
        "diagnosis": diagnosis,
        "confidence": float(conf.item()) * 100,
        "details": MEDICAL_INFO.get(diagnosis, {}),
        "heatmap": f"data:image/jpeg;base64,{heatmap_base64}", 
        "probabilities": {CLASSES[i]: float(probs[i].item()) for i in range(len(CLASSES))}
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)