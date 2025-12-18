"""
Configuration settings for DrugReflector Automation MVP
"""
import os

# Base directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Upload configuration
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
ALLOWED_EXTENSIONS = {'h5ad'}
MAX_CONTENT_LENGTH = 2 * 1024 * 1024 * 1024  # 2GB max file size

# DrugReflector model checkpoints
CHECKPOINT_DIR = os.path.join(BASE_DIR, 'checkpoints')
CHECKPOINT_PATHS = [
    os.path.join(CHECKPOINT_DIR, 'model_fold_0.pt'),
    os.path.join(CHECKPOINT_DIR, 'model_fold_1.pt'),
    os.path.join(CHECKPOINT_DIR, 'model_fold_2.pt'),
]

# Ensure directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(CHECKPOINT_DIR, exist_ok=True)

# Flask configuration
class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    UPLOAD_FOLDER = UPLOAD_FOLDER
    MAX_CONTENT_LENGTH = MAX_CONTENT_LENGTH
