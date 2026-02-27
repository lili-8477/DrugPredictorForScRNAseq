"""
Upstream preprocessing module for Cell Ranger output.

Handles reading 10x matrix files, QC metrics computation,
interactive filtering, doublet detection, and normalization
to produce analysis-ready .h5ad files.
"""

import os
import numpy as np
import scanpy as sc


def read_10x_mtx(directory_path):
    """Read Cell Ranger filtered_feature_bc_matrix/ using sc.read_10x_mtx().

    Validates that all 3 required files exist, then reads and returns
    an AnnData object with raw counts.

    Parameters
    ----------
    directory_path : str
        Path to directory containing barcodes.tsv.gz, features.tsv.gz, matrix.mtx.gz

    Returns
    -------
    anndata.AnnData
        AnnData with raw counts matrix
    """
    required_files = ['barcodes.tsv.gz', 'features.tsv.gz', 'matrix.mtx.gz']
    missing = [f for f in required_files if not os.path.exists(os.path.join(directory_path, f))]
    if missing:
        raise FileNotFoundError(
            f"Missing required files in {directory_path}: {', '.join(missing)}"
        )

    adata = sc.read_10x_mtx(directory_path, var_names='gene_symbols', cache=False)
    adata.var_names_make_unique()
    return adata


def read_10x_h5(filepath):
    """Read Cell Ranger filtered_feature_bc_matrix.h5 using sc.read_10x_h5().

    Parameters
    ----------
    filepath : str
        Path to a Cell Ranger .h5 file

    Returns
    -------
    anndata.AnnData
        AnnData with raw counts matrix
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"File not found: {filepath}")
    if not filepath.endswith('.h5'):
        raise ValueError(f"Expected .h5 file, got: {filepath}")

    adata = sc.read_10x_h5(filepath)
    adata.var_names_make_unique()
    return adata


def compute_qc_metrics(adata):
    """Annotate mitochondrial/ribosomal genes and compute QC metrics.

    Auto-detects species from gene name prefixes:
    - MT- for human mitochondrial genes
    - mt- for mouse mitochondrial genes

    Parameters
    ----------
    adata : anndata.AnnData
        AnnData object (modified in place with .obs QC columns)

    Returns
    -------
    dict
        Dictionary with metric arrays and summary statistics
    """
    gene_names = adata.var_names

    # Auto-detect species for mitochondrial genes
    n_human_mt = sum(1 for g in gene_names if g.startswith('MT-'))
    n_mouse_mt = sum(1 for g in gene_names if g.startswith('mt-'))
    mt_prefix = 'MT-' if n_human_mt >= n_mouse_mt else 'mt-'

    adata.var['mt'] = adata.var_names.str.startswith(mt_prefix)
    adata.var['ribo'] = adata.var_names.str.match('^(RPS|RPL|Rps|Rpl)')

    sc.pp.calculate_qc_metrics(
        adata,
        qc_vars=['mt', 'ribo'],
        percent_top=None,
        log1p=False,
        inplace=True
    )

    return {
        'mt_prefix': mt_prefix,
        'n_mt_genes': int(adata.var['mt'].sum()),
        'n_ribo_genes': int(adata.var['ribo'].sum()),
        'n_cells': int(adata.n_obs),
        'n_genes': int(adata.n_vars),
    }


def get_qc_plot_data(adata):
    """Return JSON-serializable data for frontend QC violin + scatter plots.

    Parameters
    ----------
    adata : anndata.AnnData
        AnnData with QC metrics already computed in .obs

    Returns
    -------
    dict
        Plot data including distributions, scatter coords, and summary stats
    """
    obs = adata.obs

    # Extract metric arrays
    n_counts = obs['total_counts'].values.astype(float)
    n_genes = obs['n_genes_by_counts'].values.astype(float)
    pct_mt = obs['pct_counts_mt'].values.astype(float)
    pct_ribo = obs['pct_counts_ribo'].values.astype(float)

    def metric_summary(arr):
        return {
            'median': float(np.median(arr)),
            'mean': float(np.mean(arr)),
            'q1': float(np.percentile(arr, 25)),
            'q3': float(np.percentile(arr, 75)),
            'min': float(np.min(arr)),
            'max': float(np.max(arr)),
        }

    # Subsample for scatter plots if dataset is very large
    max_points = 50000
    if len(n_counts) > max_points:
        idx = np.random.choice(len(n_counts), max_points, replace=False)
        idx.sort()
    else:
        idx = np.arange(len(n_counts))

    return {
        'distributions': {
            'n_counts': n_counts.tolist(),
            'n_genes': n_genes.tolist(),
            'pct_mt': pct_mt.tolist(),
            'pct_ribo': pct_ribo.tolist(),
        },
        'scatter': {
            'x_counts': n_counts[idx].tolist(),
            'y_genes': n_genes[idx].tolist(),
            'x_genes': n_genes[idx].tolist(),
            'y_pct_mt': pct_mt[idx].tolist(),
            'color_pct_mt': pct_mt[idx].tolist(),
        },
        'summary': {
            'n_cells': int(adata.n_obs),
            'n_counts': metric_summary(n_counts),
            'n_genes': metric_summary(n_genes),
            'pct_mt': metric_summary(pct_mt),
            'pct_ribo': metric_summary(pct_ribo),
        }
    }


def apply_qc_filters(adata, min_genes=250, min_counts=500, max_pct_mt=20.0, max_pct_ribo=50.0, min_cells_per_gene=3):
    """Apply cell and gene quality filters.

    Parameters
    ----------
    adata : anndata.AnnData
        AnnData with QC metrics in .obs
    min_genes : int
        Minimum genes per cell
    min_counts : int
        Minimum UMI counts per cell
    max_pct_mt : float
        Maximum mitochondrial percentage
    max_pct_ribo : float
        Maximum ribosomal percentage
    min_cells_per_gene : int
        Minimum cells expressing a gene

    Returns
    -------
    tuple
        (filtered_adata, summary_dict)
    """
    n_cells_before = adata.n_obs
    n_genes_before = adata.n_vars

    # Cell filters
    cell_mask = (
        (adata.obs['n_genes_by_counts'] >= min_genes) &
        (adata.obs['total_counts'] >= min_counts) &
        (adata.obs['pct_counts_mt'] <= max_pct_mt) &
        (adata.obs['pct_counts_ribo'] <= max_pct_ribo)
    )
    adata = adata[cell_mask].copy()

    # Gene filter
    sc.pp.filter_genes(adata, min_cells=min_cells_per_gene)

    n_cells_after = adata.n_obs
    n_genes_after = adata.n_vars

    summary = {
        'n_cells_before': n_cells_before,
        'n_cells_after': n_cells_after,
        'n_cells_removed': n_cells_before - n_cells_after,
        'n_genes_before': n_genes_before,
        'n_genes_after': n_genes_after,
        'n_genes_removed': n_genes_before - n_genes_after,
        'filters_applied': {
            'min_genes': min_genes,
            'min_counts': min_counts,
            'max_pct_mt': max_pct_mt,
            'max_pct_ribo': max_pct_ribo,
            'min_cells_per_gene': min_cells_per_gene,
        }
    }

    return adata, summary


def run_preprocessing(adata):
    """Normalize, log-transform, and select highly variable genes.

    Stores raw counts in adata.raw before normalization.

    Parameters
    ----------
    adata : anndata.AnnData
        Filtered AnnData with raw counts

    Returns
    -------
    tuple
        (preprocessed_adata, steps_list)
    """
    steps = []

    # Store raw counts
    adata.raw = adata
    steps.append('Stored raw counts in adata.raw')

    # Normalize
    sc.pp.normalize_total(adata, target_sum=1e4)
    steps.append('Normalized to 10,000 counts per cell')

    # Log transform
    sc.pp.log1p(adata)
    steps.append('Log1p transformed')

    # HVG selection (use seurat flavor which works on log-normalized data)
    sc.pp.highly_variable_genes(adata, n_top_genes=2000, flavor='seurat')
    n_hvg = int(adata.var['highly_variable'].sum())
    steps.append(f'Selected {n_hvg} highly variable genes')

    return adata, steps
