"""
DrugReflector Automation MVP - Flask Backend
Automated phenotypic drug discovery application with upstream
single-cell RNA-seq preprocessing, QC, and cell type annotation.
"""
import os
import atexit
import glob
import uuid
import shutil
import traceback
import threading
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

# Multi-batch project store
project_store = {}

# Background integration thread tracking
integration_threads = {}


def cleanup_all_uploads():
    """Remove all uploaded files from disk and clear file_store."""
    # Clean tracked files
    for file_id, info in list(file_store.items()):
        filepath = info.get('filepath')
        if filepath and os.path.exists(filepath):
            try:
                os.remove(filepath)
            except OSError:
                pass
    file_store.clear()

    # Clean any untracked files left in uploads/
    for f in glob.glob(os.path.join(UPLOAD_FOLDER, '*.h5ad')):
        try:
            os.remove(f)
        except OSError:
            pass

    # Clean any 10x temp directories left in uploads/
    for d in glob.glob(os.path.join(UPLOAD_FOLDER, '*_10x')):
        try:
            shutil.rmtree(d, ignore_errors=True)
        except OSError:
            pass


# Purge stale uploads from previous sessions on startup
cleanup_all_uploads()

# Clean up on server shutdown
atexit.register(cleanup_all_uploads)


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

    # Check if scrublet is available
    try:
        import scrublet
        scrublet_available = True
        scrublet_version = getattr(scrublet, '__version__', 'unknown')
    except ImportError:
        scrublet_available = False
        scrublet_version = None

    # Check if celltypist is available
    try:
        import celltypist
        celltypist_available = True
        celltypist_version = getattr(celltypist, '__version__', 'unknown')
    except ImportError:
        celltypist_available = False
        celltypist_version = None

    # Check if scanorama is available
    try:
        import scanorama as _scanorama
        scanorama_available = True
        scanorama_version = getattr(_scanorama, '__version__', 'unknown')
    except ImportError:
        scanorama_available = False
        scanorama_version = None

    # Check if scvi-tools is available
    try:
        import scvi as _scvi
        scvi_available = True
        scvi_version = getattr(_scvi, '__version__', 'unknown')
    except ImportError:
        scvi_available = False
        scvi_version = None

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
        'scrublet': {
            'available': scrublet_available,
            'version': scrublet_version
        },
        'celltypist': {
            'available': celltypist_available,
            'version': celltypist_version
        },
        'checkpoints': {
            'available': checkpoints_ok,
            'missing': missing,
            'directory': CHECKPOINT_DIR
        },
        'scanorama': {
            'available': scanorama_available,
            'version': scanorama_version
        },
        'scvi': {
            'available': scvi_available,
            'version': scvi_version
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


# ============== Upstream Preprocessing Endpoints ==============

@app.route('/api/upload-10x', methods=['POST'])
def upload_10x():
    """Handle Cell Ranger filtered_feature_bc_matrix upload (3 files)"""
    required_files = ['barcodes', 'features', 'matrix']
    uploaded = {}

    for key in required_files:
        if key not in request.files:
            return jsonify({'error': f'Missing file: {key}'}), 400
        uploaded[key] = request.files[key]

    # Generate unique file ID and temp directory
    file_id = str(uuid.uuid4())
    temp_dir = os.path.join(UPLOAD_FOLDER, f"{file_id}_10x")
    os.makedirs(temp_dir, exist_ok=True)

    try:
        # Save the 3 files with standard names
        file_map = {
            'barcodes': 'barcodes.tsv.gz',
            'features': 'features.tsv.gz',
            'matrix': 'matrix.mtx.gz',
        }
        for key, standard_name in file_map.items():
            uploaded[key].save(os.path.join(temp_dir, standard_name))

        # Read into AnnData
        from utils.preprocessing import read_10x_mtx
        adata = read_10x_mtx(temp_dir)

        # Save as h5ad
        h5ad_path = os.path.join(UPLOAD_FOLDER, f"{file_id}_cellranger.h5ad")
        adata.write_h5ad(h5ad_path)

        # Store file info
        file_store[file_id] = {
            'filename': 'cellranger_data.h5ad',
            'filepath': h5ad_path,
            'source': '10x',
            'uploaded_at': pd.Timestamp.now().isoformat()
        }

        # Clean up temp directory
        shutil.rmtree(temp_dir, ignore_errors=True)

        return jsonify({
            'file_id': file_id,
            'filename': 'cellranger_data.h5ad',
            'source': '10x',
            'n_cells': int(adata.n_obs),
            'n_genes': int(adata.n_vars),
            'message': 'Cell Ranger data loaded successfully'
        })

    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        return jsonify({
            'error': f'Failed to read Cell Ranger data: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500


@app.route('/api/upload-10x-h5', methods=['POST'])
def upload_10x_h5():
    """Handle Cell Ranger .h5 file upload"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not file.filename.lower().endswith('.h5'):
        return jsonify({'error': 'Invalid file type. Only .h5 files are allowed'}), 400

    file_id = str(uuid.uuid4())
    filename = secure_filename(file.filename)
    h5_path = os.path.join(UPLOAD_FOLDER, f"{file_id}_{filename}")

    try:
        file.save(h5_path)

        from utils.preprocessing import read_10x_h5
        adata = read_10x_h5(h5_path)

        # Save as h5ad
        h5ad_path = os.path.join(UPLOAD_FOLDER, f"{file_id}_cellranger.h5ad")
        adata.write_h5ad(h5ad_path)

        # Remove the original .h5 file
        os.remove(h5_path)

        file_store[file_id] = {
            'filename': filename,
            'filepath': h5ad_path,
            'source': '10x',
            'uploaded_at': pd.Timestamp.now().isoformat()
        }

        return jsonify({
            'file_id': file_id,
            'filename': filename,
            'source': '10x',
            'n_cells': int(adata.n_obs),
            'n_genes': int(adata.n_vars),
            'message': 'Cell Ranger H5 data loaded successfully'
        })

    except Exception as e:
        # Clean up on failure
        if os.path.exists(h5_path):
            os.remove(h5_path)
        return jsonify({
            'error': f'Failed to read Cell Ranger H5 file: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500


@app.route('/api/qc-metrics/<file_id>', methods=['POST'])
def compute_qc_metrics_endpoint(file_id):
    """Compute QC metrics and return plot data"""
    if file_id not in file_store:
        return jsonify({'error': 'File not found'}), 404

    filepath = file_store[file_id]['filepath']

    try:
        import anndata as ad
        from utils.preprocessing import compute_qc_metrics, get_qc_plot_data

        adata = ad.read_h5ad(filepath)

        # Compute QC metrics
        qc_info = compute_qc_metrics(adata)

        # Get plot data
        plot_data = get_qc_plot_data(adata)

        # Save adata with QC annotations
        adata.write_h5ad(filepath)

        return jsonify({
            'success': True,
            'qc_info': qc_info,
            'plot_data': plot_data
        })

    except Exception as e:
        return jsonify({
            'error': f'QC metrics computation failed: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500


@app.route('/api/qc-filter', methods=['POST'])
def apply_qc_filter():
    """Apply user-chosen QC thresholds"""
    data = request.get_json()
    file_id = data.get('file_id')

    if not file_id or file_id not in file_store:
        return jsonify({'error': 'File not found'}), 404

    filepath = file_store[file_id]['filepath']

    try:
        import anndata as ad
        from utils.preprocessing import apply_qc_filters

        adata = ad.read_h5ad(filepath)

        # Apply filters with user thresholds
        adata_filtered, summary = apply_qc_filters(
            adata,
            min_genes=int(data.get('min_genes', 250)),
            min_counts=int(data.get('min_counts', 500)),
            max_pct_mt=float(data.get('max_pct_mt', 20.0)),
            max_pct_ribo=float(data.get('max_pct_ribo', 50.0)),
            min_cells_per_gene=int(data.get('min_cells_per_gene', 3))
        )

        # Save filtered data
        adata_filtered.write_h5ad(filepath)

        return jsonify({
            'success': True,
            'summary': summary
        })

    except Exception as e:
        return jsonify({
            'error': f'QC filtering failed: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500


@app.route('/api/preprocess', methods=['POST'])
def run_preprocess():
    """Run normalization + HVG pipeline on filtered data"""
    data = request.get_json()
    file_id = data.get('file_id')

    if not file_id or file_id not in file_store:
        return jsonify({'error': 'File not found'}), 404

    filepath = file_store[file_id]['filepath']

    try:
        import anndata as ad
        from utils.preprocessing import run_preprocessing

        adata = ad.read_h5ad(filepath)

        # Run preprocessing pipeline
        adata, steps = run_preprocessing(adata)

        # Save preprocessed data
        adata.write_h5ad(filepath)

        return jsonify({
            'success': True,
            'steps': steps,
            'n_cells': int(adata.n_obs),
            'n_genes': int(adata.n_vars),
            'n_hvg': int(adata.var['highly_variable'].sum()) if 'highly_variable' in adata.var.columns else None
        })

    except Exception as e:
        return jsonify({
            'error': f'Preprocessing failed: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500


# ============== Quality Control Endpoints ==============

@app.route('/api/doublet-detection', methods=['POST'])
def run_doublet_detection():
    """Run Scrublet doublet detection on uploaded data"""
    data = request.get_json()
    file_id = data.get('file_id')

    if not file_id or file_id not in file_store:
        return jsonify({'error': 'File not found'}), 404

    filepath = file_store[file_id]['filepath']
    expected_rate = data.get('expected_doublet_rate', 0.06)

    try:
        import anndata as ad
        from utils.doublet_detection import run_scrublet

        # Load AnnData
        adata = ad.read_h5ad(filepath)

        # Run Scrublet
        results = run_scrublet(adata, expected_doublet_rate=expected_rate)

        # Save modified AnnData back (with doublet scores in .obs)
        adata.write_h5ad(filepath)

        return jsonify({
            'success': True,
            'results': results
        })

    except ImportError as e:
        return jsonify({
            'error': f'Missing dependency: {str(e)}',
            'instructions': 'Install with: pip install scrublet'
        }), 500

    except Exception as e:
        return jsonify({
            'error': f'Doublet detection failed: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500

@app.route('/api/filter-doublets', methods=['POST'])
def filter_doublets_endpoint():
    """Filter out detected doublets from the data"""
    data = request.get_json()
    file_id = data.get('file_id')

    if not file_id or file_id not in file_store:
        return jsonify({'error': 'File not found'}), 404

    filepath = file_store[file_id]['filepath']

    try:
        import anndata as ad
        from utils.doublet_detection import filter_doublets

        # Load AnnData
        adata = ad.read_h5ad(filepath)

        # Filter doublets
        adata_filtered, n_removed = filter_doublets(adata)

        # Save filtered data back
        adata_filtered.write_h5ad(filepath)

        # Re-extract metadata with updated cell count
        metadata = extract_metadata(adata_filtered, file_id, file_store[file_id]['filename'])

        return jsonify({
            'success': True,
            'n_removed': n_removed,
            'n_remaining': int(adata_filtered.n_obs),
            'metadata': metadata
        })

    except Exception as e:
        return jsonify({
            'error': f'Doublet filtering failed: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500


# ============== Cell Type Annotation Endpoints ==============

@app.route('/api/celltypist-models', methods=['GET'])
def get_celltypist_models():
    """Get list of available CellTypist models"""
    from utils.annotation import get_available_models
    return jsonify({'models': get_available_models()})

@app.route('/api/annotate', methods=['POST'])
def run_annotation():
    """Run CellTypist cell type annotation"""
    data = request.get_json()
    file_id = data.get('file_id')

    if not file_id or file_id not in file_store:
        return jsonify({'error': 'File not found'}), 404

    filepath = file_store[file_id]['filepath']
    model_name = data.get('model', 'Immune_All_Low.pkl')
    majority_voting = data.get('majority_voting', True)

    try:
        import anndata as ad
        from utils.annotation import run_celltypist

        # Load AnnData
        adata = ad.read_h5ad(filepath)

        # Run CellTypist annotation
        results = run_celltypist(
            adata,
            model_name=model_name,
            majority_voting=majority_voting
        )

        # Save annotated data back (with cell type labels in .obs)
        adata.write_h5ad(filepath)

        # Re-extract metadata (new annotation columns now available for group selection)
        metadata = extract_metadata(adata, file_id, file_store[file_id]['filename'])

        return jsonify({
            'success': True,
            'results': results,
            'metadata': metadata
        })

    except ImportError as e:
        return jsonify({
            'error': f'Missing dependency: {str(e)}',
            'instructions': 'Install with: pip install celltypist'
        }), 500

    except Exception as e:
        return jsonify({
            'error': f'Annotation failed: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500

@app.route('/api/annotation-columns/<file_id>', methods=['GET'])
def get_annotation_columns(file_id):
    """Get categorical columns from adata.obs suitable as training labels"""
    if file_id not in file_store:
        return jsonify({'error': 'File not found'}), 404

    filepath = file_store[file_id]['filepath']

    try:
        import anndata as ad
        from utils.annotation import get_annotation_columns as _get_cols

        adata = ad.read_h5ad(filepath)
        columns = _get_cols(adata)

        return jsonify({'columns': columns})

    except Exception as e:
        return jsonify({
            'error': f'Failed to get annotation columns: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500

@app.route('/api/train-model', methods=['POST'])
def train_model():
    """Train a custom CellTypist model from user-selected labels"""
    data = request.get_json()
    file_id = data.get('file_id')

    if not file_id or file_id not in file_store:
        return jsonify({'error': 'File not found'}), 404

    labels_column = data.get('labels_column')
    model_name = data.get('model_name')

    if not labels_column:
        return jsonify({'error': 'labels_column is required'}), 400
    if not model_name:
        return jsonify({'error': 'model_name is required'}), 400

    filepath = file_store[file_id]['filepath']
    feature_selection = data.get('feature_selection', True)
    top_genes = data.get('top_genes', 300)
    epochs = data.get('epochs', 10)
    use_SGD = data.get('use_SGD', True)
    max_cells = data.get('max_cells')
    subset_column = data.get('subset_column')
    subset_values = data.get('subset_values')

    # Validate max_cells
    if max_cells is not None:
        try:
            max_cells = int(max_cells)
            if max_cells < 1:
                max_cells = None
        except (ValueError, TypeError):
            max_cells = None

    try:
        import anndata as ad
        from utils.annotation import train_celltypist_model

        adata = ad.read_h5ad(filepath)

        results = train_celltypist_model(
            adata,
            labels_column=labels_column,
            model_name=model_name,
            feature_selection=feature_selection,
            top_genes=top_genes,
            epochs=epochs,
            use_SGD=use_SGD,
            max_cells=max_cells,
            subset_column=subset_column,
            subset_values=subset_values
        )

        return jsonify({
            'success': True,
            'results': results
        })

    except ImportError as e:
        return jsonify({
            'error': f'Missing dependency: {str(e)}',
            'instructions': 'Install with: pip install celltypist'
        }), 500

    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    except Exception as e:
        return jsonify({
            'error': f'Model training failed: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500

@app.route('/api/custom-models', methods=['GET'])
def list_custom_models():
    """Get list of user-trained custom models"""
    from utils.annotation import get_custom_models
    return jsonify({'models': get_custom_models()})


# ============== UMAP Visualization Endpoints ==============

@app.route('/api/umap', methods=['POST'])
def run_umap():
    """Compute UMAP embedding for visualization"""
    data = request.get_json()
    file_id = data.get('file_id')

    if not file_id or file_id not in file_store:
        return jsonify({'error': 'File not found'}), 404

    filepath = file_store[file_id]['filepath']
    force_recompute = data.get('force_recompute', False)
    n_neighbors = int(data.get('n_neighbors', 15))
    resolution = float(data.get('resolution', 1.0))

    try:
        import anndata as ad
        from utils.umap import compute_umap

        # Load AnnData
        adata = ad.read_h5ad(filepath)

        # Compute UMAP (returns result dict and potentially modified adata)
        results, adata = compute_umap(
            adata, force_recompute=force_recompute,
            n_neighbors=n_neighbors, resolution=resolution
        )

        # Save modified AnnData back (with UMAP coords in .obsm)
        adata.write_h5ad(filepath)

        return jsonify({
            'success': True,
            'results': results
        })

    except ImportError as e:
        return jsonify({
            'error': f'Missing dependency: {str(e)}',
            'instructions': 'Install with: pip install scanpy'
        }), 500

    except Exception as e:
        return jsonify({
            'error': f'UMAP computation failed: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500


@app.route('/api/recluster', methods=['POST'])
def run_recluster():
    """Re-run Leiden clustering at a new resolution without recomputing UMAP"""
    data = request.get_json()
    file_id = data.get('file_id')

    if not file_id or file_id not in file_store:
        return jsonify({'error': 'File not found'}), 404

    filepath = file_store[file_id]['filepath']
    resolution = float(data.get('resolution', 1.0))

    try:
        import anndata as ad
        from utils.umap import recluster

        adata = ad.read_h5ad(filepath)
        results, adata = recluster(adata, resolution=resolution)
        adata.write_h5ad(filepath)

        return jsonify({
            'success': True,
            'results': results
        })

    except Exception as e:
        return jsonify({
            'error': f'Re-clustering failed: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500


@app.route('/api/gene-expression', methods=['POST'])
def get_gene_expression():
    """Get expression values for a single gene across all cells"""
    data = request.get_json()
    file_id = data.get('file_id')
    gene = data.get('gene')

    if not file_id or file_id not in file_store:
        return jsonify({'error': 'File not found'}), 404

    if not gene:
        return jsonify({'error': 'No gene specified'}), 400

    filepath = file_store[file_id]['filepath']

    try:
        import anndata as ad
        import numpy as np

        adata = ad.read_h5ad(filepath)

        if gene not in adata.var_names:
            return jsonify({'error': f'Gene "{gene}" not found in dataset'}), 404

        # Extract expression for this gene
        expr = adata[:, gene].X
        if hasattr(expr, 'toarray'):
            expr = expr.toarray()
        values = np.asarray(expr).flatten()
        values = np.nan_to_num(values, nan=0.0).tolist()

        return jsonify({
            'success': True,
            'gene': gene,
            'values': values
        })

    except Exception as e:
        return jsonify({
            'error': f'Failed to get gene expression: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500


@app.route('/api/gene-search', methods=['POST'])
def search_genes():
    """Search for gene names matching a query string"""
    data = request.get_json()
    file_id = data.get('file_id')
    query = data.get('query', '').strip()

    if not file_id or file_id not in file_store:
        return jsonify({'error': 'File not found'}), 404

    if len(query) < 1:
        return jsonify({'genes': []})

    filepath = file_store[file_id]['filepath']

    try:
        import anndata as ad

        adata = ad.read_h5ad(filepath, backed='r')
        gene_names = list(adata.var_names)
        adata.file.close()

        query_upper = query.upper()
        # Exact prefix matches first, then substring matches
        prefix = [g for g in gene_names if g.upper().startswith(query_upper)]
        substring = [g for g in gene_names if query_upper in g.upper() and g not in prefix]
        matches = (prefix + substring)[:20]

        return jsonify({'genes': matches})

    except Exception as e:
        return jsonify({
            'error': f'Gene search failed: {str(e)}'
        }), 500


# ============== Drug Prediction Endpoints ==============

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

@app.route('/api/cleanup-all', methods=['POST'])
def cleanup_all():
    """Remove all uploaded files (called when browser session ends)"""
    cleanup_all_uploads()
    return jsonify({'message': 'All uploads cleaned up'})

# ============== Multi-Batch Integration Endpoints ==============

@app.route('/api/project/create', methods=['POST'])
def create_project():
    """Create a new multi-batch project"""
    project_id = str(uuid.uuid4())
    project_store[project_id] = {
        'samples': [],  # list of {file_id, batch_label, filename, status}
        'merged_file_id': None,
        'integration_method': None,
        'integration_status': None,
        'created_at': pd.Timestamp.now().isoformat(),
    }
    return jsonify({
        'project_id': project_id,
        'message': 'Project created'
    })


@app.route('/api/project/<project_id>', methods=['GET'])
def get_project(project_id):
    """Get project info including samples and status"""
    if project_id not in project_store:
        return jsonify({'error': 'Project not found'}), 404

    project = project_store[project_id]
    return jsonify({
        'project_id': project_id,
        'samples': project['samples'],
        'merged_file_id': project['merged_file_id'],
        'integration_method': project['integration_method'],
        'integration_status': project['integration_status'],
    })


@app.route('/api/project/<project_id>/add-sample', methods=['POST'])
def add_sample_to_project(project_id):
    """Associate a file_id + batch_label with a project"""
    if project_id not in project_store:
        return jsonify({'error': 'Project not found'}), 404

    data = request.get_json()
    file_id = data.get('file_id')
    batch_label = data.get('batch_label')

    if not file_id or file_id not in file_store:
        return jsonify({'error': 'File not found'}), 404
    if not batch_label:
        return jsonify({'error': 'batch_label is required'}), 400

    # Check for duplicate batch labels
    existing_labels = [s['batch_label'] for s in project_store[project_id]['samples']]
    if batch_label in existing_labels:
        return jsonify({'error': f'Batch label "{batch_label}" already exists in project'}), 400

    project_store[project_id]['samples'].append({
        'file_id': file_id,
        'batch_label': batch_label,
        'filename': file_store[file_id]['filename'],
        'status': 'uploaded',  # uploaded -> qc_done -> preprocessed
    })

    return jsonify({
        'success': True,
        'n_samples': len(project_store[project_id]['samples']),
    })


@app.route('/api/project/<project_id>/remove-sample', methods=['POST'])
def remove_sample_from_project(project_id):
    """Remove a sample from a project"""
    if project_id not in project_store:
        return jsonify({'error': 'Project not found'}), 404

    data = request.get_json()
    file_id = data.get('file_id')

    project = project_store[project_id]
    project['samples'] = [s for s in project['samples'] if s['file_id'] != file_id]

    return jsonify({
        'success': True,
        'n_samples': len(project['samples']),
    })


@app.route('/api/project/<project_id>/merge', methods=['POST'])
def merge_project_samples(project_id):
    """Concatenate all samples in a project"""
    if project_id not in project_store:
        return jsonify({'error': 'Project not found'}), 404

    project = project_store[project_id]
    samples = project['samples']

    if len(samples) < 2:
        return jsonify({'error': 'Need at least 2 samples to merge'}), 400

    try:
        from utils.integration import concat_samples

        file_paths = []
        batch_labels = []
        for s in samples:
            fid = s['file_id']
            if fid not in file_store:
                return jsonify({'error': f'File {fid} not found'}), 404
            file_paths.append(file_store[fid]['filepath'])
            batch_labels.append(s['batch_label'])

        # Concatenate
        merged_adata, merge_summary = concat_samples(file_paths, batch_labels)

        # Save merged file
        merged_file_id = str(uuid.uuid4())
        merged_path = os.path.join(UPLOAD_FOLDER, f"{merged_file_id}_merged.h5ad")
        merged_adata.write_h5ad(merged_path)

        file_store[merged_file_id] = {
            'filename': 'merged_samples.h5ad',
            'filepath': merged_path,
            'source': 'merged',
            'uploaded_at': pd.Timestamp.now().isoformat(),
        }

        project['merged_file_id'] = merged_file_id

        return jsonify({
            'success': True,
            'merged_file_id': merged_file_id,
            'summary': merge_summary,
        })

    except Exception as e:
        return jsonify({
            'error': f'Merge failed: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500


@app.route('/api/project/<project_id>/integrate', methods=['POST'])
def integrate_project(project_id):
    """Run batch integration (scVI or Scanorama) in a background thread"""
    if project_id not in project_store:
        return jsonify({'error': 'Project not found'}), 404

    project = project_store[project_id]
    merged_file_id = project.get('merged_file_id')

    if not merged_file_id or merged_file_id not in file_store:
        return jsonify({'error': 'No merged data found. Run merge first.'}), 400

    data = request.get_json()
    method = data.get('method', 'scanorama')
    n_latent = int(data.get('n_latent', 30))
    max_epochs = int(data.get('max_epochs', 400))

    # Check if integration already running
    if project_id in integration_threads:
        thread_info = integration_threads[project_id]
        if (thread_info.get('thread') and thread_info['thread'].is_alive()
                and not thread_info.get('cancel')):
            return jsonify({'error': 'Integration already running'}), 409

    # Initialize status
    integration_threads[project_id] = {
        'status': 'running',
        'method': method,
        'progress': 0,
        'message': f'Starting {method} integration...',
        'error': None,
        'result': None,
        'thread': None,
        'cancel': False,
    }

    def run_integration():
        try:
            import anndata as ad
            filepath = file_store[merged_file_id]['filepath']
            adata = ad.read_h5ad(filepath)

            status = integration_threads[project_id]
            status['progress'] = 10
            status['message'] = 'Data loaded, running integration...'

            if status.get('cancel'):
                return

            if method == 'scanorama':
                from utils.integration import run_scanorama_integration
                from utils.metadata import is_log_normalized
                # Scanorama needs log-normalized data
                if not is_log_normalized(adata):
                    import scanpy as sc
                    sc.pp.normalize_total(adata, target_sum=1e4)
                    sc.pp.log1p(adata)
                status['progress'] = 30
                if status.get('cancel'):
                    return
                result = run_scanorama_integration(adata)
            elif method == 'scvi':
                from utils.integration import run_scvi_integration
                status['progress'] = 20
                status['message'] = 'Training scVI model...'
                if status.get('cancel'):
                    return
                result = run_scvi_integration(
                    adata, n_latent=n_latent, max_epochs=max_epochs
                )
            else:
                raise ValueError(f'Unknown integration method: {method}')

            if status.get('cancel'):
                return

            status['progress'] = 90
            status['message'] = 'Saving results...'

            # Save updated adata
            adata.write_h5ad(filepath)

            status['status'] = 'completed'
            status['progress'] = 100
            status['message'] = 'Integration complete'
            status['result'] = result

            project['integration_method'] = method
            project['integration_status'] = 'completed'

        except Exception as e:
            status = integration_threads[project_id]
            status['status'] = 'error'
            status['error'] = str(e)
            status['message'] = f'Integration failed: {str(e)}'
            project['integration_status'] = 'error'

    thread = threading.Thread(target=run_integration, daemon=True)
    integration_threads[project_id]['thread'] = thread
    thread.start()

    return jsonify({
        'success': True,
        'message': f'{method} integration started',
        'status': 'running',
    })


@app.route('/api/project/<project_id>/status', methods=['GET'])
def get_integration_status(project_id):
    """Poll integration progress"""
    if project_id not in integration_threads:
        return jsonify({
            'status': 'idle',
            'progress': 0,
            'message': 'No integration running',
        })

    info = integration_threads[project_id]
    response = {
        'status': info['status'],
        'method': info['method'],
        'progress': info['progress'],
        'message': info['message'],
    }

    if info['status'] == 'completed' and info['result']:
        response['result'] = info['result']
    if info['status'] == 'error' and info['error']:
        response['error'] = info['error']

    return jsonify(response)


@app.route('/api/project/<project_id>/cancel-integration', methods=['POST'])
def cancel_integration(project_id):
    """Cancel a running integration task"""
    if project_id not in integration_threads:
        return jsonify({'error': 'No integration running'}), 404

    info = integration_threads[project_id]
    if info['status'] != 'running':
        return jsonify({'error': 'Integration is not running'}), 400

    # Set cancel flag — the thread checks this
    info['cancel'] = True
    info['status'] = 'cancelled'
    info['message'] = 'Cancelled by user'

    if project_id in project_store:
        project_store[project_id]['integration_status'] = 'cancelled'

    return jsonify({'success': True, 'message': 'Integration cancelled'})


# In-flight task cancellation for synchronous endpoints (CellTypist training/annotation)
active_tasks = {}  # task_id -> threading.Event (set = cancelled)


@app.route('/api/cancel-task/<task_id>', methods=['POST'])
def cancel_task(task_id):
    """Cancel a long-running synchronous task by setting its cancel event"""
    if task_id in active_tasks:
        active_tasks[task_id].set()
        return jsonify({'success': True, 'message': 'Task cancellation requested'})
    return jsonify({'error': 'Task not found'}), 404


# ============== Main ==============

if __name__ == '__main__':
    print("=" * 60)
    print("DrugReflector Automation MVP")
    print("=" * 60)

    # Check dependencies
    checkpoints_ok, missing = check_checkpoints_exist()
    if not checkpoints_ok:
        print("\n  WARNING: Model checkpoints not found!")
        print(f"   Missing: {missing}")
        print(f"   Please download from Zenodo (DOI: 10.5281/zenodo.16912444)")
        print(f"   Place files in: {CHECKPOINT_DIR}")
    else:
        print("  Model checkpoints found")

    try:
        import drugreflector
        print("  DrugReflector installed")
    except ImportError:
        print("  DrugReflector not installed. Run: pip install drugreflector")

    try:
        import scanpy
        print("  Scanpy installed")
    except ImportError:
        print("  Scanpy not installed. Run: pip install scanpy")

    try:
        import scrublet
        print("  Scrublet installed")
    except ImportError:
        print("  Scrublet not installed. Run: pip install scrublet")

    try:
        import celltypist
        print("  CellTypist installed")
    except ImportError:
        print("  CellTypist not installed. Run: pip install celltypist")

    try:
        import scanorama
        print("  Scanorama installed")
    except ImportError:
        print("  Scanorama not installed (optional). Run: pip install scanorama")

    try:
        import scvi
        print("  scvi-tools installed")
    except ImportError:
        print("  scvi-tools not installed (optional). Run: pip install scvi-tools")

    print("\n" + "=" * 60)
    print("Starting server at http://localhost:5001")
    print("=" * 60 + "\n")

    app.run(debug=True, host='0.0.0.0', port=5001)
