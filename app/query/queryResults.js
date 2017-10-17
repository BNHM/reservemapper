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
            update: update,
            append: append,
            clear: clear
        };

        return queryResults;

        function update(data) {
            angular.extend(queryResults, data);
            queryResults.isSet = true;
        }

        function append(data) {
            queryResults.isSet = true;
            queryResults.size += data.size;
            queryResults.data = queryResults.data.concat(data.data);

            if (!queryResults.totalElements) {
                queryResults.totalElements = data.totalElements;
            }
        }

        function clear() {
            queryResults.data = [];
            queryResults.isSet = false;
            queryResults.size = 0;
            queryResults.totalElements = 0;
        }
    }
})();
