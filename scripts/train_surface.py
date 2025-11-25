import os
import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import datasets, models, transforms
from torch.utils.data import DataLoader, WeightedRandomSampler
import numpy as np
import sys

TARGET_FOLDER = 'Ocular Surface Disorders' 
SAVE_NAME = 'specialist_surface.pth'

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT, 'dataset', TARGET_FOLDER)
MODEL_SAVE_PATH = os.path.join(PROJECT_ROOT, 'models', SAVE_NAME)

BATCH_SIZE = 16
IMG_SIZE = 224
EPOCHS = 25
TARGET_SAMPLES_PER_CLASS = 2000

def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"🚀 Training Specialist for: {TARGET_FOLDER}")
    print(f"📂 Data Source: {DATA_DIR}")
    
    if not os.path.exists(DATA_DIR):
        print(f"❌ Error: Folder not found! Check spelling of '{TARGET_FOLDER}'")
        return

    train_transforms = transforms.Compose([
        transforms.Resize((255, 255)),
        transforms.RandomRotation(20),
        transforms.RandomResizedCrop(IMG_SIZE, scale=(0.7, 1.0)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomVerticalFlip(),
        transforms.ColorJitter(brightness=0.15, contrast=0.15),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])

    dataset = datasets.ImageFolder(DATA_DIR, transform=train_transforms)
    class_names = dataset.classes
    print(f"✅ Classes Found: {class_names}")

    targets = dataset.targets
    class_counts = np.bincount(targets)
    class_weights = 1. / class_counts
    sample_weights = class_weights[targets]
    
    num_samples = TARGET_SAMPLES_PER_CLASS * len(class_names)
    sampler = WeightedRandomSampler(weights=sample_weights, num_samples=num_samples, replacement=True)
    
    train_loader = DataLoader(dataset, batch_size=BATCH_SIZE, sampler=sampler, num_workers=0)
    print(f"⚖️  Sampler Active: Will train on {num_samples} images per epoch.")

    model = models.efficientnet_b3(weights='DEFAULT')
    model.classifier[1] = nn.Linear(model.classifier[1].in_features, len(class_names))
    model = model.to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=0.0005) 
    
    print("--- Starting Specialist Training ---")
    for epoch in range(EPOCHS):
        model.train()
        running_loss = 0.0
        correct = 0
        
        for i, (inputs, labels) in enumerate(train_loader):
            inputs, labels = inputs.to(device), labels.to(device)
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            running_loss += loss.item()
            _, preds = torch.max(outputs, 1)
            correct += (preds == labels).sum().item()

            if i % 10 == 0:
                sys.stdout.write(f"\rEpoch {epoch+1} | Batch {i} | Loss: {loss.item():.4f}")
                sys.stdout.flush()

        print(f"\nEpoch {epoch+1} Acc: {correct/(len(train_loader)*BATCH_SIZE):.4f}")

    torch.save(model.state_dict(), MODEL_SAVE_PATH)
    print(f"✅ Specialist Saved: {SAVE_NAME}")

if __name__ == "__main__":
    main()