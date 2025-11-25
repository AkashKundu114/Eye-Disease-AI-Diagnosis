import torch
from torchvision import models, transforms
from PIL import Image
import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(PROJECT_ROOT, 'models')
DATA_ROOT = os.path.join(PROJECT_ROOT, 'dataset')
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

HIERARCHY = {
    0: {'name': 'Ocular Surface', 'model': 'specialist_surface.pth', 'path': 'Ocular Surface Disorders'},
    1: {'name': 'Anterior Pathology', 'model': 'specialist_anterior.pth', 'path': 'Anterior Segment Pathology'},
    2: {'name': 'Adnexal/Eyelid', 'model': 'specialist_eyelid.pth', 'path': 'Adnexal Oculoplastic'}
}

class HierarchicalSystem:
    def __init__(self):
        print(f"🚀 Initializing Hierarchical AI on {DEVICE}...")
        
        self.preprocess = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ])
        
        self.router = models.mobilenet_v3_large(weights=None)
        self.router.classifier[3] = torch.nn.Linear(self.router.classifier[3].in_features, 3)
        self.load_weights(self.router, 'router.pth')
        self.router.eval()
        print("✅ Router Module Online")

        self.specialists = {}
        for idx, info in HIERARCHY.items():
            class_dir = os.path.join(DATA_ROOT, info['path'])
            if os.path.exists(class_dir):
                classes = sorted([d for d in os.listdir(class_dir) if os.path.isdir(os.path.join(class_dir, d))])
                info['classes'] = classes
                
                model = models.efficientnet_b3(weights=None)
                model.classifier[1] = torch.nn.Linear(model.classifier[1].in_features, len(classes))
                
                if self.load_weights(model, info['model']):
                    self.specialists[idx] = model
                    print(f"   ✅ Specialist Loaded: {info['name']} ({len(classes)} classes)")
            else:
                print(f"   ⚠️ Warning: Dataset folder missing for {info['name']}")

    def load_weights(self, model, filename):
        path = os.path.join(MODELS_DIR, filename)
        if os.path.exists(path):
            model.load_state_dict(torch.load(path, map_location=DEVICE))
            model.to(DEVICE)
            return True
        print(f"   ❌ Missing Model File: {filename}")
        return False

    def predict(self, image_path):
        if not os.path.exists(image_path): return {"error": "Image not found"}

        img = Image.open(image_path).convert('RGB')
        tensor = self.preprocess(img).unsqueeze(0).to(DEVICE)

        with torch.no_grad():
            router_out = self.router(tensor)
            router_probs = torch.nn.functional.softmax(router_out[0], dim=0)
            group_idx = torch.argmax(router_probs).item()
            group_conf = router_probs[group_idx].item()

        group_info = HIERARCHY.get(group_idx)
        if not group_info: return {"error": "Router prediction invalid"}

        print(f"\n[Router] Detected: {group_info['name']} ({group_conf*100:.1f}%)")

        if group_idx in self.specialists:
            specialist = self.specialists[group_idx]
            with torch.no_grad():
                spec_out = specialist(tensor)
                spec_probs = torch.nn.functional.softmax(spec_out[0], dim=0)
                class_idx = torch.argmax(spec_probs).item()
                
                diagnosis = group_info['classes'][class_idx]
                confidence = spec_probs[class_idx].item()

            return {
                "group": group_info['name'],
                "group_confidence": group_conf,
                "diagnosis": diagnosis,
                "confidence": confidence
            }
        else:
            return {"error": f"Specialist model for {group_info['name']} is missing."}

if __name__ == "__main__":
    ai = HierarchicalSystem()