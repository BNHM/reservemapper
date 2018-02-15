(function () {
    'use strict';

    angular.module('map.query')
        .factory('GBIFMapperService', mapperService);

    mapperService.$inject = ['queryService', 'queryMap', 'queryResults', 'alerts', '$q'];

    function mapperService(queryService, queryMap, queryResults, alerts, $q) {

	var maxResults = 1000;
        var mapperService = {
            query: query
        };

        return mapperService;

        function query(query, page) {
            return _queryJson(query, page, true)
                .then(function(results) {
                    //var toFetch = (results.totalElements <= 1000) ? results.totalElements : 1000; //200k is max fetch depth
                    var toFetch;
		    if (results.totalElements <= maxResults) {
		    	toFetch = results.totalElements;
		    } else {
		    	toFetch = maxResults
		    }

		    // results.size is the total elements returned in this batch, typically 300
                    if (results.size < toFetch) {
                        var numRequests = Math.floor(toFetch / results.size);

                        var promises = [];

                        for (var i = 0; i < numRequests; i++) {
                            promises.push(_queryJson(query, i + 1))
                        }

                        alerts.info('Loading more results...');

                        if (toFetch >= 1000) {
                            alerts.info('result set is limited to ' + maxResults +', narrow your search to view all results');
                        }

			// when we are done loading all promises then remove the loading alert and
			// safely display download button
                        $q.all(promises)
                            .finally(function() {
                                var a = alerts.getAlerts();

                                for (var i = 0; i < a.length; i++) {
                                    if (a[i].msg === 'Loading more results...') {
                                        alerts.remove(a[i]);
					queryResults.isSet = true;
                                        break;
                                    }
                                }
                            });
                    } 
		    // in case we don't need to send multiple requests, we can just
		    // indicate we're done
		    else {
			queryResults.isSet = true;
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
