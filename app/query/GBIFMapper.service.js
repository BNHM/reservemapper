(function () {
    'use strict';

    angular.module('map.query')
        .factory('GBIFMapperService', mapperService);

    mapperService.$inject = ['queryService', 'queryMap', 'queryResults', 'alerts', '$q'];

    function mapperService(queryService, queryMap, queryResults, alerts, $q) {

        var mapperService = {
            query: query
        };

        return mapperService;

        function query(query, page) {
            return _queryJson(query, page, true)
                .then(function(results) {
                    var toFetch = (results.totalElements <= 50000) ? results.totalElements : 50000; //200k is max fetch depth

                    if (results.size < toFetch) {
                        var numRequests = Math.floor(toFetch / results.size);

                        var promises = [];

                        for (var i = 0; i < numRequests; i++) {
                            promises.push(_queryJson(query, i + 1))
                        }

                        alerts.info('Loading more results...');

                        if (toFetch === 50000) {
                            alerts.warning('result set is limited to 50000, narrow your search to view all results');
                        }

                        $q.all(promises)
                            .finally(function() {
                                var a = alerts.getAlerts();

                                for (var i = 0; i < a.length; i++) {
                                    if (a[i].msg === 'Loading more results...') {
                                        alerts.remove(a[i]);
                                        break;
                                    }
                                }
                            });
                    }

                });


        }

        function _queryJson(query, page, resetMarkers) {
            return queryService.queryJson(query, page)
                .then(function (results) {
                    _mapResults(results, resetMarkers);

                    return results;
                }).catch(function(err) {
                    alerts.error('Failed to load some query results');
                    console.log('query-error:', err);
                    throw err;
                });
        }

        function _mapResults(results, resetMarkers) {
            queryResults.append(results);
            if (resetMarkers) {
                queryMap.setMarkers(results.data);
            } else {
                queryMap.addMarkers(results.data);
            }
        }
    }
})();
