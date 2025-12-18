"""
File and checkpoint validation utilities.
"""
import os
from config import ALLOWED_EXTENSIONS, CHECKPOINT_PATHS


def allowed_file(filename):
    """
    Check if file extension is allowed.
    
    Args:
        filename: Name of the file to check
        
    Returns:
        bool: True if file extension is allowed
    """
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def check_checkpoints_exist():
    """
    Check if model checkpoints are available.
    
    Returns:
        tuple: (bool indicating if all exist, list of missing paths)
    """
    missing = [p for p in CHECKPOINT_PATHS if not os.path.exists(p)]
    return len(missing) == 0, missing


def validate_group_column(adata, group_col, source_group, target_group):
    """
    Validate that group column exists and specified groups are present.
    
    Args:
        adata: AnnData object
        group_col: Column name in adata.obs
        source_group: Source group value
        target_group: Target group value
        
    Returns:
        tuple: (bool success, str error_message or None)
    """
    # Check group column exists
    if group_col not in adata.obs.columns:
        return False, f'Group column "{group_col}" not found in data'
    
    # Get unique groups
    unique_groups = adata.obs[group_col].unique().tolist()
    unique_groups_str = [str(g) for g in unique_groups]
    
    # Validate source group
    if source_group not in unique_groups_str:
        return False, f'Source group "{source_group}" not found'
    
    # Validate target group
    if target_group not in unique_groups_str:
        return False, f'Target group "{target_group}" not found'
    
    return True, None
