"""
Cell type annotation utilities using CellTypist.

Provides functions to automatically annotate cell types in single-cell RNA-seq
data using pre-trained CellTypist models (Dominguez Conde et al., 2022).
"""

import os

# Popular CellTypist models organized by category
CELLTYPIST_MODELS = [
    {
        'name': 'Immune_All_Low.pkl',
        'description': 'Immune cells - Low resolution (33 types)',
        'category': 'Human - Immune'
    },
    {
        'name': 'Immune_All_High.pkl',
        'description': 'Immune cells - High resolution (98 types)',
        'category': 'Human - Immune'
    },
    {
        'name': 'Healthy_COVID19_PBMC.pkl',
        'description': 'Healthy and COVID19 PBMC',
        'category': 'Human - Immune'
    },
    {
        'name': 'COVID19_Immune_Landscape.pkl',
        'description': 'COVID19 immune landscape',
        'category': 'Human - Immune'
    },
    {
        'name': 'Human_Lung_Atlas.pkl',
        'description': 'Human Lung Atlas',
        'category': 'Human - Tissue'
    },
    {
        'name': 'Human_Colorectal_Cancer.pkl',
        'description': 'Human colorectal cancer',
        'category': 'Human - Tissue'
    },
    {
        'name': 'Pan_Fetal_Human.pkl',
        'description': 'Pan fetal human (cross-tissue)',
        'category': 'Human - Development'
    },
    {
        'name': 'Developing_Human_Brain.pkl',
        'description': 'Developing human brain',
        'category': 'Human - Development'
    },
    {
        'name': 'Adult_Human_PrefrontalCortex.pkl',
        'description': 'Adult human prefrontal cortex',
        'category': 'Human - Brain'
    },
    {
        'name': 'Developing_Mouse_Brain.pkl',
        'description': 'Developing mouse brain',
        'category': 'Mouse'
    },
    {
        'name': 'Adult_Mouse_Gut.pkl',
        'description': 'Adult mouse gut',
        'category': 'Mouse'
    },
    {
        'name': 'Cells_Fetal_Lung.pkl',
        'description': 'Fetal lung cells (mouse)',
        'category': 'Mouse'
    },
]


def get_available_models():
    """
    Get list of available CellTypist models.

    Returns a curated list of popular pre-trained models organized by category.
    Models are automatically downloaded when first used.

    Returns:
        list[dict]: Available models with name, description, and category
    """
    return CELLTYPIST_MODELS


