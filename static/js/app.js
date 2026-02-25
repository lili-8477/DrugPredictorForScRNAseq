/**
 * DrugReflector Automation MVP - Frontend Application
 * Handles file upload, QC (Scrublet), annotation (CellTypist),
 * drug prediction configuration, and results visualization.
 *
 * Pipeline: Upload → QC → Annotation → Configure → Drug Prediction → Results
 */

// ==================== State Management ====================
const state = {
    fileId: null,
    filename: null,
    metadata: null,
    results: null,
    sortColumn: 'rank',
    sortDirection: 'asc',
    // New upstream analysis state
    doubletResults: null,
    annotationResults: null,
    doubletsFiltered: false,
    umapData: null,
    annotationColumnsData: []
};

// ==================== DOM Elements ====================
const elements = {
    // Header
    headerStatus: document.getElementById('headerStatus'),

    // Upload section
    uploadSection: document.getElementById('uploadSection'),
    uploadZone: document.getElementById('uploadZone'),
    fileInput: document.getElementById('fileInput'),
    uploadProgress: document.getElementById('uploadProgress'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),

    // QC section
    qcSection: document.getElementById('qcSection'),
    qcDetectedBanner: document.getElementById('qcDetectedBanner'),
    qcDetectedText: document.getElementById('qcDetectedText'),
    qcFilenameBadge: document.getElementById('qcFilenameBadge'),
    qcCellCount: document.getElementById('qcCellCount'),
    qcGeneCount: document.getElementById('qcGeneCount'),
    qcNormStatus: document.getElementById('qcNormStatus'),
    doubletRate: document.getElementById('doubletRate'),
    runScrubletBtn: document.getElementById('runScrubletBtn'),
    skipQcBtn: document.getElementById('skipQcBtn'),
    qcResults: document.getElementById('qcResults'),
    totalCellsQc: document.getElementById('totalCellsQc'),
    doubletsFound: document.getElementById('doubletsFound'),
    doubletRateResult: document.getElementById('doubletRateResult'),
    scrubletThreshold: document.getElementById('scrubletThreshold'),
    scoreHistogram: document.getElementById('scoreHistogram'),
    filterDoubletsBtn: document.getElementById('filterDoubletsBtn'),
    keepDoubletsBtn: document.getElementById('keepDoubletsBtn'),

    // Annotation section
    annotationSection: document.getElementById('annotationSection'),
    annotationDetectedBanner: document.getElementById('annotationDetectedBanner'),
    annotationDetectedText: document.getElementById('annotationDetectedText'),
    celltypistModel: document.getElementById('celltypistModel'),
    majorityVoting: document.getElementById('majorityVoting'),
    runAnnotationBtn: document.getElementById('runAnnotationBtn'),
    skipAnnotationBtn: document.getElementById('skipAnnotationBtn'),
    annotationResults: document.getElementById('annotationResults'),
    nCellTypes: document.getElementById('nCellTypes'),
    meanConfidence: document.getElementById('meanConfidence'),
    modelUsed: document.getElementById('modelUsed'),
    cellTypeBody: document.getElementById('cellTypeBody'),
    continueToConfigBtn: document.getElementById('continueToConfigBtn'),

    // Model training
    trainModelCard: document.getElementById('trainModelCard'),
    trainLabelsColumn: document.getElementById('trainLabelsColumn'),
    trainModelName: document.getElementById('trainModelName'),
    trainFeatureSelection: document.getElementById('trainFeatureSelection'),
    trainTopGenes: document.getElementById('trainTopGenes'),
    trainEpochs: document.getElementById('trainEpochs'),
    trainModelBtn: document.getElementById('trainModelBtn'),
    trainModelResults: document.getElementById('trainModelResults'),
    trainedModelName: document.getElementById('trainedModelName'),
    trainedNCells: document.getElementById('trainedNCells'),
    trainedNGenes: document.getElementById('trainedNGenes'),
    trainedNLabels: document.getElementById('trainedNLabels'),
    trainedLabelsBody: document.getElementById('trainedLabelsBody'),
    trainSubsetColumn: document.getElementById('trainSubsetColumn'),
    trainMaxCells: document.getElementById('trainMaxCells'),
    trainSubsetValuesContainer: document.getElementById('trainSubsetValuesContainer'),
    trainSubsetValues: document.getElementById('trainSubsetValues'),
    trainSubsetSelectAll: document.getElementById('trainSubsetSelectAll'),
    trainSubsetSelectNone: document.getElementById('trainSubsetSelectNone'),

    // UMAP section
    umapSection: document.getElementById('umapSection'),
    umapDetectedBanner: document.getElementById('umapDetectedBanner'),
    umapDetectedText: document.getElementById('umapDetectedText'),
    runUmapBtn: document.getElementById('runUmapBtn'),
    skipUmapBtn: document.getElementById('skipUmapBtn'),
    umapResults: document.getElementById('umapResults'),
    umapColorBy: document.getElementById('umapColorBy'),
    umapPlot: document.getElementById('umapPlot'),
    umapCellCount: document.getElementById('umapCellCount'),
    umapSteps: document.getElementById('umapSteps'),
    umapGeneInput: document.getElementById('umapGeneInput'),
    geneAutocomplete: document.getElementById('geneAutocomplete'),
    continueFromUmapBtn: document.getElementById('continueFromUmapBtn'),

    // Metadata / Config section
    metadataSection: document.getElementById('metadataSection'),
    filenameBadge: document.getElementById('filenameBadge'),
    cellCount: document.getElementById('cellCount'),
    geneCount: document.getElementById('geneCount'),
    normStatus: document.getElementById('normStatus'),

    // Selection
    groupCol: document.getElementById('groupCol'),
    sourceGroup: document.getElementById('sourceGroup'),
    targetGroup: document.getElementById('targetGroup'),
    transitionIndicator: document.getElementById('transitionIndicator'),
    sourceLabel: document.getElementById('sourceLabel'),
    targetLabel: document.getElementById('targetLabel'),

    // Actions
    resetBtn: document.getElementById('resetBtn'),
    analyzeBtn: document.getElementById('analyzeBtn'),

    // Results section
    resultsSection: document.getElementById('resultsSection'),
    resultsSummary: document.getElementById('resultsSummary'),
    upregulatedGenes: document.getElementById('upregulatedGenes'),
    downregulatedGenes: document.getElementById('downregulatedGenes'),
    pathwayCard: document.getElementById('pathwayCard'),
    upregulatedPathways: document.getElementById('upregulatedPathways'),
    downregulatedPathways: document.getElementById('downregulatedPathways'),
    resultsTable: document.getElementById('resultsTable'),
    resultsBody: document.getElementById('resultsBody'),
    exportCsvBtn: document.getElementById('exportCsvBtn'),
    exportJsonBtn: document.getElementById('exportJsonBtn'),
    newAnalysisBtn: document.getElementById('newAnalysisBtn'),

    // Loading
    loadingOverlay: document.getElementById('loadingOverlay'),
    loadingTitle: document.getElementById('loadingTitle'),
    loadingMessage: document.getElementById('loadingMessage'),

    // Toast
    errorToast: document.getElementById('errorToast'),
    errorMessage: document.getElementById('errorMessage'),
    closeToast: document.getElementById('closeToast')
};

