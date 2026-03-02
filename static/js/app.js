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
    // Upstream analysis state
    uploadSource: null, // '10x' or 'h5ad'
    tenxFiles: { barcodes: null, features: null, matrix: null },
    qcPlotData: null, // cached distributions for client-side threshold preview
    doubletResults: null,
    annotationResults: null,
    doubletsFiltered: false,
    umapData: null,
    annotationColumnsData: [],
    // Multi-batch state
    isBatchMode: false,
    projectId: null,
    samples: [],        // [{file_id, batch_label, filename, status, n_cells}]
    mergedFileId: null,
    integrationMethod: null,
    integrationStatus: null,
    integrationPollTimer: null,
    scanoramaAvailable: false,
    scviAvailable: false,
    // Batch QC mode: tracks which sample is being QC'd interactively
    batchQcSampleId: null,
    // Cancellation
    activeAbortController: null,
    activeTaskId: null,
};

// ==================== DOM Elements ====================
const elements = {
    // Header
    headerStatus: document.getElementById('headerStatus'),

    // Upload section
    uploadSection: document.getElementById('uploadSection'),
    tab10x: document.getElementById('tab10x'),
    tabH5: document.getElementById('tabH5'),
    tabH5ad: document.getElementById('tabH5ad'),
    panel10x: document.getElementById('panel10x'),
    panelH5: document.getElementById('panelH5'),
    panelH5ad: document.getElementById('panelH5ad'),
    uploadZoneH5: document.getElementById('uploadZoneH5'),
    fileInputH5: document.getElementById('fileInputH5'),
    uploadProgressH5: document.getElementById('uploadProgressH5'),
    progressFillH5: document.getElementById('progressFillH5'),
    progressTextH5: document.getElementById('progressTextH5'),
    uploadZone10x: document.getElementById('uploadZone10x'),
    fileInput10x: document.getElementById('fileInput10x'),
    uploadProgress10x: document.getElementById('uploadProgress10x'),
    progressFill10x: document.getElementById('progressFill10x'),
    progressText10x: document.getElementById('progressText10x'),
    uploadZone: document.getElementById('uploadZone'),
    fileInput: document.getElementById('fileInput'),
    uploadProgress: document.getElementById('uploadProgress'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),

    // QC Visualization section (NEW)
    qcVisualizationSection: document.getElementById('qcVisualizationSection'),
    qcVizFilenameBadge: document.getElementById('qcVizFilenameBadge'),
    qcVizCellCount: document.getElementById('qcVizCellCount'),
    qcVizGeneCount: document.getElementById('qcVizGeneCount'),
    qcVizMedianGenes: document.getElementById('qcVizMedianGenes'),
    qcVizMedianUmi: document.getElementById('qcVizMedianUmi'),
    qcVizMedianMt: document.getElementById('qcVizMedianMt'),
    violinNcounts: document.getElementById('violinNcounts'),
    violinNgenes: document.getElementById('violinNgenes'),
    violinPctMt: document.getElementById('violinPctMt'),
    violinPctRibo: document.getElementById('violinPctRibo'),
    scatterCountsGenes: document.getElementById('scatterCountsGenes'),
    scatterGenesMt: document.getElementById('scatterGenesMt'),
    threshMinGenes: document.getElementById('threshMinGenes'),
    threshMinGenesVal: document.getElementById('threshMinGenesVal'),
    threshMinCounts: document.getElementById('threshMinCounts'),
    threshMinCountsVal: document.getElementById('threshMinCountsVal'),
    threshMaxMt: document.getElementById('threshMaxMt'),
    threshMaxMtVal: document.getElementById('threshMaxMtVal'),
    threshMaxRibo: document.getElementById('threshMaxRibo'),
    threshMaxRiboVal: document.getElementById('threshMaxRiboVal'),
    cellsPassingCount: document.getElementById('cellsPassingCount'),
    cellsTotalCount: document.getElementById('cellsTotalCount'),
    applyFiltersBtn: document.getElementById('applyFiltersBtn'),

    // Filter Results section (NEW)
    filterResultsSection: document.getElementById('filterResultsSection'),
    filterCellsBefore: document.getElementById('filterCellsBefore'),
    filterCellsAfter: document.getElementById('filterCellsAfter'),
    filterCellsRemoved: document.getElementById('filterCellsRemoved'),
    filterGenesBefore: document.getElementById('filterGenesBefore'),
    filterGenesAfter: document.getElementById('filterGenesAfter'),
    filterGenesRemoved: document.getElementById('filterGenesRemoved'),
    continueToDoubletBtn: document.getElementById('continueToDoubletBtn'),

    // Preprocess section (NEW)
    preprocessSection: document.getElementById('preprocessSection'),
    runPreprocessBtn: document.getElementById('runPreprocessBtn'),
    preprocessResults: document.getElementById('preprocessResults'),
    prepCells: document.getElementById('prepCells'),
    prepGenes: document.getElementById('prepGenes'),
    prepHvg: document.getElementById('prepHvg'),
    prepNormStatus: document.getElementById('prepNormStatus'),
    prepStepsList: document.getElementById('prepStepsList'),
    continueToAnnotationBtn: document.getElementById('continueToAnnotationBtn'),

    // QC section (doublet detection)
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

    async upload10x(barcodes, features, matrix) {
        const formData = new FormData();
        formData.append('barcodes', barcodes);
        formData.append('features', features);
        formData.append('matrix', matrix);

        const response = await fetch(`${this.baseUrl}/api/upload-10x`, {
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

    async upload10xH5(file) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${this.baseUrl}/api/upload-10x-h5`, {
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

    async computeQcMetrics(fileId) {
        const response = await fetch(`${this.baseUrl}/api/qc-metrics/${fileId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'QC metrics computation failed');
        }

        return response.json();
    },

    async applyQcFilter(params) {
        const response = await fetch(`${this.baseUrl}/api/qc-filter`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'QC filtering failed');
        }

        return response.json();
    },

    async runPreprocess(fileId) {
        const response = await fetch(`${this.baseUrl}/api/preprocess`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_id: fileId })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Preprocessing failed');
        }

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

    async computeUmap(fileId, forceRecompute = false, nNeighbors = 15, resolution = 1.0) {
        const response = await fetch(`${this.baseUrl}/api/umap`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                file_id: fileId,
                force_recompute: forceRecompute,
                n_neighbors: nNeighbors,
                resolution: resolution
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

    async recluster(fileId, resolution) {
        const response = await fetch(`${this.baseUrl}/api/recluster`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_id: fileId, resolution })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Re-clustering failed');
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
    },

    // Multi-batch API methods
    async createProject() {
        const response = await fetch(`${this.baseUrl}/api/project/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        if (!response.ok) { const e = await response.json(); throw new Error(e.error || 'Failed to create project'); }
        return response.json();
    },

    async getProject(projectId) {
        const response = await fetch(`${this.baseUrl}/api/project/${projectId}`);
        if (!response.ok) { const e = await response.json(); throw new Error(e.error || 'Failed to get project'); }
        return response.json();
    },

    async addSampleToProject(projectId, fileId, batchLabel) {
        const response = await fetch(`${this.baseUrl}/api/project/${projectId}/add-sample`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_id: fileId, batch_label: batchLabel })
        });
        if (!response.ok) { const e = await response.json(); throw new Error(e.error || 'Failed to add sample'); }
        return response.json();
    },

    async removeSampleFromProject(projectId, fileId) {
        const response = await fetch(`${this.baseUrl}/api/project/${projectId}/remove-sample`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_id: fileId })
        });
        if (!response.ok) { const e = await response.json(); throw new Error(e.error || 'Failed to remove sample'); }
        return response.json();
    },

    async mergeProjectSamples(projectId) {
        const response = await fetch(`${this.baseUrl}/api/project/${projectId}/merge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        if (!response.ok) { const e = await response.json(); throw new Error(e.error || 'Merge failed'); }
        return response.json();
    },

    async runIntegration(projectId, method, nLatent, maxEpochs) {
        const response = await fetch(`${this.baseUrl}/api/project/${projectId}/integrate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ method, n_latent: nLatent, max_epochs: maxEpochs })
        });
        if (!response.ok) { const e = await response.json(); throw new Error(e.error || 'Integration failed'); }
        return response.json();
    },

    async getIntegrationStatus(projectId) {
        const response = await fetch(`${this.baseUrl}/api/project/${projectId}/status`);
        if (!response.ok) { const e = await response.json(); throw new Error(e.error || 'Failed to get status'); }
        return response.json();
    },

    async cancelIntegration(projectId) {
        const response = await fetch(`${this.baseUrl}/api/project/${projectId}/cancel-integration`, {
            method: 'POST',
        });
        if (!response.ok) { const e = await response.json(); throw new Error(e.error || 'Failed to cancel'); }
        return response.json();
    },

    async cancelTask(taskId) {
        const response = await fetch(`${this.baseUrl}/api/cancel-task/${taskId}`, {
            method: 'POST',
        });
        return response.json();
    },
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

function showLoading(title, message, { cancellable = false } = {}) {
    elements.loadingTitle.textContent = title;
    elements.loadingMessage.textContent = message;
    elements.loadingOverlay.hidden = false;
    const cancelBtn = document.getElementById('loadingCancelBtn');
    cancelBtn.hidden = !cancellable;
}

function hideLoading() {
    elements.loadingOverlay.hidden = true;
    document.getElementById('loadingCancelBtn').hidden = true;
    // Clean up abort controller
    state.activeAbortController = null;
    state.activeTaskId = null;
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

// ==================== Upload Tab Switching ====================
function handleTabSwitch(tab) {
    // Deactivate all tabs and hide all panels
    elements.tab10x.classList.remove('active');
    elements.tabH5.classList.remove('active');
    elements.tabH5ad.classList.remove('active');
    elements.panel10x.hidden = true;
    elements.panelH5.hidden = true;
    elements.panelH5ad.hidden = true;

    // Activate the selected tab and show its panel
    if (tab === '10x') {
        elements.tab10x.classList.add('active');
        elements.panel10x.hidden = false;
    } else if (tab === 'h5') {
        elements.tabH5.classList.add('active');
        elements.panelH5.hidden = false;
    } else {
        elements.tabH5ad.classList.add('active');
        elements.panelH5ad.hidden = false;
    }
}

// ==================== 10x File Handling ====================
function handle10xFileSelect(e) {
    const files = Array.from(e.target.files);
    console.log('Directory selected, total files:', files.length, files.map(f => f.name));
    classify10xFiles(files);
    e.target.value = '';
}

function handle10xDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.uploadZone10x.classList.remove('drag-over');

    // Support dropped directories via dataTransfer items
    const items = e.dataTransfer.items;
    if (items) {
        const filePromises = [];
        for (const item of items) {
            const entry = item.webkitGetAsEntry && item.webkitGetAsEntry();
            if (entry && entry.isDirectory) {
                filePromises.push(readDirectoryEntries(entry));
            } else if (item.kind === 'file') {
                filePromises.push(Promise.resolve([item.getAsFile()]));
            }
        }
        Promise.all(filePromises).then(results => {
            classify10xFiles(results.flat());
        });
    } else {
        classify10xFiles(Array.from(e.dataTransfer.files));
    }
}

function readDirectoryEntries(dirEntry) {
    return new Promise((resolve) => {
        const reader = dirEntry.createReader();
        reader.readEntries((entries) => {
            const files = [];
            let pending = entries.length;
            if (pending === 0) resolve(files);
            entries.forEach(entry => {
                if (entry.isFile) {
                    entry.file(f => {
                        files.push(f);
                        if (--pending === 0) resolve(files);
                    });
                } else {
                    if (--pending === 0) resolve(files);
                }
            });
        });
    });
}

function classify10xFiles(files) {
    state.tenxFiles = { barcodes: null, features: null, matrix: null };

    files.forEach(f => {
        const name = f.name.toLowerCase();
        if (name.includes('barcodes')) {
            state.tenxFiles.barcodes = f;
        } else if (name.includes('features') || name.includes('genes')) {
            state.tenxFiles.features = f;
        } else if (name.includes('matrix')) {
            state.tenxFiles.matrix = f;
        }
    });

    const { barcodes, features, matrix } = state.tenxFiles;

    if (barcodes && features && matrix) {
        handleUpload10x();
    } else {
        const missing = [];
        if (!barcodes) missing.push('barcodes.tsv.gz');
        if (!features) missing.push('features.tsv.gz (or genes.tsv.gz)');
        if (!matrix) missing.push('matrix.mtx.gz');
        showError(`Invalid Cell Ranger directory. Missing required files: ${missing.join(', ')}`);
    }
}

async function handleUpload10x() {
    if (!state.tenxFiles.barcodes || !state.tenxFiles.features || !state.tenxFiles.matrix) {
        showError('Please select all 3 Cell Ranger files');
        return;
    }

    elements.uploadProgress10x.hidden = false;
    elements.progressFill10x.style.width = '20%';
    elements.progressText10x.textContent = 'Uploading files...';

    try {
        elements.progressFill10x.style.width = '40%';
        const result = await api.upload10x(
            state.tenxFiles.barcodes,
            state.tenxFiles.features,
            state.tenxFiles.matrix
        );

        state.fileId = result.file_id;
        state.filename = result.filename;
        state.uploadSource = '10x';

        // In batch mode, add to project and return
        if (state.isBatchMode) {
            elements.progressFill10x.style.width = '100%';
            elements.progressText10x.textContent = 'Added to batch project!';
            await addSampleToProject(result.file_id, result.filename);
            setTimeout(() => {
                elements.uploadProgress10x.hidden = true;
                document.getElementById('batchManagerSection').scrollIntoView({ behavior: 'smooth' });
            }, 500);
            return;
        }

        elements.progressFill10x.style.width = '70%';
        elements.progressText10x.textContent = 'Computing QC metrics...';

        // Automatically compute QC metrics
        const qcResult = await api.computeQcMetrics(state.fileId);
        state.qcPlotData = qcResult.plot_data;

        elements.progressFill10x.style.width = '100%';
        elements.progressText10x.textContent = 'Complete!';

        // Get metadata for downstream use
        const metadata = await api.getMetadata(state.fileId);
        state.metadata = metadata;

        setTimeout(() => {
            showQcVisualization(qcResult);
        }, 500);

    } catch (error) {
        showError(error.message);
        elements.uploadProgress10x.hidden = true;
    }
}

// ==================== H5 Upload Handling ====================
async function handleUploadH5(file) {
    if (!file) return;

    elements.uploadProgressH5.hidden = false;
    elements.progressFillH5.style.width = '20%';
    elements.progressTextH5.textContent = 'Uploading H5 file...';

    try {
        elements.progressFillH5.style.width = '40%';
        const result = await api.upload10xH5(file);

        state.fileId = result.file_id;
        state.filename = result.filename;
        state.uploadSource = '10x';

        // In batch mode, add to project and return
        if (state.isBatchMode) {
            elements.progressFillH5.style.width = '100%';
            elements.progressTextH5.textContent = 'Added to batch project!';
            await addSampleToProject(result.file_id, result.filename);
            setTimeout(() => {
                elements.uploadProgressH5.hidden = true;
                document.getElementById('batchManagerSection').scrollIntoView({ behavior: 'smooth' });
            }, 500);
            return;
        }

        elements.progressFillH5.style.width = '70%';
        elements.progressTextH5.textContent = 'Computing QC metrics...';

        // Automatically compute QC metrics (same as 10x mtx path)
        const qcResult = await api.computeQcMetrics(state.fileId);
        state.qcPlotData = qcResult.plot_data;

        elements.progressFillH5.style.width = '100%';
        elements.progressTextH5.textContent = 'Complete!';

        // Get metadata for downstream use
        const metadata = await api.getMetadata(state.fileId);
        state.metadata = metadata;

        setTimeout(() => {
            showQcVisualization(qcResult);
        }, 500);

    } catch (error) {
        showError(error.message);
        elements.uploadProgressH5.hidden = true;
    }
}

// ==================== QC Visualization ====================
function showQcVisualization(qcResult) {
    const plotData = qcResult.plot_data;
    const summary = plotData.summary;

    // Update summary banner
    elements.qcVizCellCount.textContent = formatNumber(summary.n_cells);
    elements.qcVizGeneCount.textContent = formatNumber(plotData.distributions.n_genes.length > 0 ? summary.n_genes.median : 0);
    elements.qcVizMedianGenes.textContent = formatNumber(Math.round(summary.n_genes.median));
    elements.qcVizMedianUmi.textContent = formatNumber(Math.round(summary.n_counts.median));
    elements.qcVizMedianMt.textContent = summary.pct_mt.median.toFixed(1) + '%';

    // Set slider ranges based on data
    const maxGenes = Math.min(Math.round(summary.n_genes.max * 1.1), 50000);
    const maxCounts = Math.min(Math.round(summary.n_counts.max * 1.1), 500000);
    elements.threshMinGenes.max = maxGenes;
    elements.threshMinCounts.max = maxCounts;

    // Update total cells count
    elements.cellsTotalCount.textContent = summary.n_cells;

    // Show section
    elements.qcVisualizationSection.hidden = false;
    elements.uploadProgress10x.hidden = true;

    // Render plots
    renderQcPlots(plotData);

    // Compute initial cells passing
    handleThresholdChange();

    elements.qcVisualizationSection.scrollIntoView({ behavior: 'smooth' });
    updateHeaderStatus('ok', 'Review QC metrics');
}

function renderQcPlots(plotData) {
    const dist = plotData.distributions;
    const plotConfig = { responsive: true, displayModeBar: false };
    const darkLayout = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(30,41,59,0.6)',
        font: { color: '#e2e8f0', family: 'Inter, sans-serif', size: 11 },
        margin: { l: 50, r: 20, t: 30, b: 30 },
    };

    // Violin/box plots
    const makeViolin = (containerId, data, title, color) => {
        Plotly.newPlot(containerId, [{
            y: data,
            type: 'violin',
            box: { visible: true },
            meanline: { visible: true },
            fillcolor: color,
            opacity: 0.6,
            line: { color: color },
            marker: { size: 2 },
            points: data.length <= 5000 ? 'all' : false,
            jitter: 0.3,
            pointpos: -1.5
        }], {
            ...darkLayout,
            title: { text: title, font: { size: 13, color: '#cbd5e1' } },
            yaxis: { color: '#94a3b8', gridcolor: 'rgba(255,255,255,0.05)' },
            xaxis: { showticklabels: false },
        }, plotConfig);
    };

    makeViolin('violinNcounts', dist.n_counts, 'UMI Counts', '#6366f1');
    makeViolin('violinNgenes', dist.n_genes, 'Genes Detected', '#22d3ee');
    makeViolin('violinPctMt', dist.pct_mt, '% Mitochondrial', '#ef4444');
    makeViolin('violinPctRibo', dist.pct_ribo, '% Ribosomal', '#f59e0b');

    // Scatter plots
    const scatter = plotData.scatter;

    Plotly.newPlot('scatterCountsGenes', [{
        x: scatter.x_counts,
        y: scatter.y_genes,
        mode: 'markers',
        type: 'scattergl',
        marker: {
            size: 2,
            color: scatter.color_pct_mt,
            colorscale: [[0, '#22d3ee'], [0.5, '#f59e0b'], [1, '#ef4444']],
            colorbar: { title: { text: '%MT', font: { color: '#e2e8f0', size: 10 } }, tickfont: { color: '#94a3b8' }, thickness: 12, len: 0.6 },
            opacity: 0.5,
        },
        hovertemplate: 'UMI: %{x}<br>Genes: %{y}<br>%MT: %{marker.color:.1f}<extra></extra>'
    }], {
        ...darkLayout,
        title: { text: 'UMI Counts vs Genes (colored by %MT)', font: { size: 13, color: '#cbd5e1' } },
        xaxis: { title: 'UMI Counts', color: '#94a3b8', gridcolor: 'rgba(255,255,255,0.05)' },
        yaxis: { title: 'Genes', color: '#94a3b8', gridcolor: 'rgba(255,255,255,0.05)' },
    }, plotConfig);

    Plotly.newPlot('scatterGenesMt', [{
        x: scatter.x_genes,
        y: scatter.y_pct_mt,
        mode: 'markers',
        type: 'scattergl',
        marker: { size: 2, color: '#ef4444', opacity: 0.4 },
        hovertemplate: 'Genes: %{x}<br>%MT: %{y:.1f}<extra></extra>'
    }], {
        ...darkLayout,
        title: { text: 'Genes vs %Mitochondrial', font: { size: 13, color: '#cbd5e1' } },
        xaxis: { title: 'Genes Detected', color: '#94a3b8', gridcolor: 'rgba(255,255,255,0.05)' },
        yaxis: { title: '% Mitochondrial', color: '#94a3b8', gridcolor: 'rgba(255,255,255,0.05)' },
    }, plotConfig);
}

// ==================== Threshold Controls ====================
function handleThresholdChange() {
    if (!state.qcPlotData) return;
    const dist = state.qcPlotData.distributions;

    const minGenes = parseFloat(elements.threshMinGenes.value);
    const minCounts = parseFloat(elements.threshMinCounts.value);
    const maxMt = parseFloat(elements.threshMaxMt.value);
    const maxRibo = parseFloat(elements.threshMaxRibo.value);

    // Count passing cells client-side
    let passing = 0;
    const n = dist.n_genes.length;
    for (let i = 0; i < n; i++) {
        if (dist.n_genes[i] >= minGenes &&
            dist.n_counts[i] >= minCounts &&
            dist.pct_mt[i] <= maxMt &&
            dist.pct_ribo[i] <= maxRibo) {
            passing++;
        }
    }

    elements.cellsPassingCount.textContent = formatNumber(passing);
    elements.cellsTotalCount.textContent = formatNumber(n);
}

function syncSliderToInput(sliderId, inputId) {
    const slider = document.getElementById(sliderId);
    const input = document.getElementById(inputId);
    if (!slider || !input) return;

    slider.addEventListener('input', () => {
        input.value = slider.value;
        handleThresholdChange();
    });
    input.addEventListener('input', () => {
        slider.value = input.value;
        handleThresholdChange();
    });
}

// ==================== Apply QC Filters ====================
async function handleApplyFilters() {
    showLoading('Applying Filters', 'Filtering cells and genes based on your thresholds...');

    try {
        const result = await api.applyQcFilter({
            file_id: state.fileId,
            min_genes: parseInt(elements.threshMinGenesVal.value),
            min_counts: parseInt(elements.threshMinCountsVal.value),
            max_pct_mt: parseFloat(elements.threshMaxMtVal.value),
            max_pct_ribo: parseFloat(elements.threshMaxRiboVal.value),
        });

        hideLoading();
        showFilterResults(result.summary);

        // Update metadata
        const metadata = await api.getMetadata(state.fileId);
        state.metadata = metadata;

    } catch (error) {
        hideLoading();
        showError(error.message);
    }
}

function showFilterResults(summary) {
    elements.filterCellsBefore.textContent = formatNumber(summary.n_cells_before);
    elements.filterCellsAfter.textContent = formatNumber(summary.n_cells_after);
    elements.filterCellsRemoved.textContent = `(-${formatNumber(summary.n_cells_removed)})`;
    elements.filterGenesBefore.textContent = formatNumber(summary.n_genes_before);
    elements.filterGenesAfter.textContent = formatNumber(summary.n_genes_after);
    elements.filterGenesRemoved.textContent = `(-${formatNumber(summary.n_genes_removed)})`;

    // In batch QC mode, change the continue button
    if (state.batchQcSampleId) {
        const continueBtn = document.getElementById('continueToDoubletBtn');
        continueBtn.textContent = 'Preprocess & Return to Batch Manager';
    }

    elements.filterResultsSection.hidden = false;
    elements.filterResultsSection.scrollIntoView({ behavior: 'smooth' });
}

async function handleContinueToDoublet() {
    if (state.batchQcSampleId) {
        await handleBatchQcContinue();
        return;
    }
    showQcSection(state.metadata);
}

async function handleBatchQcContinue() {
    const fileId = state.batchQcSampleId;
    const sample = state.samples.find(s => s.file_id === fileId);
    if (!sample) return;

    showLoading('Preprocessing', `Preprocessing ${sample.filename}...`);

    try {
        await api.runPreprocess(fileId);

        // Update metadata to get cell count after filtering + preprocessing
        const metadata = await api.getMetadata(fileId);
        sample.status = 'preprocessed';
        sample.n_cells = metadata.shape.n_cells;

        hideLoading();

        // Clean up batch QC mode
        finishBatchQc();
    } catch (err) {
        hideLoading();
        sample.status = 'error';
        finishBatchQc();
        showError(`Preprocessing failed for ${sample.filename}: ${err.message}`);
    }
}

function finishBatchQc() {
    state.batchQcSampleId = null;
    // Restore fileId to merged file (or null if not merged yet)
    state.fileId = state.mergedFileId || null;

    // Hide QC sections
    elements.qcVisualizationSection.hidden = true;
    elements.filterResultsSection.hidden = true;

    // Hide batch QC banner
    const banner = document.getElementById('batchQcBanner');
    if (banner) banner.hidden = true;

    // Restore button text
    const continueBtn = document.getElementById('continueToDoubletBtn');
    continueBtn.innerHTML = 'Continue to Doublet Detection <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/></svg>';

    // Re-render batch table and scroll to it
    renderBatchSampleTable();
    updateBatchMergeButton();
    document.getElementById('batchManagerSection').scrollIntoView({ behavior: 'smooth' });
}

// ==================== Preprocessing ====================
async function handleRunPreprocess() {
    showLoading('Preprocessing', 'Normalizing, log-transforming, and selecting HVGs...');

    try {
        const result = await api.runPreprocess(state.fileId);
        hideLoading();

        elements.prepCells.textContent = formatNumber(result.n_cells);
        elements.prepGenes.textContent = formatNumber(result.n_genes);
        elements.prepHvg.textContent = result.n_hvg ? formatNumber(result.n_hvg) : '-';
        elements.prepNormStatus.textContent = 'Normalized';
        elements.prepStepsList.textContent = 'Steps: ' + result.steps.join(' \u2192 ');
        elements.preprocessResults.hidden = false;
        elements.preprocessResults.scrollIntoView({ behavior: 'smooth' });

        // Update metadata
        const metadata = await api.getMetadata(state.fileId);
        state.metadata = metadata;

    } catch (error) {
        hideLoading();
        showError(error.message);
    }
}

function handleContinueToAnnotation() {
    showAnnotationSection();
}

function showPreprocessSection() {
    elements.preprocessSection.hidden = false;
    elements.preprocessResults.hidden = true;
    elements.preprocessSection.scrollIntoView({ behavior: 'smooth' });
    updateHeaderStatus('ok', 'Ready for preprocessing');
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
        state.uploadSource = 'h5ad';

        // In batch mode, add to project and return
        if (state.isBatchMode) {
            elements.progressFill.style.width = '100%';
            elements.progressText.textContent = 'Added to batch project!';
            await addSampleToProject(result.file_id, result.filename);
            setTimeout(() => {
                elements.uploadProgress.hidden = true;
                document.getElementById('batchManagerSection').scrollIntoView({ behavior: 'smooth' });
            }, 500);
            return;
        }

        elements.progressFill.style.width = '60%';
        elements.progressText.textContent = 'Extracting metadata...';

        // Get metadata
        const metadata = await api.getMetadata(state.fileId);
        state.metadata = metadata;

        elements.progressFill.style.width = '100%';
        elements.progressText.textContent = 'Complete!';

        // h5ad path: skip upstream QC steps, go straight to doublet detection
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

        // Route based on upload source
        advanceAfterDoublets();
    } catch (error) {
        hideLoading();
        showError(error.message);
    }
}

function handleSkipQc() {
    advanceAfterDoublets();
}

function handleKeepDoublets() {
    advanceAfterDoublets();
}

function advanceAfterDoublets() {
    // If Cell Ranger path, go to preprocessing; otherwise skip to annotation
    if (state.uploadSource === '10x') {
        showPreprocessSection();
    } else {
        showAnnotationSection();
    }
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

    showLoading('Running CellTypist', `Annotating cell types with ${modelName.replace('.pkl', '')}...\nThis may take a few minutes (downloading model if first use).`, { cancellable: true });

    const abortController = new AbortController();
    state.activeAbortController = abortController;

    try {
        const response = await fetch(`${api.baseUrl}/api/annotate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                file_id: state.fileId,
                model: modelName,
                majority_voting: majorityVoting
            }),
            signal: abortController.signal,
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Annotation failed');
        }

        const result = await response.json();
        state.annotationResults = result.results;
        state.metadata = result.metadata;

        hideLoading();
        displayAnnotationResults(result.results);
        // Reload annotation columns (new celltypist columns now available for training)
        loadAnnotationColumns();
    } catch (error) {
        hideLoading();
        if (error.name === 'AbortError') {
            showError('Annotation cancelled.');
        } else {
            showError(error.message);
        }
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

    showLoading('Training Model', `Training custom CellTypist model "${modelName}"...\nThis may take several minutes.`, { cancellable: true });

    const abortController = new AbortController();
    state.activeAbortController = abortController;

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

        const response = await fetch(`${api.baseUrl}/api/train-model`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
            signal: abortController.signal,
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Training failed');
        }

        const result = await response.json();
        hideLoading();
        displayTrainingResults(result.results);

        // Add custom model to the CellTypist model dropdown
        addCustomModelToDropdown(result.results.model_name);
    } catch (error) {
        hideLoading();
        if (error.name === 'AbortError') {
            showError('Model training cancelled.');
        } else {
            showError(error.message);
        }
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
    const nNeighbors = parseInt(document.getElementById('umapNNeighbors').value) || 15;
    const resolution = parseFloat(document.getElementById('umapResolution').value) || 1.0;

    showLoading('Computing UMAP', 'Running dimensionality reduction and clustering...\nThis may take a minute for large datasets.', { cancellable: true });

    const abortController = new AbortController();
    state.activeAbortController = abortController;

    try {
        const response = await fetch(`${api.baseUrl}/api/umap`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                file_id: state.fileId,
                force_recompute: true,
                n_neighbors: nNeighbors,
                resolution: resolution
            }),
            signal: abortController.signal,
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'UMAP computation failed');
        }

        const result = await response.json();
        state.umapData = result.results;

        hideLoading();
        displayUmapResults(state.umapData);

        // Sync recluster resolution input
        document.getElementById('reclusterResolution').value = resolution;
    } catch (error) {
        hideLoading();
        if (error.name === 'AbortError') {
            showError('UMAP computation cancelled.');
        } else {
            showError(error.message);
        }
    }
}

