(function () {
    'use strict';

    angular.module('map.query')
        .factory('photoMapperService', photoMapperService);

    photoMapperService.$inject = ['photoService', 'queryMap', 'queryResults', 'alerts', '$q'];

    function photoMapperService(photoService, queryMap, queryResults, alerts, $q) {

	// GBIF result-sets come in batches of 300, so we make maxResults some multiple of 300
	// in order to make the actual results returned match maxResults in cases where maxResults
	// is needed
	var maxResults = 15000;
        var photoMapperService = {
            query: query
        };

        return photoMapperService;

        function query(query, page) {
            return _queryJson(query, page, true)
                .then(function(results) {
		    if (results.totalElements <= maxResults) {
		    	queryResults.toFetch = results.totalElements;
		    } else {
		    	queryResults.toFetch = maxResults
		    }

		    // results.size is the total elements returned in this batch, typically 300
                    if (results.size < queryResults.toFetch) {
                        var numRequests = Math.floor(queryResults.toFetch / results.size);

                        var promises = [];

                        for (var i = 1; i < numRequests; i++) {
                            promises.push(_queryJson(query, i + 1))
                        }

                        alerts.info('Loading more results...');

                        if (queryResults.toFetch >= maxResults) {
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
            return photoService.queryJson(query, page)
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
	    //queryMap.setPhoto(true); 
            if (resetMarkers) {
                queryMap.setMarkers(results.data);
            } else {
                queryMap.addMarkers(results.data);
            }
        }
    }
})();