// ==================== API Functions ====================
const api = {
    baseUrl: '',

    async checkStatus() {
        const response = await fetch(`${this.baseUrl}/api/status`);
        return response.json();
    },

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${this.baseUrl}/api/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const error = await response.json();
                throw new Error(error.error || 'Upload failed');
            } else {
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }
        }

        return response.json();
    },

    async getMetadata(fileId) {
        const response = await fetch(`${this.baseUrl}/api/metadata/${fileId}`);

        if (!response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to get metadata');
            } else {
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }
        }

        return response.json();
    },

    async runDoubletDetection(fileId, expectedDoubletRate) {
        const response = await fetch(`${this.baseUrl}/api/doublet-detection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                file_id: fileId,
                expected_doublet_rate: expectedDoubletRate
            })
        });

        if (!response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const error = await response.json();
                throw new Error(error.error || 'Doublet detection failed');
            } else {
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }
        }

        return response.json();
    },

    async filterDoublets(fileId) {
        const response = await fetch(`${this.baseUrl}/api/filter-doublets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_id: fileId })
        });

        if (!response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const error = await response.json();
                throw new Error(error.error || 'Doublet filtering failed');
            } else {
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }
        }

        return response.json();
    },

    async runAnnotation(fileId, modelName, majorityVoting) {
        const response = await fetch(`${this.baseUrl}/api/annotate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                file_id: fileId,
                model: modelName,
                majority_voting: majorityVoting
            })
        });

        if (!response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const error = await response.json();
                throw new Error(error.error || 'Annotation failed');
            } else {
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }
        }

        return response.json();
    },

    async computeUmap(fileId, forceRecompute = false) {
        const response = await fetch(`${this.baseUrl}/api/umap`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                file_id: fileId,
                force_recompute: forceRecompute
            })
        });

        if (!response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const error = await response.json();
                throw new Error(error.error || 'UMAP computation failed');
            } else {
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }
        }

        return response.json();
    },

    async getGeneExpression(fileId, gene) {
        const response = await fetch(`${this.baseUrl}/api/gene-expression`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_id: fileId, gene })
        });

        if (!response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const error = await response.json();
                throw new Error(error.error || 'Gene expression fetch failed');
            } else {
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }
        }

        return response.json();
    },

    async searchGenes(fileId, query) {
        const response = await fetch(`${this.baseUrl}/api/gene-search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_id: fileId, query })
        });

        if (!response.ok) return { genes: [] };
        return response.json();
    },

    async getAnnotationColumns(fileId) {
        const response = await fetch(`${this.baseUrl}/api/annotation-columns/${fileId}`);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get annotation columns');
        }
        return response.json();
    },

    async trainModel(params) {
        const response = await fetch(`${this.baseUrl}/api/train-model`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });

        if (!response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const error = await response.json();
                throw new Error(error.error || 'Model training failed');
            } else {
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }
        }

        return response.json();
    },

    async getCustomModels() {
        const response = await fetch(`${this.baseUrl}/api/custom-models`);
        if (!response.ok) return { models: [] };
        return response.json();
    },

    async analyze(params) {
        const response = await fetch(`${this.baseUrl}/api/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(params)
        });

        if (!response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const error = await response.json();
                throw new Error(error.error || 'Analysis failed');
            } else {
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }
        }

        return response.json();
    },

    async cleanup(fileId) {
        await fetch(`${this.baseUrl}/api/cleanup/${fileId}`, {
            method: 'DELETE'
        });
    }
};

// ==================== UI Functions ====================
function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorToast.hidden = false;

    // Auto-hide after 5 seconds
    setTimeout(() => {
        elements.errorToast.hidden = true;
    }, 5000);
}

function showLoading(title, message) {
    elements.loadingTitle.textContent = title;
    elements.loadingMessage.textContent = message;
    elements.loadingOverlay.hidden = false;
}

function hideLoading() {
    elements.loadingOverlay.hidden = true;
}

function updateHeaderStatus(status, message) {
    const indicator = elements.headerStatus.querySelector('.status-indicator');
    const text = elements.headerStatus.querySelector('.status-text');

    indicator.className = 'status-indicator';
    if (status === 'loading') indicator.classList.add('loading');
    if (status === 'error') indicator.classList.add('error');

    text.textContent = message;
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function populateSelect(selectElement, options, placeholder = 'Select...') {
    selectElement.innerHTML = `<option value="">${placeholder}</option>`;
    options.forEach(option => {
        const opt = document.createElement('option');
        opt.value = option;
        opt.textContent = option;
        selectElement.appendChild(opt);
    });
}

// ==================== Upload Handlers ====================
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.uploadZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.uploadZone.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.uploadZone.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileUpload(files[0]);
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        handleFileUpload(files[0]);
    }
}

async function handleFileUpload(file) {
    // Validate file type
    if (!file.name.endsWith('.h5ad')) {
        showError('Invalid file type. Please upload a .h5ad file.');
        return;
    }

    // Show progress
    elements.uploadProgress.hidden = false;
    elements.progressFill.style.width = '0%';
    elements.progressText.textContent = 'Uploading...';

    try {
        // Simulate upload progress (real progress would need XHR)
        elements.progressFill.style.width = '30%';

        // Upload file
        const result = await api.uploadFile(file);
        state.fileId = result.file_id;
        state.filename = result.filename;

        elements.progressFill.style.width = '60%';
        elements.progressText.textContent = 'Extracting metadata...';

        // Get metadata
        const metadata = await api.getMetadata(state.fileId);
        state.metadata = metadata;

        elements.progressFill.style.width = '100%';
        elements.progressText.textContent = 'Complete!';

        // Show QC section (next step after upload)
        setTimeout(() => {
            showQcSection(metadata);
        }, 500);

    } catch (error) {
        showError(error.message);
        elements.uploadProgress.hidden = true;
        elements.progressFill.style.width = '0%';
    }
}

// ==================== QC Section ====================
function showQcSection(metadata) {
    // Update file summary banner
    elements.qcFilenameBadge.textContent = metadata.filename;
    elements.qcCellCount.textContent = formatNumber(metadata.shape.n_cells);
    elements.qcGeneCount.textContent = formatNumber(metadata.shape.n_genes);
    elements.qcNormStatus.textContent = metadata.is_log_normalized ? 'Log-normalized' : 'Raw counts';

    // Check for existing doublet scores
    const existing = metadata.existing_results || {};
    if (existing.has_doublet_scores) {
        elements.qcDetectedBanner.hidden = false;
        elements.qcDetectedText.textContent = 'Doublet scores already present in data. You can skip or re-run.';
    } else {
        elements.qcDetectedBanner.hidden = true;
    }

    // Hide upload progress, show QC section
    elements.uploadProgress.hidden = true;
    elements.qcSection.hidden = false;
    elements.qcResults.hidden = true;

    // Scroll to QC section
    elements.qcSection.scrollIntoView({ behavior: 'smooth' });
    updateHeaderStatus('ok', 'Data loaded - Ready for QC');
}

async function handleRunScrublet() {
    const expectedRate = parseFloat(elements.doubletRate.value) || 0.06;

    showLoading('Running Scrublet', 'Detecting doublets in your dataset...');

    try {
        const result = await api.runDoubletDetection(state.fileId, expectedRate);
        state.doubletResults = result.results;

        hideLoading();
        displayDoubletResults(result.results);
    } catch (error) {
        hideLoading();
        showError(error.message);
    }
}

function displayDoubletResults(results) {
    // Update stats
    elements.totalCellsQc.textContent = formatNumber(results.n_cells_total);
    elements.doubletsFound.textContent = formatNumber(results.n_doublets);
    elements.doubletRateResult.textContent = (results.doublet_rate * 100).toFixed(1) + '%';
    elements.scrubletThreshold.textContent = results.threshold.toFixed(3);

    // Render histogram
    renderHistogram(results.histogram, results.threshold);

    // Show results
    elements.qcResults.hidden = false;
    elements.qcResults.scrollIntoView({ behavior: 'smooth' });
}

function renderHistogram(histData, threshold) {
    const container = elements.scoreHistogram;
    container.innerHTML = '';

    const maxCount = Math.max(...histData.counts);

    histData.counts.forEach((count, i) => {
        const bar = document.createElement('div');
        bar.className = 'histogram-bar';

        const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
        bar.style.height = `${height}%`;

        // Color bars beyond threshold as doublets (red)
        const binCenter = (histData.bin_edges[i] + histData.bin_edges[i + 1]) / 2;
        if (binCenter >= threshold) {
            bar.classList.add('doublet-bar');
        }

        // Tooltip
        bar.title = `Score: ${histData.bin_edges[i].toFixed(2)}-${histData.bin_edges[i + 1].toFixed(2)}\nCount: ${count}`;

        container.appendChild(bar);
    });
}

async function handleFilterDoublets() {
    showLoading('Filtering Doublets', 'Removing predicted doublets from the dataset...');

    try {
        const result = await api.filterDoublets(state.fileId);
        state.metadata = result.metadata;
        state.doubletsFiltered = true;

        hideLoading();

        // Update QC banner with new cell count
        elements.qcCellCount.textContent = formatNumber(result.n_remaining);

        // Show annotation section
        showAnnotationSection();
    } catch (error) {
        hideLoading();
        showError(error.message);
    }
}

function handleSkipQc() {
    showAnnotationSection();
}

function handleKeepDoublets() {
    // Continue without filtering
    showAnnotationSection();
}

// ==================== Annotation Section ====================
function showAnnotationSection() {
    elements.annotationSection.hidden = false;
    elements.annotationResults.hidden = true;
    elements.trainModelResults.hidden = true;

    // Check for existing annotations
    const existing = (state.metadata && state.metadata.existing_results) || {};
    if (existing.has_cell_type_annotations) {
        elements.annotationDetectedBanner.hidden = false;
        const cols = existing.annotation_columns.join(', ');
        elements.annotationDetectedText.textContent = `Cell type annotations found: ${cols}. You can skip or re-run.`;
    } else {
        elements.annotationDetectedBanner.hidden = true;
    }

    // Load annotation columns for training and custom models
    loadAnnotationColumns();
    loadCustomModels();

    // Scroll to annotation section
    elements.annotationSection.scrollIntoView({ behavior: 'smooth' });
    updateHeaderStatus('ok', 'Ready for cell type annotation');
}

async function handleRunAnnotation() {
    const modelName = elements.celltypistModel.value;
    const majorityVoting = elements.majorityVoting.checked;

    showLoading('Running CellTypist', `Annotating cell types with ${modelName.replace('.pkl', '')}...\nThis may take a few minutes (downloading model if first use).`);

    try {
        const result = await api.runAnnotation(state.fileId, modelName, majorityVoting);
        state.annotationResults = result.results;
        state.metadata = result.metadata;

        hideLoading();
        displayAnnotationResults(result.results);
        // Reload annotation columns (new celltypist columns now available for training)
        loadAnnotationColumns();
    } catch (error) {
        hideLoading();
        showError(error.message);
    }
}

function displayAnnotationResults(results) {
    // Update summary stats
    elements.nCellTypes.textContent = results.n_cell_types;
    elements.meanConfidence.textContent = (results.overall_confidence.mean * 100).toFixed(1) + '%';
    elements.modelUsed.textContent = results.model_used.replace('.pkl', '');

    // Populate cell type table
    elements.cellTypeBody.innerHTML = '';
    results.cell_types.forEach(ct => {
        const row = document.createElement('tr');
        const confPercent = (ct.mean_confidence * 100).toFixed(1);

        row.innerHTML = `
            <td class="celltype-name-cell">${ct.name}</td>
            <td>${formatNumber(ct.count)}</td>
            <td>
                <div class="percentage-bar-container">
                    <div class="percentage-bar">
                        <div class="percentage-bar-fill" style="width: ${ct.percentage}%"></div>
                    </div>
                    <span class="percentage-text">${ct.percentage.toFixed(1)}%</span>
                </div>
            </td>
            <td>
                <span class="confidence-badge ${getConfidenceClass(ct.mean_confidence)}">${confPercent}%</span>
            </td>
        `;
        elements.cellTypeBody.appendChild(row);
    });

    // Show results
    elements.annotationResults.hidden = false;
    elements.annotationResults.scrollIntoView({ behavior: 'smooth' });
}

function getConfidenceClass(confidence) {
    if (confidence >= 0.8) return 'conf-high';
    if (confidence >= 0.5) return 'conf-medium';
    return 'conf-low';
}

function handleSkipAnnotation() {
    showUmapSection();
}

function handleContinueToConfig() {
    showUmapSection();
}

// ==================== Model Training ====================
async function loadAnnotationColumns() {
    if (!state.fileId) return;

    try {
        const result = await api.getAnnotationColumns(state.fileId);
        state.annotationColumnsData = result.columns;

        // Populate labels column dropdown
        const select = elements.trainLabelsColumn;
        select.innerHTML = '<option value="">Select annotation column...</option>';

        result.columns.forEach(col => {
            const opt = document.createElement('option');
            opt.value = col.name;
            opt.textContent = `${col.name} (${col.n_unique} labels)`;
            select.appendChild(opt);
        });

        // Populate subset column dropdown
        const subsetSelect = elements.trainSubsetColumn;
        subsetSelect.innerHTML = '<option value="">All cells</option>';

        result.columns.forEach(col => {
            const opt = document.createElement('option');
            opt.value = col.name;
            opt.textContent = `${col.name} (${col.n_unique} values)`;
            subsetSelect.appendChild(opt);
        });
    } catch (error) {
        console.error('Failed to load annotation columns:', error);
    }
}

function handleTrainSubsetColumnChange() {
    const colName = elements.trainSubsetColumn.value;

    if (!colName) {
        elements.trainSubsetValuesContainer.hidden = true;
        elements.trainSubsetValues.innerHTML = '';
        return;
    }

    const colData = state.annotationColumnsData.find(c => c.name === colName);
    if (!colData) return;

    elements.trainSubsetValues.innerHTML = '';
    colData.values.forEach(val => {
        const label = document.createElement('label');
        label.className = 'checkbox-label';
        label.style.cssText = 'white-space: nowrap;';
        label.innerHTML = `<input type="checkbox" class="train-subset-checkbox" value="${val}" checked> <span class="checkbox-text">${val}</span>`;
        elements.trainSubsetValues.appendChild(label);
    });

    elements.trainSubsetValuesContainer.hidden = false;
}

function handleTrainSubsetSelectAll() {
    elements.trainSubsetValues.querySelectorAll('.train-subset-checkbox').forEach(cb => cb.checked = true);
}

function handleTrainSubsetSelectNone() {
    elements.trainSubsetValues.querySelectorAll('.train-subset-checkbox').forEach(cb => cb.checked = false);
}

function handleTrainLabelsChange() {
    const col = elements.trainLabelsColumn.value;
    const name = elements.trainModelName.value.trim();
    elements.trainModelBtn.disabled = !(col && name);
}

function handleTrainModelNameInput() {
    const col = elements.trainLabelsColumn.value;
    const name = elements.trainModelName.value.trim();
    elements.trainModelBtn.disabled = !(col && name);
}

async function handleTrainModel() {
    const labelsColumn = elements.trainLabelsColumn.value;
    const modelName = elements.trainModelName.value.trim();

    if (!labelsColumn || !modelName) return;

    showLoading('Training Model', `Training custom CellTypist model "${modelName}"...\nThis may take several minutes.`);

    try {
        const params = {
            file_id: state.fileId,
            labels_column: labelsColumn,
            model_name: modelName,
            feature_selection: elements.trainFeatureSelection.checked,
            top_genes: parseInt(elements.trainTopGenes.value) || 300,
            epochs: parseInt(elements.trainEpochs.value) || 10,
            use_SGD: true
        };

        // Optional: max cells
        const maxCells = parseInt(elements.trainMaxCells.value);
        if (maxCells > 0) {
            params.max_cells = maxCells;
        }

        // Optional: subset by group
        const subsetCol = elements.trainSubsetColumn.value;
        if (subsetCol) {
            const checkedBoxes = elements.trainSubsetValues.querySelectorAll('.train-subset-checkbox:checked');
            const subsetVals = Array.from(checkedBoxes).map(cb => cb.value);
            if (subsetVals.length > 0) {
                params.subset_column = subsetCol;
                params.subset_values = subsetVals;
            }
        }

        const result = await api.trainModel(params);
        hideLoading();
        displayTrainingResults(result.results);

        // Add custom model to the CellTypist model dropdown
        addCustomModelToDropdown(result.results.model_name);
    } catch (error) {
        hideLoading();
        showError(error.message);
    }
}

function displayTrainingResults(results) {
    elements.trainedModelName.textContent = results.model_name.replace('.pkl', '');
    elements.trainedNCells.textContent = formatNumber(results.n_cells_trained);
    elements.trainedNGenes.textContent = formatNumber(results.n_genes);
    elements.trainedNLabels.textContent = results.n_labels;

    elements.trainedLabelsBody.innerHTML = '';
    results.label_summary.forEach(label => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="celltype-name-cell">${label.name}</td>
            <td>${formatNumber(label.count)}</td>
        `;
        elements.trainedLabelsBody.appendChild(row);
    });

    elements.trainModelResults.hidden = false;
    elements.trainModelResults.scrollIntoView({ behavior: 'smooth' });
}

