# DrugReflector Automation App — Comprehensive Project Plan

## 1. Project Overview

This project builds a **production-ready, automated phenotypic drug discovery application with DrugReflector** (https://github.com/Cellarity/drugreflector) 
that:

1. Accepts **single-cell (AnnData)** or **bulk DEG** input.
2. Automatically **preprocesses**, **computes v-score signatures**, and **validates groups**.use scANVI (scVI-tools) for single-cell cell type annotation and. show user the cell type annotation and ask user to select the baseline and target cell types. 
3. Runs **DrugReflector** inference to rank compounds by likelihood of inducing a desired state transition.
4. Returns a structured, interactive, exportable prediction report and target genes and pathways.

The goal is to create a **robust, scalable, user-friendly system** for phenotype-to-compound prioritization, suitable for internal R&D workflows, computational biologists, and translational researchers.

---

## 2. Functional Requirements

### 2.1 Core Capabilities
- Upload `.h5ad` file.
- Auto-inspect AnnData metadata (`.obs`, `.var`, matrix shape).
- User selects:
  - `group_col` (cluster/cell-type label)
  - `source group`
  - `target group`
- Automatic preprocessing pipeline:
  - Validate log-normalization
  - Apply Scanpy normalization if needed
  - Validate gene names
- Compute **v-score signature** using DrugReflector utilities.
- Run DrugReflector inference (CPU or GPU).
- Return:
  - Ranked compound list
  - Scores (rank, probability)
  - Target genes and pathways.




