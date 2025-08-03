// Get color scale based on indicator
function getColorScale(indicator) {
    if (indicator === 'cohd_ppp') {
        return d3.scaleThreshold()
            .domain([3, 3.5, 4.5, 5.5])
            .range(['#059669', '#10b981', '#f59e0b', '#ea580c', '#dc2626']);
    } else if (indicator === 'pua') {
        return d3.scaleThreshold()
            .domain([10, 30, 50, 70])
            .range(['#10b981', '#eab308', '#f59e0b', '#ea580c', '#dc2626']);
    } else {
        return d3.scaleThreshold()
            .domain([10, 50, 100, 200])
            .range(['#059669', '#10b981', '#f59e0b', '#ea580c', '#dc2626']);
    }
}// Global variables
let allData = [];
let charts = {};
let currentDataSource = 'countries';
let currentDataFile = 'https://data-snack.com/apps/prepared_data-final.csv'; // Updated to use the new CSV file
let latestYear = '2024';
let selectedYear = '2024';
let selectedIncomeLevel = 'all';
let performanceStartTime = performance.now();
let chartsLoaded = 0;
let totalCharts = 4;
let isDarkMode = false;
let continentData = [];
let worldMap = null;
let mapData = null;

const indicators = {
    'pua': { name: 'Prevalence of Unaffordability', unit: '%', color: '#dc2626' },
    'cohd_ppp': { name: 'Cost of Healthy Diet (PPP)', unit: 'Int$ PPP/day', color: '#3b82f6' },
    'nua': { name: 'People Unable to Afford', unit: 'Million', color: '#f59e0b' }
};

// Income level mappings (simplified classification)
const incomeMapping = {
    'high': ['Norway', 'Switzerland', 'Luxembourg', 'United States of America', 'Germany', 'Denmark', 'Sweden', 'Netherlands', 'Austria', 'Finland', 'Canada', 'Australia', 'United Kingdom of Great Britain and Northern Ireland', 'France', 'Belgium', 'Japan', 'New Zealand', 'Italy', 'Spain', 'Israel', 'Republic of Korea', 'Slovenia', 'Czechia'],
    'upper-middle': ['China', 'Russian Federation', 'Brazil', 'Mexico', 'Argentina', 'Malaysia', 'Thailand', 'Turkey', 'South Africa', 'Chile', 'Poland', 'Croatia', 'Romania', 'Bulgaria', 'Lithuania', 'Latvia', 'Estonia', 'Hungary', 'Slovakia', 'Portugal', 'Greece'],
    'lower-middle': ['India', 'Indonesia', 'Nigeria', 'Bangladesh', 'Pakistan', 'Philippines', 'Viet Nam', 'Egypt', 'Morocco', 'Ukraine', 'Guatemala', 'Honduras', 'Nicaragua', 'Bolivia', 'Paraguay', 'Ecuador', 'Peru', 'Colombia', 'El Salvador'],
    'low': ['Ethiopia', 'Chad', 'Mali', 'Burkina Faso', 'Niger', 'Central African Republic', 'Madagascar', 'Sierra Leone', 'Afghanistan', 'Yemen', 'Haiti', 'Mozambique', 'Malawi', 'Rwanda', 'Uganda', 'Tanzania', 'Kenya', 'Zambia', 'Zimbabwe']
};

// Regional classifications based on the new data
const regionalAreas = [
    'World', 'Africa', 'Eastern Africa', 'Middle Africa', 'Northern Africa', 
    'Northern Africa (excluding Sudan)', 'Southern Africa', 'Western Africa', 'Sub-Saharan Africa',
    'Northern America', 'Central America', 'Latin America', 'Latin America and the Caribbean', 
    'South America', 'Northern America and Europe', 'Asia', 'Central Asia', 'Eastern Asia', 
    'Southern Asia', 'Southern Asia (excluding India)', 'South-eastern Asia', 'Western Asia',
    'Europe', 'Eastern Europe', 'Northern Europe', 'Southern Europe', 'Western Europe', 'Oceania',
    'Low-income economies', 'Lower-middle-income economies', 'High-income economies', 'Upper-middle-income economies'
];

// Continent mappings for aggregation
const continentMapping = {
    'Africa': ['Eastern Africa', 'Middle Africa', 'Northern Africa', 'Southern Africa', 'Western Africa'],
    'Asia': ['Central Asia', 'Eastern Asia', 'South-eastern Asia', 'Southern Asia', 'Western Asia'],
    'Europe': ['Eastern Europe', 'Northern Europe', 'Southern Europe', 'Western Europe'],
    'North America': ['Northern America', 'Central America'],
    'South America': ['South America'],
    'Oceania': ['Oceania']
};

// Theme toggle function
function toggleTheme() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode');
    document.getElementById('theme-toggle').textContent = isDarkMode ? '☀️' : '🌙';
    
    // Update Chart.js default colors for dark mode
    if (isDarkMode) {
        Chart.defaults.color = '#e5e7eb';
        Chart.defaults.borderColor = '#4b5563';
    } else {
        Chart.defaults.color = '#666';
        Chart.defaults.borderColor = '#e5e7eb';
    }
    
    // Recreate all charts with new theme
    updateOverview();
    updateAnalysis();
}

// Update performance metrics
function updatePerformanceMetrics() {
    const loadTime = performance.now() - performanceStartTime;
    document.getElementById('load-time').textContent = `${loadTime.toFixed(0)}ms`;
    document.getElementById('charts-loaded').textContent = `${chartsLoaded}/${totalCharts}`;
}

// Chart lazy loading with placeholder
function createChartWithLazyLoading(chartId, createFunction) {
    const placeholder = document.getElementById(`${chartId}-placeholder`);
    const canvas = document.getElementById(chartId);
    
    if (placeholder) placeholder.style.display = 'flex';
    if (canvas) canvas.style.display = 'none';
    
    setTimeout(() => {
        createFunction();
        if (placeholder) placeholder.style.display = 'none';
        if (canvas) canvas.style.display = 'block';
        chartsLoaded++;
        updatePerformanceMetrics();
    }, 100);
}

