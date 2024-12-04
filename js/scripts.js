
const queryParameters = document.getElementById('queryParameters');
const statisticsMessage = "Please select a reserve before continuing.";
const tableMessage = "Please select a reserve and perform a search before continuing."
let lastMapCenter = null;
let lastMapZoom = null;
let reserveBoundaryLayer;



document.addEventListener('DOMContentLoaded', () => {
    const basisOfRecordInput = document.getElementById("basisOfRecord");
    const basisOfRecordSuggestions = document.getElementById("basisOfRecordSuggestions");
    const basisOfRecordTags = document.getElementById("basisOfRecordTags");
  
    let selectedBasisOfRecords = [];
  
    // Add event listener for selecting an option
    basisOfRecordInput.addEventListener("input", function () {
      const value = this.value.trim();
      const optionExists = Array.from(basisOfRecordSuggestions.options).some(
        (option) => option.value === value
      );
  
      if (optionExists && !selectedBasisOfRecords.includes(value)) {
        selectedBasisOfRecords.push(value);
        updateTags();
        this.value = ""; // Clear the input
      }
    });
  
    // Function to update the displayed tags
    function updateTags() {
      basisOfRecordTags.innerHTML = "";
      selectedBasisOfRecords.forEach((record) => {
        const tag = document.createElement("div");
        tag.classList.add("tag");
        tag.innerHTML = `
          ${record}
          <span class="remove-tag">&times;</span>
        `;
  
        // Add event listener to remove tag
        tag.querySelector(".remove-tag").addEventListener("click", () => {
          selectedBasisOfRecords = selectedBasisOfRecords.filter(
            (item) => item !== record
          );
          updateTags();
        });
  
        basisOfRecordTags.appendChild(tag);
      });
    }
  
    // Function to get the selected basisOfRecord values
    function getSelectedBasisOfRecords() {
      return selectedBasisOfRecords;
    }
  


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
                <td>${row.media && row.media.length > 0 ? generatePhotoGallery(row.media) : 'No Photos'}</td>
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
    function generatePhotoGallery(media) {
        if (!media || !Array.isArray(media)) {
            return ''; // No media available
        }

        const gallery = media
            .filter(item => item.type === 'StillImage' && item.identifier) // Ensure it's a valid image
            .map(item => {
                const smallImageUrl = item.identifier.replace(/original\.(jpeg|jpg|png)$/i, 'small.$1');
                return `<a href="${item.references}" target="_blank">
                            <img src="${smallImageUrl}" alt="Photo" style="width: 100px; margin: 5px;">
                        </a>`;
            })
            .join('');

        return gallery ? `<div><strong>Photos:</strong><br>${gallery}</div>` : '';
    }

    function buildGBIFQueryUrl(baseEndpoint, options = {}) {
        const {
            taxonKey,
            yearFrom,
            yearTo,
            facet,
            facetLimit,
            currentBounds,
            mediaType,
            basisOfRecord // Expect an array of selected basisOfRecord values
        } = options;
    
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
    
        // Add multiple basisOfRecord parameters
        if (Array.isArray(basisOfRecord) && basisOfRecord.length > 0) {
            basisOfRecord.forEach(record => {
                url += `&basisOfRecord=${encodeURIComponent(record)}`;
            });
        }
    
        return url;
    }
    
    
    
    
    
    async function performGBIFSearch(yearFrom, yearTo) {
        clearMarkers();
        tableData = []; // Reset table data
    
        const loadingMessage = document.getElementById('loadingMessage');
        loadingMessage.style.display = 'block';
        loadingMessage.innerHTML = 'Loading Records...';
    
        const basisOfRecord = getSelectedBasisOfRecords(); // Get selected Basis of Record values
        const baseUrl = `https://api.gbif.org/v1/occurrence/search`;
    
        const url = buildGBIFQueryUrl(baseUrl, {
            taxonKey,
            yearFrom,
            yearTo,
            currentBounds,
            mediaType: document.getElementById('filterPhotos').checked ? 'stillImage' : null,
            basisOfRecord // Pass the array of selected values
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
                        const popupContent = `
                            <strong>Scientific Name:</strong> ${occurrence.scientificName || 'N/A'}<br>
                            <strong>Country:</strong> ${occurrence.country || 'N/A'}<br>
                            <strong>Year:</strong> ${occurrence.year || 'N/A'}<br>
                            <strong>Basis of Record:</strong> ${occurrence.basisOfRecord || 'N/A'}<br>
                            ${generatePhotoGallery(occurrence.media)}
                            <a href="https://www.gbif.org/occurrence/${occurrence.key}" target="_blank">More details</a>
                        `;
    
                        const marker = L.marker([occurrence.decimalLatitude, occurrence.decimalLongitude])
                            .bindPopup(popupContent);
                        markerClusterGroup.addLayer(marker);
    
                        tableData.push({
                            scientificName: occurrence.scientificName,
                            year: occurrence.year,
                            month: occurrence.month,
                            day: occurrence.day,
                            verbatimLocality: occurrence.verbatimLocality,
                            institutionCode: occurrence.institutionCode,
                            basisOfRecord: occurrence.basisOfRecord || 'N/A',
                            media: occurrence.media || []
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

        statisticsContainer.innerHTML = '<h3>Showing Top 10 Counts for ' + getSelectedReserveText() + " for given query</h3>"; // Clear previous content

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
                mediaType: document.getElementById('filterPhotos').checked ? 'stillImage' : null // Include mediaType if checkbox is checked
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
        const checklistContainer = document.getElementById('checklistView');
    
        const mapButton = document.getElementById('mapViewBtn');
        const statisticsButton = document.getElementById('statisticsViewBtn');
        const tableButton = document.getElementById('tableViewBtn');
        const checklistButton = document.getElementById('checklistsViewBtn');
    
        [mapButton, statisticsButton, tableButton, checklistButton].forEach(button => button.classList.remove('active'));
        [mapContainer, statisticsContainer, tableContainer, checklistContainer].forEach(container => container.style.display = 'none');
    
        if (view === 'map') {
            mapButton.classList.add('active');
            mapContainer.style.display = 'block';
        } else if (view === 'statistics') {
            statisticsButton.classList.add('active');
            statisticsContainer.style.display = 'block';
        } else if (view === 'table') {
            tableButton.classList.add('active');
            tableContainer.style.display = 'block';
        } else if (view === 'checklist') {
            checklistButton.classList.add('active');
            checklistContainer.style.display = 'block';
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
    document.getElementById('checklistsViewBtn').addEventListener('click', () => {
        switchView('checklist');
    
        if (reserveBoundaryLayer) {
            fetchSpeciesFromMOL(reserveBoundaryLayer);
        } else {
            document.getElementById('checklistContainer').innerHTML = '<p>Please select a reserve first.</p>';
        }
    });
    
    document.getElementById('searchBtn').addEventListener('click', () => {
        const yearFrom = document.getElementById('yearFrom').value;
        const yearTo = document.getElementById('yearTo').value;
        performGBIFSearch(yearFrom, yearTo);
        const selectedBasisOfRecord = getSelectedBasisOfRecords();
      console.log("Selected Basis of Record:", selectedBasisOfRecord);
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
            switchView('map')
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

    async function fetchSpeciesFromMOL(reserveBoundaryLayer) {
        if (!reserveBoundaryLayer) {
            console.error('No reserve boundary layer is available.');
            return;
        }
    
        const checklistContainer = document.getElementById('checklistContainer');
        checklistContainer.innerHTML = '<p>Loading species checklist...</p>';
    
        try {
            // Extract GeoJSON data from the reserve boundary layer
            const geojson = reserveBoundaryLayer.toGeoJSON();
            const coordinates = geojson.features[0]?.geometry?.coordinates;
    
            if (!coordinates) {
                console.error('Failed to extract coordinates from the reserve boundary layer.');
                checklistContainer.innerHTML = '<p>Error: Invalid reserve boundary.</p>';
                return;
            }
    
            // Build the payload
            const payload = {
                lang: "en",
                geojson: {
                    type: "Polygon",
                    coordinates: coordinates
                }
            };
    
            // Send POST request to Map of Life API
            const response = await fetch("https://dev-api.mol.org/2.x/spatial/species/list", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });
    
            const data = await response.json();
    
            // Handle the response
            if (data && data.taxas && Array.isArray(data.taxas)) {
                let htmlContent = '';
    
                // Loop through the taxa to create collapsible sections
                data.taxas.forEach(taxa => {
                    const speciesList = taxa.species
                        ? taxa.species.map(species => `
                            <li>
                                <strong>${species.scientificname}</strong> (${species.common?.[0] || 'No common name'})
                            </li>
                        `).join('')
                        : '<li>No species available.</li>';
    
                    // Collapsible section for each taxa group
                    htmlContent += `
                        <div class="collapsible-container">
                            <button class="collapsible">${taxa.title} (${taxa.count} records)</button>
                            <div class="content">
                                <ul>
                                    ${speciesList}
                                </ul>
                            </div>
                        </div>
                    `;
                });
    
                checklistContainer.innerHTML = htmlContent;
    
                // Add collapsible functionality
                const collapsibles = document.querySelectorAll('.collapsible');
                collapsibles.forEach(button => {
                    button.addEventListener('click', function () {
                        this.classList.toggle('active');
                        const content = this.nextElementSibling;
                        if (content.style.maxHeight) {
                            content.style.maxHeight = null; // Collapse
                        } else {
                            content.style.maxHeight = content.scrollHeight + 'px'; // Expand
                        }
                    });
                });
            } else {
                checklistContainer.innerHTML = '<p>No species data found for the selected reserve or there was an error fetching results.</p>';
            }
        } catch (error) {
            console.error('Error fetching species checklist:', error);
            checklistContainer.innerHTML = '<p>Error loading species checklist. Please try again later.</p>';
        }
    }
    
    
    
    loadReserves();
});