def run_celltypist(adata, model_name='Immune_All_Low.pkl', majority_voting=True):
    """
    Run CellTypist cell type annotation on AnnData object.

    CellTypist automatically handles normalization internally, so both raw
    count and log-normalized data are accepted.

    Args:
        adata: AnnData object
        model_name: Name of the CellTypist model to use
        majority_voting: Whether to apply majority voting for over-clustering
                        refinement (recommended for cleaner annotations)

    Returns:
        dict: Annotation results including cell type counts, confidence
              scores, and per-type statistics
    """
    import celltypist
    from celltypist import models
    import scanpy as sc

    # Download model if not cached (skip for custom model paths)
    if not os.path.isfile(model_name):
        models.download_models(force_update=False, model=model_name)

    # CellTypist requires log1p normalized data (target_sum=10000).
    # Normalize a copy so we don't alter the original adata.
    adata_norm = adata.copy()

    # Clean NaN/Inf values from expression matrix (can arise after filtering)
    import numpy as np
    import scipy.sparse as sp
    if sp.issparse(adata_norm.X):
        adata_norm.X = adata_norm.X.toarray()
    adata_norm.X = np.nan_to_num(adata_norm.X, nan=0.0, posinf=0.0, neginf=0.0)

    # Remove genes that are all zero (no information)
    gene_mask = adata_norm.X.sum(axis=0) > 0
    if gene_mask.sum() < adata_norm.n_vars:
        adata_norm = adata_norm[:, gene_mask].copy()

    sc.pp.normalize_total(adata_norm, target_sum=1e4)
    sc.pp.log1p(adata_norm)

    # Final NaN check after normalization
    if np.isnan(adata_norm.X).any():
        adata_norm.X = np.nan_to_num(adata_norm.X, nan=0.0)

    # CellTypist with majority_voting requires PCA and neighbors graph.
    # Compute PCA with n_comps capped to min(n_cells, n_genes, 50) - 1.
    if majority_voting:
        n_comps = min(adata_norm.n_obs, adata_norm.n_vars, 50) - 1
        if n_comps < 2:
            n_comps = 2
        sc.pp.highly_variable_genes(adata_norm, n_top_genes=min(2000, adata_norm.n_vars))
        sc.pp.pca(adata_norm, n_comps=n_comps)
        sc.pp.neighbors(adata_norm)

    # Run annotation on the normalized copy
    predictions = celltypist.annotate(
        adata_norm,
        model=model_name,
        majority_voting=majority_voting
    )

    # Get annotated AnnData
    adata_result = predictions.to_adata()

    # Transfer annotations to original AnnData
    adata.obs['celltypist_prediction'] = adata_result.obs['predicted_labels']
    adata.obs['celltypist_conf_score'] = adata_result.obs['conf_score']

    if majority_voting and 'majority_voting' in adata_result.obs.columns:
        adata.obs['celltypist_majority_voting'] = adata_result.obs['majority_voting']

    # Determine which prediction column to report
    pred_col = 'celltypist_majority_voting' if (
        majority_voting and 'celltypist_majority_voting' in adata.obs.columns
    ) else 'celltypist_prediction'

    # Build per-cell-type summary
    counts = adata.obs[pred_col].value_counts()
    total = len(adata)

    cell_types = []
    for ct, count in counts.items():
        mask = adata.obs[pred_col] == ct
        conf_scores = adata.obs.loc[mask, 'celltypist_conf_score']
        cell_types.append({
            'name': str(ct),
            'count': int(count),
            'percentage': round(count / total * 100, 1),
            'mean_confidence': round(float(conf_scores.mean()), 4)
        })

    # Sort by count descending
    cell_types.sort(key=lambda x: x['count'], reverse=True)

    return {
        'model_used': model_name,
        'majority_voting': majority_voting,
        'prediction_column': pred_col,
        'n_cell_types': len(cell_types),
        'cell_types': cell_types,
        'overall_confidence': {
            'mean': round(float(adata.obs['celltypist_conf_score'].mean()), 4),
            'median': round(float(adata.obs['celltypist_conf_score'].median()), 4)
        }
    }


# Directory for storing custom-trained models
CUSTOM_MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'custom_models')


def get_custom_models():
    """
    Get list of user-trained custom CellTypist models.

    Returns:
        list[dict]: Custom models with name and path
    """
    if not os.path.exists(CUSTOM_MODELS_DIR):
        return []

    models = []
    for fname in sorted(os.listdir(CUSTOM_MODELS_DIR)):
        if fname.endswith('.pkl'):
            models.append({
                'name': fname,
                'path': os.path.join(CUSTOM_MODELS_DIR, fname),
                'description': f'Custom model: {fname.replace(".pkl", "")}',
                'category': 'Custom'
            })
    return models


def get_annotation_columns(adata):
    """
    Get categorical/string columns from adata.obs suitable for training labels.

    Args:
        adata: AnnData object

    Returns:
        list[dict]: Columns with name and number of unique values
    """
    columns = []
    for col in adata.obs.columns:
        dtype = adata.obs[col].dtype
        if dtype == 'category' or dtype == object or dtype.name == 'string':
            n_unique = adata.obs[col].nunique()
            if 2 <= n_unique <= 500:
                columns.append({
                    'name': col,
                    'n_unique': int(n_unique),
                    'values': sorted(adata.obs[col].dropna().unique().astype(str).tolist())
                })
    return columns


