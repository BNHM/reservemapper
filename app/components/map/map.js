(function () {
	'use strict';

	angular.module('map.map')
		.factory('Map', Map);

	Map.$inject = ['$rootScope', 'MAPBOX_TOKEN'];

	function Map( $rootScope, MAPBOX_TOKEN) {
		var MAX_CLUSTER_FULL_POPUP_RECORDS = 300;
		var MAX_CLUSTER_LIMITED_POPUP_RECORDS = 50;

		function Map(latColumn, lngColumn) {
			this.latColumn = latColumn;
			this.lngColumn = lngColumn;
			this._markers = [];
			this._gbifTileLayer = null;
			this._gbifAggregateLayer = null;
			this._gbifAggregateState = null;
			this._gbifAggregateMoveHandler = null;
			this._gbifAggregateLoadTimer = null;
			this._gbifViewportNotifyTimer = null;
			this._gbifTileErrorShown = false;
		}

		Map.prototype = {
			_markers: [],
			_gbifTileLayer: null,
			_gbifAggregateLayer: null,
			_gbifAggregateState: null,
			_gbifAggregateMoveHandler: null,
			_gbifAggregateLoadTimer: null,
			_gbifViewportNotifyTimer: null,
			_gbifTileErrorShown: false,
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

				this._clusterLayer = L.markerClusterGroup({chunkedLoading: true, spiderfyOnMaxZoom: false, zoomToBoundsOnClick: false});
				this._gbifTileLayer = null;
				this._gbifAggregateLayer = null;
				this._gbifAggregateState = null;
				this._gbifAggregateMoveHandler = null;
				this._gbifAggregateLoadTimer = null;
				this._gbifViewportNotifyTimer = null;
				this._gbifTileErrorShown = false;

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
					if (!_this.photoOption) {
						var htmlItems = [];
						var displayLimit = length > MAX_CLUSTER_FULL_POPUP_RECORDS ? MAX_CLUSTER_LIMITED_POPUP_RECORDS : length;
						for (var itemIndex = 0; itemIndex < displayLimit; itemIndex++) {
							if (markerChildren[itemIndex].popupContentCallback) {
								htmlItems.push(markerChildren[itemIndex].popupContentCallback);
							}
						}
						openRecordHtmlPopup(_this._map, htmlItems, m.latlng || m.layer.getLatLng(), {
							totalElements: length,
							title: 'Occurrence records',
							emptyMessage: 'No records found in this cluster.'
						});
						return;
					}
					if (length > 300 && currentZoom != maxZoom){
						// prevents clusterclick from opening modal on large clusters
					} else {
						var modal = document.getElementById('photoModal')
						function openModal() {
							modal.style.display = "block";
						}
						var popupContentElement;
						if (_this.photoOption) {
							popupContentElement = L.DomUtil.get("modalPopupContent");
							if (!popupContentElement) {
								return;
							}
							popupContentElement.innerHTML = "";
						} else {
							popupContentElement = L.DomUtil.create('div', 'map-popup-content');
						}
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
							elements = $(popupContentElement).children(".photo");
						} else {
							elements = $(popupContentElement).children(".query");
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
						if (_this.photoOption) {
							userInfo.setAttribute('id','userInfo');
						} else {
							userInfo.setAttribute('class','map-popup-pager');
						}

						// previous button
						var prev = document.createElement('a');
						prev.appendChild(document.createTextNode('Prev'))
						prev.setAttribute('href', '#')
						if (_this.photoOption) {
							prev.setAttribute('id', 'prev')
						} else {
							prev.setAttribute('class', 'map-popup-prev')
						}
						userInfo.appendChild(prev)
						// next button
						var next = document.createElement('a');
						next.appendChild(document.createTextNode('Next'))
						next.setAttribute('href', '#')
						if (_this.photoOption) {
							next.setAttribute('id','next')
						} else {
							next.setAttribute('class','map-popup-next')
						}
						userInfo.appendChild(next)
						//additional information for the user
						var text= document.createElement('div');
						if (_this.photoOption) {
							text.setAttribute('id','textModalHeader')
						} else {
							text.setAttribute('class','map-popup-count')
						}
						userInfo.appendChild(text)

						if (length === 50) {	
							var onlyFifty = document.createElement('p')
							onlyFifty.appendChild(document.createTextNode('Results limited to 50 from this cluster'))
							if (_this.photoOption) {
								onlyFifty.setAttribute('id', 'onlyFifty')
							} else {
								onlyFifty.setAttribute('class', 'map-popup-limit')
							}
							userInfo.appendChild(onlyFifty)	
						}
						
						//add user controls into the popup information
						popupContentElement.appendChild(userInfo)

						//next button controller function
						$(next).click(function(){
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
						$(prev).click(function(){
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

						// The following code will display each marker element one at a time, after the user clicks a cluster
						if (_this.photoOption) {
							openModal()
						} else {
							var clusterPopupOptions = getRecordPopupOptions(_this._map);
							applyRecordPopupBounds(popupContentElement, clusterPopupOptions);
							L.popup(clusterPopupOptions)
								.setLatLng(m.latlng || m.layer.getLatLng())
								.setContent(popupContentElement)
								.openOn(_this._map);
						}

						//retrieve close element by ID, on click (x) hide modal and hide popupContent
						if (_this.photoOption) {
							document.getElementById("close").onclick = function() {
								modal.style.display = "none";
								document.getElementById("modalPopupContent").innerHTML = ""
							}

							// When user clicks anywhere outside of modal, hide modal and popupContent
							window.onclick = function(event) {
								if (event.target == modal) {
									modal.style.display = "none";
									document.getElementById("modalPopupContent").innerHTML = ""
								}
							}
						}
					}	
				});
			},

			// * @param data data is a json array of objects. Each object should contain a key matching the given latColumn
			// * & lngColumn. @param popupContentCallback the function to call to populate the popup box content. Will be passed the current resource
			setMarkers: function (data, popupContentCallback, zoomTo, options) {
				this._clearMap();
				this.addMarkers(data, popupContentCallback, zoomTo, options);
				this._map.on('move', this._updateMarkerLocations.bind(this));
			},

			addMarkers: function(data, popupContentCallback, zoomTo, options) {
				var _this = this;
				var markerOptions = options || {};

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
						popupContentCallback = buildGBIFRecordPopupContent;

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
						pointToLayer: function (feature, latlng) {
							if (_this.photoOption) {
								return L.marker(latlng);
							}

							return L.circleMarker(latlng, {
								radius: 7,
								weight: 2,
								color: '#ffffff',
								fillColor: '#03A9F4',
								fillOpacity: 0.9,
								opacity: 1,
								className: 'occurrence-click-marker'
							});
						},
						onEachFeature: function (feature, layer) {
							var count = 0;
							layer.popupContentCallback = popupContentCallback(resource,count++)
							if (!_this.photoOption) {
								layer.on('mouseover', function () {
									if (layer.setRadius) {
										layer.setRadius(10);
									}
									if (layer.setStyle) {
										layer.setStyle({
											fillColor: '#f5d142',
											color: '#222222'
										});
									}
								});
								layer.on('mouseout', function () {
									if (layer.setRadius) {
										layer.setRadius(7);
									}
									if (layer.setStyle) {
										layer.setStyle({
											fillColor: '#03A9F4',
											color: '#ffffff'
										});
									}
								});
							}
						}
					});
					//when marker clicked, show information in the popupContent box
					var modal = document.getElementById('photoModal')
					function openModal() {
						modal.style.display = "block";
					}
					marker.on('click', function(m,resource) {
						if (!_this.photoOption) {
							var markerPopupOptions = getRecordPopupOptions(_this._map);
							var markerPopupContent = L.DomUtil.create('div', 'map-popup-content');
							markerPopupContent.innerHTML = m.layer.popupContentCallback;
							applyRecordPopupBounds(markerPopupContent, markerPopupOptions);
							L.popup(markerPopupOptions)
								.setLatLng(m.latlng)
								.setContent(markerPopupContent)
								.openOn(_this._map);
							return;
						}

						var popupContentElement = L.DomUtil.get("modalPopupContent");
						if (!popupContentElement) {
							return;
						}
						popupContentElement.innerHTML=m.layer.popupContentCallback;
						openModal()
						//retrieve close element by ID, on click (x) hide modal and hide popupContent
						document.getElementById("close").onclick = function() {
							modal.style.display = "none";
							document.getElementById("modalPopupContent").innerHTML = ""
						}

						// When user clicks anywhere outside of modal, hide modal and popupContent
						window.onclick = function(event) {
							if (event.target == modal) {
								modal.style.display = "none";
								document.getElementById("modalPopupContent").innerHTML = ""
							}
						}

					});

					_this._markers.push(marker); 
				});	

				if (markerOptions.cluster === false) {
					angular.forEach(this._markers, function (markerLayer) {
						markerLayer.addTo(_this._map);
					});
					this._map
						.setMinZoom(1)
						.spin(false);
				} else {
					_this._clusterLayer.addLayers(this._markers);

					this._map
						.addLayer(this._clusterLayer)
						.setMinZoom(1)
						.spin(false);
				}

			},

			setGBIFTiles: function(searchRequest, handlers) {
				var callbacks = angular.isFunction(handlers) ? { onTileError: handlers } : (handlers || {});
				var tileState = buildGBIFTileState(searchRequest);
				var _this = this;

				this._clearMarkers();
				this.clearGBIFTiles();

				this._gbifTileErrorShown = false;
				this._gbifAggregateLayer = L.markerClusterGroup({
					chunkedLoading: true,
					iconCreateFunction: createGBIFAggregateClusterIcon,
					maxClusterRadius: 48,
					showCoverageOnHover: false,
					spiderfyOnMaxZoom: false,
					zoomToBoundsOnClick: false
				}).addTo(this._map);
				this._gbifAggregateState = {
					callbacks: callbacks,
					loadId: 0,
					url: tileState.url,
					visible: true
				};
				this._gbifAggregateLayer.on('clusterclick', function (event) {
					var targetZoom = getAggregateClickZoom(_this._map);
					var total = getAggregateClusterTotal(event.layer);
					var bounds = getAggregateClusterBounds(event.layer);

					_this._map.setView(event.latlng, targetZoom);
					openGBIFAggregatePopup(_this._map, event.latlng, total, {
						loading: angular.isFunction(callbacks.onAggregateClick)
					});
					if (angular.isFunction(callbacks.onAggregateClick)) {
						$rootScope.$evalAsync(function () {
							callbacks.onAggregateClick({
								bounds: bounds,
								latlng: event.latlng,
								total: total,
								zoom: targetZoom
							});
						});
					}
				});

				this._gbifAggregateMoveHandler = function () {
					_this._scheduleGBIFAggregateUpdate();
					_this._scheduleGBIFViewportChange();
				};
				this._map.on('moveend zoomend', this._gbifAggregateMoveHandler);

				if (searchRequest.bounds && (!searchRequest.bounds.isValid || searchRequest.bounds.isValid())) {
					this._map.fitBounds(searchRequest.bounds, {padding: [30, 30]});
				}

				this._scheduleGBIFAggregateUpdate();
				this._scheduleGBIFViewportChange();
				this._map.spin(false);

				return tileState;
			},

			showGBIFAggregateTiles: function () {
				if (!this._gbifAggregateState || !this._gbifAggregateLayer) {
					return;
				}

				this._clearMarkers();
				this._gbifAggregateState.visible = true;
				if (!this._map.hasLayer(this._gbifAggregateLayer)) {
					this._gbifAggregateLayer.addTo(this._map);
				}
				this._scheduleGBIFAggregateUpdate();
				this._map.spin(false);
			},

			showGBIFExactMarkers: function (data) {
				if (this._gbifAggregateState) {
					this._gbifAggregateState.visible = false;
				}
				if (this._gbifAggregateLayer && this._map.hasLayer(this._gbifAggregateLayer)) {
					this._map.removeLayer(this._gbifAggregateLayer);
				}

				this._clearMarkers();
				Map.prototype.addMarkers.call(this, data, null, null, {cluster: true});
			},

			openGBIFRecordPopup: function (data, latlng, options) {
				openGBIFRecordPopup(this._map, data, latlng, options);
			},

			openGBIFMessagePopup: function (latlng, title, message) {
				openSimpleMapPopup(this._map, latlng, title, message);
			},

			getBounds: function () {
				return this._map.getBounds();
			},

			getZoom: function () {
				return this._map.getZoom();
			},

			clearGBIFTiles: function() {
				if (this._gbifTileLayer && this._map) {
					this._map.removeLayer(this._gbifTileLayer);
				}
				this._gbifTileLayer = null;
				this._stopGBIFAggregateTiles();
				this._gbifTileErrorShown = false;
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

			_scheduleGBIFAggregateUpdate: function () {
				if (!this._gbifAggregateState || !this._gbifAggregateState.visible) {
					return;
				}

				if (this._gbifAggregateLoadTimer) {
					clearTimeout(this._gbifAggregateLoadTimer);
				}

				this._gbifAggregateLoadTimer = setTimeout(function () {
					this._gbifAggregateLoadTimer = null;
					this._loadGBIFAggregateTiles();
				}.bind(this), 80);
			},

			_notifyGBIFViewportChange: function () {
				var callbacks = this._gbifAggregateState && this._gbifAggregateState.callbacks;

				if (!callbacks || !angular.isFunction(callbacks.onViewportChange)) {
					return;
				}

				var bounds = this._map.getBounds();
				var zoom = this._map.getZoom();
				$rootScope.$evalAsync(function () {
					callbacks.onViewportChange(bounds, zoom);
				});
			},

			_scheduleGBIFViewportChange: function () {
				if (!this._gbifAggregateState) {
					return;
				}

				if (this._gbifViewportNotifyTimer) {
					clearTimeout(this._gbifViewportNotifyTimer);
				}

				this._gbifViewportNotifyTimer = setTimeout(function () {
					this._gbifViewportNotifyTimer = null;
					this._notifyGBIFViewportChange();
				}.bind(this), 120);
			},

			_loadGBIFAggregateTiles: function () {
				if (!this._gbifAggregateState || !this._gbifAggregateState.visible || !this._gbifAggregateLayer) {
					return;
				}

				if (!window.Pbf || !window.VectorTile || !window.fetch) {
					this._handleGBIFTileError();
					return;
				}

				var state = this._gbifAggregateState;
				var loadId = ++state.loadId;
				var tileZoom = getAggregateTileZoom(this._map);
				var tileCoords = getVisibleTileCoords(this._map, tileZoom);
				var _this = this;

				this._gbifAggregateLayer.clearLayers();

				angular.forEach(tileCoords, function (coords) {
					var url = L.Util.template(state.url, coords);

					fetch(url)
						.then(function (response) {
							if (response.status === 204) {
								return null;
							}
							if (!response.ok) {
								throw new Error('GBIF tile request failed with status ' + response.status);
							}
							return response.arrayBuffer();
						})
						.then(function (buffer) {
							if (!buffer || loadId !== state.loadId || !state.visible || !_this._gbifAggregateLayer) {
								return;
							}
							addGBIFAggregateMarkersFromTile(buffer, coords, _this, state);
						})
						.catch(function () {
							_this._handleGBIFTileError();
						});
				});
			},

			_handleGBIFTileError: function () {
				var callbacks = this._gbifAggregateState && this._gbifAggregateState.callbacks;

				if (this._gbifTileErrorShown) {
					return;
				}

				this._gbifTileErrorShown = true;
				if (callbacks && angular.isFunction(callbacks.onTileError)) {
					$rootScope.$evalAsync(function () {
						callbacks.onTileError();
					});
				}
			},

			_stopGBIFAggregateTiles: function () {
				if (this._gbifAggregateLoadTimer) {
					clearTimeout(this._gbifAggregateLoadTimer);
					this._gbifAggregateLoadTimer = null;
				}
				if (this._gbifViewportNotifyTimer) {
					clearTimeout(this._gbifViewportNotifyTimer);
					this._gbifViewportNotifyTimer = null;
				}
				if (this._gbifAggregateMoveHandler && this._map) {
					this._map.off('moveend zoomend', this._gbifAggregateMoveHandler);
				}
				this._gbifAggregateMoveHandler = null;

				if (this._gbifAggregateLayer && this._map && this._map.hasLayer(this._gbifAggregateLayer)) {
					this._map.removeLayer(this._gbifAggregateLayer);
				}
				if (this._gbifAggregateLayer) {
					this._gbifAggregateLayer.clearLayers();
				}
				if (this._gbifAggregateState) {
					this._gbifAggregateState.loadId++;
				}
				this._gbifAggregateLayer = null;
				this._gbifAggregateState = null;
			},

			_clearMap: function () {
				this._clearMarkers();
				this.clearGBIFTiles();
			},

			_clearMarkers: function () {
				if (this._clusterLayer) {
					this._clusterLayer.clearLayers();
					if (this._map && this._map.hasLayer(this._clusterLayer)) {
						this._map.removeLayer(this._clusterLayer);
					}
				}
				angular.forEach(this._markers, function (markerLayer) {
					if (this._map && this._map.hasLayer(markerLayer)) {
						this._map.removeLayer(markerLayer);
					}
				}, this);
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

		function buildGBIFTileState(searchRequest) {
			var SAFE_TILE_URL_LENGTH = 6000;
			var exactQuery = stripWildcardQueryParam(searchRequest.tileQueryExact || searchRequest.queryString || '');
			var boundsQuery = stripWildcardQueryParam(searchRequest.tileQueryBounds || '');
			var exactUrl = buildGBIFTileUrl(exactQuery);
			var usedBoundsFallback = exactQuery && exactUrl.length > SAFE_TILE_URL_LENGTH && boundsQuery;
			var tileQuery = usedBoundsFallback ? boundsQuery : exactQuery;

			return {
				usedBoundsFallback: !!usedBoundsFallback,
				url: buildGBIFTileUrl(tileQuery)
			};
		}

		function buildGBIFTileUrl(queryString) {
			var url = 'https://api.gbif.org/v2/map/occurrence/adhoc/{z}/{x}/{y}.mvt';
			var params = [
				'srs=EPSG%3A3857',
				'mode=GEO_CENTROID'
			];

			if (queryString) {
				params.push(queryString);
			}

			return url + '?' + params.join('&');
		}

		function stripWildcardQueryParam(queryString) {
			if (!queryString) {
				return '';
			}

			return queryString.split('&').filter(function (part) {
				return part !== 'q=*' && part !== 'q=%2A' && part !== 'q=%2a';
			}).join('&');
		}

		function getAggregateTileZoom(map) {
			var zoom = Math.floor(map.getZoom());
			return Math.max(0, Math.min(16, zoom));
		}

		function getVisibleTileCoords(map, tileZoom) {
			var TILE_SIZE = 256;
			var MAX_VISIBLE_TILES = 80;
			var scale = Math.pow(2, tileZoom);
			var bounds = map.getBounds();
			var northWest = map.project(bounds.getNorthWest(), tileZoom).divideBy(TILE_SIZE).floor();
			var southEast = map.project(bounds.getSouthEast(), tileZoom).divideBy(TILE_SIZE).floor();
			var coords = [];
			var seen = {};

			if (southEast.x < northWest.x) {
				southEast.x += scale;
			}

			for (var x = northWest.x; x <= southEast.x; x++) {
				for (var y = northWest.y; y <= southEast.y; y++) {
					if (y < 0 || y >= scale) {
						continue;
					}

					var wrappedX = wrapTileX(x, scale);
					var key = wrappedX + ':' + y + ':' + tileZoom;
					if (seen[key]) {
						continue;
					}
					seen[key] = true;

					coords.push({
						x: wrappedX,
						y: y,
						z: tileZoom
					});

					if (coords.length >= MAX_VISIBLE_TILES) {
						return coords;
					}
				}
			}

			return coords;
		}

		function wrapTileX(x, scale) {
			return ((x % scale) + scale) % scale;
		}

		function addGBIFAggregateMarkersFromTile(buffer, coords, mapInstance, state) {
			var tile = new window.VectorTile(new window.Pbf(buffer));
			var layer = tile.layers.occurrence || firstTileLayer(tile.layers);
			var markers = [];

			if (!layer) {
				return;
			}

			for (var i = 0; i < layer.length; i++) {
				var feature = layer.feature(i);
				var point = getFirstTilePoint(feature.loadGeometry());
				var tileBounds = tileCoordsToBounds(coords);

				if (!point) {
					continue;
				}

				markers.push(createGBIFAggregateMarker(
					tilePointToLatLng(point, coords, layer.extent || 4096),
					getAggregateTotal(feature.properties),
					mapInstance,
					state,
					tileBounds
				));
			}

			if (markers.length && mapInstance._gbifAggregateLayer) {
				mapInstance._gbifAggregateLayer.addLayers(markers);
			}
		}

		function firstTileLayer(layers) {
			for (var key in layers) {
				if (layers.hasOwnProperty(key)) {
					return layers[key];
				}
			}

			return null;
		}

		function getFirstTilePoint(geometry) {
			if (!geometry || !geometry.length) {
				return null;
			}

			if (typeof geometry[0].x === 'number' && typeof geometry[0].y === 'number') {
				return geometry[0];
			}

			if (geometry[0] && geometry[0].length && typeof geometry[0][0].x === 'number' && typeof geometry[0][0].y === 'number') {
				return geometry[0][0];
			}

			return null;
		}

		function getAggregateTotal(properties) {
			var total = Number((properties || {}).total || (properties || {}).TOTAL || (properties || {}).count || 1);
			return isFinite(total) && total > 0 ? total : 1;
		}

		function tilePointToLatLng(point, coords, extent) {
			var scale = Math.pow(2, coords.z);
			var x = (coords.x + point.x / extent) / scale;
			var y = (coords.y + point.y / extent) / scale;
			var lng = x * 360 - 180;
			var latRadians = Math.atan(Math.sinh(Math.PI * (1 - 2 * y)));

			return L.latLng(latRadians * 180 / Math.PI, lng);
		}

		function tileCoordsToBounds(coords) {
			var northWest = tileXYToLatLng(coords.x, coords.y, coords.z);
			var southEast = tileXYToLatLng(coords.x + 1, coords.y + 1, coords.z);

			return L.latLngBounds(southEast, northWest);
		}

		function tileXYToLatLng(x, y, z) {
			var scale = Math.pow(2, z);
			var lng = (x / scale) * 360 - 180;
			var latRadians = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / scale)));

			return L.latLng(latRadians * 180 / Math.PI, lng);
		}

		function createGBIFAggregateMarker(latlng, total, mapInstance, state, bounds) {
			var size = getAggregateMarkerSize(total);
			var label = formatAggregateCount(total);
			var marker = L.marker(latlng, {
				icon: L.divIcon({
					className: 'gbif-aggregate-marker gbif-aggregate-marker-' + getAggregateMarkerBucket(total),
					html: '<span>' + label + '</span>',
					iconSize: [size, size],
					iconAnchor: [size / 2, size / 2]
				}),
				keyboard: true,
				riseOnHover: true,
				title: label + ' GBIF occurrence records. Click to inspect records.'
			});

			marker.gbifAggregateTotal = total;
			marker.gbifAggregateBounds = bounds;
			marker.on('click', function () {
				var targetZoom = getAggregateClickZoom(mapInstance._map);
				mapInstance._map.setView(latlng, targetZoom);
				openGBIFAggregatePopup(mapInstance._map, latlng, total, {
					loading: !!(state.callbacks && angular.isFunction(state.callbacks.onAggregateClick))
				});

				if (state.callbacks && angular.isFunction(state.callbacks.onAggregateClick)) {
					$rootScope.$evalAsync(function () {
						state.callbacks.onAggregateClick({
							bounds: bounds,
							latlng: latlng,
							total: total,
							zoom: targetZoom
						});
					});
				}
			});

			return marker;
		}

		function openGBIFAggregatePopup(map, latlng, total, options) {
			var message = options && options.loading ? 'Loading records for this map area...' : 'Zoom in to load exact occurrence points.';

			L.popup({
				className: 'query-map-popup gbif-aggregate-popup',
				maxWidth: 260
			})
				.setLatLng(latlng)
				.setContent(
					'<div class="gbif-aggregate-popup-content">' +
					'<strong>GBIF aggregate</strong><br>' +
					formatAggregateCount(total) + ' occurrence records in this map area.<br>' +
					message +
					'</div>'
				)
				.openOn(map);
		}

		function createGBIFAggregateClusterIcon(cluster) {
			var total = getAggregateClusterTotal(cluster);
			var size = getAggregateMarkerSize(total) + 4;

			return L.divIcon({
				className: 'gbif-aggregate-marker gbif-aggregate-cluster gbif-aggregate-marker-' + getAggregateMarkerBucket(total),
				html: '<span>' + formatAggregateCount(total) + '</span>',
				iconSize: [size, size],
				iconAnchor: [size / 2, size / 2]
			});
		}

		function getAggregateClusterTotal(cluster) {
			var total = 0;

			angular.forEach(cluster.getAllChildMarkers(), function (marker) {
				total += Number(marker.gbifAggregateTotal) || 0;
			});

			return total;
		}

		function getAggregateClusterBounds(cluster) {
			var bounds = null;

			angular.forEach(cluster.getAllChildMarkers(), function (marker) {
				var markerBounds = marker.gbifAggregateBounds;

				if (markerBounds && (!markerBounds.isValid || markerBounds.isValid())) {
					bounds = extendBounds(bounds, markerBounds);
					return;
				}

				if (marker.getLatLng) {
					bounds = extendBounds(bounds, L.latLngBounds(marker.getLatLng(), marker.getLatLng()));
				}
			});

			return bounds || L.latLngBounds(cluster.getLatLng(), cluster.getLatLng());
		}

		function extendBounds(bounds, boundsToAdd) {
			if (!bounds) {
				return L.latLngBounds(boundsToAdd.getSouthWest(), boundsToAdd.getNorthEast());
			}

			return bounds.extend(boundsToAdd.getSouthWest()).extend(boundsToAdd.getNorthEast());
		}

		function getAggregateClickZoom(map) {
			var currentZoom = map.getZoom();
			var maxZoom = map.getMaxZoom() || 18;
			var zoomStep = currentZoom < 8 ? 3 : 2;

			return Math.min(16, maxZoom, Math.max(Math.floor(currentZoom) + 1, Math.floor(currentZoom) + zoomStep));
		}

		function getAggregateMarkerSize(total) {
			if (total >= 1000000) {
				return 58;
			}
			if (total >= 100000) {
				return 52;
			}
			if (total >= 10000) {
				return 46;
			}
			if (total >= 1000) {
				return 40;
			}

			return 34;
		}

		function getAggregateMarkerBucket(total) {
			if (total >= 100000) {
				return 'large';
			}
			if (total >= 1000) {
				return 'medium';
			}

			return 'small';
		}

		function formatAggregateCount(total) {
			if (total >= 1000000) {
				return formatCompactNumber(total, 1000000, 'M');
			}
			if (total >= 1000) {
				return formatCompactNumber(total, 1000, 'k');
			}

			return String(total);
		}

		function formatCompactNumber(value, divisor, suffix) {
			var rounded = Math.round((value / divisor) * 10) / 10;
			var text = rounded % 1 === 0 ? String(Math.round(rounded)) : String(rounded);

			return text + suffix;
		}

		function openGBIFRecordPopup(map, data, latlng, options) {
			var records = data || [];
			var popupOptions = options || {};
			var displayLimit = Math.min(records.length, Number(popupOptions.resultLimit) || records.length);
			var htmlItems = [];

			for (var i = 0; i < displayLimit; i++) {
				htmlItems.push(buildGBIFRecordPopupContent(records[i]));
			}

			openRecordHtmlPopup(map, htmlItems, latlng, {
				totalElements: Number(popupOptions.totalElements) || records.length,
				title: popupOptions.title || 'GBIF records',
				emptyMessage: popupOptions.emptyMessage || 'No exact records found for this map area.'
			});
		}

		function openRecordHtmlPopup(map, htmlItems, latlng, options) {
			var popupOptions = options || {};
			var items = htmlItems || [];
			var totalElements = Number(popupOptions.totalElements) || items.length;
			var popupContentElement = L.DomUtil.create('div', 'map-popup-content');

			if (!items.length) {
				openSimpleMapPopup(map, latlng, popupOptions.title || 'Occurrence records', popupOptions.emptyMessage || 'No records found.');
				return;
			}

			angular.forEach(items, function (html) {
				popupContentElement.innerHTML += html;
			});

			var elements = $(popupContentElement).children(".query");
			var counter = 0;

			elements.each(function (index) {
				if (index !== 0) {
					$(this).hide();
				}
			});

			var userInfo = document.createElement('div');
			userInfo.setAttribute('class', 'map-popup-pager');

			var prev = document.createElement('a');
			prev.appendChild(document.createTextNode('Prev'));
			prev.setAttribute('href', '#');
			prev.setAttribute('class', 'map-popup-prev');

			var next = document.createElement('a');
			next.appendChild(document.createTextNode('Next'));
			next.setAttribute('href', '#');
			next.setAttribute('class', 'map-popup-next');

			if (elements.length > 1) {
				userInfo.appendChild(prev);
				userInfo.appendChild(next);
			}

			var text = document.createElement('div');
			text.setAttribute('class', 'map-popup-count');
			userInfo.appendChild(text);

			if (totalElements > elements.length) {
				var limited = document.createElement('p');
				limited.appendChild(document.createTextNode('Showing first ' + elements.length + ' of ' + totalElements + ' records from this cluster'));
				limited.setAttribute('class', 'map-popup-limit');
				userInfo.appendChild(limited);
			}

			popupContentElement.appendChild(userInfo);

			$(next).click(function () {
				elements.eq(counter).hide();
				counter = counter === elements.length - 1 ? 0 : counter + 1;
				elements.eq(counter).show();
				displayChange();
				return false;
			});

			$(prev).click(function () {
				elements.eq(counter).hide();
				counter = counter === 0 ? elements.length - 1 : counter - 1;
				elements.eq(counter).show();
				displayChange();
				return false;
			});

			function displayChange() {
				text.innerHTML = 'Showing result ' + (counter + 1) + ' of ' + elements.length;
			}
			displayChange();

			var leafletPopupOptions = getRecordPopupOptions(map);
			applyRecordPopupBounds(popupContentElement, leafletPopupOptions);

			L.popup(leafletPopupOptions)
				.setLatLng(latlng)
				.setContent(popupContentElement)
				.openOn(map);
		}

		function getRecordPopupOptions(map) {
			var preferredWidth = 390;
			var preferredHeight = 390;
			var maxWidth = preferredWidth;
			var maxHeight = preferredHeight;
			var size;

			if (map && angular.isFunction(map.getSize)) {
				size = map.getSize();
				if (size) {
					maxWidth = Math.min(preferredWidth, Math.max(80, size.x - 44), size.x);
					maxHeight = Math.min(preferredHeight, Math.max(100, size.y - 58), size.y);
				}
			}

			return {
				autoPan: true,
				autoPanPadding: [20, 20],
				className: 'query-map-popup',
				keepInView: true,
				maxHeight: Math.floor(maxHeight),
				maxWidth: Math.floor(maxWidth)
			};
		}

		function applyRecordPopupBounds(contentElement, popupOptions) {
			var contentWidth = Math.max(0, (popupOptions.maxWidth || 390) - 30);
			var contentHeight = Math.max(0, (popupOptions.maxHeight || 390) - 20);
			var records = contentElement && contentElement.querySelectorAll ? contentElement.querySelectorAll('.gbif-record-popup') : [];

			if (!contentElement) {
				return;
			}

			contentElement.style.maxWidth = contentWidth + 'px';
			contentElement.style.maxHeight = contentHeight + 'px';
			contentElement.style.overflow = 'auto';

			angular.forEach(records, function (record) {
				record.style.width = contentWidth + 'px';
				record.style.maxWidth = '100%';
			});
		}

		function openSimpleMapPopup(map, latlng, title, message) {
			L.popup({
				className: 'query-map-popup gbif-aggregate-popup',
				maxWidth: 300
			})
				.setLatLng(latlng)
				.setContent(
					'<div class="gbif-aggregate-popup-content">' +
					'<strong>' + title + '</strong><br>' +
					message +
					'</div>'
				)
				.openOn(map);
		}

		function buildGBIFRecordPopupContent(resource) {
			resource = resource || {};
			var occurrenceKey = resource.key || resource.gbifID || '';
			var sourceUrl = getGBIFSourceUrl(resource);
			var mediaItems = getGBIFImageMedia(resource);
			var retString = "<div class='query gbif-record-popup'>";
			retString += "<div class='gbif-record-heading'>";
			retString += "<div class='gbif-record-name'>" + safePopupValue(resource.scientificName || resource.species || resource.taxonID) + "</div>";
			retString += "<div class='gbif-record-source'>" + safePopupValue(resource.institutionCode || resource.datasetName || 'GBIF occurrence') + "</div>";
			retString += "</div>";
			retString += buildGBIFMediaHtml(mediaItems, resource);
			retString += "<dl class='gbif-record-fields'>";
			retString += buildGBIFFieldHtml('Basis of Record', resource.basisOfRecord);
			retString += buildGBIFFieldHtml('Event Date', resource.eventDate);
			retString += buildGBIFFieldHtml('Recorded By', resource.recordedBy);
			retString += buildGBIFFieldHtml('Locality', resource.locality || resource.verbatimLocality);
			retString += buildGBIFFieldHtml('Dataset', resource.datasetName);
			retString += "</dl>";
			retString += "<div class='gbif-record-links'>";
			if (occurrenceKey) {
				retString += "<a href='https://www.gbif.org/occurrence/" + escapeAttribute(occurrenceKey) + "' target='_blank' rel='noopener noreferrer'>GBIF occurrence</a>";
			}
			if (sourceUrl) {
				retString += "<a href='" + escapeAttribute(sourceUrl) + "' target='_blank' rel='noopener noreferrer'>Source record</a>";
			}
			retString += "</div>";
			retString += "</div>";
			return retString;
		}

		function buildGBIFFieldHtml(label, value) {
			if (value === undefined || value === null || value === '') {
				return '';
			}

			return '<dt>' + escapeHtml(label) + '</dt><dd>' + safePopupValue(value) + '</dd>';
		}

		function safePopupValue(value) {
			return value === undefined || value === null || value === '' ? 'Unknown' : escapeHtml(value);
		}

		function buildGBIFMediaHtml(mediaItems, resource) {
			if (!mediaItems.length) {
				return '';
			}

			var title = resource.scientificName || resource.species || 'GBIF occurrence image';
			var primary = mediaItems[0];
			var html = "<div class='gbif-record-media'>";

			html += "<figure class='gbif-record-primary-media'>";
			html += buildGBIFMediaAnchor(primary, title, 'gbif-record-primary-link', primary.previewUrl || primary.url);
			html += buildGBIFMediaCaption(primary);
			html += "</figure>";
			html += "</div>";
			return html;
		}

		function buildGBIFMediaAnchor(media, title, className, imageUrl) {
			var linkUrl = media.pageUrl || media.url || media.previewUrl || imageUrl;
			var imgSrc = imageUrl || media.previewUrl || media.url || media.thumbnailUrl;

			if (!linkUrl || !imgSrc) {
				return '';
			}

			return "<a class='" + escapeAttribute(className) + "' href='" + escapeAttribute(linkUrl) + "' target='_blank' rel='noopener noreferrer' title='Open image'>" +
				"<img src='" + escapeAttribute(imgSrc) + "' alt='" + escapeAttribute(title) + "' loading='lazy'>" +
				"</a>";
		}

		function buildGBIFMediaCaption(media) {
			var parts = [];

			if (media.creator) {
				parts.push(escapeHtml(media.creator));
			}
			if (media.license) {
				parts.push("<a href='" + escapeAttribute(media.license) + "' target='_blank' rel='noopener noreferrer'>License</a>");
			}

			if (!parts.length) {
				return '';
			}

			return "<figcaption>" + parts.join(' &middot; ') + "</figcaption>";
		}

		function getGBIFSourceUrl(resource) {
			var sourceUrl = sanitizeMediaUrl(resource && resource.references);

			if (sourceUrl) {
				return sourceUrl;
			}

			return sanitizeMediaUrl(resource && resource.occurrenceID);
		}

		function addMultimediaExtensionItems(items, seen, records, extensionType) {
			angular.forEach(records || [], function (media) {
				var normalized = {
					type: media['http://purl.org/dc/terms/type'],
					format: media['http://purl.org/dc/terms/format'],
					identifier: media['http://purl.org/dc/terms/identifier'],
					references: media['http://purl.org/dc/terms/references'],
					title: media['http://purl.org/dc/terms/title'],
					description: media['http://purl.org/dc/terms/description'],
					creator: media['http://purl.org/dc/terms/creator'] || media['http://purl.org/dc/elements/1.1/creator'],
					rightsHolder: media['http://purl.org/dc/terms/rightsHolder'] || media['http://ns.adobe.com/xap/1.0/rights/Owner'],
					license: media['http://purl.org/dc/terms/license'] || media['http://ns.adobe.com/xap/1.0/rights/WebStatement'],
					accessURI: media['http://rs.tdwg.org/ac/terms/accessURI'],
					goodQualityAccessURI: media['http://rs.tdwg.org/ac/terms/goodQualityAccessURI'],
					thumbnail: media['http://rs.tdwg.org/ac/terms/thumbnailAccessURI']
				};

				if (extensionType === 'audubonCore' && !normalized.type) {
					normalized.type = media['http://rs.tdwg.org/ac/terms/subtype'];
				}

				addMediaItem(items, seen, normalized);
			});
		}

		function getGBIFImageMedia(resource) {
			var items = [];
			var seen = {};

			var extensions = (resource && resource.extensions) || {};
			addMultimediaExtensionItems(items, seen, extensions['http://rs.gbif.org/terms/1.0/Multimedia'], 'gbif');
			addMultimediaExtensionItems(items, seen, extensions['http://rs.tdwg.org/ac/terms/Multimedia'], 'audubonCore');

			angular.forEach((resource && resource.media) || [], function (media) {
				addMediaItem(items, seen, media);
			});

			angular.forEach(parseAssociatedMedia(resource && resource.associatedMedia), function (url) {
				addMediaItem(items, seen, {
					type: 'StillImage',
					identifier: url
				});
			});

			return items;
		}

		function addMediaItem(items, seen, media) {
			var urls = getMediaUrls(media);
			var url = urls.url || urls.previewUrl || urls.thumbnailUrl;
			var seenKey = urls.dedupeKey || url;

			if (!url || seen[seenKey] || !isStillImageMedia(media, url)) {
				return;
			}

			seen[seenKey] = true;
			seen[url] = true;
			items.push({
				url: url,
				previewUrl: urls.previewUrl || url,
				thumbnailUrl: urls.thumbnailUrl || urls.previewUrl || url,
				pageUrl: urls.pageUrl,
				title: media.title,
				creator: media.creator || media.rightsHolder,
				license: media.license
			});
		}

		function getMediaUrls(media) {
			var identifier = sanitizeMediaUrl(media && media.identifier);
			var references = sanitizeMediaUrl(media && media.references);
			var accessURI = sanitizeMediaUrl(media && media.accessURI);
			var goodQualityAccessURI = sanitizeMediaUrl(media && media.goodQualityAccessURI);
			var thumbnail = sanitizeMediaUrl(media && media.thumbnail);
			var imageUrl = firstImageUrl([
				goodQualityAccessURI,
				accessURI,
				identifier,
				thumbnail,
				references
			]);
			var previewUrl = isImageUrl(goodQualityAccessURI) ? goodQualityAccessURI : getPreviewImageUrl(imageUrl);
			var thumbnailUrl = isImageUrl(thumbnail) ? thumbnail : getThumbnailImageUrl(imageUrl);

			return {
				url: imageUrl,
				previewUrl: previewUrl,
				thumbnailUrl: thumbnailUrl,
				pageUrl: firstPageUrl([references, identifier, accessURI]),
				dedupeKey: getMediaDedupeKey([identifier, accessURI, goodQualityAccessURI, thumbnail, references], imageUrl)
			};
		}

		function getMediaDedupeKey(urls, fallbackUrl) {
			for (var i = 0; i < urls.length; i++) {
				if (isImageUrl(urls[i])) {
					return getInaturalistMediaIdentity(urls[i]) || urls[i];
				}
			}

			for (var j = 0; j < urls.length; j++) {
				if (urls[j]) {
					return getInaturalistMediaIdentity(urls[j]) || urls[j];
				}
			}

			return getInaturalistMediaIdentity(fallbackUrl) || fallbackUrl || '';
		}

		function getInaturalistMediaIdentity(url) {
			var text = sanitizeMediaUrl(url);
			var match;

			if (!text || text.toLowerCase().indexOf('inaturalist') === -1) {
				return '';
			}

			match = text.match(/^(https?:\/\/[^?#]*\/photos\/\d+)(?:\/|$)/i);
			return match ? match[1].toLowerCase() : '';
		}

		function firstImageUrl(urls) {
			for (var i = 0; i < urls.length; i++) {
				if (isImageUrl(urls[i])) {
					return urls[i];
				}
			}

			return '';
		}

		function firstPageUrl(urls) {
			for (var i = 0; i < urls.length; i++) {
				if (urls[i] && !isImageUrl(urls[i])) {
					return urls[i];
				}
			}

			return '';
		}

		function getPreviewImageUrl(url) {
			return getInaturalistImageVariant(url, 'medium') || url;
		}

		function getThumbnailImageUrl(url) {
			return getInaturalistImageVariant(url, 'thumb') || getPreviewImageUrl(url);
		}

		function getInaturalistImageVariant(url, variant) {
			var text = sanitizeMediaUrl(url);
			var match;

			if (!text || text.toLowerCase().indexOf('inaturalist') === -1) {
				return '';
			}

			match = text.match(/^(https?:\/\/[^?#]*\/photos\/\d+\/)([^\/?#]+?)(\.(?:jpe?g|png|gif|webp))([?#].*)?$/i);
			if (!match || !/^(original|large|medium|small|square|thumb)$/i.test(match[2])) {
				return '';
			}

			return match[1] + variant + match[3] + (match[4] || '');
		}

		function isStillImageMedia(media, url) {
			var type = String((media && media.type) || '').toLowerCase();
			var format = String((media && media.format) || '').toLowerCase();

			return type === 'stillimage' ||
				type === 'still image' ||
				type === 'image' ||
				format.indexOf('image/') === 0 ||
				isImageUrl(url);
		}

		function parseAssociatedMedia(value) {
			if (!value) {
				return [];
			}

			return String(value).split('|').map(function (url) {
				return url.trim();
			}).filter(Boolean);
		}

		function sanitizeMediaUrl(url) {
			var text = String(url || '').trim();

			if (/^https?:\/\//i.test(text)) {
				return text;
			}
			if (/^\/\//.test(text)) {
				return 'https:' + text;
			}

			return '';
		}

		function isImageUrl(url) {
			return /\.(jpg|jpeg|png|gif|webp)(\?|#|$)/i.test(String(url || ''));
		}

		function escapeHtml(value) {
			return String(value).replace(/[&<>"']/g, function (character) {
				return {
					'&': '&amp;',
					'<': '&lt;',
					'>': '&gt;',
					'"': '&quot;',
					"'": '&#39;'
				}[character];
			});
		}

		function escapeAttribute(value) {
			return escapeHtml(value);
		}
	}
})();