// Filter data by income level
function filterByIncomeLevel(data) {
    if (selectedIncomeLevel === 'all' || currentDataSource === 'regions') {
        return data;
    }
    
    const countriesInLevel = incomeMapping[selectedIncomeLevel] || [];
    return data.filter(d => countriesInLevel.includes(d.area));
}

// Update ranking tables with selected year and income filter
function updateRankingTables() {
    let latestData = allData.filter(d => d.year === selectedYear && (currentDataSource === 'countries' ? !regionalAreas.includes(d.area) : regionalAreas.includes(d.area) && d.area !== 'World'));
    latestData = filterByIncomeLevel(latestData);
    
    // Cost ranking
    const costRanking = latestData.filter(d => d.cohd_ppp)
        .sort((a, b) => b.cohd_ppp - a.cohd_ppp);
    
    const costTableBody = document.getElementById('cost-ranking-table');
    costTableBody.innerHTML = '';
    costRanking.forEach((item, index) => {
        const row = document.createElement('tr');
        const costColorClass = item.cohd_ppp > 5 ? 'text-red' : item.cohd_ppp > 3.5 ? 'text-orange' : 'text-green';
        const puaColorClass = (item.pua || 0) > 30 ? 'text-red' : (item.pua || 0) > 10 ? 'text-orange' : 'text-green';
        
        row.innerHTML = `
            <td>${index + 1}</td>
            <td style="font-weight: 500;">${item.area}</td>
            <td class="text-right"><span class="${costColorClass}" style="font-weight: 500;">${item.cohd_ppp.toFixed(2)}</span></td>
            <td class="text-right"><span class="${puaColorClass}" style="font-weight: 500;">${item.pua?.toFixed(1) || 'N/A'}%</span></td>
            <td class="text-right">${item.nua?.toFixed(1) || 'N/A'}M</td>
        `;
        costTableBody.appendChild(row);
    });

    // Affordability ranking
    const affordabilityRanking = latestData.filter(d => d.pua)
        .sort((a, b) => b.pua - a.pua);
    
    const affordabilityTableBody = document.getElementById('affordability-ranking-table');
    affordabilityTableBody.innerHTML = '';
    affordabilityRanking.forEach((item, index) => {
        const row = document.createElement('tr');
        const puaColorClass = item.pua > 30 ? 'text-red' : item.pua > 10 ? 'text-orange' : 'text-green';
        const costColorClass = (item.cohd_ppp || 0) > 5 ? 'text-red' : (item.cohd_ppp || 0) > 3.5 ? 'text-orange' : 'text-green';
        
        row.innerHTML = `
            <td>${index + 1}</td>
            <td style="font-weight: 500;">${item.area}</td>
            <td class="text-right"><span class="${puaColorClass}" style="font-weight: 500;">${item.pua.toFixed(1)}%</span></td>
            <td class="text-right"><span class="${costColorClass}" style="font-weight: 500;">${item.cohd_ppp?.toFixed(2) || 'N/A'}</span></td>
            <td class="text-right">${item.nua?.toFixed(1) || 'N/A'}M</td>
        `;
        affordabilityTableBody.appendChild(row);
    });
}

// Initialize the application
async function init() {
    try {
        console.log('Starting initialization...');
        await loadData();
        setupEventListeners();
        updateInterface();
        updateOverview();
        updateAnalysis();
        
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        
        updatePerformanceMetrics();
        
        // Initialize map data first, then show map view by default
        updateMapView();
        showView('map');
        
    } catch (error) {
        console.error('Error initializing app:', error);
        document.getElementById('loading').textContent = `Error loading data: ${error.message}. Please refresh the page.`;
    }
}

// Load and process the new CSV data format
async function loadData() {
    try {
        const response = await fetch(currentDataFile);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const csvText = await response.text();
        const parsed = Papa.parse(csvText, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true
        });

        const processedData = {};
        
        // Process the new CSV format
        parsed.data.forEach(row => {
            if (!row.Area || !row.Year || row.Value === null || row.Value === undefined || row.Value_Missing === 'True') return;
            
            const area = row.Area.trim();
            const year = row.Year.toString();
            const value = parseFloat(row.Value);
            const itemDescription = row['Item Description'] || '';
            
            if (isNaN(value)) return;
            
            const key = `${area}-${year}`;
            
            if (!processedData[key]) {
                processedData[key] = {
                    area: area,
                    year: year
                };
            }
            
            // Map the new item descriptions to our indicators
            if (itemDescription === 'Cost of a healthy diet (CoHD), PPP dollar per person per day') {
                processedData[key].cohd_ppp = value;
            } else if (itemDescription === 'Prevalence of unaffordability (PUA), percent') {
                processedData[key].pua = value;
            } else if (itemDescription === 'Number of people unable to afford a healthy diet (NUA), million') {
                processedData[key].nua = value;
            }
        });
        
        allData = Object.values(processedData).filter(item => 
            item.cohd_ppp !== undefined || item.pua !== undefined || item.nua !== undefined
        );

        const years = [...new Set(allData.map(d => d.year))].sort();
        latestYear = years[years.length - 1];
        selectedYear = latestYear;
        
        // Aggregate continent data if in regional mode
        if (currentDataSource === 'regions') {
            aggregateContinentData();
        }
        
        populateAreasDropdown();

    } catch (error) {
        throw error;
    }
}

// Aggregate data by continent
function aggregateContinentData() {
    continentData = [];
    const years = [...new Set(allData.map(d => d.year))];
    
    years.forEach(year => {
        Object.entries(continentMapping).forEach(([continent, regions]) => {
            const regionData = allData.filter(d => 
                d.year === year && regions.includes(d.area)
            );
            
            if (regionData.length > 0) {
                // Calculate weighted averages and sums
                let totalCost = 0;
                let totalCostWeight = 0;
                let totalPua = 0;
                let totalPuaWeight = 0;
                let totalNua = 0;
                
                regionData.forEach(d => {
                    if (d.cohd_ppp && d.nua) {
                        totalCost += d.cohd_ppp * d.nua;
                        totalCostWeight += d.nua;
                    }
                    if (d.pua && d.nua) {
                        totalPua += d.pua * d.nua;
                        totalPuaWeight += d.nua;
                    }
                    if (d.nua) {
                        totalNua += d.nua;
                    }
                });
                
                continentData.push({
                    area: continent,
                    year: year,
                    cohd_ppp: totalCostWeight > 0 ? totalCost / totalCostWeight : null,
                    pua: totalPuaWeight > 0 ? totalPua / totalPuaWeight : null,
                    nua: totalNua
                });
            }
        });
    });
}

