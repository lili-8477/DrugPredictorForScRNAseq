"""
Doublet detection utilities using Scrublet.

Provides functions to detect and filter doublets from single-cell RNA-seq data
using the Scrublet algorithm (Wolock et al., 2019).
"""
import numpy as np


def run_scrublet(adata, expected_doublet_rate=0.06, random_state=0):
    """
    Run Scrublet doublet detection on AnnData object.

    Scrublet works best on raw (unnormalized) count data. If data appears
    to be log-normalized, detection will still proceed but results may
    be less reliable.

    Args:
        adata: AnnData object
        expected_doublet_rate: Expected fraction of doublets (default 0.06)
        random_state: Random seed for reproducibility

    Returns:
        dict: Results including doublet scores, predictions, statistics,
              and histogram data for visualization
    """
    import scrublet as scr

    # Get count matrix
    X = adata.X
    if hasattr(X, 'toarray'):
        X_dense = X.toarray()
    else:
        X_dense = np.array(X)

    # Initialize Scrublet
    scrub = scr.Scrublet(
        X_dense,
        expected_doublet_rate=expected_doublet_rate,
        random_state=random_state
    )

    # Run doublet prediction
    doublet_scores, predicted_doublets = scrub.scrub_doublets(
        min_counts=2,
        min_cells=3,
        min_gene_variability_pctl=85,
        n_prin_comps=30
    )

    # If Scrublet fails to find a bimodal threshold, predicted_doublets is None.
    # Fall back to a manual threshold based on the score distribution.
    if predicted_doublets is None:
        threshold = np.mean(doublet_scores) + 2 * np.std(doublet_scores)
        threshold = min(threshold, 0.5)  # cap at 0.5
        predicted_doublets = doublet_scores > threshold
        scrub.predicted_doublets_ = predicted_doublets
        scrub.threshold_ = threshold

    # Store results in AnnData obs
    adata.obs['doublet_score'] = doublet_scores
    adata.obs['predicted_doublet'] = predicted_doublets

    # Compute summary statistics
    n_doublets = int(predicted_doublets.sum())
    n_total = len(predicted_doublets)
    n_singlets = n_total - n_doublets
    doublet_rate = n_doublets / n_total if n_total > 0 else 0.0

    # Compute histogram data for frontend visualization
    hist_counts, hist_edges = np.histogram(doublet_scores, bins=50, range=(0, 1))

    return {
        'n_cells_total': int(n_total),
        'n_doublets': n_doublets,
        'n_singlets': int(n_singlets),
        'doublet_rate': round(doublet_rate, 4),
        'expected_doublet_rate': expected_doublet_rate,
        'threshold': round(float(scrub.threshold_), 4),
        'score_stats': {
            'mean': round(float(np.mean(doublet_scores)), 4),
            'median': round(float(np.median(doublet_scores)), 4),
            'std': round(float(np.std(doublet_scores)), 4),
        },
        'histogram': {
            'counts': hist_counts.tolist(),
            'bin_edges': [round(float(e), 4) for e in hist_edges.tolist()]
        }
    }


def filter_doublets(adata):
    """
    Filter out predicted doublets from AnnData object.

    Requires that run_scrublet() has been called first to populate
    the 'predicted_doublet' column in adata.obs.

    Args:
        adata: AnnData object with 'predicted_doublet' column in .obs

    Returns:
        tuple: (filtered AnnData with doublets removed, number of cells removed)

    Raises:
        ValueError: If doublet detection has not been run
    """
    if 'predicted_doublet' not in adata.obs.columns:
        raise ValueError("Doublet detection has not been run. Call run_scrublet first.")

    n_before = adata.n_obs
    adata_filtered = adata[~adata.obs['predicted_doublet']].copy()
    n_removed = n_before - adata_filtered.n_obs

    return adata_filtered, int(n_removed)
