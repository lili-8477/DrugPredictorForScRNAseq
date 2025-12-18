"""
Utility modules for DrugReflector application.

This package contains modular components for:
- Metadata extraction from AnnData files
- DrugReflector prediction pipeline
- iLINCS URL generation
- File and checkpoint validation
"""

from .metadata import (
    convert_to_json_serializable,
    is_log_normalized,
    extract_metadata,
    get_categorical_info
)

from .prediction import (
    compute_vscores_adata,
    preprocess_adata,
    run_drugreflector_prediction,
    format_prediction_results,
    get_vscore_summary
)

from .urls import generate_ilincs_url

from .validation import (
    allowed_file,
    check_checkpoints_exist,
    validate_group_column
)

__all__ = [
    # Metadata
    'convert_to_json_serializable',
    'is_log_normalized',
    'extract_metadata',
    'get_categorical_info',
    # Prediction
    'compute_vscores_adata',
    'preprocess_adata',
    'run_drugreflector_prediction',
    'format_prediction_results',
    'get_vscore_summary',
    # URLs
    'generate_ilincs_url',
    # Validation
    'allowed_file',
    'check_checkpoints_exist',
    'validate_group_column',
]
