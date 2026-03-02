"""
Metadata extraction utilities for AnnData files.
"""
import numpy as np
import pandas as pd


def convert_to_json_serializable(obj):
    """
    Convert numpy types to Python native types for JSON serialization.
    
    Args:
        obj: Object to convert (can be numpy types, dicts, lists, etc.)
        
    Returns:
        JSON-serializable version of the object
    """
    if isinstance(obj, (np.integer, np.int64, np.int32)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float64, np.float32)):
        return float(obj)
    elif isinstance(obj, (np.bool_, bool)):
        return bool(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {k: convert_to_json_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [convert_to_json_serializable(item) for item in obj]
    else:
        return obj


def is_log_normalized(adata):
    """
    Check if data appears to be log-normalized.
    
    Args:
        adata: AnnData object
        
    Returns:
        bool: True if data appears to be log-normalized
    """
    # Check if max value is reasonable for log-normalized data (typically < 15)
    if hasattr(adata.X, 'toarray'):
        max_val = adata.X.toarray().max()
    else:
        max_val = adata.X.max()
    return max_val < 20


def get_categorical_info(adata):
    """
    Extract categorical column information from AnnData.
    
    Args:
        adata: AnnData object
        
    Returns:
        dict: Mapping of column names to unique values (limited to 50 values)
    """
    categorical_info = {}
    for col in adata.obs.columns:
        if adata.obs[col].dtype.name == 'category' or adata.obs[col].nunique() < 100:
            unique_vals = adata.obs[col].unique().tolist()
            # Convert to string for JSON serialization
            categorical_info[col] = [str(v) for v in unique_vals[:50]]  # Limit to 50 values
    
    return categorical_info


def detect_existing_results(adata):
    """
    Detect what analysis results already exist in the AnnData object.

    Args:
        adata: AnnData object

    Returns:
        dict: Detection results for doublets, annotations, and UMAP
    """
    obs_cols = set(adata.obs.columns)

    # Detect doublet scores
    has_doublet_scores = 'doublet_score' in obs_cols or 'predicted_doublet' in obs_cols

    # Detect cell type annotations - check common annotation column names
    annotation_columns = []
    annotation_patterns = [
        'celltypist_prediction', 'celltypist_majority_voting',
        'cell_type', 'celltype', 'cell_ontology_class',
        'predicted_labels', 'majority_voting',
        'leiden', 'louvain', 'cluster', 'clusters'
    ]
    for col in obs_cols:
        col_lower = col.lower()
        for pattern in annotation_patterns:
            if pattern in col_lower:
                annotation_columns.append(col)
                break

    has_cell_type_annotations = len(annotation_columns) > 0

    # Detect UMAP
    has_umap = 'X_umap' in adata.obsm

    # Detect batch integration
    has_batch_integration = 'X_scVI' in adata.obsm or 'X_scanorama' in adata.obsm
    batch_method = None
    if 'X_scVI' in adata.obsm:
        batch_method = 'scvi'
    elif 'X_scanorama' in adata.obsm:
        batch_method = 'scanorama'
    has_batch_column = 'batch' in obs_cols

    return {
        'has_doublet_scores': has_doublet_scores,
        'has_cell_type_annotations': has_cell_type_annotations,
        'annotation_columns': annotation_columns,
        'has_umap': has_umap,
        'has_batch_integration': has_batch_integration,
        'batch_integration_method': batch_method,
        'has_batch_column': has_batch_column,
    }


def extract_metadata(adata, file_id, filename):
    """
    Extract metadata from AnnData object.

    Args:
        adata: AnnData object
        file_id: Unique file identifier
        filename: Original filename

    Returns:
        dict: Metadata dictionary ready for JSON serialization
    """
    metadata = {
        'file_id': file_id,
        'filename': filename,
        'shape': {
            'n_cells': int(adata.n_obs),
            'n_genes': int(adata.n_vars)
        },
        'obs_columns': list(adata.obs.columns),
        'var_columns': list(adata.var.columns),
        'obs_sample': convert_to_json_serializable(adata.obs.head(5).to_dict()) if len(adata.obs.columns) > 0 else {},
        'is_log_normalized': bool(is_log_normalized(adata)),
        'layers': list(adata.layers.keys()) if adata.layers else []
    }

    # Add categorical column information
    metadata['categorical_columns'] = get_categorical_info(adata)

    # Detect existing analysis results
    metadata['existing_results'] = detect_existing_results(adata)

    return metadata
