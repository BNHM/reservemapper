(function () {
    'use strict';

    angular.module('map.query')
        .factory('queryResults', queryResults);

    queryResults.$inject = [];

    function queryResults() {

        var queryResults = {
            size: 0,
            totalElements: 0,
            data: [],
            isSet: false,
            querySource: null,
            isCompleteRecordSet: true,
            usingTileMap: false,
            mapUsesBoundsFallback: false,
            facets: {},
            searchRequest: null,
            sampleLimit: 0,
            drilldownLimit: 0,
            drilldownZoom: 0,
            update: update,
            append: append,
            toFetch: 0,
            clear: clear
        };

        return queryResults;

        function update(data) {
            angular.extend(queryResults, data);
        }

        function append(data) {
            //queryResults.isSet = true;
            var records = data.data || [];
            queryResults.size += records.length;
            queryResults.data = queryResults.data.concat(records);

            if (!queryResults.totalElements) {
                queryResults.totalElements = data.totalElements;
            }
        }

        function clear() {
            queryResults.data = [];
            queryResults.isSet = false;
            queryResults.size = 0;
            queryResults.totalElements = 0;
            queryResults.toFetch = 0;
            queryResults.querySource = null;
            queryResults.isCompleteRecordSet = true;
            queryResults.usingTileMap = false;
            queryResults.mapUsesBoundsFallback = false;
            queryResults.facets = {};
            queryResults.searchRequest = null;
            queryResults.sampleLimit = 0;
            queryResults.drilldownLimit = 0;
            queryResults.drilldownZoom = 0;
        }
    }
})();
