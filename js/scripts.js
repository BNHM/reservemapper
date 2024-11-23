
const queryParameters = document.getElementById('queryParameters');
const statisticsMessage = "Please select a reserve before continuing.";
const tableMessage = "Please select a reserve and perform a search before continuing."
let lastMapCenter = null;
let lastMapZoom = null;


document.addEventListener('DOMContentLoaded', () => {

    // Initially hide the query parameters
    queryParameters.style.display = 'none';

    // Add an event listener to the Reserve Selector
    reserveSelect.addEventListener('change', function () {
        if (this.value) {
            // Show query parameters when a reserve is selected
            queryParameters.style.display = 'block';
        } else {
            // Hide query parameters if no reserve is selected
            queryParameters.style.display = 'none';
        }
    });

    // Initialize the Leaflet map
    const map = L.map('map', {
        crs: L.CRS.EPSG3857 // Default: Spherical Mercator
    }).setView([37.7749, -122.4194], 5);

    // Define Base Layers
    const lightLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19
    });

    const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors, SRTM | &copy; OpenTopoMap',
        maxZoom: 17
    });

    const satelliteLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google Maps',
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        maxZoom: 20
    });

    // Add the default base layer
    lightLayer.addTo(map);

    // Add Layer Control
    const baseLayers = {
        'Light': lightLayer,
        'Topographic': topoLayer,
        'Satellite': satelliteLayer
    };

    L.control.layers(baseLayers).addTo(map);

    // Variables
    let taxonKey = null;
    let currentBounds = null;
    let markerClusterGroup = L.markerClusterGroup();
    let reserveBoundaryLayer;
    map.addLayer(markerClusterGroup);

    // Table and pagination variables
    let tableData = [];
    const recordsPerPage = 50;
    let currentPage = 1;

    // Utility: Format numbers with commas
    function formatNumber(num) {
        return num.toLocaleString();
    }

    // Clear markers
    function clearMarkers() {
        markerClusterGroup.clearLayers();
    }

    function getSelectedReserveText() {
        const reserveSelect = document.getElementById('reserveSelect');
        
        if (!reserveSelect) {
            console.error('Element with id "reserveSelect" not found.');
            return null;
        }
    
        // Get the text of the selected option
        const selectedText = reserveSelect.selectedOptions[0]?.textContent || null;
    
        return selectedText;
    }
    
    function isQueryParametersVisible() {
        const queryParameters = document.getElementById('queryParameters');
        if (!queryParameters) {
            console.error('Element with id "queryParameters" not found.');
            return false; // Return false if the element does not exist
        }
    
        return window.getComputedStyle(queryParameters).display !== 'none';
    }
    // Render a single page of the Table View
    function renderTablePage(page) {
        
        const tableContainer = document.getElementById('tableView');

        if (!isQueryParametersVisible()) {
            tableContainer.innerHTML = tableMessage;
            return;
        }

        const start = (page - 1) * recordsPerPage;
        const end = start + recordsPerPage;
        const pageData = tableData.slice(start, end);


        const tableBody = document.querySelector('#dataTable tbody');
        if (!tableBody) {
            console.error('Table body element not found.');
            return;
        }
        tableBody.innerHTML = pageData.map(row => `
            <tr>
                <td>${row.scientificName || 'N/A'}</td>
                <td>${row.year || 'N/A'}</td>
                <td>${row.month || 'N/A'}</td>
                <td>${row.day || 'N/A'}</td>
                <td>${row.verbatimLocality || 'N/A'}</td>
                <td>${row.institutionCode || 'N/A'}</td>
            </tr>
        `).join('');

        document.getElementById('prevPage').disabled = page <= 1;
        document.getElementById('nextPage').disabled = page >= Math.ceil(tableData.length / recordsPerPage);
        document.getElementById('pageInfo').textContent = `Page ${page} of ${Math.ceil(tableData.length / recordsPerPage)}`;

        currentPage = page;
    }

    function updateRecordCount(view, count) {
        const formattedCount = count.toLocaleString(); // Format number with commas
        const recordCountElement = document.getElementById(
            view === 'statistics' ? 'statisticsRecordCount' : 'tableRecordCount'
        );

        if (recordCountElement) {
            recordCountElement.textContent = `A total of ${formattedCount} records satisfy this query`;
        }
    }


    function buildGBIFQueryUrl(baseEndpoint, options = {}) {
        const { taxonKey, yearFrom, yearTo, facet, facetLimit, currentBounds, mediaType } = options;

        let url = `${baseEndpoint}?limit=300`; // Default limit for occurrence search

        if (taxonKey) url += `&taxonKey=${taxonKey}`;
        if (yearFrom && yearTo) url += `&year=${yearFrom},${yearTo}`;
        else if (yearFrom) url += `&year=${yearFrom}`;
        else if (yearTo) url += `&year=${yearTo}`;

        if (facet) url += `&facet=${facet}`;
        if (facetLimit) url += `&facetLimit=${facetLimit}`;

        if (currentBounds) {
            const sw = currentBounds.getSouthWest();
            const ne = currentBounds.getNorthEast();
            url += `&decimalLatitude=${sw.lat},${ne.lat}&decimalLongitude=${sw.lng},${ne.lng}`;
        }

        if (mediaType) url += `&mediaType=${mediaType}`;

        return url;
    }
    // Perform a GBIF search and update the Table View
    async function performGBIFSearch(yearFrom, yearTo) {
        clearMarkers();
        tableData = []; // Reset table data

        const loadingMessage = document.getElementById('loadingMessage');
        loadingMessage.style.display = 'block';
        loadingMessage.innerHTML = 'Loading Records...';

        let baseUrl = `https://api.gbif.org/v1/occurrence/search`;
        url = buildGBIFQueryUrl(baseUrl, {
            taxonKey,
            yearFrom,
            yearTo,
            currentBounds,
            mediaType: filterPhotos ? 'stillImage' : null // Include mediaType if checkbox is checked

        });

        let offset = 0;
        let totalRecords = 0;
        let loadedCount = 0;

        try {
            while (loadedCount < 1000) {
                const pagedUrl = `${url}&offset=${offset}`;
                const response = await fetch(pagedUrl);
                const data = await response.json();

                if (offset === 0) totalRecords = data.count;
                if (offset === 0) updateRecordCount('table', data.count || 0);

                data.results.forEach(occurrence => {
                    if (occurrence.decimalLatitude && occurrence.decimalLongitude) {
                        const marker = L.marker([occurrence.decimalLatitude, occurrence.decimalLongitude])
                            .bindPopup(`
                                <strong>Scientific Name:</strong> ${occurrence.scientificName || 'N/A'}<br>
                                <strong>Country:</strong> ${occurrence.country || 'N/A'}<br>
                                <strong>Year:</strong> ${occurrence.year || 'N/A'}<br>
                                <a href="https://www.gbif.org/occurrence/${occurrence.key}" target="_blank">More details</a>
                            `);
                        markerClusterGroup.addLayer(marker);

                        tableData.push({
                            scientificName: occurrence.scientificName,
                            year: occurrence.year,
                            month: occurrence.month,
                            day: occurrence.day,
                            verbatimLocality: occurrence.verbatimLocality,
                            institutionCode: occurrence.institutionCode
                        });
                    }
                });

                loadedCount += data.results.length;
                offset += 300;

                loadingMessage.innerHTML = `Loading ${Math.min(loadedCount, 1000)} of ${totalRecords} records...`;

                if (data.endOfRecords) break;
            }

            renderTablePage(1); // Render the first page
            loadingMessage.style.display = 'none';
        } catch (error) {
            console.error('Error fetching GBIF data:', error);
            loadingMessage.innerHTML = 'Error loading records.';
            setTimeout(() => (loadingMessage.style.display = 'none'), 5000);
        }
    }

    // Fetch and render statistics from GBIF
    async function fetchStatistics() {
        switchView('statistics');

        const facets = ['institutionCode', 'collectionCode', 'scientificName'];
        const statisticsContainer = document.getElementById('statistics');

        if (!isQueryParametersVisible()) {
            statisticsContainer.innerHTML = statisticsMessage;
            return;
        }

        statisticsContainer.innerHTML = 'Showing Statistics for ' + getSelectedReserveText(); // Clear previous content

        //const baseUrl = `https://api.gbif.org/v1/occurrence/search?limit=0`;
        const baseUrl = `https://api.gbif.org/v1/occurrence/search`;

        // Display loading indicators for each facet
        facets.forEach(facet => {
            const loadingMessage = document.createElement('div');
            loadingMessage.id = `loading-${facet}`;
            loadingMessage.innerHTML = `<p>Loading top 10 ${facet.charAt(0).toUpperCase() + facet.slice(1)}...</p>`;
            statisticsContainer.appendChild(loadingMessage);
        });

        yearFrom = document.getElementById('yearFrom').value;
        yearTo = document.getElementById('yearTo').value;
        for (const facet of facets) {
            //const facetUrl = `${baseUrl}&facet=${facet}&facetLimit=20`;
            // Build the query URL using the helper function
            const facetUrl = buildGBIFQueryUrl(baseUrl, {
                facet,
                facetLimit: 10,
                taxonKey, // Reuse taxonKey from performGBIFSearch
                yearFrom,
                yearTo,
                currentBounds, // Replace with your year input variable
                mediaType: filterPhotos ? 'stillImage' : null // Include mediaType if checkbox is checked
            });

            try {
                const response = await fetch(facetUrl);
                const data = await response.json();

                // Extract facet counts and remove loading message
                const counts = data.facets?.[0]?.counts || [];


                document.getElementById(`loading-${facet}`).remove();
                createStatisticsTable(counts, facet.charAt(0).toUpperCase() + facet.slice(1), data.count);
            } catch (error) {
                console.error(`Error fetching ${facet}:`, error);

                // Update the loading message with an error message
                const loadingMessage = document.getElementById(`loading-${facet}`);
                if (loadingMessage) {
                    loadingMessage.innerHTML = `<p>Error loading ${facet.charAt(0).toUpperCase() + facet.slice(1)}.</p>`;
                }
            }
        }
    }

    function createStatisticsTable(data, title, count) {
        const statisticsContainer = document.getElementById('statistics');

        const tableHtml = `
        <h3>${title} (${count} total)</h3>
        <table class="sortable-table">
            <thead>
                <tr>
                    <th data-key="name">Name</th>
                    <th data-key="count">Count</th>
                </tr>
            </thead>
            <tbody>
                ${data
                .map((row, index) => {
                    return `
                            <tr>
                                <td>${row.name || 'N/A'}</td>
                                <td>${formatNumber(row.count) || '0'}</td>
                            </tr>
                        `;
                })
                .join('')}
            </tbody>
        </table>
    `;

        // Insert the table into the container
        statisticsContainer.innerHTML += tableHtml;
    }



    // Switch between views
    function switchView(view) {
        const mapContainer = document.getElementById('map');
        const statisticsContainer = document.getElementById('statistics');
        const tableContainer = document.getElementById('tableView');

        // Buttons
        const mapButton = document.getElementById('mapViewBtn');
        const statisticsButton = document.getElementById('statisticsViewBtn');
        const tableButton = document.getElementById('tableViewBtn');

        // Reset all buttons to inactive
        [mapButton, statisticsButton, tableButton].forEach(button => button.classList.remove('active'));

        // Reset all containers to hidden
        mapContainer.style.display = 'none';
        statisticsContainer.style.display = 'none';
        tableContainer.style.display = 'none';

 // Save map state when switching away
 if (view !== 'map' && map) {
    lastMapCenter = map.getCenter();
    lastMapZoom = map.getZoom();
}

        if (view === 'map') {
            mapButton.classList.add('active'); 
            if (map) {
                map.setView(lastMapCenter || [37.7749, -122.4194], lastMapZoom || 5);
                map.invalidateSize(); // Recalculate map dimensions
            }
            mapContainer.style.display = 'block';
            statisticsContainer.style.display = 'none';
            tableContainer.style.display = 'none';
        } else if (view === 'statistics') {
            statisticsButton.classList.add('active');
            mapContainer.style.display = 'none';
            statisticsContainer.style.display = 'block';
            tableContainer.style.display = 'none';
        } else if (view === 'table') {
            tableButton.classList.add('active');
            mapContainer.style.display = 'none';
            statisticsContainer.style.display = 'none';
            tableContainer.style.display = 'block';
        }
    }

    // Event listeners
    document.getElementById('mapViewBtn').addEventListener('click', () => switchView('map'));
    document.getElementById('tableViewBtn').addEventListener('click', () => {
        switchView('table');
        renderTablePage(1); // Ensure the table renders on switching views
    });
    document.getElementById('statisticsViewBtn').addEventListener('click', () => {
        switchView('statistics');
        fetchStatistics();
    });
    document.getElementById('searchBtn').addEventListener('click', () => {
        const yearFrom = document.getElementById('yearFrom').value;
        const yearTo = document.getElementById('yearTo').value;
        performGBIFSearch(yearFrom, yearTo);
    });

    // Scientific name suggestions
    document.getElementById('scientificName').addEventListener('input', function () {
        const query = this.value;
        if (query.length < 2) return;

        fetch(`https://api.gbif.org/v1/species/suggest?q=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => {
                const suggestions = data.map(
                    species => `<option value="${species.canonicalName}" data-key="${species.key}"></option>`
                );
                document.getElementById('speciesSuggestions').innerHTML = suggestions.join('');
            })
            .catch(error => {
                console.error('Error fetching species suggestions:', error);
            });
    });

    document.getElementById('scientificName').addEventListener('change', function () {
        const selectedName = this.value;
        const selectedOption = Array.from(
            document.getElementById('speciesSuggestions').children
        ).find(option => option.value === selectedName);

        taxonKey = selectedOption ? selectedOption.getAttribute('data-key') : null;
    });

    // Load reserves for the dropdown
    function loadReserves() {
        const githubApiUrl = 'https://api.github.com/repos/BNHM/spatial-layers/contents/json?ref=master';
        fetch(githubApiUrl)
            .then(response => response.json())
            .then(data => {
                data.forEach(item => {
                    if (item.name.endsWith('.geojson')) {
                        const reserveName = item.name.replace(/\+/g, ' ').replace('.geojson', '');
                        document.getElementById('reserveSelect').innerHTML += `<option value="${item.download_url}">${reserveName}</option>`;
                    }
                });
            });

        document.getElementById('reserveSelect').addEventListener('change', function () {
            const selectedUrl = this.value;
            if (selectedUrl) {
                fetch(selectedUrl)
                    .then(response => response.json())
                    .then(geoJsonData => {
                        if (reserveBoundaryLayer) {
                            map.removeLayer(reserveBoundaryLayer);
                        }

                        reserveBoundaryLayer = L.geoJSON(geoJsonData, {
                            style: {
                                color: '#0000FF',
                                weight: 2
                            }
                        }).addTo(map);

                        map.fitBounds(reserveBoundaryLayer.getBounds());
                        currentBounds = reserveBoundaryLayer.getBounds();
                    });
            }
        });
    }

    loadReserves();
});
