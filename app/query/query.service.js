(function () {
    'use strict';

    angular.module('map.query')
        .factory('queryService', queryService);

    queryService.$inject = ['$http', 'alerts'];

    function queryService($http, alerts) {

        var queryService = {
            queryJson: queryJson,
            countryCodes: countryCodes,
            basisOfRecords: basisOfRecords
        };

        return queryService;

        function queryJson(query, page) {
            alerts.removeTmp();
            return $http.get("http://api.gbif.org/v1/occurrence/search?limit=300" + "&offset=" + 300 * page + "&" + query)
               .then(queryJsonComplete);

            function queryJsonComplete(response) {
                var results = {
                    size: 0,
                    totalElements: 0,
                    data: []
                };
                if (response.data) {
                    results.size = response.data.limit;
                    results.totalElements = response.data.count;
                    if (results.totalElements === 0) {
                        alerts.info("No results found.")
                    }
                    results.data = response.data.results;
                }
                return results;
            }
        }

        function basisOfRecords() {
            return $http.get('http://api.gbif.org/v1/enumeration/basic/BasisOfRecord')
                .then(function (response) {
                    var records = [];

                    angular.forEach(response.data, function (c) {
                        records.push({
                            'name': c,
                            'record': c
                        });
                    });

                    return records;
                });
        }
        function countryCodes() {
            return $http.get('http://api.gbif.org/v1/enumeration/country')
                .then(function (response) {
                    var codes = [];

                    angular.forEach(response.data, function (c) {
                        codes.push({
                            'name': c.title,
                            'code': c.iso2
                        });
                    });

                    return codes;
                });
        }

    }
    })();
