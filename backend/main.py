from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
import torch
from torchvision import models, transforms
from PIL import Image
import io
import uvicorn
import torch.nn as nn
import os
import numpy as np
import base64
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget
from pytorch_grad_cam.utils.image import show_cam_on_image
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from medical_data import MEDICAL_INFO

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
MODELS_DIR = os.path.join(project_root, "models")
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

HIERARCHY = {
    0: {'name': 'Adnexal Oculoplastic', 'model_file': 'specialist_eyelid.pth', 'default_class': 'Eyelid'},
    1: {'name': 'Anterior Segment Pathology', 'model_file': 'specialist_anterior.pth'},
    2: {'name': 'Ocular Surface Disorders', 'model_file': 'specialist_surface.pth'}
}

CLASS_MAP = {
    0: ['Eyelid'], 
    1: ['Cataract', 'Uveitis'],
    2: ['Conjunctivitis', 'Jaundice', 'Normal', 'Pterygium']
}

def load_model_architecture(model_type, num_classes):
    if model_type == 'router':
        model = models.mobilenet_v3_large(weights=None)
        model.classifier[3] = torch.nn.Linear(model.classifier[3].in_features, num_classes)
    else:
        model = models.efficientnet_b3(weights=None)
        model.classifier[1] = torch.nn.Linear(model.classifier[1].in_features, num_classes)
    return model

def load_system():
    print("Loading AI System...")
    
    router = load_model_architecture('router', len(HIERARCHY))
    router_path = os.path.join(MODELS_DIR, 'router.pth')
    
    if os.path.exists(router_path):
        router.load_state_dict(torch.load(router_path, map_location=DEVICE))
        router.to(DEVICE).eval()
        print("✅ Router Loaded")
    else:
        print("❌ Router Model Missing!")
        return None, None

    specialists = {}
    for idx, info in HIERARCHY.items():
        classes = CLASS_MAP[idx]
        
        if len(classes) <= 1:
            print(f"ℹ️  Group {idx} ({info['name']}) is Single-Class. Skipping specialist model.")
            specialists[idx] = {'type': 'direct', 'class': classes[0], 'group_name': info['name']}
            continue

        model = load_model_architecture('specialist', len(classes))
        spec_path = os.path.join(MODELS_DIR, info['model_file'])
        
        if os.path.exists(spec_path):
            model.load_state_dict(torch.load(spec_path, map_location=DEVICE))
            model.to(DEVICE).eval()
            specialists[idx] = {'type': 'model', 'model': model, 'classes': classes, 'group_name': info['name']}
            print(f"✅ Loaded Specialist: {info['name']}")
        else:
            print(f"⚠️ Specialist Missing: {info['name']}")

    return router, specialists

router, specialists = load_system()

preprocess = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

@app.post("/predict")
async def predict(file: UploadFile = File(...), pain: str = Form(...), vision: str = Form(...), itch: str = Form(...)):
    if not router: return {"error": "AI System Offline"}

    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert('RGB')
        input_tensor = preprocess(image).unsqueeze(0).to(DEVICE)
        
        with torch.no_grad():
            router_out = router(input_tensor)
            router_probs = torch.nn.functional.softmax(router_out[0], dim=0)
            group_idx = torch.argmax(router_probs).item()
            group_conf = router_probs[group_idx].item()
        
        spec_data = specialists.get(group_idx)
        if not spec_data: return {"error": "Specialist logic missing."}

        heatmap_base64 = None
        probs_dict = {}

        if spec_data['type'] == 'direct':
            diagnosis = spec_data['class']
            confidence = group_conf * 100 
            probs_dict = {diagnosis: 1.0}
            
        else:
            model = spec_data['model']
            with torch.no_grad():
                out = model(input_tensor)
                probs = torch.nn.functional.softmax(out[0], dim=0)
                class_idx = torch.argmax(probs).item()
            
            diagnosis = spec_data['classes'][class_idx]
            confidence = probs[class_idx].item() * 100
            probs_dict = {spec_data['classes'][i]: float(probs[i].item()) for i in range(len(spec_data['classes']))}

            target_layer = [model.features[-1]]
            cam = GradCAM(model=model, target_layers=target_layer)
            grayscale_cam = cam(input_tensor=input_tensor, targets=[ClassifierOutputTarget(class_idx)])
            rgb_img = np.float32(image.resize((224, 224))) / 255
            vis = show_cam_on_image(rgb_img, grayscale_cam[0, :], use_rgb=True)
            
            buff = io.BytesIO()
            Image.fromarray(vis).save(buff, format="JPEG")
            heatmap_base64 = base64.b64encode(buff.getvalue()).decode("utf-8")

        details = MEDICAL_INFO.get(diagnosis, {}).copy()
        
        warnings = []
        if diagnosis == 'Conjunctivitis' and pain == 'Severe': warnings.append("⚠️ Pain Mismatch: Severe pain is unusual for Pink Eye. Rule out Glaucoma.")
        if diagnosis == 'Eyelid' and vision == 'Yes': warnings.append("⚠️ Vision Alert: Eyelid issues shouldn't affect vision significantly. Check cornea.")
        
        if warnings: details['advice'] += " " + " ".join(warnings)

        return {
            "group_name": spec_data['group_name'],
            "diagnosis": diagnosis,
            "confidence": confidence,
            "heatmap": f"data:image/jpeg;base64,{heatmap_base64}" if heatmap_base64 else None,
            "details": details,
            "hybrid_warnings": warnings,
            "probabilities": probs_dict
        }

    except Exception as e:
        print(f"Error: {e}")
        return {"error": str(e)}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)