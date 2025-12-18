"""
DrugReflector Automation MVP - Flask Backend
Automated phenotypic drug discovery application
"""
import os
import uuid
import traceback
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
import pandas as pd

# Import configuration
from config import Config, UPLOAD_FOLDER, CHECKPOINT_PATHS, CHECKPOINT_DIR

# Import utilities from modular components
from utils.validation import allowed_file, check_checkpoints_exist, validate_group_column
from utils.metadata import extract_metadata
from utils.prediction import (
    compute_vscores_adata,
    preprocess_adata,
    run_drugreflector_prediction,
    format_prediction_results,
    get_vscore_summary
)

app = Flask(__name__, static_folder='static')
app.config.from_object(Config)
CORS(app)

# Store file metadata in memory (for MVP - use database in production)
file_store = {}


# ============== API Endpoints ==============

@app.route('/')
def index():
    """Serve the main application page"""
    return send_from_directory('.', 'index.html')

@app.route('/static/<path:path>')
def serve_static(path):
    """Serve static files"""
    return send_from_directory('static', path)

@app.route('/api/status', methods=['GET'])
def get_status():
    """Get application status and check dependencies"""
    checkpoints_ok, missing = check_checkpoints_exist()
    
    # Check if drugreflector is available
    try:
        import drugreflector
        dr_available = True
        dr_version = getattr(drugreflector, '__version__', 'unknown')
    except ImportError:
        dr_available = False
        dr_version = None
    
    # Check if scanpy is available
    try:
        import scanpy
        scanpy_available = True
        scanpy_version = scanpy.__version__
    except ImportError:
        scanpy_available = False
        scanpy_version = None
    
    return jsonify({
        'status': 'ok' if (checkpoints_ok and dr_available) else 'incomplete',
        'drugreflector': {
            'available': dr_available,
            'version': dr_version
        },
        'scanpy': {
            'available': scanpy_available,
            'version': scanpy_version
        },
        'checkpoints': {
            'available': checkpoints_ok,
            'missing': missing,
            'directory': CHECKPOINT_DIR
        }
    })

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """Handle file upload"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type. Only .h5ad files are allowed'}), 400
    
    # Generate unique file ID
    file_id = str(uuid.uuid4())
    filename = secure_filename(file.filename)
    filepath = os.path.join(UPLOAD_FOLDER, f"{file_id}_{filename}")
    
    # Save file
    file.save(filepath)
    
    # Store file info
    file_store[file_id] = {
        'filename': filename,
        'filepath': filepath,
        'uploaded_at': pd.Timestamp.now().isoformat()
    }
    
    return jsonify({
        'file_id': file_id,
        'filename': filename,
        'message': 'File uploaded successfully'
    })

@app.route('/api/metadata/<file_id>', methods=['GET'])
def get_metadata(file_id):
    """Extract and return AnnData metadata"""
    if file_id not in file_store:
        return jsonify({'error': 'File not found'}), 404
    
    filepath = file_store[file_id]['filepath']
    
    try:
        import anndata as ad
        
        # Load AnnData
        adata = ad.read_h5ad(filepath)
        
        # Extract metadata using utility function
        metadata = extract_metadata(adata, file_id, file_store[file_id]['filename'])
        
        return jsonify(metadata)
    
    except Exception as e:
        return jsonify({
            'error': f'Failed to read file: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500

@app.route('/api/analyze', methods=['POST'])
def analyze():
    """Run the full DrugReflector analysis pipeline"""
    data = request.get_json()
    
    # Validate required fields
    required_fields = ['file_id', 'group_col', 'source_group', 'target_group']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    file_id = data['file_id']
    if file_id not in file_store:
        return jsonify({'error': 'File not found'}), 404
    
    # Check if checkpoints exist
    checkpoints_ok, missing = check_checkpoints_exist()
    if not checkpoints_ok:
        return jsonify({
            'error': 'Model checkpoints not found',
            'missing_files': missing,
            'instructions': f'Please download checkpoints from Zenodo (DOI: 10.5281/zenodo.16912444) and place them in {CHECKPOINT_DIR}'
        }), 500
    
    filepath = file_store[file_id]['filepath']
    group_col = data['group_col']
    source_group = data['source_group']
    target_group = data['target_group']
    n_top = data.get('n_top', 50)
    
    try:
        import anndata as ad
        
        # Step 1: Load AnnData
        adata = ad.read_h5ad(filepath)
        
        # Step 2: Validate group column and groups
        valid, error_msg = validate_group_column(adata, group_col, source_group, target_group)
        if not valid:
            return jsonify({'error': error_msg}), 400
        
        # Step 3: Preprocessing
        adata, preprocessing_steps = preprocess_adata(adata)
        
        # Step 4: Compute v-scores
        vscores = compute_vscores_adata(
            adata,
            group_col=group_col,
            group1_value=source_group,
            group2_value=target_group
        )
        
        # Generate v-score summary
        vscore_summary = get_vscore_summary(vscores)
        
        # Step 5: Run DrugReflector prediction
        predictions = run_drugreflector_prediction(vscores, CHECKPOINT_PATHS, n_top=n_top)
        
        # Step 6: Format results (including iLINCS URLs)
        results_df = format_prediction_results(predictions, vscores, n_top=n_top)
        
        # Step 7: Cleanup uploaded file to save disk space
        filepath = file_store.get(file_id, {}).get('filepath')
        if filepath and os.path.exists(filepath):
            os.remove(filepath)
            print(f"Cleaned up uploaded file: {filepath}")
        if file_id in file_store:
            del file_store[file_id]
        
        return jsonify({
            'success': True,
            'analysis': {
                'source_group': source_group,
                'target_group': target_group,
                'group_column': group_col,
                'transition_name': vscores.name
            },
            'preprocessing': preprocessing_steps,
            'vscore_summary': vscore_summary,
            'predictions': results_df.to_dict(orient='records'),
            'n_compounds': len(results_df)
        })
    
    except ImportError as e:
        return jsonify({
            'error': f'Missing dependency: {str(e)}',
            'instructions': 'Please install required packages: pip install drugreflector scanpy anndata'
        }), 500
    
    except Exception as e:
        return jsonify({
            'error': f'Analysis failed: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500

@app.route('/api/export/<file_id>', methods=['GET'])
def export_results(file_id):
    """Export analysis results (placeholder for now)"""
    # In a full implementation, this would retrieve cached results
    return jsonify({'message': 'Export endpoint - run analysis first'}), 200

@app.route('/api/cleanup/<file_id>', methods=['DELETE'])
def cleanup_file(file_id):
    """Remove uploaded file"""
    if file_id not in file_store:
        return jsonify({'error': 'File not found'}), 404
    
    filepath = file_store[file_id]['filepath']
    if os.path.exists(filepath):
        os.remove(filepath)
    
    del file_store[file_id]
    return jsonify({'message': 'File removed successfully'})

# ============== Main ==============

if __name__ == '__main__':
    print("=" * 60)
    print("DrugReflector Automation MVP")
    print("=" * 60)
    
    # Check dependencies
    checkpoints_ok, missing = check_checkpoints_exist()
    if not checkpoints_ok:
        print("\n⚠️  WARNING: Model checkpoints not found!")
        print(f"   Missing: {missing}")
        print(f"   Please download from Zenodo (DOI: 10.5281/zenodo.16912444)")
        print(f"   Place files in: {CHECKPOINT_DIR}")
    else:
        print("✓ Model checkpoints found")
    
    try:
        import drugreflector
        print("✓ DrugReflector installed")
    except ImportError:
        print("⚠️  DrugReflector not installed. Run: pip install drugreflector")
    
    try:
        import scanpy
        print("✓ Scanpy installed")
    except ImportError:
        print("⚠️  Scanpy not installed. Run: pip install scanpy")
    
    print("\n" + "=" * 60)
    print("Starting server at http://localhost:5001")
    print("=" * 60 + "\n")
    
    app.run(debug=True, host='0.0.0.0', port=5001)
