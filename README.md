# 👁️ OphthalmoAI – Eye Disease Diagnostic System

A full-stack AI-powered application for detecting **6 types of eye diseases** using a deep learning model built on **EfficientNetB3**.

---

## 🚀 Features

### 🧠 AI Model  
- Trained on **3,500+ medical eye images**  
- Detects: Cataract, Uveitis, Conjunctivitis, and more  
- High accuracy with EfficientNetB3 architecture  

### 📸 Real-time Webcam Mode  
- Live inference using OpenCV  

### 🏥 Medical Dashboard  
- React + Tailwind CSS interface  

### ⚡ FastAPI Backend  
- High-performance inference  

---

## 🛠️ Installation Guide

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/Eye-Disease-AI-Diagnosis.git
cd Eye-Disease-AI-Diagnosis
```

---

## Backend Setup
```bash
python -m venv venv
venv\Scripts\activate   # Windows
source venv/bin/activate # Mac/Linux
pip install -r requirements.txt
```

---

## Frontend Setup
```bash
cd frontend
npm install
```

---

## ⚡ How to Run

### Step 1 — Dataset & Model
Download dataset → put in `dataset/` → train:
```bash
python scripts/train_model.py
```

Creates:
```
models/model.pth
```

### Step 2 — Start Backend
```bash
python backend/main.py
```

### Step 3 — Start Frontend
```bash
cd frontend
npm run dev
```

---

## 📂 Project Structure
```
backend/  
frontend/  
scripts/  
models/  
dataset/
```

---

## 📊 Model Architecture Diagram (Mermaid)
```mermaid
flowchart TD

A[Input Eye Image 224x224 RGB] --> B[Preprocessing Resize Normalize]
B --> C[EfficientNetB3 Backbone ImageNet]
C --> D[Conv Blocks MBConv DepthwiseConv SELayers]
D --> E[Global Average Pooling]
E --> F[Dropout 0.3]
F --> G[Dense Classifier Head]
G --> H[Softmax Output 6 Classes]
```