// Populate areas dropdown
function populateAreasDropdown() {
    let areas;
    
    if (currentDataSource === 'regions') {
        // Filter to only include regional areas
        areas = [...new Set(allData.map(d => d.area))].filter(area => regionalAreas.includes(area)).sort();
    } else {
        // Filter to exclude regional areas for country view
        areas = [...new Set(allData.map(d => d.area))].filter(area => !regionalAreas.includes(area)).sort();
    }
    
    const areasSelect = document.getElementById('areas-select');
    areasSelect.innerHTML = '';
    
    // Add optgroups for better organization in regional mode
    if (currentDataSource === 'regions') {
        // Add continents group
        const continentGroup = document.createElement('optgroup');
        continentGroup.label = 'Main Regions';
        const mainRegions = ['World', 'Africa', 'Asia', 'Europe', 'Northern America', 'South America', 'Oceania'];
        mainRegions.forEach(region => {
            if (areas.includes(region)) {
                const option = document.createElement('option');
                option.value = region;
                option.textContent = region;
                if (region === 'World') option.selected = true;
                continentGroup.appendChild(option);
            }
        });
        areasSelect.appendChild(continentGroup);
        
        // Add sub-regions group
        const subRegionGroup = document.createElement('optgroup');
        subRegionGroup.label = 'Sub-regions';
        areas.filter(area => !mainRegions.includes(area)).forEach(area => {
            const option = document.createElement('option');
            option.value = area;
            option.textContent = area;
            subRegionGroup.appendChild(option);
        });
        areasSelect.appendChild(subRegionGroup);
    } else {
        areas.forEach(area => {
            const option = document.createElement('option');
            option.value = area;
            option.textContent = area;
            
            if (['Germany', 'United States of America', 'China', 'India', 'Brazil'].includes(area)) {
                option.selected = true;
            }
            areasSelect.appendChild(option);
        });
    }
}

// Switch data source
async function switchDataSource(source) {
    if (source === currentDataSource) return;
    
    currentDataSource = source;
    // We now use the same file for both sources but filter differently
    currentDataFile = 'https://data-snack.com/apps/prepared_data-final.csv';
    
    document.getElementById('regions-source-btn').className = source === 'regions' ? 'source-btn active' : 'source-btn inactive';
    document.getElementById('countries-source-btn').className = source === 'countries' ? 'source-btn active' : 'source-btn inactive';
    
    // Disable/enable map button based on data source (map only works with countries)
    const mapBtn = document.getElementById('map-source-btn');
    if (source === 'regions') {
        mapBtn.style.opacity = '0.5';
        mapBtn.style.pointerEvents = 'none';
        mapBtn.title = 'Map view only available for country data';
        // If currently in map view, switch to overview
        if (document.getElementById('map-view').classList.contains('hidden') === false) {
            showView('overview');
        }
    } else {
        mapBtn.style.opacity = '1';
        mapBtn.style.pointerEvents = 'auto';
        mapBtn.title = '';
    }
    
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    
    // Reset chart counter
    chartsLoaded = 0;
    performanceStartTime = performance.now();
    
    try {
        // Just repopulate the dropdown and update interface, data is already loaded
        populateAreasDropdown();
        updateInterface();
        updateOverview();
        updateAnalysis();
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
    } catch (error) {
        console.error('Error switching data source:', error);
        document.getElementById('loading').textContent = 'Error loading data. Please refresh the page.';
    }
}

// Update interface text based on current data source
function updateInterface() {
    const isRegional = currentDataSource === 'regions';
    const entityName = isRegional ? 'Region' : 'Country';
    const entityNamePlural = isRegional ? 'Regions' : 'Countries';
    
    const updateText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };
    
    updateText('areas-select-label', `Select ${entityNamePlural}`);
    updateText('area-search-label', `Search ${entityNamePlural}`);
    
    const searchGroup = document.getElementById('search-group');
    if (searchGroup) searchGroup.style.display = isRegional ? 'none' : 'flex';
    
    // Show/hide income filter for countries only
    const incomeFilter = document.getElementById('income-filter');
    if (incomeFilter) {
        incomeFilter.style.display = isRegional ? 'none' : 'flex';
    }
    
    // Show/hide continent selector for regions only
    const continentGroup = document.getElementById('continent-group');
    if (continentGroup) {
        continentGroup.style.display = isRegional ? 'flex' : 'none';
    }
    
    if (isRegional) {
        updateText('stat-1-title', 'Global Cost (PPP)');
        updateText('stat-2-title', 'Global Unaffordability');
        updateText('stat-3-title', 'People Affected');
        updateText('stat-4-title', 'Regional Average');
    } else {
        updateText('stat-1-title', 'Countries Analyzed');
        updateText('stat-2-title', 'Highest Cost Country');
        updateText('stat-3-title', 'Worst Affordability');
        updateText('stat-4-title', 'Best Affordability');
    }
    
    updateText('chart-1-title', `Top 15 Most Expensive ${entityNamePlural} (Int$ PPP/day)`);
    updateText('chart-2-title', `Top 15 Least Affordable ${entityNamePlural} (%)`);
    updateText('chart-3-title', `Top 15 Most Affordable ${entityNamePlural} (Lowest Unaffordability %)`);
    updateText('chart-4-title', `Cost vs Affordability by ${entityName}`);
    
    updateText('table-1-title', `Complete ${entityName} Ranking - Cost (Int$ PPP/day)`);
    updateText('table-2-title', `Complete ${entityName} Ranking - Unaffordability (%)`);
    updateText('table-1-header', entityName);
    updateText('table-2-header', entityName);
    
    updateText('analysis-chart-title', `${entityName} Comparison: Cost of Healthy Diet (PPP)`);
    updateText('analysis-table-area-header', entityName);
    
    updateText('coverage-text', isRegional ? 'Global and regional estimates' : 'Country-level data');
}

