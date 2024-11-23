// Initialize Maplibre GL map with OpenStreetMap as basemap and GBIF vector tile layer
const map = new maplibregl.Map({
    container: 'map', // Container ID
    style: {
      "version": 8,
      "sources": {
        "osm": {
          "type": "raster",
          "tiles": [
            "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png"
          ],
          "tileSize": 256,
          "attribution": "&copy; OpenStreetMap contributors"
        },
        "gbif": {
          "type": "vector",
          "tiles": ["https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}.mvt?style=classic.poly&palette=red"],
          "minzoom": 0,
          "maxzoom": 14
        }
      },
      "layers": [
        {
          "id": "osm-basemap",
          "type": "raster",
          "source": "osm",
          "minzoom": 0,
          "maxzoom": 19
        },
        {
          "id": "gbif-occurrences",
          "type": "circle",
          "source": "gbif",
          "source-layer": "occurrence",
          "paint": {
            "circle-radius": 4,
            "circle-color": "#FF0000"
          }
        }
      ]
    },
    center: [-122.4194, 37.7749], // Initial map center
    zoom: 5 // Initial zoom level
  });
  
  // Add navigation controls to the map
  map.addControl(new maplibregl.NavigationControl());
  
  // Function to fetch occurrences near a given point
  async function fetchNearbyOccurrences(lat, lng) {
    // Define a small bounding box around the click location for nearby search
    const buffer = 0.01; // ~1.1km radius
    const url = `https://api.gbif.org/v1/occurrence/search?decimalLatitude=${lat - buffer},${lat + buffer}&decimalLongitude=${lng - buffer},${lng + buffer}&limit=10`;
  
    const response = await fetch(url);
    if (!response.ok) {
      console.error("Error fetching occurrences:", response.status);
      return [];
    }
    const data = await response.json();
    return data.results;
  }
  
  // Handle click events on the GBIF vector tile layer
  map.on('click', 'gbif-occurrences', async function (e) {
    const { lng, lat } = e.lngLat;
    const occurrences = await fetchNearbyOccurrences(lat, lng);
  
    // Prepare popup content
    let popupContent = occurrences.length
      ? occurrences.map(occ => `
        <strong>Scientific Name:</strong> ${occ.scientificName || 'N/A'}<br>
        <strong>Country:</strong> ${occ.country || 'N/A'}<br>
        <strong>Year:</strong> ${occ.year || 'N/A'}<br>
        <a href="https://www.gbif.org/occurrence/${occ.key}" target="_blank">More details</a><br><hr>
      `).join('')
      : 'No detailed occurrences found in this area.';
  
    // Show popup with occurrence details
    new maplibregl.Popup()
      .setLngLat([lng, lat])
      .setHTML(popupContent)
      .addTo(map);
  });
  