"""
DrugReflector prediction pipeline utilities.
"""
import pandas as pd
import scipy.stats as stats
from .metadata import is_log_normalized
from .urls import generate_ilincs_url


def compute_vscores_adata(adata, group_col, group1_value, group2_value, layer=None):
    """
    Compute v-scores between two groups in AnnData object.
    V-score is a measure of differential expression.
    
    Args:
        adata: AnnData object
        group_col: Column in adata.obs containing group labels
        group1_value: Value for group 1 (baseline/control)
        group2_value: Value for group 2 (treatment/target)
        layer: Optional layer to use (default: use .X)
    
    Returns:
        pandas Series with v-scores for each gene
    """
    # Get expression data
    if layer is not None and layer in adata.layers:
        X = adata.layers[layer]
    else:
        X = adata.X
    
    # Convert to dense if sparse
    if hasattr(X, 'toarray'):
        X = X.toarray()
    
    # Get indices for each group
    group1_mask = adata.obs[group_col] == group1_value
    group2_mask = adata.obs[group_col] == group2_value
    
    group1_data = X[group1_mask, :]
    group2_data = X[group2_mask, :]
    
    # Compute v-scores for each gene
    vscores = []
    for i in range(X.shape[1]):
        g1_vals = group1_data[:, i]
        g2_vals = group2_data[:, i]
        
        # V-score is based on the Mann-Whitney U statistic
        # normalized to range [-1, 1]
        try:
            statistic, pval = stats.mannwhitneyu(g1_vals, g2_vals, alternative='two-sided')
            n1, n2 = len(g1_vals), len(g2_vals)
            # Normalize U statistic to [-1, 1] range
            vscore = 2 * (statistic / (n1 * n2)) - 1
            vscores.append(vscore)
        except:
            vscores.append(0.0)
    
    # Create pandas Series with gene names
    result = pd.Series(vscores, index=adata.var_names)
    result.name = f'{group_col}:{group1_value}->{group2_value}'
    
    return result


def preprocess_adata(adata):
    """
    Preprocess AnnData object (normalize if needed).
    
    Args:
        adata: AnnData object
        
    Returns:
        tuple: (preprocessed adata, list of preprocessing steps)
    """
    import scanpy as sc
    
    preprocessing_steps = []
    
    # Check and apply normalization if needed
    if not is_log_normalized(adata):
        sc.pp.normalize_total(adata, target_sum=1e4)
        sc.pp.log1p(adata)
        preprocessing_steps.append('Applied log-normalization')
    else:
        preprocessing_steps.append('Data already log-normalized')
    
    return adata, preprocessing_steps


def run_drugreflector_prediction(vscores, checkpoint_paths, n_top=50):
    """
    Run DrugReflector prediction.
    
    Args:
        vscores: pandas Series of v-scores
        checkpoint_paths: List of checkpoint file paths
        n_top: Number of top predictions to return
        
    Returns:
        DataFrame with predictions
    """
    import drugreflector as dr
    
    model = dr.DrugReflector(checkpoint_paths=checkpoint_paths)
    predictions = model.predict(vscores, n_top=n_top)
    
    return predictions


def format_prediction_results(predictions, vscores, n_top=50):
    """
    Format DrugReflector prediction results for API response.
    
    Args:
        predictions: DataFrame from DrugReflector prediction
        vscores: pandas Series of v-scores (for transition name)
        n_top: Number of top predictions to return
        
    Returns:
        DataFrame with formatted results including iLINCS URLs
    """
    # Extract rank and probability columns
    transition_name = vscores.name
    rank_col = ('rank', transition_name)
    prob_col = ('prob', transition_name)
    logit_col = ('logit', transition_name)
    
    # Create results dataframe
    results_df = pd.DataFrame({
        'compound': predictions.index.tolist(),
        'rank': predictions[rank_col].tolist() if rank_col in predictions.columns else list(range(1, len(predictions) + 1)),
        'probability': predictions[prob_col].tolist() if prob_col in predictions.columns else [0.0] * len(predictions),
        'logit': predictions[logit_col].tolist() if logit_col in predictions.columns else [0.0] * len(predictions)
    })
    
    # Sort by rank
    results_df = results_df.sort_values('rank').head(n_top)
    
    # Add iLINCS URLs for each compound
    print(f"Generating iLINCS URLs for {len(results_df)} compounds...")
    results_df['ilincs_url'] = results_df['compound'].apply(generate_ilincs_url)
    
    return results_df


def get_vscore_summary(vscores):
    """
    Generate summary statistics for v-scores.
    
    Args:
        vscores: pandas Series of v-scores
        
    Returns:
        dict: Summary with top upregulated and downregulated genes
    """
    return {
        'n_genes': len(vscores),
        'top_upregulated': vscores.nlargest(10).to_dict(),
        'top_downregulated': vscores.nsmallest(10).to_dict()
    }
