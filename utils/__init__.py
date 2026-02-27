"""
Utility modules for DrugReflector application.

This package contains modular components for:
- Metadata extraction from AnnData files
- DrugReflector prediction pipeline
- iLINCS URL generation
- File and checkpoint validation
- Doublet detection using Scrublet
- Cell type annotation using CellTypist
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

from .doublet_detection import (
    run_scrublet,
    filter_doublets
)

from .annotation import (
    get_available_models,
    run_celltypist,
    CELLTYPIST_MODELS
)

from .umap import compute_umap

from .preprocessing import (
    read_10x_mtx,
    read_10x_h5,
    compute_qc_metrics,
    get_qc_plot_data,
    apply_qc_filters,
    run_preprocessing,
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
    # Doublet detection
    'run_scrublet',
    'filter_doublets',
    # Annotation
    'get_available_models',
    'run_celltypist',
    'CELLTYPIST_MODELS',
    # UMAP
    'compute_umap',
    # Preprocessing
    'read_10x_mtx',
    'read_10x_h5',
    'compute_qc_metrics',
    'get_qc_plot_data',
    'apply_qc_filters',
    'run_preprocessing',
]
