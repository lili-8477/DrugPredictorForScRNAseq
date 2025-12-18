# DrugReflector Automation MVP

**Automated phenotypic drug discovery application** using single-cell RNA-seq data and DrugReflector neural network models.

![DrugReflector](https://img.shields.io/badge/DrugReflector-MVP-6366f1)
![Python](https://img.shields.io/badge/Python-3.8+-22d3ee)
![Flask](https://img.shields.io/badge/Flask-2.3+-ef4444)

## Overview

This application provides a user-friendly web interface for:

1. **Uploading** single-cell RNA-seq data in AnnData format (`.h5ad`)
2. **Inspecting** metadata and selecting cell populations
3. **Computing** v-score differential expression signatures
4. **Predicting** compounds that may induce desired state transitions using DrugReflector
5. **Exploring** compounds via direct iLINCS database integration

## Features

✨ **Key Capabilities:**

- 🧬 **Automated Analysis Pipeline**: End-to-end workflow from data upload to drug predictions
- 🤖 **AI-Powered Predictions**: DrugReflector ensemble models for accurate drug-gene signature matching
- 🔗 **iLINCS Integration**: One-click access to detailed compound information and signatures
- 📊 **Interactive Results**: Browse, sort, and export predicted compounds with confidence scores
- 🏗️ **Modular Codebase**: Clean architecture for easy maintenance and extension
- 🎨 **Modern UI**: Dark-themed, responsive interface with intuitive workflow

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Download Model Checkpoints

DrugReflector requires model checkpoints from Zenodo:

```bash
pip install zenodo-get
zenodo_get --output-dir checkpoints 16912444
```

Or download manually from [DOI: 10.5281/zenodo.16912444](https://doi.org/10.5281/zenodo.16912444) and place files in the `checkpoints/` directory.

### 3. Run the Application

```bash
python app.py
```

### 4. Open in Browser

Navigate to **http://localhost:5001**

## Usage

### Step 1: Upload Data

- Drag and drop your `.h5ad` file or click to browse
- Supports single-cell AnnData files with cell type annotations

### Step 2: Configure Analysis

- Review data summary (cells, genes, normalization status)
- Select **Group Column** (e.g., `cell_type`, `louvain`, `cluster`)
- Choose **Source** (baseline) and **Target** (desired state) populations

### Step 3: View Results

- View top differentially expressed genes (v-scores)
- Browse ranked compounds with probability scores
- Click iLINCS links to explore compound details and signatures
- Export results as CSV or JSON

## Project Structure

```
DrugPredictorForScRNAseq/
├── app.py              # Main Flask application (refactored & modular)
├── config.py           # Configuration settings
├── requirements.txt    # Python dependencies
├── index.html          # Main web page
├── utils/              # Utility modules (NEW!)
│   ├── __init__.py    # Package initialization
│   ├── metadata.py    # AnnData metadata extraction
│   ├── prediction.py  # DrugReflector prediction pipeline
│   ├── urls.py        # iLINCS URL generation
│   └── validation.py  # File and checkpoint validation
├── static/
│   ├── css/
│   │   └── style.css   # Premium dark theme styles
│   └── js/
│       └── app.js      # Frontend application logic
├── uploads/            # Temporary file storage (auto-created)
├── checkpoints/        # DrugReflector model files
└── README.md
```

### Modular Architecture

The application has been refactored into a clean, maintainable modular structure:

- **`utils/metadata.py`**: Handles AnnData file inspection, metadata extraction, and JSON serialization
- **`utils/prediction.py`**: Complete DrugReflector pipeline including v-score computation, preprocessing, and result formatting
- **`utils/urls.py`**: Generates iLINCS database URLs for compound exploration
- **`utils/validation.py`**: File upload validation, checkpoint verification, and group validation

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Check system and dependency status |
| `/api/upload` | POST | Upload `.h5ad` file |
| `/api/metadata/<file_id>` | GET | Get AnnData metadata |
| `/api/analyze` | POST | Run DrugReflector analysis |
| `/api/cleanup/<file_id>` | DELETE | Remove uploaded file |

## Requirements

- Python 3.8+
- PyTorch
- DrugReflector
- Scanpy
- AnnData
- Flask

## License

This project uses the [DrugReflector](https://github.com/Cellarity/drugreflector) library by Cellarity.

## Troubleshooting

### Model checkpoints not found

Download checkpoints from Zenodo and place them in the `checkpoints/` directory:
```bash
zenodo_get --output-dir checkpoints 16912444
```

### DrugReflector not installed

```bash
pip install drugreflector
```

### Gene symbol issues

DrugReflector automatically converts gene names to HGNC format. Ensure your data uses standard gene symbols.