async function loadCustomModels() {
    try {
        const result = await api.getCustomModels();
        if (result.models.length > 0) {
            const select = elements.celltypistModel;
            let customGroup = select.querySelector('optgroup[label="Custom Models"]');
            if (!customGroup) {
                customGroup = document.createElement('optgroup');
                customGroup.label = 'Custom Models';
                select.insertBefore(customGroup, select.firstChild);
            }
            // Clear existing custom options to avoid dupes
            customGroup.innerHTML = '';
            result.models.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.path;
                opt.textContent = m.name.replace('.pkl', '') + ' (custom)';
                customGroup.appendChild(opt);
            });
        }
    } catch (e) {
        // Non-critical, ignore
    }
}

function addCustomModelToDropdown(modelName) {
    const select = elements.celltypistModel;
    // Add custom optgroup if not present
    let customGroup = select.querySelector('optgroup[label="Custom Models"]');
    if (!customGroup) {
        customGroup = document.createElement('optgroup');
        customGroup.label = 'Custom Models';
        select.insertBefore(customGroup, select.firstChild);
    }

    const opt = document.createElement('option');
    opt.value = modelName;
    opt.textContent = modelName.replace('.pkl', '') + ' (custom)';
    customGroup.appendChild(opt);
}

// ==================== UMAP Section ====================
function showUmapSection() {
    elements.umapSection.hidden = false;
    elements.umapResults.hidden = true;

    // Check for existing UMAP
    const existing = (state.metadata && state.metadata.existing_results) || {};
    if (existing.has_umap) {
        elements.umapDetectedBanner.hidden = false;
        elements.umapDetectedText.textContent = 'UMAP embedding already present. Loading existing coordinates...';
        // Auto-load existing UMAP (no computation needed)
        autoLoadExistingUmap();
    } else {
        elements.umapDetectedBanner.hidden = true;
    }

    elements.umapSection.scrollIntoView({ behavior: 'smooth' });
    updateHeaderStatus('ok', 'Ready for UMAP visualization');
}

