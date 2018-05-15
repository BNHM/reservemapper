(function () {
	'use strict';

	angular.module('map.query')
		.factory('queryMap', queryMap)
		.factory('photoViewer', function() {
			return {
				clear: function(){
					document.getElementById("popupContent").innerHTML = ""
					return true;
				}
			};
		})

	queryMap.$inject = ['Map'];

	function queryMap(Map) {
		var _this = this
		var popupContent; 
		popupContent = function() {
			if (_this.photoOption) {
				popupContent = function (resource, classNum) {
					//push object containing new scientific name into observations array, if observations array is empty
					if (resource.observations[0] == undefined){
						resource.observations.push({scientific_name : 'undefined', url : 'unknown'})
					} 
					var retString = "<div class='photo " + classNum + "'>"
					retString += "<a href='" + resource.media_url+ "' target='_blank'><img src='" + resource.media_url + "'></a>";
					retString += "<ul>"	
					retString += "<br><strong><i>" + resource.observations[0].scientific_name + "</strong></i>" 
					retString += "<br><a href='" + resource.remote_resource + "' target='_blank'>Photo Courtesy of CalPhotos</a>" 
					retString += "<br>license: "+ resource.license 
					retString += "<br>photo taken on " + resource.begin_date 
					if (resource.authors )
						retString += "<br>by " + resource.authors 
					if (resource.locality)
						retString += "<br>at " + resource.locality
					retString += "</ul>"
					return retString;
				}

			} else {
				popupContent = function (resource) {
					return "<strong>institutionCode</strong>:  " + resource.institutionCode + "<br>" +
						"<strong>basisOfRecord</strong>:  " + resource.basisOfRecord + "<br>" +
						"<strong>eventDate</strong>:  " + resource.eventDate + "<br>" +
						"<strong>recordedBy</strong>:  " + resource.recordedBy + "<br>" +
						"<strong>ScientificName</strong>:  " + resource.scientificName + "<br>" +
						"<strong>Locality, Country</strong>:  " + resource.locality + ", " + resource.country + "<br>" +
						"<a href='http://www.gbif.org/occurrence/" + resource.key + "' target='_blank'>Occurrence details from GBIF site</a>";
				}
			}
		} 
		function QueryMap(latColumn, lngColumn) {
			Map.call(this, latColumn, lngColumn);
		}

		QueryMap.prototype = Object.create(Map.prototype);

		QueryMap.prototype.setPhoto = function (photoOption) {
			this._clearMap();
			var this1 = this
			this.photoOption = photoOption
			$('input[name=selector]').change(function(popupContent) {
				if (this.value == 'photos'){
					console.log('photos')
			//TODO: insert clusterLayer clusterclick function here
				
				} else if (this.value == 'query') { 
				 		console.log('query me')	
			//TODO: insert clusterLayer clusterclick function here	
				}
			})
		}

		QueryMap.prototype.setMarkers = function (data, zoomTo) {
			Map.prototype.setMarkers.call(this, data, popupContent, zoomTo);
		};

		QueryMap.prototype.addMarkers = function (data, zoomTo) {
			Map.prototype.addMarkers.call(this, data, popupContent, zoomTo);
		};
	
		return new QueryMap('decimalLatitude', 'decimalLongitude');
	}
})();
