# DrugReflector Automation MVP

**Automated phenotypic drug discovery application** using single-cell RNA-seq data and DrugReflector neural network models.

![DrugReflector](https://img.shields.io/badge/DrugReflector-MVP-6366f1)
![Python](https://img.shields.io/badge/Python-3.8+-22d3ee)
![Flask](https://img.shields.io/badge/Flask-2.3+-ef4444)

## Overview

This application provides a user-friendly web interface for:

1. **Uploading** single-cell RNA-seq data — Cell Ranger output (directory or `.h5`) or preprocessed `.h5ad`
2. **Quality Control** — automated QC metrics, interactive threshold filtering, and doublet detection
3. **Preprocessing** — normalization, log-transform, and highly variable gene selection
4. **Cell Type Annotation** — CellTypist integration with pre-trained and custom model training
5. **UMAP Visualization** — interactive dimensionality reduction with gene expression overlay
6. **Drug Prediction** — v-score differential expression and DrugReflector compound ranking
7. **Exploring** compounds via direct iLINCS database integration

## Features

- **Full Upstream Pipeline**: From raw Cell Ranger counts through QC, filtering, normalization, and annotation
- **Three Upload Paths**: Cell Ranger directory (3 gzipped files), Cell Ranger `.h5` file, or preprocessed `.h5ad`
- **Interactive QC**: Violin/scatter plots with adjustable thresholds for genes, UMI counts, mitochondrial %, and ribosomal %
- **Doublet Detection**: Scrublet integration with histogram visualization and one-click filtering
- **Cell Type Annotation**: CellTypist with 50+ pre-trained models and custom model training with cell subsetting
- **UMAP Visualization**: Interactive 2D embedding colored by cell type or gene expression
- **AI-Powered Predictions**: DrugReflector ensemble models for drug-gene signature matching
- **iLINCS Integration**: One-click access to detailed compound information and signatures
- **Modern UI**: Dark-themed, responsive interface with tabbed upload and step-by-step workflow

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

Three upload options:
- **Cell Ranger Directory**: Upload `barcodes.tsv.gz`, `features.tsv.gz`, and `matrix.mtx.gz` → enters full QC pipeline
- **Cell Ranger H5**: Upload a single `filtered_feature_bc_matrix.h5` file → enters full QC pipeline
- **Preprocessed .h5ad**: Upload a pre-processed AnnData file → skips QC, goes to doublet detection

### Step 2: Quality Control (Cell Ranger paths)

- Review QC metric distributions (violin + scatter plots)
- Adjust filtering thresholds with real-time cell count preview
- Apply filters to remove low-quality cells and genes

### Step 3: Preprocessing & Normalization

- Automatic normalization (10k counts/cell), log-transform, and HVG selection
- Doublet detection with Scrublet

### Step 4: Cell Type Annotation

- Annotate cells using CellTypist pre-trained models
- Train custom models from your own labels with optional cell subsetting
- View UMAP colored by cell type or gene expression

### Step 5: Drug Prediction

- Select group column, source, and target populations
- View ranked compounds with probability scores
- Click iLINCS links to explore compound details

## Project Structure

```
DrugPredictorForScRNAseq/
├── app.py                  # Main Flask application
├── config.py               # Configuration settings
├── requirements.txt        # Python dependencies
├── index.html              # Main web page
├── utils/
│   ├── __init__.py         # Package initialization & exports
│   ├── metadata.py         # AnnData metadata extraction
│   ├── preprocessing.py    # 10x reading, QC metrics, filtering, normalization
│   ├── prediction.py       # DrugReflector prediction pipeline
│   ├── doublet_detection.py # Scrublet doublet detection
│   ├── annotation.py       # CellTypist annotation & model training
│   ├── umap.py             # UMAP computation
│   ├── urls.py             # iLINCS URL generation
│   └── validation.py       # File and checkpoint validation
├── custom_models/          # User-trained CellTypist models
├── static/
│   ├── css/
│   │   └── style.css       # Dark theme styles
│   └── js/
│       └── app.js          # Frontend application logic
├── uploads/                # Temporary file storage (auto-created)
├── checkpoints/            # DrugReflector model files
└── README.md
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Check system and dependency status |
| `/api/upload` | POST | Upload `.h5ad` file |
| `/api/upload-10x` | POST | Upload Cell Ranger directory (3 files) |
| `/api/upload-10x-h5` | POST | Upload Cell Ranger `.h5` file |
| `/api/metadata/<file_id>` | GET | Get AnnData metadata |
| `/api/qc-metrics/<file_id>` | POST | Compute QC metrics and plot data |
| `/api/qc-filter` | POST | Apply QC filtering thresholds |
| `/api/preprocess` | POST | Run normalization + HVG pipeline |
| `/api/doublet-detection` | POST | Run Scrublet doublet detection |
| `/api/filter-doublets` | POST | Remove detected doublets |
| `/api/celltypist-models` | GET | List available CellTypist models |
| `/api/annotate` | POST | Run CellTypist annotation |
| `/api/annotation-columns/<file_id>` | GET | Get categorical columns for labels |
| `/api/train-model` | POST | Train custom CellTypist model |
| `/api/custom-models` | GET | List user-trained models |
| `/api/umap` | POST | Compute UMAP embedding |
| `/api/gene-expression` | POST | Get expression values for a gene |
| `/api/gene-search` | POST | Search gene names |
| `/api/analyze` | POST | Run DrugReflector analysis |
| `/api/cleanup/<file_id>` | DELETE | Remove uploaded file |
| `/api/cleanup-all` | POST | Remove all uploaded files |

## Requirements

- Python 3.8+
- PyTorch
- DrugReflector
- Scanpy
- AnnData
- Flask
- Scrublet
- CellTypist

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
