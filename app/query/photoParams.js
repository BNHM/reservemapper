(function () {
    'use strict';

    angular.module('map.query')
        .factory('photoParams', photoParams);

    photoParams.$inject = ['PhotoBuilder'];

    function photoParams(PhotoBuilder) {
        var defaultParams = {
            bbox: null,
	    bounds: null
        };

        var params = {
            build: buildPhotoQuery,
            clear: clear
        };

        activate();

        return params;

        function activate() {
            clear();
        }

        function buildPhotoQuery() {
            var builder = new PhotoBuilder();

            if (params.bounds) {
                var ne = params.bounds.getNorthEast();
                var sw = params.bounds.getSouthWest();

                builder.add("bbox", sw.lng + "," + sw.lat + "," + ne.lng + "," + ne.lat);
            }

            return builder.build();

        }

        function clear() {
            angular.extend(params, defaultParams);
        }
    }

})();
