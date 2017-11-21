(function () {
    'use strict';

    angular.module('map.query')
        .factory('queryMap', queryMap);

    queryMap.$inject = ['Map'];

    function queryMap(Map) {

        function QueryMap(latColumn, lngColumn) {
            Map.call(this, latColumn, lngColumn);
        }

        QueryMap.prototype = Object.create(Map.prototype);

        QueryMap.prototype.setMarkers = function (data, zoomTo) {
            Map.prototype.setMarkers.call(this, data, generatePopupContent, zoomTo);
        };

        QueryMap.prototype.addMarkers = function (data, zoomTo) {
            Map.prototype.addMarkers.call(this, data, generatePopupContent, zoomTo);
        };

        return new QueryMap('decimalLatitude', 'decimalLongitude');

        function generatePopupContent(resource) {
            return "<strong>institutionCode</strong>:  " + resource.institutionCode+ "<br>" +
		"<strong>basisOfRecord</strong>:  " + resource.basisOfRecord + "<br>" +
		"<strong>eventDate</strong>:  " + resource.eventDate + "<br>" +
		"<strong>recordedBy</strong>:  " + resource.recordedBy + "<br>" +
                "<strong>ScientificName</strong>:  " + resource.scientificName + "<br>" +
                "<strong>Locality, Country</strong>:  " + resource.locality + ", " + resource.country + "<br>" +
                "<a href='http://www.gbif.org/occurrence/" + resource.key + "' target='_blank'>Occurrence details from GBIF site</a>";
        }
    }
})();