// Set up event listeners
function setupEventListeners() {
    document.getElementById('map-source-btn').addEventListener('click', () => {
        // Switch to countries mode if not already, then show map
        if (currentDataSource !== 'countries') {
            switchDataSource('countries');
        }
        showView('map');
    });
    document.getElementById('regions-source-btn').addEventListener('click', () => {
        switchDataSource('regions');
        showView('overview'); // Always show overview when switching to regions
    });
    document.getElementById('countries-source-btn').addEventListener('click', () => {
        switchDataSource('countries');
        showView('overview'); // Always show overview when switching to countries
    });
    
    document.getElementById('overview-btn').addEventListener('click', () => showView('overview'));
    document.getElementById('analysis-btn').addEventListener('click', () => showView('analysis'));
    
    document.getElementById('areas-select').addEventListener('change', updateAnalysis);
    document.getElementById('continent-select').addEventListener('change', updateAnalysisWithContinents);
    document.getElementById('area-search').addEventListener('input', filterAreas);
    document.getElementById('indicator-select').addEventListener('change', updateAnalysis);
    document.getElementById('year-select').addEventListener('change', updateAnalysis);
    document.getElementById('time-series-checkbox').addEventListener('change', updateAnalysis);
    
    // Map view controls
    document.getElementById('map-indicator-select').addEventListener('change', updateMapView);
    document.getElementById('map-year-select').addEventListener('change', updateMapView);
    
    // Year toggle buttons
    document.querySelectorAll('.year-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            selectedYear = e.target.dataset.year;
            updateOverview();
        });
    });
    
    // Income filter buttons
    document.querySelectorAll('.income-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.income-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            selectedIncomeLevel = e.target.dataset.income;
            updateOverview();
        });
    });
}

// Filter areas based on search input
function filterAreas() {
    const searchTerm = document.getElementById('area-search').value.toLowerCase();
    const areasSelect = document.getElementById('areas-select');
    const options = areasSelect.options;
    
    for (let i = 0; i < options.length; i++) {
        const option = options[i];
        const areaName = option.textContent.toLowerCase();
        option.style.display = areaName.includes(searchTerm) ? '' : 'none';
    }
}

// Show different views
function showView(view) {
    document.getElementById('overview-view').classList.toggle('hidden', view !== 'overview');
    document.getElementById('analysis-view').classList.toggle('hidden', view !== 'analysis');
    document.getElementById('map-view').classList.toggle('hidden', view !== 'map');
    
    // Handle top level buttons (source selector)
    document.getElementById('map-source-btn').className = view === 'map' ? 'source-btn active' : 'source-btn inactive';
    document.getElementById('regions-source-btn').className = (view !== 'map' && currentDataSource === 'regions') ? 'source-btn active' : 'source-btn inactive';
    document.getElementById('countries-source-btn').className = (view !== 'map' && currentDataSource === 'countries') ? 'source-btn active' : 'source-btn inactive';
    
    // Handle navigation buttons
    document.getElementById('overview-btn').className = view === 'overview' ? 'btn btn-primary' : 'btn btn-secondary';
    document.getElementById('analysis-btn').className = view === 'analysis' ? 'btn btn-primary' : 'btn btn-secondary';
    
    // Update map view when shown
    if (view === 'map') {
        updateMapView();
        // Handle window resize for map
        window.addEventListener('resize', handleMapResize);
    } else {
        window.removeEventListener('resize', handleMapResize);
    }
}

// Handle map resize
function handleMapResize() {
    if (worldMap && mapData) {
        const width = document.getElementById('world-map').offsetWidth;
        const height = 600;
        
        d3.select('#map-svg')
            .attr('width', width)
            .attr('height', height);
        
        // Update projection
        mapData.projection
            .scale(width / 6.5)
            .translate([width / 2, height / 2]);
        
        // Redraw map
        updateD3Map(document.getElementById('map-indicator-select').value,
                   document.getElementById('map-year-select').value);
    }
}

// Update overview section
function updateOverview() {
    chartsLoaded = 0;
    if (currentDataSource === 'regions') {
        updateRegionalOverview();
    } else {
        updateCountryOverview();
    }
    createOverviewChartsWithLazyLoading();
    updateRankingTables();
}

// Create overview charts with lazy loading
function createOverviewChartsWithLazyLoading() {
    createChartWithLazyLoading('cost-chart', createCostChart);
    createChartWithLazyLoading('affordability-chart', createAffordabilityChart);
    createChartWithLazyLoading('best-affordability-chart', createBestAffordabilityChart);
    createChartWithLazyLoading('cost-vs-affordability-chart', createCostVsAffordabilityChart);
}

// Individual chart creation functions
function createCostChart() {
    let latestData = allData.filter(d => d.year === selectedYear && (currentDataSource === 'countries' ? !regionalAreas.includes(d.area) : regionalAreas.includes(d.area) && d.area !== 'World'));
    latestData = filterByIncomeLevel(latestData);
    
    const topCostData = latestData.filter(d => d.cohd_ppp)
        .sort((a, b) => b.cohd_ppp - a.cohd_ppp)
        .slice(0, 15);
    
    if (charts.costChart) charts.costChart.destroy();
    charts.costChart = new Chart(document.getElementById('cost-chart'), {
        type: 'bar',
        data: {
            labels: topCostData.map(d => d.area),
            datasets: [{
                label: 'Cost (PPP)',
                data: topCostData.map(d => d.cohd_ppp),
                backgroundColor: topCostData.map(d => {
                    if (d.cohd_ppp > 5) return '#dc2626';
                    if (d.cohd_ppp > 4) return '#f59e0b';
                    if (d.cohd_ppp > 3.5) return '#eab308';
                    return '#10b981';
                })
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            scales: {
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        font: { size: 10 }
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Cost (Int$ PPP/day)'
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Cost: ${context.parsed.y.toFixed(2)} PPP/day`;
                        }
                    }
                }
            }
        }
    });
}

function createAffordabilityChart() {
    let latestData = allData.filter(d => d.year === selectedYear && (currentDataSource === 'countries' ? !regionalAreas.includes(d.area) : regionalAreas.includes(d.area) && d.area !== 'World'));
    latestData = filterByIncomeLevel(latestData);
    
    const topUnaffordableData = latestData.filter(d => d.pua)
        .sort((a, b) => b.pua - a.pua)
        .slice(0, 15);
    
    if (charts.affordabilityChart) charts.affordabilityChart.destroy();
    charts.affordabilityChart = new Chart(document.getElementById('affordability-chart'), {
        type: 'bar',
        data: {
            labels: topUnaffordableData.map(d => d.area),
            datasets: [{
                label: 'Unaffordability (%)',
                data: topUnaffordableData.map(d => d.pua),
                backgroundColor: topUnaffordableData.map(d => {
                    if (d.pua > 50) return '#dc2626';
                    if (d.pua > 30) return '#f59e0b';
                    if (d.pua > 10) return '#eab308';
                    return '#10b981';
                })
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            scales: {
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        font: { size: 10 }
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Unaffordability (%)'
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Unaffordable: ${context.parsed.y.toFixed(1)}%`;
                        }
                    }
                }
            }
        }
    });
}

