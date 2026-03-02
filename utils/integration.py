"""
Multi-batch integration module for combining multiple scRNA-seq samples.

Supports Scanorama and scVI integration methods for batch effect correction.
"""

import numpy as np
import scanpy as sc
import anndata as ad
import scipy.sparse as sp

# Optional imports with graceful degradation
try:
    import scanorama
    SCANORAMA_AVAILABLE = True
except ImportError:
    SCANORAMA_AVAILABLE = False

try:
    import scvi
    SCVI_AVAILABLE = True
except ImportError:
    SCVI_AVAILABLE = False


def concat_samples(file_paths, batch_labels, batch_key='batch'):
    """Read multiple h5ad files, add batch labels, and concatenate.

    Uses gene intersection (join='inner') to keep only shared genes.
    Stores raw counts in .layers['counts'] for downstream integration.

    Parameters
    ----------
    file_paths : list of str
        Paths to h5ad files to concatenate.
    batch_labels : list of str
        Batch label for each file (same length as file_paths).
    batch_key : str
        Column name in .obs for batch labels.

    Returns
    -------
    tuple
        (concatenated_adata, summary_dict)
    """
    if len(file_paths) != len(batch_labels):
        raise ValueError("file_paths and batch_labels must have the same length")
    if len(file_paths) < 2:
        raise ValueError("Need at least 2 samples to merge")

    adatas = []
    per_sample_genes = []

    for path, label in zip(file_paths, batch_labels):
        a = ad.read_h5ad(path)
        a.obs[batch_key] = label
        a.obs[batch_key] = a.obs[batch_key].astype('category')
        per_sample_genes.append(set(a.var_names))
        adatas.append(a)

    # Compute gene intersection stats
    gene_intersection = set.intersection(*per_sample_genes)
    gene_union = set.union(*per_sample_genes)

    # Concatenate with inner join (gene intersection)
    combined = ad.concat(adatas, join='inner', label=batch_key, keys=batch_labels)
    combined.obs_names_make_unique()
    combined.var_names_make_unique()

    # Store raw counts for scVI
    if sp.issparse(combined.X):
        combined.layers['counts'] = combined.X.copy()
    else:
        combined.layers['counts'] = combined.X.copy()

    summary = {
        'n_samples': len(file_paths),
        'batch_labels': batch_labels,
        'total_cells': int(combined.n_obs),
        'genes_per_sample': {label: len(genes) for label, genes in zip(batch_labels, per_sample_genes)},
        'gene_intersection': len(gene_intersection),
        'gene_union': len(gene_union),
        'genes_after_merge': int(combined.n_vars),
        'cells_per_batch': {label: int((combined.obs[batch_key] == label).sum()) for label in batch_labels},
    }

    return combined, summary


def run_scanorama_integration(adata, batch_key='batch'):
    """Run Scanorama batch integration.

    Splits data by batch, runs scanorama.integrate_scanpy(),
    and stores the corrected embedding in .obsm['X_scanorama'].

    Parameters
    ----------
    adata : anndata.AnnData
        Concatenated AnnData with batch labels in .obs[batch_key].
        Should be log-normalized.
    batch_key : str
        Column in .obs identifying batches.

    Returns
    -------
    dict
        Integration results summary.
    """
    if not SCANORAMA_AVAILABLE:
        raise ImportError("scanorama is not installed. Install with: pip install scanorama")

    batches = adata.obs[batch_key].cat.categories.tolist()

    # Split into per-batch AnnData objects
    adatas_split = [adata[adata.obs[batch_key] == b].copy() for b in batches]

    # Run Scanorama integration
    scanorama.integrate_scanpy(adatas_split)

    # Collect corrected embeddings
    embeddings = []
    for a in adatas_split:
        embeddings.append(a.obsm['X_scanorama'])

    adata.obsm['X_scanorama'] = np.concatenate(embeddings, axis=0)

    return {
        'method': 'scanorama',
        'embedding_key': 'X_scanorama',
        'embedding_dim': int(adata.obsm['X_scanorama'].shape[1]),
        'n_batches': len(batches),
        'batches': batches,
    }


def run_scvi_integration(adata, batch_key='batch', n_latent=30, max_epochs=400):
    """Run scVI batch integration.

    Sets up and trains an scVI model on raw counts from .layers['counts'],
    then stores the latent representation in .obsm['X_scVI'].

    Parameters
    ----------
    adata : anndata.AnnData
        Concatenated AnnData with raw counts in .layers['counts'].
    batch_key : str
        Column in .obs identifying batches.
    n_latent : int
        Dimensionality of the latent space.
    max_epochs : int
        Maximum training epochs.

    Returns
    -------
    dict
        Integration results summary including training history.
    """
    if not SCVI_AVAILABLE:
        raise ImportError("scvi-tools is not installed. Install with: pip install scvi-tools")

    # Ensure counts layer exists
    if 'counts' not in adata.layers:
        raise ValueError("Raw counts not found in adata.layers['counts']. Run preprocessing first.")

    # Setup scVI model
    scvi.model.SCVI.setup_anndata(
        adata,
        layer='counts',
        batch_key=batch_key,
    )

    model = scvi.model.SCVI(
        adata,
        n_latent=n_latent,
    )

    # Train
    model.train(max_epochs=max_epochs)

    # Store latent representation
    adata.obsm['X_scVI'] = model.get_latent_representation()

    # Store normalized expression
    adata.layers['scvi_normalized'] = model.get_normalized_expression(library_size=1e4)

    history = model.history
    train_loss = history.get('elbo_train', {})

    return {
        'method': 'scvi',
        'embedding_key': 'X_scVI',
        'embedding_dim': n_latent,
        'max_epochs': max_epochs,
        'n_batches': len(adata.obs[batch_key].cat.categories),
        'batches': adata.obs[batch_key].cat.categories.tolist(),
        'final_train_loss': float(train_loss.iloc[-1]) if hasattr(train_loss, 'iloc') and len(train_loss) > 0 else None,
    }


def get_integration_summary(adata, batch_key='batch'):
    """Return summary of batch integration state.

    Parameters
    ----------
    adata : anndata.AnnData
        AnnData object.
    batch_key : str
        Column in .obs identifying batches.

    Returns
    -------
    dict
        Summary including per-batch cell counts, available embeddings,
        and method used.
    """
    summary = {
        'has_batch_info': batch_key in adata.obs.columns,
        'available_embeddings': [],
        'method_used': None,
    }

    if batch_key in adata.obs.columns:
        batch_counts = adata.obs[batch_key].value_counts().to_dict()
        summary['cells_per_batch'] = {str(k): int(v) for k, v in batch_counts.items()}
        summary['n_batches'] = len(batch_counts)
    else:
        summary['cells_per_batch'] = {}
        summary['n_batches'] = 0

    if 'X_scVI' in adata.obsm:
        summary['available_embeddings'].append('X_scVI')
        summary['method_used'] = 'scvi'
    if 'X_scanorama' in adata.obsm:
        summary['available_embeddings'].append('X_scanorama')
        summary['method_used'] = 'scanorama'

    return summary