async function autoLoadExistingUmap() {
    try {
        const result = await api.computeUmap(state.fileId, false);
        state.umapData = result.results;
        displayUmapResults(state.umapData);
    } catch (error) {
        showError(error.message);
    }
}

async function handleComputeUmap() {
    showLoading('Computing UMAP', 'Running dimensionality reduction...\nThis may take a minute for large datasets.');

    try {
        const result = await api.computeUmap(state.fileId);
        state.umapData = result.results;

        hideLoading();
        displayUmapResults(state.umapData);
    } catch (error) {
        hideLoading();
        showError(error.message);
    }
}

function displayUmapResults(umapData) {
    // Update cell count
    elements.umapCellCount.textContent = `${formatNumber(umapData.n_cells)} cells`;

    // Populate color-by dropdown
    populateSelect(elements.umapColorBy, umapData.categorical_columns, 'Select column...');

    // Clear gene input
    elements.umapGeneInput.value = '';
    elements.geneAutocomplete.hidden = true;

    // Auto-select first column if available
    if (umapData.categorical_columns.length > 0) {
        elements.umapColorBy.value = umapData.categorical_columns[0];
        renderUmapPlot(umapData, umapData.categorical_columns[0]);
    } else {
        renderUmapPlot(umapData, null);
    }

    // Show steps performed
    if (umapData.steps_performed && umapData.steps_performed.length > 0) {
        elements.umapSteps.textContent = 'Steps: ' + umapData.steps_performed.join(' → ');
    }

    // Show results
    elements.umapResults.hidden = false;
    elements.umapResults.scrollIntoView({ behavior: 'smooth' });
}

