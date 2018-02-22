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
	    if (photoOption) 
	        popupContent = function (resource) {
		    var retString = "<a href='" + resource.remote_resource + "' target='_blank'><img max-height=300 width=200 src='" + resource.media_url + "'></a>";
			if (resource.observations[0] != null)	
                        	retString += "<br><b><i>" + resource.observations[0].scientific_name +"</b></i>"
		    return retString;
		};
	    else 
	        popupContent = function (resource) {
            	    return "<strong>institutionCode</strong>:  " + resource.institutionCode+ "<br>" +
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
