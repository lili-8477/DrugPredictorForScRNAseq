"""
URL generation utilities for drug databases.
"""
import urllib.parse


def generate_ilincs_url(compound_name):
    """
    Generate iLINCS URL for a compound to allow users to explore more details.
    
    Args:
        compound_name: Name or ID of the compound
        
    Returns:
        str: iLINCS search URL
    """
    encoded_name = urllib.parse.quote(compound_name.strip())
    return f"https://www.ilincs.org/ilincs/searchFor/{encoded_name}"