async function handleRecluster() {
    const resolution = parseFloat(document.getElementById('reclusterResolution').value) || 1.0;
    const reclusterBtn = document.getElementById('reclusterBtn');
    const reclusterInfo = document.getElementById('reclusterInfo');

    reclusterBtn.disabled = true;
    reclusterInfo.textContent = 'Re-clustering...';

    try {
        const result = await api.recluster(state.fileId, resolution);
        state.umapData = result.results;
        displayUmapResults(state.umapData);

        reclusterInfo.textContent = `${result.results.n_clusters} clusters at resolution ${resolution}`;
        // Sync the initial resolution input
        document.getElementById('umapResolution').value = resolution;
    } catch (error) {
        showError(error.message);
        reclusterInfo.textContent = '';
    } finally {
        reclusterBtn.disabled = false;
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

function searchGenesLocal(query) {
    // Client-side gene search using gene names from UMAP data
    if (!state.umapData || !state.umapData.gene_names) return [];
    const queryUpper = query.toUpperCase();
    const genes = state.umapData.gene_names;
    const prefix = genes.filter(g => g.toUpperCase().startsWith(queryUpper));
    const substring = genes.filter(g => g.toUpperCase().includes(queryUpper) && !prefix.includes(g));
    return prefix.concat(substring).slice(0, 20);
}

function handleGeneInputChange() {
    const query = elements.umapGeneInput.value.trim();

    if (geneSearchTimeout) clearTimeout(geneSearchTimeout);

    if (query.length < 1) {
        elements.geneAutocomplete.hidden = true;
        return;
    }

    // Debounce: wait 200ms after typing stops
    geneSearchTimeout = setTimeout(async () => {
        // Use client-side search if gene names are available (faster, works for merged files)
        const localMatches = searchGenesLocal(query);
        if (localMatches.length > 0) {
            showGeneAutocomplete(localMatches);
            return;
        }
        // Fall back to server-side search
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
    state.uploadSource = null;
    state.tenxFiles = { barcodes: null, features: null, matrix: null };
    state.qcPlotData = null;
    state.doubletResults = null;
    state.annotationResults = null;
    state.doubletsFiltered = false;
    state.umapData = null;

    // Reset batch state
    if (state.integrationPollTimer) {
        clearInterval(state.integrationPollTimer);
        state.integrationPollTimer = null;
    }
    state.isBatchMode = false;
    state.projectId = null;
    state.samples = [];
    state.mergedFileId = null;
    state.batchQcSampleId = null;
    state.integrationMethod = null;
    state.integrationStatus = null;

    // Reset batch UI
    document.getElementById('modeSingle').classList.add('active');
    document.getElementById('modeBatch').classList.remove('active');
    document.getElementById('batchManagerSection').hidden = true;
    document.getElementById('mergeResultsCard').hidden = true;
    document.getElementById('integrationPanel').hidden = true;
    document.getElementById('integrationProgress').hidden = true;
    document.getElementById('integrationResults').hidden = true;

    // Reset UI - hide all sections except upload
    elements.uploadProgress.hidden = true;
    elements.progressFill.style.width = '0%';
    elements.uploadProgress10x.hidden = true;
    elements.progressFill10x.style.width = '0%';
    elements.uploadProgressH5.hidden = true;
    elements.progressFillH5.style.width = '0%';
    elements.qcVisualizationSection.hidden = true;
    elements.filterResultsSection.hidden = true;
    elements.preprocessSection.hidden = true;
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

// ==================== Multi-Batch Functions ====================

function handleModeSwitch(mode) {
    state.isBatchMode = (mode === 'batch');
    document.getElementById('modeSingle').classList.toggle('active', mode === 'single');
    document.getElementById('modeBatch').classList.toggle('active', mode === 'batch');

    const batchSection = document.getElementById('batchManagerSection');
    if (state.isBatchMode) {
        batchSection.hidden = false;
        // Create project if needed
        if (!state.projectId) {
            createBatchProject();
        }
    } else {
        batchSection.hidden = true;
    }
}

async function createBatchProject() {
    try {
        const result = await api.createProject();
        state.projectId = result.project_id;
    } catch (err) {
        showError('Failed to create project: ' + err.message);
    }
}

async function addSampleToProject(fileId, filename) {
    if (!state.projectId) return;

    // Auto-generate batch label from filename
    const batchLabel = filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');

    // Check for label uniqueness
    let label = batchLabel;
    let counter = 1;
    while (state.samples.some(s => s.batch_label === label)) {
        label = `${batchLabel}_${counter++}`;
    }

    try {
        await api.addSampleToProject(state.projectId, fileId, label);
        state.samples.push({
            file_id: fileId,
            batch_label: label,
            filename: filename,
            status: 'uploaded',
            n_cells: null,
        });
        renderBatchSampleTable();
        updateBatchMergeButton();
    } catch (err) {
        showError('Failed to add sample: ' + err.message);
    }
}

async function removeSample(fileId) {
    if (!state.projectId) return;
    try {
        await api.removeSampleFromProject(state.projectId, fileId);
        state.samples = state.samples.filter(s => s.file_id !== fileId);
        renderBatchSampleTable();
        updateBatchMergeButton();
    } catch (err) {
        showError('Failed to remove sample: ' + err.message);
    }
}

async function runSampleQcAndPreprocess(fileId) {
    const sample = state.samples.find(s => s.file_id === fileId);
    if (!sample) return;

    // Enter batch QC mode: show interactive QC for this sample
    state.batchQcSampleId = fileId;
    // Temporarily set fileId so the QC UI operates on this sample
    const prevFileId = state.fileId;
    state.fileId = fileId;

    const row = document.querySelector(`[data-sample-file-id="${fileId}"]`);
    const statusCell = row ? row.querySelector('.batch-status-badge') : null;
    if (statusCell) { statusCell.textContent = 'Computing QC...'; statusCell.className = 'batch-status-badge badge badge-warning'; }

    try {
        // Compute QC metrics
        const qcResult = await api.computeQcMetrics(fileId);
        state.qcPlotData = qcResult.plot_data;

        // Get metadata for this sample
        const metadata = await api.getMetadata(fileId);
        state.metadata = metadata;

        // Hide filter results from any previous QC run
        elements.filterResultsSection.hidden = true;

        // Show the QC visualization section
        showQcVisualization(qcResult);

        // Add a banner showing which sample is being QC'd
        let batchQcBanner = document.getElementById('batchQcBanner');
        if (!batchQcBanner) {
            batchQcBanner = document.createElement('div');
            batchQcBanner.id = 'batchQcBanner';
            batchQcBanner.className = 'batch-qc-banner';
            elements.qcVisualizationSection.querySelector('.step-header').after(batchQcBanner);
        }
        batchQcBanner.innerHTML = `<strong>Batch QC:</strong> ${sample.filename} (${sample.batch_label})`;
        batchQcBanner.hidden = false;

    } catch (err) {
        state.batchQcSampleId = null;
        state.fileId = prevFileId;
        sample.status = 'error';
        renderBatchSampleTable();
        showError(`QC failed for ${sample.filename}: ${err.message}`);
    }
}

function renderBatchSampleTable() {
    const tbody = document.getElementById('batchSampleTableBody');
    if (state.samples.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-500);">Upload samples to get started</td></tr>';
        return;
    }

    tbody.innerHTML = state.samples.map(s => {
        const statusClass = s.status === 'preprocessed' ? 'badge-success' :
                           s.status === 'error' ? 'badge-error' : 'badge-info';
        const statusText = s.status === 'preprocessed' ? 'Ready' :
                          s.status === 'error' ? 'Error' :
                          s.status === 'uploaded' ? 'Needs QC' : s.status;
        const cellCount = s.n_cells ? s.n_cells.toLocaleString() : '-';
        const canRunQc = s.status === 'uploaded';

        return `<tr data-sample-file-id="${s.file_id}">
            <td class="compound-cell">${s.filename}</td>
            <td>
                <input type="text" class="text-input batch-label-input" value="${s.batch_label}"
                    data-file-id="${s.file_id}" style="width:140px;"
                    onchange="handleBatchLabelChange(this)" ${s.status === 'preprocessed' ? 'disabled' : ''}>
            </td>
            <td><span class="batch-status-badge badge ${statusClass}">${statusText}</span></td>
            <td>${cellCount}</td>
            <td>
                ${canRunQc ? `<button class="btn btn-secondary" style="padding:var(--space-2) var(--space-3); font-size:0.8125rem;"
                    onclick="runSampleQcAndPreprocess('${s.file_id}')">Run QC & Preprocess</button>` : ''}
                <button class="btn btn-icon" onclick="removeSample('${s.file_id}')" title="Remove sample"
                    style="color:var(--error-500);">&times;</button>
            </td>
        </tr>`;
    }).join('');
}

function handleBatchLabelChange(input) {
    const fileId = input.dataset.fileId;
    const sample = state.samples.find(s => s.file_id === fileId);
    if (sample) {
        sample.batch_label = input.value.trim() || sample.batch_label;
    }
}

function updateBatchMergeButton() {
    const mergeBtn = document.getElementById('batchMergeBtn');
    const allPreprocessed = state.samples.length >= 2 && state.samples.every(s => s.status === 'preprocessed');
    mergeBtn.disabled = !allPreprocessed;
}

async function handleMergeSamples() {
    if (!state.projectId) return;

    const mergeBtn = document.getElementById('batchMergeBtn');
    mergeBtn.disabled = true;
    mergeBtn.innerHTML = '<span class="loading-spinner" style="width:16px;height:16px;border-width:2px;margin:0;"></span> Merging...';

    try {
        const result = await api.mergeProjectSamples(state.projectId);
        state.mergedFileId = result.merged_file_id;

        // Show merge results
        const mergeCard = document.getElementById('mergeResultsCard');
        mergeCard.hidden = false;
        const statsGrid = document.getElementById('mergeStatsGrid');
        const summary = result.summary;
        statsGrid.innerHTML = `
            <div class="stat-item">
                <span class="stat-value">${summary.total_cells.toLocaleString()}</span>
                <span class="stat-label">Total Cells</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">${summary.n_samples}</span>
                <span class="stat-label">Samples</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">${summary.gene_intersection.toLocaleString()}</span>
                <span class="stat-label">Shared Genes</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">${summary.gene_union.toLocaleString()}</span>
                <span class="stat-label">Total Genes (Union)</span>
            </div>
        `;

        // Show integration panel
        const integrationPanel = document.getElementById('integrationPanel');
        integrationPanel.hidden = false;
        document.getElementById('runIntegrationBtn').disabled = false;
        document.getElementById('skipIntegrationBtn').hidden = false;

        mergeBtn.innerHTML = 'Merge Complete';

    } catch (err) {
        showError('Merge failed: ' + err.message);
        mergeBtn.disabled = false;
        mergeBtn.textContent = 'Merge Samples';
    }
}

function handleIntegrationMethodChange() {
    const method = document.querySelector('input[name="integrationMethod"]:checked').value;
    document.getElementById('scviParams').hidden = (method !== 'scvi');

    // Update card active states
    document.getElementById('methodScanorama').classList.toggle('active', method === 'scanorama');
    document.getElementById('methodScvi').classList.toggle('active', method === 'scvi');
}

async function handleRunIntegration() {
    if (!state.projectId) return;

    const method = document.querySelector('input[name="integrationMethod"]:checked').value;
    const nLatent = parseInt(document.getElementById('scviNLatent').value) || 30;
    const maxEpochs = parseInt(document.getElementById('scviMaxEpochs').value) || 400;

    const runBtn = document.getElementById('runIntegrationBtn');
    runBtn.disabled = true;

    const progressDiv = document.getElementById('integrationProgress');
    progressDiv.hidden = false;

    try {
        await api.runIntegration(state.projectId, method, nLatent, maxEpochs);
        state.integrationMethod = method;

        // Start polling
        state.integrationPollTimer = setInterval(async () => {
            try {
                const status = await api.getIntegrationStatus(state.projectId);

                document.getElementById('integrationProgressFill').style.width = status.progress + '%';
                document.getElementById('integrationProgressText').textContent = status.message;
                document.getElementById('integrationProgressPct').textContent = status.progress + '%';

                if (status.status === 'completed') {
                    clearInterval(state.integrationPollTimer);
                    state.integrationPollTimer = null;
                    state.integrationStatus = 'completed';

                    progressDiv.hidden = true;
                    const resultsDiv = document.getElementById('integrationResults');
                    resultsDiv.hidden = false;
                    document.getElementById('integrationResultText').textContent =
                        `${method === 'scvi' ? 'scVI' : 'Scanorama'} integration complete. Embedding stored in ${status.result.embedding_key} (dim=${status.result.embedding_dim}).`;

                    // Set merged file as active for downstream
                    state.fileId = state.mergedFileId;
                    proceedAfterIntegration();
                } else if (status.status === 'error') {
                    clearInterval(state.integrationPollTimer);
                    state.integrationPollTimer = null;
                    showError('Integration failed: ' + (status.error || 'Unknown error'));
                    runBtn.disabled = false;
                }
            } catch (pollErr) {
                // Polling error - keep trying
            }
        }, 2000);

    } catch (err) {
        showError('Failed to start integration: ' + err.message);
        runBtn.disabled = false;
        progressDiv.hidden = true;
    }
}

function handleSkipIntegration() {
    // Use merged file without integration
    state.fileId = state.mergedFileId;
    proceedAfterIntegration();
}

async function handleCancelIntegration() {
    if (!state.projectId) return;

    try {
        await api.cancelIntegration(state.projectId);
    } catch (e) {
        // Ignore cancel errors
    }

    // Stop polling
    if (state.integrationPollTimer) {
        clearInterval(state.integrationPollTimer);
        state.integrationPollTimer = null;
    }

    // Reset UI
    document.getElementById('integrationProgress').hidden = true;
    document.getElementById('runIntegrationBtn').disabled = false;
    state.integrationStatus = null;
    showError('Integration cancelled.');
}

function handleLoadingCancel() {
    // Abort the in-flight fetch request
    if (state.activeAbortController) {
        state.activeAbortController.abort();
    }
    // Also try to cancel the backend task
    if (state.activeTaskId) {
        api.cancelTask(state.activeTaskId).catch(() => {});
    }
}

function proceedAfterIntegration() {
    // In batch mode, after integration (or skip), jump to annotation
    // Use the proper function that also loads custom models and annotation columns
    showAnnotationSection();
}

function updateIntegrationAvailability(statusData) {
    state.scanoramaAvailable = statusData.scanorama && statusData.scanorama.available;
    state.scviAvailable = statusData.scvi && statusData.scvi.available;

    const scanoramaBadge = document.getElementById('scanoramaBadge');
    const scviBadge = document.getElementById('scviBadge');

    if (scanoramaBadge) {
        scanoramaBadge.textContent = state.scanoramaAvailable ? 'Available' : 'Not installed';
        scanoramaBadge.className = 'method-availability-badge ' + (state.scanoramaAvailable ? 'available' : 'unavailable');
    }
    if (scviBadge) {
        scviBadge.textContent = state.scviAvailable ? 'Available' : 'Not installed';
        scviBadge.className = 'method-availability-badge ' + (state.scviAvailable ? 'available' : 'unavailable');
    }

    // Disable unavailable methods
    const scviRadio = document.querySelector('input[name="integrationMethod"][value="scvi"]');
    if (scviRadio && !state.scviAvailable) {
        scviRadio.disabled = true;
        document.getElementById('methodScvi').classList.add('disabled');
    }
    const scanoramaRadio = document.querySelector('input[name="integrationMethod"][value="scanorama"]');
    if (scanoramaRadio && !state.scanoramaAvailable) {
        scanoramaRadio.disabled = true;
        document.getElementById('methodScanorama').classList.add('disabled');
        // If scanorama not available but scvi is, select scvi
        if (state.scviAvailable && scviRadio) {
            scviRadio.checked = true;
            handleIntegrationMethodChange();
        }
    }
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
        // Update batch integration availability
        updateIntegrationAvailability(status);
    } catch (error) {
        updateHeaderStatus('error', 'Cannot connect to server');
    }

    // Setup event listeners

    // Upload tabs
    elements.tab10x.addEventListener('click', () => handleTabSwitch('10x'));
    elements.tabH5.addEventListener('click', () => handleTabSwitch('h5'));
    elements.tabH5ad.addEventListener('click', () => handleTabSwitch('h5ad'));

    // 10x upload zone
    elements.uploadZone10x.addEventListener('click', (e) => {
        if (e.target.closest('.btn')) return; // Don't trigger file picker on button clicks
        elements.fileInput10x.click();
    });
    elements.uploadZone10x.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); elements.uploadZone10x.classList.add('drag-over'); });
    elements.uploadZone10x.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); elements.uploadZone10x.classList.remove('drag-over'); });
    elements.uploadZone10x.addEventListener('drop', handle10xDrop);
    elements.fileInput10x.addEventListener('change', handle10xFileSelect);

    // H5 upload zone
    elements.uploadZoneH5.addEventListener('click', () => elements.fileInputH5.click());
    elements.uploadZoneH5.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); elements.uploadZoneH5.classList.add('drag-over'); });
    elements.uploadZoneH5.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); elements.uploadZoneH5.classList.remove('drag-over'); });
    elements.uploadZoneH5.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        elements.uploadZoneH5.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].name.toLowerCase().endsWith('.h5')) {
            handleUploadH5(files[0]);
        } else {
            showError('Please drop a .h5 file');
        }
    });
    elements.fileInputH5.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleUploadH5(e.target.files[0]);
        }
    });

    // h5ad upload zone
    elements.uploadZone.addEventListener('click', () => elements.fileInput.click());
    elements.uploadZone.addEventListener('dragover', handleDragOver);
    elements.uploadZone.addEventListener('dragleave', handleDragLeave);
    elements.uploadZone.addEventListener('drop', handleDrop);
    elements.fileInput.addEventListener('change', handleFileSelect);

    // QC Visualization threshold controls
    syncSliderToInput('threshMinGenes', 'threshMinGenesVal');
    syncSliderToInput('threshMinCounts', 'threshMinCountsVal');
    syncSliderToInput('threshMaxMt', 'threshMaxMtVal');
    syncSliderToInput('threshMaxRibo', 'threshMaxRiboVal');
    elements.applyFiltersBtn.addEventListener('click', handleApplyFilters);

    // Filter Results
    elements.continueToDoubletBtn.addEventListener('click', handleContinueToDoublet);

    // Preprocessing
    elements.runPreprocessBtn.addEventListener('click', handleRunPreprocess);
    elements.continueToAnnotationBtn.addEventListener('click', handleContinueToAnnotation);

    // QC section (doublet detection)
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
    document.getElementById('reclusterBtn').addEventListener('click', handleRecluster);
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

    // Multi-batch mode toggle
    document.getElementById('modeSingle').addEventListener('click', () => handleModeSwitch('single'));
    document.getElementById('modeBatch').addEventListener('click', () => handleModeSwitch('batch'));

    // Batch manager buttons
    document.getElementById('batchAddSampleBtn').addEventListener('click', () => {
        // Scroll to upload section for adding another sample
        elements.uploadSection.scrollIntoView({ behavior: 'smooth' });
    });
    document.getElementById('batchMergeBtn').addEventListener('click', handleMergeSamples);
    document.getElementById('runIntegrationBtn').addEventListener('click', handleRunIntegration);
    document.getElementById('skipIntegrationBtn').addEventListener('click', handleSkipIntegration);
    document.getElementById('cancelIntegrationBtn').addEventListener('click', handleCancelIntegration);

    // Integration method change
    document.querySelectorAll('input[name="integrationMethod"]').forEach(radio => {
        radio.addEventListener('change', handleIntegrationMethodChange);
    });

    // Loading overlay cancel button
    document.getElementById('loadingCancelBtn').addEventListener('click', handleLoadingCancel);
}

// Clean up uploads when user leaves the page
window.addEventListener('beforeunload', () => {
    if (state.fileId) {
        navigator.sendBeacon('/api/cleanup-all', '');
    }
});

// Start application
document.addEventListener('DOMContentLoaded', init);
