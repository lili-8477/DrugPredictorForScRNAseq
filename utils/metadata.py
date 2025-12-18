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
    
    return metadata
