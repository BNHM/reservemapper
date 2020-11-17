(function () {
	'use strict';

	angular.module('map.map')
		.factory('Map', Map);

	Map.$inject = ['$rootScope', 'MAPBOX_TOKEN'];

	function Map( $rootScope, MAPBOX_TOKEN) {

		function Map(latColumn, lngColumn) {
			this.latColumn = latColumn;
			this.lngColumn = lngColumn;
		}

		Map.prototype = {
			_markers: [],
			/**
			 * @param mapId the id of the the div container for the map
			 */
			init: function (mapId) {
				var startBounds = [
					[2.811371, -168.513794], //Southwest
					[71.635993, -48.279419] //Northeast
				];

				this._map = L.map(mapId, {
					center: [0, 0],
					zoom: 0,
					closePopupOnClick: false,
					maxBoundsViscocity: .5
				}).fitBounds(startBounds);

				//this._mapTiles = L.tileLayer('https://api.mapbox.com/v4/mapbox.outdoors/{z}/{x}/{y}.png?access_token={access_token}',
				//	{access_token: MAPBOX_TOKEN});

				//this._mapTiles.addTo(this._map);

				this._satelliteTiles = L.tileLayer('https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.png?access_token={access_token}',
					{access_token: MAPBOX_TOKEN});
				this._satelliteTiles.addTo(this._map);
				this._base = this._satelliteTiles;

				//this._usgsTiles = L.tileLayer.wms('https://basemap.nationalmap.gov/arcgis/services/USGSImageryOnly/MapServer/WMSServer', { layers: 0, maxZoom: 8 });
				this._esriTopoTiles = L.tileLayer.wms('http://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { layers: 0 });

				this._clusterLayer = L.markerClusterGroup({chunkedLoading: true, spiderfyOnMaxZoom: false});

				var _this = this;

				this._map.on('dragstart', function () {
					var centerLng = _this._map.getCenter().lng;
					// the following is how leaflet internally calculates the max bounds. Leaflet doesn't provide a way
					// to bound only the latitude, so we do that here. We set the lng to be bound 3x greater the the center
					// and is recalculated upon every dragstart event, which should essentially keep the lng unbound
					var nwCorner = [90, centerLng - 1080];
					var seCorner = [-90, centerLng + 1080];
					_this._map.setMaxBounds([nwCorner, seCorner]);
				});


				// Define the clusterclick layer in init method
				this._clusterLayer.on('clusterclick', function (m, resource) {
					var markerChildren = m.layer.getAllChildMarkers()
					var length = m.layer.getChildCount()
					var currentZoom = this._map.getZoom()
					var maxZoom = this._map.getMaxZoom()
					if (length > 300 && currentZoom != maxZoom){
						// prevents clusterclick from opening modal on large clusters
					} else {
						var modal = document.getElementById('photoModal')
						function openModal() {
							modal.style.display = "block";
						}
						var popupContentElement = L.DomUtil.get("popupContent");
						if (currentZoom == maxZoom && length > 300) {	
							//fill popupContentElement with just the first 50 children
							for (var i = 0; i < 50; i ++){
								popupContentElement.innerHTML += markerChildren[i].popupContentCallback
							}
						}else {
							//fill popupContentElement with all markerChildren
							for (var i = 0; i < length; i ++){
								popupContentElement.innerHTML += markerChildren[i].popupContentCallback
							}
						}

						//retrieve each element to be displayed
						var elements;
						if (_this.photoOption) {
							elements = $("#popupContent").children(".photo");
						} else {
							elements = $("#popupContent").children(".query");
						}
						var length = elements.length;

						var counter = 0;
						//Get direct children of popupContent div
						elements.each(function(e) {
							if (e != 0)
								$(this).hide();
						});

						// userInfo element holds "showing results...", "results limited to 50...",  and prev next buttons
						var userInfo = document.createElement('div');
						userInfo.setAttribute('id','userInfo');

						// previous button
						var prev = document.createElement('a');
						prev.appendChild(document.createTextNode('Prev'))
						prev.setAttribute('id', 'prev')
						userInfo.appendChild(prev)
						// next button
						var next = document.createElement('a');
						next.appendChild(document.createTextNode('Next'))
						next.setAttribute('id','next')
						userInfo.appendChild(next)
						//additional information for the user
						var text= document.createElement('div');
						text.setAttribute('id','textModalHeader')
						userInfo.appendChild(text)

						if (length === 50) {	
							var onlyFifty = document.createElement('p')
							onlyFifty.appendChild(document.createTextNode('Results limited to 50 from this cluster'))
							onlyFifty.setAttribute('id', 'onlyFifty')	
							userInfo.appendChild(onlyFifty)	
						}
						
						//add user controls into the popup information
						popupContentElement.appendChild(userInfo)

						//next button controller function
						$("#next").click(function(){
							// hide the current element
							elements.eq( counter ).hide()
							// if this is the last one, reset to 0
							if (counter == length -1) {
								counter = 0;
								// increment counter in other cases
							} else {
								counter++;
							}
							elements.eq( counter ).show()
							displayChange()
							return false;
						});

						//prev button controller function
						$("#prev").click(function(){
							// hide the current element
							elements.eq( counter ).hide()

							// if this is the first one, reset to 0
							if (counter == 0) {
								counter = length -1;
							} else {
								counter--;
							}
							elements.eq( counter ).show()
							displayChange()
							return false;
						});

						//populate additional information for the user
						function displayChange(){
							var shownElement = counter + 1
							text.innerHTML = ("Showing result "+ shownElement +" of "+ length)
						}
						displayChange()

						//add all information from popupContent into modal body
						document.getElementById("modal-body").appendChild(popupContentElement)

						// The following code will display each marker element one at a time, after the user clicks a cluster
						openModal()	

						//retrieve close element by ID, on click (x) hide modal and hide popupContent
						document.getElementById("close").onclick = function() {
							modal.style.display = "none";
							popupContentElement.innerHTML = ""
						}

						// When user clicks anywhere outside of modal, hide modal and popupContent
						window.onclick = function(event) {
							if (event.target == modal) {
								modal.style.display = "none";
								popupContentElement.innerHTML = ""
							}
						}
					}	
				});
			},

			// * @param data data is a json array of objects. Each object should contain a key matching the given latColumn
			// * & lngColumn. @param popupContentCallback the function to call to populate the popup box content. Will be passed the current resource
			setMarkers: function (data, popupContentCallback, zoomTo) {
				this._clearMap();
				this.addMarkers(data, popupContentCallback, zoomTo);
				this._map.on('move', this._updateMarkerLocations.bind(this));
			},

			addMarkers: function(data, popupContentCallback, zoomTo) {
				var _this = this;

				var marker;
				angular.forEach(data, function (resource) {
					var genericGeoJSON = null;
					// Handle CalPhotos Popup Content
					if (_this.photoOption) {
						popupContentCallback = function(resource) { 
							//push object containing new scientific name into observations array, if observations array is empty
							if (resource.observations[0] == undefined){
								resource.observations.push({scientific_name : 'undefined', url : 'unknown'})
							} 
							var retString = "<div class='photo'>"
							retString += "<a href='" + resource.media_url+ "' target='_blank'><img src='" + resource.media_url + "'></a>";
							retString += "<ul>"	
							retString += "<br><strong><i>" + resource.observations[0].scientific_name + "</strong></i>" 
							retString += "<br><a href='" + resource.remote_resource + "' target='_blank'>Photo Courtesy of CalPhotos</a>" 
							retString += "<br>License: "+ resource.license 
							retString += "<br>Photo Taken On " + resource.begin_date 
							if (resource.authors )
								retString += "<br>by " + resource.authors 
							if (resource.locality)
								retString += "<br>at " + resource.locality
							retString += "</ul>"
							return retString; 
						}
						genericGeoJSON = resource['geometry']
					} 
					// Handle GBIF Occurrence popup content
					else {
						popupContentCallback = function (resource) { 
							var retString = "<div class='query'>" 
							retString += "<strong>Institution Code</strong>:  " + resource.institutionCode + "<br>";
							retString += "<strong>Basis Of Record</strong>:  " + resource.basisOfRecord + "<br>";
							retString += "<strong>Event Date</strong>:  " + resource.eventDate + "<br>";
							retString += "<strong>Recorded By</strong>:  " + resource.recordedBy + "<br>";
							retString += "<strong>Scientific Name</strong>:  " + resource.scientificName + "<br>";
							retString += "<strong>Locality</strong>:  " + resource.locality + "<br>";
							retString += "<a href='http://www.gbif.org/occurrence/" + resource.key + "' target='_blank'>Occurrence details from GBIF site</a>"
							return retString;
						}

						var lat = resource[_this.latColumn];
						var lng = resource[_this.lngColumn];

						if (typeof lat === 'number' & typeof lng === 'number') {
							if (typeof popupContentCallback === 'function') {
								genericGeoJSON = { 
									"type": "Feature", 
									"properties": { "popupContent": "" }, 
									"geometry": { 
										"type": "Point", "coordinates": [lng, lat] 
									}
								}
							}
						}
					}

					marker = L.geoJSON(genericGeoJSON, {
						style: function (feature) {
							return feature.properties.style;
						},
						onEachFeature: function (feature, layer) {
							var count = 0;
							layer.popupContentCallback = popupContentCallback(resource,count++)
						}
					});
					//when marker clicked, show information in the popupContent box
					var modal = document.getElementById('photoModal')
					function openModal() {
						modal.style.display = "block";
					}
					marker.on('click', function(m,resource) {
						var popupContentElement = L.DomUtil.get("popupContent");
						popupContentElement.innerHTML=m.layer.popupContentCallback;
						document.getElementById("modal-body").appendChild(popupContentElement)
						openModal()
						//retrieve close element by ID, on click (x) hide modal and hide popupContent
						document.getElementById("close").onclick = function() {
							modal.style.display = "none";
							popupContentElement.innerHTML = ""
						}

						// When user clicks anywhere outside of modal, hide modal and popupContent
						window.onclick = function(event) {
							if (event.target == modal) {
								modal.style.display = "none";
								popupContentElement.innerHTML = ""
							}
						}

					});

					_this._markers.push(marker); 
				});	

				_this._clusterLayer.addLayers(this._markers);

				this._map
					.addLayer(this._clusterLayer)
					.setMinZoom(1)
					.spin(false);

			},

			addLayer: function(l) {
				this._map.addLayer(l);
				this._map.fitBounds(l.getBounds(), {padding: [30, 30]});
			},

			removeLayer: function(l) {
				this._map.removeLayer(l);
			},

			satelliteView: function () {
				this._map.removeLayer(this._base);
				this._map.addLayer(this._satelliteTiles);
				this._base = this._satelliteTiles;
			},

			mapView: function () {
				this._map.removeLayer(this._base);
				this._map.addLayer(this._mapTiles);
				this._base = this._mapTiles;
			},

			//usgsView: function () {
		///		this._map.removeLayer(this._base);
		//		this._map.addLayer(this._usgsTiles);
		//		this._base = this._usgsTiles;
		//	},
			esriTopoView: function () {
				this._map.removeLayer(this._base);
				this._map.addLayer(this._esriTopoTiles);
				this._base = this._esriTopoTiles;
			},

			drawBounds: function (createCallback) {
				new L.Draw.Rectangle(this._map, {}).enable();

				var _this = this;
				this._map.on(L.Draw.Event.CREATED, function (e) {
					_this._boundingBox = e.layer;
					_this._map.addLayer(_this._boundingBox);
					var ne = e.layer.getBounds().getNorthEast().wrap();
					var sw = e.layer.getBounds().getSouthWest().wrap();

					createCallback({
						northEast: ne,
						southWest: sw
					});
				});

				this._map.on(L.Draw.Event.DRAWSTOP, function (e) {
					if (!_this._boundingBox) {
						_this._map.off(L.Draw.Event.CREATED)
						createCallback();
					}
					_this._map.off(L.Draw.Event.DRAWSTOP);
				});
			},

			clearBounds: function () {
				if (this._boundingBox) {
					this._map.removeLayer(this._boundingBox);
					this._map.off(L.Draw.Event.CREATED);
					this._boundingBox = null;
				}
			},

			// calls map.invalidateSize(). Used to recalculate the map size if the container has changed dimensions

			refreshSize: function () {
				this._map.invalidateSize();
			},

			_clearMap: function () {
				if (this._clusterLayer && this._markers.length > 0) {
					this._clusterLayer.clearLayers();
				}
				this._markers = [];
			},

			// move the markers as the user pans the map. Otherwise, the markers will be panned out of view

			_updateMarkerLocations: function () {
				var centerLng = this._map.getCenter().lng;
				var updatedMarkers = [];
				var originalMarkers = [];
				this._clusterLayer.eachLayer(function (m) {
					var latlng = m.getLatLng();
					if (latlng.lng < centerLng) {
						// marker is W of center
						if ((centerLng - 180) > latlng.lng) {
							var mCopy = L.marker([latlng.lat, latlng.lng + 360]);
							mCopy.bindPopup(m.getPopup());
							updatedMarkers.push(mCopy);
							originalMarkers.push(m);
						}
					} else {
						// marker is E of center
						if ((centerLng + 180) < latlng.lng) {
							var mCopy = L.marker([latlng.lat, latlng.lng - 360]);
							mCopy.bindPopup(m.getPopup());
							updatedMarkers.push(mCopy);
							originalMarkers.push(m);
						}
					}
				});
				this._clusterLayer.removeLayers(originalMarkers);
				this._clusterLayer.addLayers(updatedMarkers);
			}
		};

		return Map;
	}
})();
