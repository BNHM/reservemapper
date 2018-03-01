(function () {
	'use strict';

	angular.module('map.query')
		.factory('queryMap', queryMap);

	queryMap.$inject = ['Map'];

	function queryMap(Map) {
		
		var popupContent;
		function QueryMap(latColumn, lngColumn) {
			Map.call(this, latColumn, lngColumn);
		}

		QueryMap.prototype = Object.create(Map.prototype);

		QueryMap.prototype.setPhoto = function (photoOption) {
			this.photoOption = photoOption
			// NOTE: this is a hack.  Ran into trouble using popup boxes so ended up having to wrap the marker events
			// in a call to a div tag.  Then, ran into more troubles trying to pass scope of the close command into the
			// map.map module and having that effectively switch the showPopup variable to off, which lived inside another
			// module.  
			var closeDiv = "<div style='float:right;' onclick='document.getElementById(\"popupContent\").innerHTML = \"\";'>X&nbsp;&nbsp;</div>"

			if (photoOption)
				popupContent = function (resource) {
					var retString = "<div style='float:left'>"
					retString += "<a href='" + resource.remote_resource + "' target='_blank'><img height=200 src='" + resource.media_url + "'></a>";
					retString += "</div><div style='float:left'>"
					if (resource.observations[0] != null)
						retString += "<strong><i>" + resource.observations[0].scientific_name + "</strong></i>" 
					retString += "<br><a href='" + resource.remote_resource + "' target='_blank'>Photo Courtesy of CalPhotos</a>" 
					retString += "<br>license: "+ resource.license 
					retString += "<br>photo taken on " + resource.begin_date + "</div>"
					return retString + closeDiv;
				};
			else
				popupContent = function (resource) {
					return "<strong>institutionCode</strong>:  " + resource.institutionCode + "<br>" +
						"<strong>basisOfRecord</strong>:  " + resource.basisOfRecord + "<br>" +
						"<strong>eventDate</strong>:  " + resource.eventDate + "<br>" +
						"<strong>recordedBy</strong>:  " + resource.recordedBy + "<br>" +
						"<strong>ScientificName</strong>:  " + resource.scientificName + "<br>" +
						"<strong>Locality, Country</strong>:  " + resource.locality + ", " + resource.country + "<br>" +
						"<a href='http://www.gbif.org/occurrence/" + resource.key + "' target='_blank'>Occurrence details from GBIF site</a>";
				};
		}

		QueryMap.prototype.setMarkers = function (data, zoomTo) {
			Map.prototype.setMarkers.call(this, data, popupContent, zoomTo);
		};

		QueryMap.prototype.addMarkers = function (data, zoomTo) {
			Map.prototype.addMarkers.call(this, data, popupContent, zoomTo);
		};

		return new QueryMap('decimalLatitude', 'decimalLongitude')
	}
})();