def train_celltypist_model(adata, labels_column, model_name, n_jobs=4, feature_selection=True, top_genes=300, epochs=10, use_SGD=True,
                           max_cells=None, subset_column=None, subset_values=None):
    """
    Train a custom CellTypist model from an AnnData object and a labels column.

    The data is normalized (log1p, target_sum=10000) before training as
    required by CellTypist.

    Args:
        adata: AnnData object with raw or normalized counts
        labels_column: Column name in adata.obs containing cell type labels
        model_name: Name for the trained model (without .pkl extension)
        n_jobs: Number of parallel jobs for training
        feature_selection: Whether to perform feature selection
        top_genes: Number of top genes per cell type for feature selection
        epochs: Number of training epochs (SGD only)
        use_SGD: Whether to use mini-batch SGD (True) or standard logistic regression (False)
        max_cells: Maximum number of cells to use (random sample). None = use all.
        subset_column: obs column name to filter by group
        subset_values: list of values to keep from subset_column

    Returns:
        dict: Training results including model path and label summary
    """
    import celltypist
    import scanpy as sc
    import numpy as np
    import scipy.sparse as sp

    if labels_column not in adata.obs.columns:
        raise ValueError(f"Column '{labels_column}' not found in adata.obs")

    # Drop cells with missing labels
    mask = adata.obs[labels_column].notna()
    if mask.sum() < adata.n_obs:
        adata = adata[mask].copy()

    # Group filter
    if subset_column and subset_values:
        if subset_column not in adata.obs.columns:
            raise ValueError(f"Subset column '{subset_column}' not found in adata.obs")
        adata = adata[adata.obs[subset_column].isin(subset_values)].copy()

    # Random downsample
    if max_cells and adata.n_obs > max_cells:
        indices = np.random.choice(adata.n_obs, size=max_cells, replace=False)
        adata = adata[indices].copy()

    if adata.n_obs < 50:
        raise ValueError(f"Too few cells ({adata.n_obs}) for model training. Need at least 50.")

    labels = adata.obs[labels_column].astype(str)
    n_labels = labels.nunique()
    if n_labels < 2:
        raise ValueError(f"Need at least 2 distinct labels, found {n_labels}")

    # Normalize a copy
    adata_norm = adata.copy()
    if sp.issparse(adata_norm.X):
        adata_norm.X = adata_norm.X.toarray()
    adata_norm.X = np.nan_to_num(adata_norm.X, nan=0.0, posinf=0.0, neginf=0.0)

    gene_mask = adata_norm.X.sum(axis=0) > 0
    if gene_mask.sum() < adata_norm.n_vars:
        adata_norm = adata_norm[:, gene_mask].copy()

    sc.pp.normalize_total(adata_norm, target_sum=1e4)
    sc.pp.log1p(adata_norm)

    if np.isnan(adata_norm.X).any():
        adata_norm.X = np.nan_to_num(adata_norm.X, nan=0.0)

    # Train model
    model = celltypist.train(
        adata_norm,
        labels=labels_column,
        n_jobs=n_jobs,
        feature_selection=feature_selection,
        top_genes=top_genes,
        epochs=epochs,
        use_SGD=use_SGD
    )

    # Save model
    os.makedirs(CUSTOM_MODELS_DIR, exist_ok=True)
    safe_name = "".join(c if c.isalnum() or c in ('_', '-') else '_' for c in model_name)
    model_path = os.path.join(CUSTOM_MODELS_DIR, f"{safe_name}.pkl")
    model.write(model_path)

    # Build label summary
    label_counts = labels.value_counts()
    label_summary = [
        {'name': str(name), 'count': int(count)}
        for name, count in label_counts.items()
    ]

    return {
        'model_name': f"{safe_name}.pkl",
        'model_path': model_path,
        'labels_column': labels_column,
        'n_cells_trained': int(adata_norm.n_obs),
        'n_genes': int(adata_norm.n_vars),
        'n_labels': n_labels,
        'feature_selection': feature_selection,
        'top_genes': top_genes,
        'label_summary': label_summary
    }