function createBestAffordabilityChart() {
    let latestData = allData.filter(d => d.year === selectedYear && (currentDataSource === 'countries' ? !regionalAreas.includes(d.area) : regionalAreas.includes(d.area) && d.area !== 'World'));
    latestData = filterByIncomeLevel(latestData);
    
    const bestAffordableData = latestData.filter(d => d.pua && d.pua > 0)
        .sort((a, b) => a.pua - b.pua)
        .slice(0, 15);
    
    if (charts.bestAffordabilityChart) charts.bestAffordabilityChart.destroy();
    charts.bestAffordabilityChart = new Chart(document.getElementById('best-affordability-chart'), {
        type: 'bar',
        data: {
            labels: bestAffordableData.map(d => d.area),
            datasets: [{
                label: 'Unaffordability (%)',
                data: bestAffordableData.map(d => d.pua),
                backgroundColor: bestAffordableData.map(d => {
                    if (d.pua > 30) return '#f59e0b';
                    if (d.pua > 10) return '#eab308';
                    return '#10b981';
                })
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            scales: {
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        font: { size: 10 }
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Unaffordability (%)'
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Only ${context.parsed.y.toFixed(1)}% cannot afford`;
                        }
                    }
                }
            }
        }
    });
}

function createCostVsAffordabilityChart() {
    let latestData = allData.filter(d => d.year === selectedYear && (currentDataSource === 'countries' ? !regionalAreas.includes(d.area) : regionalAreas.includes(d.area) && d.area !== 'World'));
    latestData = filterByIncomeLevel(latestData);
    
    const costAffordabilityData = latestData.filter(d => d.cohd_ppp && d.pua);
    
    if (charts.costVsAffordabilityChart) charts.costVsAffordabilityChart.destroy();
    charts.costVsAffordabilityChart = new Chart(document.getElementById('cost-vs-affordability-chart'), {
        type: 'scatter',
        data: {
            datasets: [{
                label: currentDataSource === 'regions' ? 'Regions' : 'Countries',
                data: costAffordabilityData.map(d => ({
                    x: d.cohd_ppp,
                    y: d.pua,
                    area: d.area
                })),
                backgroundColor: costAffordabilityData.map(d => {
                    if (d.pua > 30) return '#dc2626';
                    if (d.pua > 10) return '#eab308';
                    return '#10b981';
                }),
                borderColor: costAffordabilityData.map(d => {
                    if (d.pua > 30) return '#b91c1c';
                    if (d.pua > 10) return '#ca8a04';
                    return '#059669';
                }),
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'point'
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Cost of Healthy Diet (Int$ PPP/day)'
                    },
                    beginAtZero: true
                },
                y: {
                    title: {
                        display: true,
                        text: 'Unaffordability (%)'
                    },
                    beginAtZero: true
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const point = context.raw;
                            return [
                                `${currentDataSource === 'regions' ? 'Region' : 'Country'}: ${point.area}`,
                                `Cost: ${point.x.toFixed(2)} PPP/day`,
                                `Unaffordable: ${point.y.toFixed(1)}%`
                            ];
                        }
                    }
                }
            }
        }
    });
}

// Update regional overview stats
function updateRegionalOverview() {
    const worldData = allData.find(d => d.area === 'World' && d.year === selectedYear);
    const latestData = allData.filter(d => d.year === selectedYear && regionalAreas.includes(d.area) && d.area !== 'World');
    
    document.getElementById('stat-1-value').textContent = `${worldData?.cohd_ppp?.toFixed(2) || '0.00'}`;
    document.getElementById('stat-2-value').textContent = `${worldData?.pua?.toFixed(1) || '0'}%`;
    document.getElementById('stat-3-value').textContent = `${(worldData?.nua ? (worldData.nua/1000).toFixed(1) : '0.0')}B`;
    
    const avgCost = latestData.filter(d => d.cohd_ppp).reduce((sum, d) => sum + d.cohd_ppp, 0) / latestData.filter(d => d.cohd_ppp).length;
    document.getElementById('stat-4-value').textContent = `${avgCost?.toFixed(2) || '0.00'}`;
}

// Update country overview stats
function updateCountryOverview() {
    let latestData = allData.filter(d => d.year === selectedYear && !regionalAreas.includes(d.area));
    latestData = filterByIncomeLevel(latestData);
    
    const countriesWithData = latestData.filter(d => d.cohd_ppp || d.pua || d.nua).length;
    document.getElementById('stat-1-value').textContent = countriesWithData;
    
    const highestCostCountry = latestData.filter(d => d.cohd_ppp)
        .sort((a, b) => b.cohd_ppp - a.cohd_ppp)[0];
    document.getElementById('stat-2-value').textContent = 
        highestCostCountry ? highestCostCountry.area : 'N/A';
    
    const worstAffordabilityCountry = latestData.filter(d => d.pua)
        .sort((a, b) => b.pua - a.pua)[0];
    document.getElementById('stat-3-value').textContent = 
        worstAffordabilityCountry ? worstAffordabilityCountry.area : 'N/A';
    
    const bestAffordabilityCountry = latestData.filter(d => d.pua && d.pua > 0)
        .sort((a, b) => a.pua - b.pua)[0];
    document.getElementById('stat-4-value').textContent = 
        bestAffordabilityCountry ? bestAffordabilityCountry.area : 'N/A';
}

// Update analysis with continent selection
function updateAnalysisWithContinents() {
    const selectedContinents = Array.from(document.getElementById('continent-select').selectedOptions).map(opt => opt.value);
    
    if (selectedContinents.length > 0) {
        // Clear regular area selection
        document.getElementById('areas-select').selectedIndex = -1;
        
        // Update analysis with continent data
        const selectedIndicator = document.getElementById('indicator-select').value;
        const selectedAnalysisYear = document.getElementById('year-select').value;
        const isTimeSeries = document.getElementById('time-series-checkbox').checked;
        
        const chartTitle = isTimeSeries ? 
            `Time Series Development: ${indicators[selectedIndicator].name}` :
            `Continental Comparison: ${indicators[selectedIndicator].name}`;
        document.getElementById('analysis-chart-title').textContent = chartTitle;
        
        createAnalysisChart(selectedContinents, selectedIndicator, selectedAnalysisYear, isTimeSeries);
        updateAnalysisTable(selectedContinents, selectedAnalysisYear, isTimeSeries);
    }
}

// Update analysis section
function updateAnalysis() {
    const selectedAreas = Array.from(document.getElementById('areas-select').selectedOptions).map(opt => opt.value);
    const continentSelect = document.getElementById('continent-select');
    const selectedContinents = continentSelect ? 
        Array.from(continentSelect.selectedOptions).map(opt => opt.value) : [];
    
    // Combine areas and continents
    const allSelected = [...selectedAreas, ...selectedContinents];
    
    if (allSelected.length === 0) return;
    
    const selectedIndicator = document.getElementById('indicator-select').value;
    const selectedAnalysisYear = document.getElementById('year-select').value;
    const isTimeSeries = document.getElementById('time-series-checkbox').checked;
    
    const entityName = currentDataSource === 'regions' ? 'Regional' : 'Country';
    const chartTitle = isTimeSeries ? 
        `Time Series Development: ${indicators[selectedIndicator].name}` :
        `${entityName} Comparison: ${indicators[selectedIndicator].name}`;
    document.getElementById('analysis-chart-title').textContent = chartTitle;
    
    createAnalysisChart(allSelected, selectedIndicator, selectedAnalysisYear, isTimeSeries);
    updateAnalysisTable(allSelected, selectedAnalysisYear, isTimeSeries);
}

// Create analysis chart
function createAnalysisChart(areas, indicator, year, isTimeSeries) {
    if (charts.analysisChart) charts.analysisChart.destroy();
    
    // Use allData directly - no need for separate continent data since we have regions in the main data
    const dataToUse = allData;
    
    if (isTimeSeries) {
        const years = ['2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'];
        const datasets = areas.slice(0, 10).map((area, index) => {
            const data = years.map(y => {
                const item = dataToUse.find(d => d.area === area && d.year === y);
                return item ? item[indicator] : null;
            });
            
            const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1'];
            return {
                label: area,
                data: data,
                borderColor: colors[index % colors.length],
                backgroundColor: colors[index % colors.length],
                fill: false,
                tension: 0.1
            };
        });

        charts.analysisChart = new Chart(document.getElementById('analysis-chart'), {
            type: 'line',
            data: {
                labels: years,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: indicators[indicator].unit
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y?.toFixed(2)} ${indicators[indicator].unit}`;
                            }
                        }
                    }
                }
            }
        });
    } else {
        const data = areas.map(area => {
            const item = dataToUse.find(d => d.area === area && d.year === year);
            return {
                area: area,
                value: item ? item[indicator] : 0
            };
        }).filter(d => d.value > 0);

        charts.analysisChart = new Chart(document.getElementById('analysis-chart'), {
            type: 'bar',
            data: {
                labels: data.map(d => d.area),
                datasets: [{
                    label: indicators[indicator].name,
                    data: data.map(d => d.value),
                    backgroundColor: data.map(d => {
                        if (indicator === 'pua') {
                            // Use new PUA color scale
                            if (d.value > 50) return '#dc2626';
                            if (d.value > 30) return '#f59e0b';
                            if (d.value > 10) return '#eab308';
                            return '#10b981';
                        } else if (indicator === 'cohd_ppp') {
                            // Use cost color scale
                            if (d.value > 5) return '#dc2626';
                            if (d.value > 4) return '#f59e0b';
                            if (d.value > 3.5) return '#eab308';
                            return '#10b981';
                        } else {
                            // Default color for other indicators
                            return indicators[indicator].color;
                        }
                    })
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: indicators[indicator].unit
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.parsed.y?.toFixed(2)} ${indicators[indicator].unit}`;
                            }
                        }
                    }
                }
            }
        });
    }
}

// Update analysis table
function updateAnalysisTable(areas, year, isTimeSeries) {
    const tableBody = document.getElementById('analysis-table-body');
    const tableHeader = document.getElementById('analysis-table-header');
    const entityName = currentDataSource === 'regions' ? 'Region' : 'Country';
    
    // Use allData directly
    const dataToUse = allData;
    
    if (isTimeSeries) {
        tableHeader.innerHTML = `
            <tr>
                <th>${entityName}</th>
                <th>Year</th>
                <th class="text-right">Cost (PPP)</th>
                <th class="text-right">Unaffordability (%)</th>
                <th class="text-right">Affected (Million)</th>
            </tr>
        `;
    } else {
        tableHeader.innerHTML = `
            <tr>
                <th>${entityName}</th>
                <th class="text-right">Cost (PPP)</th>
                <th class="text-right">Unaffordability (%)</th>
                <th class="text-right">Affected (Million)</th>
            </tr>
        `;
    }
    
    tableBody.innerHTML = '';
    
    let filteredData;
    if (isTimeSeries) {
        filteredData = dataToUse.filter(d => areas.includes(d.area))
            .sort((a, b) => a.area.localeCompare(b.area) || parseInt(a.year) - parseInt(b.year))
            .slice(0, 100);
    } else {
        // Fix: Filter by selected year when NOT in time series mode
        filteredData = dataToUse.filter(d => areas.includes(d.area) && d.year === year)
            .slice(0, 50);
    }
    
    filteredData.forEach(item => {
        const row = document.createElement('tr');
        const puaColorClass = (item.pua || 0) > 30 ? 'text-red' : (item.pua || 0) > 10 ? 'text-orange' : 'text-green';
        
        if (isTimeSeries) {
            row.innerHTML = `
                <td style="font-weight: 500;">${item.area}</td>
                <td>${item.year}</td>
                <td class="text-right">${item.cohd_ppp?.toFixed(2) || 'N/A'}</td>
                <td class="text-right"><span class="${puaColorClass}" style="font-weight: 500;">${item.pua?.toFixed(1) || 'N/A'}%</span></td>
                <td class="text-right">${item.nua?.toFixed(1) || 'N/A'}M</td>
            `;
        } else {
            row.innerHTML = `
                <td style="font-weight: 500;">${item.area}</td>
                <td class="text-right">${item.cohd_ppp?.toFixed(2) || 'N/A'}</td>
                <td class="text-right"><span class="${puaColorClass}" style="font-weight: 500;">${item.pua?.toFixed(1) || 'N/A'}%</span></td>
                <td class="text-right">${item.nua?.toFixed(1) || 'N/A'}M</td>
            `;
        }
        tableBody.appendChild(row);
    });
}

// Update map view
function updateMapView() {
    const indicator = document.getElementById('map-indicator-select').value;
    const year = document.getElementById('map-year-select').value;
    
    // Update title
    document.getElementById('map-title').textContent = 
        `Global ${indicators[indicator].name} - ${year}`;
    
    // Update legend
    updateMapLegend(indicator);
    
    // Update table
    updateMapTable(indicator, year);
    
    // Initialize or update D3 map
    if (!worldMap) {
        initializeD3Map();
    } else {
        updateD3Map(indicator, year);
    }
}

// Initialize D3 world map
async function initializeD3Map() {
    const width = document.getElementById('world-map').offsetWidth;
    const height = 600;
    
    const svg = d3.select('#map-svg')
        .attr('width', width)
        .attr('height', height);
    
    // Create group for map elements
    const g = svg.append('g');
    
    // Create zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([1, 8])
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
        });
    
    svg.call(zoom);
    
    // Create projection
    const projection = d3.geoNaturalEarth1()
        .scale(width / 6.5)
        .translate([width / 2, height / 2]);
    
    const path = d3.geoPath().projection(projection);
    
    try {
        // Load world topology data
        const world = await d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
        
        // Convert TopoJSON to GeoJSON
        const countries = topojson.feature(world, world.objects.countries);
        
        // Store for later use
        mapData = { g, path, countries, projection };
        worldMap = true;
        
        // Draw initial map
        updateD3Map(document.getElementById('map-indicator-select').value, 
                   document.getElementById('map-year-select').value);
        
    } catch (error) {
        console.error('Error loading map data:', error);
        // Fallback to show error message
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height / 2)
            .attr('text-anchor', 'middle')
            .style('font-size', '16px')
            .text('Error loading map data. Please check your internet connection.');
    }
}

// Update D3 map with new data
function updateD3Map(indicator, year) {
    if (!mapData) return;
    
    const { g, path, countries } = mapData;
    
    // Create color scale
    const colorScale = getColorScale(indicator);
    
    // Create data lookup - only use country data for map
    const dataLookup = {};
    allData.filter(d => d.year === year && !regionalAreas.includes(d.area))
        .forEach(d => {
            // Match country names to map data
            const countryName = normalizeCountryName(d.area);
            dataLookup[countryName] = d[indicator];
        });
    
    // Tooltip
    const tooltip = d3.select('#map-tooltip');
    
    // Update country colors
    const countryPaths = g.selectAll('path')
        .data(countries.features)
        .join('path')
        .attr('d', path)
        .attr('fill', d => {
            const countryName = normalizeCountryName(d.properties.name);
            const value = dataLookup[countryName];
            return value !== undefined ? colorScale(value) : '#e5e7eb';
        })
        .attr('stroke', '#fff')
        .attr('stroke-width', 0.5)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
            const countryName = d.properties.name;
            const normalizedName = normalizeCountryName(countryName);
            const value = dataLookup[normalizedName];
            
            // Highlight country
            d3.select(this).attr('stroke', '#000').attr('stroke-width', 2);
            
            // Show tooltip
            let content = `<strong>${countryName}</strong><br>`;
            if (value !== undefined) {
                if (indicator === 'cohd_ppp') {
                    content += `Cost: ${value.toFixed(2)} PPP/day`;
                } else if (indicator === 'pua') {
                    content += `Unaffordability: ${value.toFixed(1)}%`;
                } else {
                    content += `Affected: ${value.toFixed(1)}M people`;
                }
            } else {
                content += 'No data available';
            }
            
            tooltip.html(content)
                .style('display', 'block')
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', function() {
            // Remove highlight
            d3.select(this).attr('stroke', '#fff').attr('stroke-width', 0.5);
            
            // Hide tooltip
            tooltip.style('display', 'none');
        })
        .on('click', function(event, d) {
            // Optional: Add click behavior (e.g., zoom to country)
            const countryName = d.properties.name;
            console.log('Clicked on:', countryName);
        });
    
    // Add zoom controls
    addZoomControls();
}

// Get color scale based on indicator
function getColorScale(indicator) {
    if (indicator === 'cohd_ppp') {
        return d3.scaleThreshold()
            .domain([3, 3.5, 4.5, 5.5])
            .range(['#059669', '#10b981', '#f59e0b', '#ea580c', '#dc2626']);
    } else if (indicator === 'pua') {
        return d3.scaleThreshold()
            .domain([10, 30, 50, 70])
            .range(['#059669', '#10b981', '#f59e0b', '#ea580c', '#dc2626']);
    } else {
        return d3.scaleThreshold()
            .domain([10, 50, 100, 200])
            .range(['#059669', '#10b981', '#f59e0b', '#ea580c', '#dc2626']);
    }
}

// Normalize country names for matching
function normalizeCountryName(name) {
    const nameMap = {
        'United States of America': 'United States',
        'USA': 'United States',
        'UK': 'United Kingdom',
        'United Kingdom of Great Britain and Northern Ireland': 'United Kingdom',
        'Russian Federation': 'Russia',
        'Czechia': 'Czech Republic',
        'Republic of Korea': 'South Korea',
        'Democratic Republic of the Congo': 'Dem. Rep. Congo',
        'Central African Republic': 'Central African Rep.',
        'South Sudan': 'S. Sudan',
        'Bosnia and Herzegovina': 'Bosnia and Herz.',
        'Dominican Republic': 'Dominican Rep.'
    };
    
    return nameMap[name] || name;
}

// Add zoom controls to map
function addZoomControls() {
    const svg = d3.select('#map-svg');
    const width = svg.node().getBoundingClientRect().width;
    
    // Remove existing controls
    svg.selectAll('.zoom-controls').remove();
    
    const controls = svg.append('g')
        .attr('class', 'zoom-controls')
        .attr('transform', `translate(${width - 60}, 20)`);
    
    // Zoom in button
    controls.append('rect')
        .attr('width', 40)
        .attr('height', 40)
        .attr('fill', 'white')
        .attr('stroke', '#ddd')
        .attr('rx', 5)
        .style('cursor', 'pointer')
        .on('click', () => {
            svg.transition().call(
                d3.zoom().scaleBy, 1.3
            );
        });
    
    controls.append('text')
        .attr('x', 20)
        .attr('y', 25)
        .attr('text-anchor', 'middle')
        .style('font-size', '20px')
        .style('user-select', 'none')
        .text('+');
    
    // Zoom out button
    controls.append('rect')
        .attr('y', 45)
        .attr('width', 40)
        .attr('height', 40)
        .attr('fill', 'white')
        .attr('stroke', '#ddd')
        .attr('rx', 5)
        .style('cursor', 'pointer')
        .on('click', () => {
            svg.transition().call(
                d3.zoom().scaleBy, 0.7
            );
        });
    
    controls.append('text')
        .attr('x', 20)
        .attr('y', 70)
        .attr('text-anchor', 'middle')
        .style('font-size', '20px')
        .style('user-select', 'none')
        .text('−');
    
    // Reset button
    controls.append('rect')
        .attr('y', 90)
        .attr('width', 40)
        .attr('height', 40)
        .attr('fill', 'white')
        .attr('stroke', '#ddd')
        .attr('rx', 5)
        .style('cursor', 'pointer')
        .on('click', () => {
            svg.transition().call(
                d3.zoom().transform,
                d3.zoomIdentity
            );
        });
    
    controls.append('text')
        .attr('x', 20)
        .attr('y', 115)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('user-select', 'none')
        .text('⟲');
}

// Update map legend
function updateMapLegend(indicator) {
    const legendContent = document.getElementById('map-legend-content');
    legendContent.innerHTML = '';
    
    let ranges;
    if (indicator === 'cohd_ppp') {
        ranges = [
            { color: '#059669', label: '< $3.00' },
            { color: '#10b981', label: '$3.00 - $3.50' },
            { color: '#f59e0b', label: '$3.50 - $4.50' },
            { color: '#ea580c', label: '$4.50 - $5.50' },
            { color: '#dc2626', label: '> $5.50' }
        ];
    } else if (indicator === 'pua') {
        ranges = [
            { color: '#10b981', label: '< 10%' },
            { color: '#eab308', label: '10% - 30%' },
            { color: '#f59e0b', label: '30% - 50%' },
            { color: '#ea580c', label: '50% - 70%' },
            { color: '#dc2626', label: '> 70%' }
        ];
    } else {
        ranges = [
            { color: '#059669', label: '< 10M' },
            { color: '#10b981', label: '10M - 50M' },
            { color: '#f59e0b', label: '50M - 100M' },
            { color: '#ea580c', label: '100M - 200M' },
            { color: '#dc2626', label: '> 200M' }
        ];
    }
    
    ranges.forEach(range => {
        const item = document.createElement('div');
        item.innerHTML = `
            <span style="display: inline-block; width: 20px; height: 12px; background: ${range.color}; margin-right: 0.5rem;"></span>
            ${range.label}
        `;
        legendContent.appendChild(item);
    });
}

// Update map table
function updateMapTable(indicator, year) {
    const tableBody = document.getElementById('map-table-body');
    tableBody.innerHTML = '';
    
    // Get all country data for the selected year, not filtered by indicator
    const data = allData.filter(d => 
        d.year === year && 
        !regionalAreas.includes(d.area)
    ).sort((a, b) => {
        // Sort by the selected indicator if available, otherwise by area name
        const aValue = a[indicator] || 0;
        const bValue = b[indicator] || 0;
        if (aValue !== bValue) {
            return bValue - aValue; // Descending order
        }
        return a.area.localeCompare(b.area); // Alphabetical fallback
    });
    
    // Show all countries, not just those with the selected indicator
    data.forEach(item => {
        const row = document.createElement('tr');
        const puaColorClass = (item.pua || 0) > 30 ? 'text-red' : (item.pua || 0) > 10 ? 'text-orange' : 'text-green';
        
        row.innerHTML = `
            <td style="font-weight: 500;">${item.area}</td>
            <td class="text-right">${item.cohd_ppp?.toFixed(2) || 'N/A'}</td>
            <td class="text-right"><span class="${puaColorClass}" style="font-weight: 500;">${item.pua?.toFixed(1) || 'N/A'}%</span></td>
            <td class="text-right">${item.nua?.toFixed(1) || 'N/A'}M</td>
        `;
        tableBody.appendChild(row);
    });
}

// Get color class based on indicator and value
function getColorClass(indicator, value) {
    if (!value) return '';
    
    if (indicator === 'cohd_ppp') {
        if (value > 5) return 'text-red';
        if (value > 3.5) return 'text-orange';
        return 'text-green';
    } else if (indicator === 'pua') {
        if (value > 30) return 'text-red';
        if (value > 10) return 'text-orange';
        return 'text-green';
    }
    return '';
}

// Chart control functions
function resetChartZoom(chartId) {
    const cleanId = chartId.replace('-', '');
    if (charts[cleanId]) {
        charts[cleanId].resetZoom();
    }
}

function toggleChartFullscreen(chartId) {
    const container = document.getElementById(chartId).closest('.chart-card');
    if (container.requestFullscreen) {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            container.requestFullscreen();
        }
    }
}

// Initialize the application when the page loads
init();