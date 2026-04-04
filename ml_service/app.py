import os
import io
import json
import base64
import joblib
import pandas as pd
import torch
import timm
from PIL import Image
from torchvision import transforms
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"}), 200


# ==========================================
# 1. LOAD DYNAMIC PRICING MODEL (XGBoost)
# ==========================================
PRICING_MODEL_PATH = os.path.join(os.path.dirname(__file__), 'models', 'gigshield_model.pkl')
try:
    pricing_data = joblib.load(PRICING_MODEL_PATH)
    pricing_model = pricing_data['model']
    # Map the actual keys from the pkl file
    pricing_encoders = {
        'plan':     pricing_data.get('le_plan'),
        'zone':     pricing_data.get('le_zone'),
        'vehicle':  pricing_data.get('le_vehicle'),
        'platform': pricing_data.get('le_platform'),
    }
    pricing_features = pricing_data.get('features', [])
    print("✅ Dynamic Pricing Model loaded.")
    print(f"   Features: {pricing_features}")
except Exception as e:
    print(f"⚠️ Could not load pricing model: {e}")
    pricing_model = None

# ==========================================
# 2. LOAD CURFEW BLOCKADE MODEL (EfficientNet-B3)
# ==========================================
CURFEW_MODEL_PATH = os.path.join(os.path.dirname(__file__), 'models', 'road_classifier_efficientnet_b3.pth')
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

# Define transform 
IMG_SIZE = 300
curfew_transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])
CURFEW_CLASSES = ['Road_block', 'Road_clear']

try:
    # Build model architecture
    curfew_model = timm.create_model('efficientnet_b3', pretrained=False, num_classes=2)
    
    ckpt = torch.load(CURFEW_MODEL_PATH, map_location=device)
    if isinstance(ckpt, dict) and 'model_state_dict' in ckpt:
        curfew_model.load_state_dict(ckpt['model_state_dict'])
        if 'class_names' in ckpt:
            CURFEW_CLASSES = ckpt['class_names']
    else:
        # If it's just the state dict
        curfew_model.load_state_dict(ckpt)
        
    curfew_model = curfew_model.to(device)
    curfew_model.eval()
    print("✅ Curfew Blockade Model loaded.")
except Exception as e:
    print(f"⚠️ Could not load curfew model: {e}")
    curfew_model = None


@app.route('/predict/premium', methods=['POST'])
def predict_premium():
    if not pricing_model:
        return jsonify({"success": False, "message": "Pricing model not loaded"}), 500
        
    try:
        data = request.json
        
        plan_name = data.get('plan', 'RAKSHAK').upper()
        risk_zone = data.get('risk_zone', 'MODERATE').upper()
        claim_history = int(data.get('claim_history', 0))
        policy_year = int(data.get('policy_year', 1))
        heat_addon = int(data.get('heat_addon', 0))
        disruption_days_hist = int(data.get('disruption_days_hist', 5))
        platform = data.get('platform', 'Zomato')
        
        # Base premiums per plan  
        base_premium_map = {'SAATHI': 399, 'RAKSHAK': 699, 'SURAKSHA': 999}
        
        # Zone factors
        zone_factor_map = {'HIGH': 1.20, 'MODERATE': 1.00, 'SAFE': 0.85}
        
        # Claim history factors
        claim_factor_map = {0: 0.90, 1: 1.00, 2: 1.15}
        
        # Loyalty factors
        loyalty_map = {1: 1.0, 2: 0.95, 3: 0.90}
        
        base_premium = base_premium_map.get(plan_name, 699)
        zone_factor = zone_factor_map.get(risk_zone, 1.0)
        claim_factor = claim_factor_map.get(min(claim_history, 2), 1.0)
        loyalty_factor = loyalty_map.get(min(policy_year, 3), 0.90)
        
        # Encode using saved label encoders
        plan_enc = int(pricing_encoders['plan'].transform([plan_name])[0]) if pricing_encoders.get('plan') else 1
        zone_enc = int(pricing_encoders['zone'].transform([risk_zone])[0]) if pricing_encoders.get('zone') else 1
        veh_enc  = int(pricing_encoders['vehicle'].transform([data.get('vehicle_type', 'two_wheeler')])[0]) if pricing_encoders.get('vehicle') else 0
        plat_enc = int(pricing_encoders['platform'].transform([platform])[0]) if pricing_encoders.get('platform') else 0
        
        monthly_earnings = float(data.get('monthly_earnings', 20000))
        daily_hours = float(data.get('daily_hours', 8))
        
        # Build feature vector matching the trained model exactly (order matters!)
        input_row = {
            'plan_enc':              [plan_enc],
            'zone_enc':              [zone_enc],
            'claim_history':         [min(claim_history, 2)],
            'policy_year':           [min(policy_year, 3)],
            'heat_addon':            [heat_addon],
            'monthly_earnings':      [monthly_earnings],
            'daily_hours':           [daily_hours],
            'veh_enc':               [veh_enc],
            'plat_enc':              [plat_enc],
            'disruption_days_hist':  [disruption_days_hist],
            'zone_factor':           [zone_factor],
            'claim_factor':          [claim_factor],
            'loyalty_factor':        [loyalty_factor],
            'base_premium':          [base_premium],
        }
        
        df = pd.DataFrame(input_row)
        prediction = pricing_model.predict(df)[0]
        
        return jsonify({
            "success": True, 
            "data": {
                "final_price": float(prediction)
            }
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route('/predict/curfew', methods=['POST'])
def predict_curfew():
    if not curfew_model:
        return jsonify({"success": False, "message": "Curfew model not loaded"}), 500
        
    try:
        if 'image' in request.files:
            file = request.files['image']
            img = Image.open(file.stream).convert('RGB')
        elif request.json and 'image_base64' in request.json:
            img_data = request.json['image_base64']
            if ',' in img_data:
                img_data = img_data.split(',')[1]
            img_bytes = base64.b64decode(img_data)
            img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
        else:
            return jsonify({"success": False, "message": "No image provided"}), 400

        # Preprocess
        tensor = curfew_transform(img).unsqueeze(0).to(device)

        # Inference
        with torch.no_grad():
            output = curfew_model(tensor)
            probs = torch.softmax(output, dim=1).cpu().squeeze().numpy()

        pred_idx = probs.argmax()
        pred_class = CURFEW_CLASSES[pred_idx]
        confidence = float(probs[pred_idx])

        return jsonify({
            "success": True,
            "data": {
                "prediction": pred_class,
                "confidence": confidence,
                "is_blocked": "block" in pred_class.lower()
            }
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
port = int(os.environ.get("PORT", 10000))
app.run(host='0.0.0.0', port=port)