function renderUmapPlot(umapData, colorByColumn, geneExpression) {
    const traces = [];

    if (geneExpression) {
        // Continuous coloring by gene expression
        traces.push({
            x: umapData.x,
            y: umapData.y,
            mode: 'markers',
            type: 'scattergl',
            name: geneExpression.gene,
            marker: {
                size: 3,
                opacity: 0.8,
                color: geneExpression.values,
                colorscale: [
                    [0, '#d1d5db'],
                    [0.25, '#f9a8a8'],
                    [0.5, '#ef4444'],
                    [0.75, '#dc2626'],
                    [1, '#991b1b']
                ],
                colorbar: {
                    title: { text: geneExpression.gene, font: { color: '#e2e8f0', size: 12 } },
                    tickfont: { color: '#94a3b8' },
                    thickness: 15,
                    len: 0.6
                },
                showscale: true
            },
            hovertemplate: `${geneExpression.gene}: %{marker.color:.2f}<br>UMAP1: %{x:.2f}<br>UMAP2: %{y:.2f}<extra></extra>`
        });
    } else if (colorByColumn && umapData.labels[colorByColumn]) {
        // Group cells by category
        const labelValues = umapData.labels[colorByColumn];
        const categories = [...new Set(labelValues)];

        categories.forEach(category => {
            const indices = [];
            labelValues.forEach((val, i) => {
                if (val === category) indices.push(i);
            });

            traces.push({
                x: indices.map(i => umapData.x[i]),
                y: indices.map(i => umapData.y[i]),
                mode: 'markers',
                type: 'scattergl',
                name: category,
                marker: {
                    size: 3,
                    opacity: 0.7
                },
                hovertemplate: `${category}<br>UMAP1: %{x:.2f}<br>UMAP2: %{y:.2f}<extra></extra>`
            });
        });
    } else {
        // Single trace, no coloring
        traces.push({
            x: umapData.x,
            y: umapData.y,
            mode: 'markers',
            type: 'scattergl',
            name: 'Cells',
            marker: {
                size: 3,
                opacity: 0.7,
                color: '#6366f1'
            },
            hovertemplate: 'UMAP1: %{x:.2f}<br>UMAP2: %{y:.2f}<extra></extra>'
        });
    }

    const layout = {
        xaxis: {
            title: 'UMAP 1',
            color: '#94a3b8',
            gridcolor: 'rgba(255,255,255,0.05)',
            zerolinecolor: 'rgba(255,255,255,0.1)'
        },
        yaxis: {
            title: 'UMAP 2',
            color: '#94a3b8',
            gridcolor: 'rgba(255,255,255,0.05)',
            zerolinecolor: 'rgba(255,255,255,0.1)'
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(30,41,59,0.6)',
        font: { color: '#e2e8f0', family: 'Inter, sans-serif' },
        legend: {
            font: { size: 11 },
            itemsizing: 'constant'
        },
        margin: { l: 50, r: 20, t: 20, b: 50 },
        hovermode: 'closest'
    };

    const config = {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        displaylogo: false
    };

    Plotly.newPlot(elements.umapPlot, traces, layout, config);
}

function handleUmapColorChange() {
    if (!state.umapData) return;
    // Switching to metadata coloring clears gene selection
    elements.umapGeneInput.value = '';
    elements.geneAutocomplete.hidden = true;
    const colorBy = elements.umapColorBy.value;
    renderUmapPlot(state.umapData, colorBy || null);
}

// ==================== Gene Expression Coloring ====================
let geneSearchTimeout = null;

function handleGeneInputChange() {
    const query = elements.umapGeneInput.value.trim();

    if (geneSearchTimeout) clearTimeout(geneSearchTimeout);

    if (query.length < 1) {
        elements.geneAutocomplete.hidden = true;
        return;
    }

    // Debounce: wait 200ms after typing stops
    geneSearchTimeout = setTimeout(async () => {
        try {
            const result = await api.searchGenes(state.fileId, query);
            showGeneAutocomplete(result.genes);
        } catch (e) {
            elements.geneAutocomplete.hidden = true;
        }
    }, 200);
}

function showGeneAutocomplete(genes) {
    const container = elements.geneAutocomplete;
    container.innerHTML = '';

    if (genes.length === 0) {
        container.hidden = true;
        return;
    }

    genes.forEach(gene => {
        const item = document.createElement('div');
        item.className = 'gene-autocomplete-item';
        item.textContent = gene;
        item.addEventListener('click', () => selectGene(gene));
        container.appendChild(item);
    });

    container.hidden = false;
}

async function selectGene(gene) {
    elements.geneAutocomplete.hidden = true;
    elements.umapGeneInput.value = gene;

    // Clear the metadata dropdown since we're coloring by gene
    elements.umapColorBy.value = '';

    if (!state.umapData) return;

    showLoading('Loading Gene Expression', `Fetching expression for ${gene}...`);

    try {
        const result = await api.getGeneExpression(state.fileId, gene);
        hideLoading();
        renderUmapPlot(state.umapData, null, { gene: result.gene, values: result.values });
    } catch (error) {
        hideLoading();
        showError(error.message);
    }
}

function handleGeneInputKeydown(e) {
    const container = elements.geneAutocomplete;
    const items = container.querySelectorAll('.gene-autocomplete-item');

    if (e.key === 'Escape') {
        container.hidden = true;
        return;
    }

    if (e.key === 'Enter') {
        e.preventDefault();
        const active = container.querySelector('.gene-autocomplete-item.active');
        if (active) {
            selectGene(active.textContent);
        } else if (items.length > 0) {
            selectGene(items[0].textContent);
        }
        return;
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (items.length === 0) return;

        let activeIdx = -1;
        items.forEach((item, i) => {
            if (item.classList.contains('active')) activeIdx = i;
        });

        items.forEach(item => item.classList.remove('active'));

        if (e.key === 'ArrowDown') {
            activeIdx = (activeIdx + 1) % items.length;
        } else {
            activeIdx = activeIdx <= 0 ? items.length - 1 : activeIdx - 1;
        }

        items[activeIdx].classList.add('active');
        items[activeIdx].scrollIntoView({ block: 'nearest' });
    }
}

function handleSkipUmap() {
    // If UMAP data was already loaded (existing or just computed), keep it visible
    // Just go directly to configure
    showConfigureSection();
}

function handleContinueFromUmap() {
    showConfigureSection();
}

// ==================== Configure / Metadata Section ====================
function showConfigureSection() {
    displayMetadata(state.metadata);
}

function displayMetadata(metadata) {
    // Update file info
    elements.filenameBadge.textContent = metadata.filename;
    elements.cellCount.textContent = formatNumber(metadata.shape.n_cells);
    elements.geneCount.textContent = formatNumber(metadata.shape.n_genes);
    elements.normStatus.textContent = metadata.is_log_normalized ? 'Log-normalized' : 'Raw counts';

    // Populate group column dropdown
    const categoricalCols = Object.keys(metadata.categorical_columns);
    populateSelect(elements.groupCol, categoricalCols, 'Select column...');

    // Show metadata section
    elements.metadataSection.hidden = false;

    // Scroll to configure section
    elements.metadataSection.scrollIntoView({ behavior: 'smooth' });
    updateHeaderStatus('ok', 'Configure drug prediction');
}

// ==================== Selection Handlers ====================
function handleGroupColChange() {
    const selectedCol = elements.groupCol.value;

    if (!selectedCol) {
        elements.sourceGroup.disabled = true;
        elements.targetGroup.disabled = true;
        elements.sourceGroup.innerHTML = '<option value="">Select group...</option>';
        elements.targetGroup.innerHTML = '<option value="">Select group...</option>';
        elements.transitionIndicator.hidden = true;
        elements.analyzeBtn.disabled = true;
        return;
    }

    // Get values for selected column
    const values = state.metadata.categorical_columns[selectedCol];

    // Populate source and target dropdowns
    populateSelect(elements.sourceGroup, values, 'Select source...');
    populateSelect(elements.targetGroup, values, 'Select target...');

    elements.sourceGroup.disabled = false;
    elements.targetGroup.disabled = false;

    updateAnalyzeButton();
}

function handleGroupChange() {
    const source = elements.sourceGroup.value;
    const target = elements.targetGroup.value;

    if (source && target) {
        elements.sourceLabel.textContent = source;
        elements.targetLabel.textContent = target;
        elements.transitionIndicator.hidden = false;
    } else {
        elements.transitionIndicator.hidden = true;
    }

    updateAnalyzeButton();
}

function updateAnalyzeButton() {
    const groupCol = elements.groupCol.value;
    const source = elements.sourceGroup.value;
    const target = elements.targetGroup.value;

    elements.analyzeBtn.disabled = !(groupCol && source && target && source !== target);
}

// ==================== Analysis ====================
async function runAnalysis() {
    const params = {
        file_id: state.fileId,
        group_col: elements.groupCol.value,
        source_group: elements.sourceGroup.value,
        target_group: elements.targetGroup.value,
        n_top: 50
    };

    showLoading('Running Analysis', 'Computing v-scores and predicting compounds...');

    try {
        const results = await api.analyze(params);
        state.results = results;

        hideLoading();
        displayResults(results);

    } catch (error) {
        hideLoading();
        showError(error.message);
    }
}

// ==================== Results Display ====================
function displayResults(results) {
    // Update summary
    elements.resultsSummary.textContent =
        `Found ${results.n_compounds} compounds for ${results.analysis.source_group} → ${results.analysis.target_group} transition`;

    // Display v-score summary
    displayVScoreSummary(results.vscore_summary);

    // Display predictions table
    displayPredictionsTable(results.predictions);

    // Show results section
    elements.resultsSection.hidden = false;

    // Scroll to results
    elements.resultsSection.scrollIntoView({ behavior: 'smooth' });
}

function displayVScoreSummary(vscore) {
    // Top upregulated genes
    elements.upregulatedGenes.innerHTML = '';
    elements.upregulatedGenes.classList.add('upregulated');
    Object.entries(vscore.top_upregulated).forEach(([gene, score]) => {
        const li = document.createElement('li');
        li.textContent = `${gene} (${score.toFixed(2)})`;
        elements.upregulatedGenes.appendChild(li);
    });

    // Top downregulated genes
    elements.downregulatedGenes.innerHTML = '';
    elements.downregulatedGenes.classList.add('downregulated');
    Object.entries(vscore.top_downregulated).forEach(([gene, score]) => {
        const li = document.createElement('li');
        li.textContent = `${gene} (${score.toFixed(2)})`;
        elements.downregulatedGenes.appendChild(li);
    });
}

function displayPredictionsTable(predictions) {
    // Sort predictions
    const sorted = [...predictions].sort((a, b) => {
        let aVal = a[state.sortColumn];
        let bVal = b[state.sortColumn];

        if (typeof aVal === 'string') {
            return state.sortDirection === 'asc'
                ? aVal.localeCompare(bVal)
                : bVal.localeCompare(aVal);
        }

        return state.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

    // Find max probability for scaling bars
    const maxProb = Math.max(...predictions.map(p => p.probability));

    // Clear and populate table
    elements.resultsBody.innerHTML = '';

    sorted.forEach((pred, index) => {
        const row = document.createElement('tr');

        const probPercent = (pred.probability / maxProb) * 100;

        row.innerHTML = `
            <td class="rank-cell">${pred.rank}</td>
            <td class="compound-cell">${pred.compound}</td>
            <td class="prob-cell">${pred.probability.toFixed(4)}</td>
            <td>
                <div class="score-bar-container">
                    <div class="score-bar">
                        <div class="score-bar-fill" style="width: ${probPercent}%"></div>
                    </div>
                </div>
            </td>
            <td class="ilincs-cell"><a href="${pred.ilincs_url}" target="_blank" rel="noopener" class="ilincs-link">View in iLINCS</a></td>
        `;

        elements.resultsBody.appendChild(row);
    });
}

function handleTableSort(e) {
    const th = e.target.closest('th.sortable');
    if (!th) return;

    const column = th.dataset.sort;

    if (state.sortColumn === column) {
        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        state.sortColumn = column;
        state.sortDirection = 'asc';
    }

    if (state.results) {
        displayPredictionsTable(state.results.predictions);
    }
}

// ==================== Export Functions ====================
function exportCSV() {
    if (!state.results) return;

    const predictions = state.results.predictions;
    const headers = ['rank', 'compound', 'probability', 'logit', 'ilincs_url'];

    let csv = headers.join(',') + '\n';
    predictions.forEach(pred => {
        csv += `${pred.rank},"${pred.compound}",${pred.probability},${pred.logit || ''},"${pred.ilincs_url || ''}"\n`;
    });

    downloadFile(csv, `drugreflector_results_${Date.now()}.csv`, 'text/csv');
}

function exportJSON() {
    if (!state.results) return;

    const json = JSON.stringify(state.results, null, 2);
    downloadFile(json, `drugreflector_results_${Date.now()}.json`, 'application/json');
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ==================== Reset / New Analysis ====================
function resetApplication() {
    // Cleanup uploaded file
    if (state.fileId) {
        api.cleanup(state.fileId).catch(() => { });
    }

    // Reset state
    state.fileId = null;
    state.filename = null;
    state.metadata = null;
    state.results = null;
    state.doubletResults = null;
    state.annotationResults = null;
    state.doubletsFiltered = false;
    state.umapData = null;

    // Reset UI - hide all sections except upload
    elements.uploadProgress.hidden = true;
    elements.progressFill.style.width = '0%';
    elements.qcSection.hidden = true;
    elements.qcResults.hidden = true;
    elements.annotationSection.hidden = true;
    elements.annotationResults.hidden = true;
    elements.umapSection.hidden = true;
    elements.umapResults.hidden = true;
    elements.metadataSection.hidden = true;
    elements.resultsSection.hidden = true;
    elements.transitionIndicator.hidden = true;
    elements.qcDetectedBanner.hidden = true;
    elements.annotationDetectedBanner.hidden = true;
    elements.umapDetectedBanner.hidden = true;

    // Reset form fields
    elements.fileInput.value = '';
    elements.doubletRate.value = '0.06';
    elements.groupCol.innerHTML = '<option value="">Select column...</option>';
    elements.sourceGroup.innerHTML = '<option value="">Select group...</option>';
    elements.targetGroup.innerHTML = '<option value="">Select group...</option>';
    elements.sourceGroup.disabled = true;
    elements.targetGroup.disabled = true;
    elements.analyzeBtn.disabled = true;
    elements.celltypistModel.selectedIndex = 0;
    elements.majorityVoting.checked = true;

    // Reset histogram
    elements.scoreHistogram.innerHTML = '';

    // Reset cell type table
    elements.cellTypeBody.innerHTML = '';

    // Reset training UI
    elements.trainModelResults.hidden = true;
    elements.trainLabelsColumn.innerHTML = '<option value="">Select annotation column...</option>';
    elements.trainModelName.value = '';
    elements.trainModelBtn.disabled = true;
    elements.trainedLabelsBody.innerHTML = '';
    elements.trainSubsetColumn.innerHTML = '<option value="">All cells</option>';
    elements.trainSubsetValuesContainer.hidden = true;
    elements.trainSubsetValues.innerHTML = '';
    elements.trainMaxCells.value = '';
    state.annotationColumnsData = [];

    updateHeaderStatus('ok', 'Ready');

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==================== Initialization ====================
async function init() {
    // Check system status
    try {
        const status = await api.checkStatus();

        if (status.status === 'ok') {
            updateHeaderStatus('ok', 'System ready');
        } else {
            let message = 'System incomplete: ';
            if (!status.drugreflector.available) message += 'DrugReflector not installed. ';
            if (!status.checkpoints.available) message += 'Model checkpoints missing.';
            updateHeaderStatus('error', message.trim());
        }
    } catch (error) {
        updateHeaderStatus('error', 'Cannot connect to server');
    }

    // Setup event listeners

    // Upload zone
    elements.uploadZone.addEventListener('click', () => elements.fileInput.click());
    elements.uploadZone.addEventListener('dragover', handleDragOver);
    elements.uploadZone.addEventListener('dragleave', handleDragLeave);
    elements.uploadZone.addEventListener('drop', handleDrop);
    elements.fileInput.addEventListener('change', handleFileSelect);

    // QC section
    elements.runScrubletBtn.addEventListener('click', handleRunScrublet);
    elements.skipQcBtn.addEventListener('click', handleSkipQc);
    elements.filterDoubletsBtn.addEventListener('click', handleFilterDoublets);
    elements.keepDoubletsBtn.addEventListener('click', handleKeepDoublets);

    // Annotation section
    elements.runAnnotationBtn.addEventListener('click', handleRunAnnotation);
    elements.skipAnnotationBtn.addEventListener('click', handleSkipAnnotation);
    elements.continueToConfigBtn.addEventListener('click', handleContinueToConfig);

    // Model training
    elements.trainLabelsColumn.addEventListener('change', handleTrainLabelsChange);
    elements.trainModelName.addEventListener('input', handleTrainModelNameInput);
    elements.trainModelBtn.addEventListener('click', handleTrainModel);
    elements.trainSubsetColumn.addEventListener('change', handleTrainSubsetColumnChange);
    elements.trainSubsetSelectAll.addEventListener('click', handleTrainSubsetSelectAll);
    elements.trainSubsetSelectNone.addEventListener('click', handleTrainSubsetSelectNone);

    // UMAP section
    elements.runUmapBtn.addEventListener('click', handleComputeUmap);
    elements.skipUmapBtn.addEventListener('click', handleSkipUmap);
    elements.umapColorBy.addEventListener('change', handleUmapColorChange);
    elements.continueFromUmapBtn.addEventListener('click', handleContinueFromUmap);
    elements.umapGeneInput.addEventListener('input', handleGeneInputChange);
    elements.umapGeneInput.addEventListener('keydown', handleGeneInputKeydown);

    // Close gene autocomplete when clicking outside
    document.addEventListener('click', (e) => {
        if (!elements.umapGeneInput.contains(e.target) && !elements.geneAutocomplete.contains(e.target)) {
            elements.geneAutocomplete.hidden = true;
        }
    });

    // Selection
    elements.groupCol.addEventListener('change', handleGroupColChange);
    elements.sourceGroup.addEventListener('change', handleGroupChange);
    elements.targetGroup.addEventListener('change', handleGroupChange);

    // Actions
    elements.resetBtn.addEventListener('click', resetApplication);
    elements.analyzeBtn.addEventListener('click', runAnalysis);
    elements.newAnalysisBtn.addEventListener('click', resetApplication);

    // Table sorting
    elements.resultsTable.querySelector('thead').addEventListener('click', handleTableSort);

    // Export
    elements.exportCsvBtn.addEventListener('click', exportCSV);
    elements.exportJsonBtn.addEventListener('click', exportJSON);

    // Toast close
    elements.closeToast.addEventListener('click', () => {
        elements.errorToast.hidden = true;
    });
}

// Clean up uploads when user leaves the page
window.addEventListener('beforeunload', () => {
    if (state.fileId) {
        navigator.sendBeacon('/api/cleanup-all', '');
    }
});

// Start application
document.addEventListener('DOMContentLoaded', init);
