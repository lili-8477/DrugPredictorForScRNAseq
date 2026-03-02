"""
UMAP dimensionality reduction and visualization utilities.
"""
import scanpy as sc
import numpy as np
import scipy.sparse as sp
from .metadata import is_log_normalized, get_categorical_info


def compute_umap(adata, force_recompute=False):
    """
    Compute UMAP embedding for visualization.

    Checks if X_umap already exists; skips computation if so (unless forced).
    Handles normalization, HVG selection, PCA, neighbor graph, and UMAP.

    Args:
        adata: AnnData object (modified in-place)
        force_recompute: If True, recompute even if X_umap exists

    Returns:
        tuple: (result_dict, adata) - result dict with UMAP data, and
               potentially modified adata object
    """
    steps_performed = []

    # Check if UMAP already exists
    if 'X_umap' in adata.obsm and not force_recompute:
        steps_performed.append('X_umap already present - skipped computation')
    else:
        # Clean NaN/Inf values from expression matrix
        if sp.issparse(adata.X):
            adata.X = adata.X.toarray()
        adata.X = np.nan_to_num(adata.X, nan=0.0, posinf=0.0, neginf=0.0)

        # Remove genes that are all zero
        gene_sums = adata.X.sum(axis=0)
        gene_mask = gene_sums > 0
        n_zero = int((~gene_mask).sum())
        if n_zero > 0:
            adata = adata[:, gene_mask].copy()
            steps_performed.append(f'Removed {n_zero} zero-expression genes')

        # Normalize if needed
        if not is_log_normalized(adata):
            sc.pp.normalize_total(adata)
            sc.pp.log1p(adata)
            steps_performed.append('Normalized and log-transformed')

        # Highly variable genes
        n_top_genes = min(2000, adata.n_vars)
        sc.pp.highly_variable_genes(adata, n_top_genes=n_top_genes)
        steps_performed.append(f'Selected {n_top_genes} highly variable genes')

        # PCA
        n_comps = min(40, adata.n_vars - 1, adata.n_obs - 1)
        sc.tl.pca(adata, n_comps=n_comps, use_highly_variable=True)
        steps_performed.append(f'PCA with {n_comps} components')

        # Neighbors — use batch-corrected embeddings if available
        if 'X_scVI' in adata.obsm:
            sc.pp.neighbors(adata, use_rep='X_scVI', n_neighbors=15)
            steps_performed.append('Computed neighbor graph from scVI embedding (n_neighbors=15)')
        elif 'X_scanorama' in adata.obsm:
            sc.pp.neighbors(adata, use_rep='X_scanorama', n_neighbors=15)
            steps_performed.append('Computed neighbor graph from Scanorama embedding (n_neighbors=15)')
        else:
            n_pcs = min(40, n_comps)
            sc.pp.neighbors(adata, n_neighbors=15, n_pcs=n_pcs)
            steps_performed.append('Computed neighbor graph (n_neighbors=15)')

        # UMAP
        sc.tl.umap(adata)
        steps_performed.append('Computed UMAP embedding')

    # Extract coordinates
    coords = adata.obsm['X_umap']
    x = coords[:, 0].tolist()
    y = coords[:, 1].tolist()

    # Get categorical columns and their labels
    categorical_info = get_categorical_info(adata)
    categorical_columns = list(categorical_info.keys())

    labels = {}
    for col in categorical_columns:
        labels[col] = [str(v) for v in adata.obs[col].values]

    # Include gene names for gene expression coloring
    gene_names = list(adata.var_names)

    result = {
        'n_cells': int(adata.n_obs),
        'n_genes': int(adata.n_vars),
        'x': x,
        'y': y,
        'categorical_columns': categorical_columns,
        'labels': labels,
        'gene_names': gene_names,
        'steps_performed': steps_performed
    }

    return result, adata
