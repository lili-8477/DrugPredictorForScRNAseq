/**
 * DrugReflector Automation MVP - Frontend Application
 * Handles file upload, metadata display, analysis, and results visualization
 */

// ==================== State Management ====================
const state = {
    fileId: null,
    filename: null,
    metadata: null,
    results: null,
    sortColumn: 'rank',
    sortDirection: 'asc'
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

    // Metadata section
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
                // Server returned HTML error page
                const text = await response.text();
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

        // Show metadata section
        setTimeout(() => {
            displayMetadata(metadata);
        }, 500);

    } catch (error) {
        showError(error.message);
        elements.uploadProgress.hidden = true;
        elements.progressFill.style.width = '0%';
    }
}

// ==================== Metadata Display ====================
function displayMetadata(metadata) {
    // Update file info
    elements.filenameBadge.textContent = metadata.filename;
    elements.cellCount.textContent = formatNumber(metadata.shape.n_cells);
    elements.geneCount.textContent = formatNumber(metadata.shape.n_genes);
    elements.normStatus.textContent = metadata.is_log_normalized ? 'Log-normalized' : 'Raw counts';

    // Populate group column dropdown
    const categoricalCols = Object.keys(metadata.categorical_columns);
    populateSelect(elements.groupCol, categoricalCols, 'Select column...');

    // Show metadata section, hide upload progress
    elements.uploadProgress.hidden = true;
    elements.metadataSection.hidden = false;

    updateHeaderStatus('ok', 'Data loaded successfully');
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

    // Reset UI
    elements.uploadProgress.hidden = true;
    elements.progressFill.style.width = '0%';
    elements.metadataSection.hidden = true;
    elements.resultsSection.hidden = true;
    elements.transitionIndicator.hidden = true;

    // Reset form
    elements.fileInput.value = '';
    elements.groupCol.innerHTML = '<option value="">Select column...</option>';
    elements.sourceGroup.innerHTML = '<option value="">Select group...</option>';
    elements.targetGroup.innerHTML = '<option value="">Select group...</option>';
    elements.sourceGroup.disabled = true;
    elements.targetGroup.disabled = true;
    elements.analyzeBtn.disabled = true;

    updateHeaderStatus('ok', 'Ready');
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

// Start application
document.addEventListener('DOMContentLoaded', init);
