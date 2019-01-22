(function () {
    'use strict';

    angular.module('map.query')
        .factory('checklistParams', checklistParams);

    checklistParams.$inject = ['ChecklistBuilder'];

    function checklistParams(ChecklistBuilder) {
        var defaultParams = {
            bbox: null,
	    bounds: null
        };

        var params = {
            build: buildChecklistQuery,
            clear: clear
        };

        activate();

        return params;

        function activate() {
            clear();
        }

        function buildChecklistQuery() {
            var builder = new ChecklistBuilder();

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
