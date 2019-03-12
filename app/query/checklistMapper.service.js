(function () {
    'use strict';

    angular.module('map.query')
        .factory('checklistMapperService', checklistMapperService);

    checklistMapperService.$inject = ['checklistService', 'queryMap', 'queryResults', 'alerts', '$q'];

    function checklistMapperService(checklistService, queryMap, queryResults, alerts, $q) {

	var maxResults = 15000;
        var checklistMapperService = {
            query: query
        };

        return checklistMapperService;

        function query(query, page, lat, lng) {
            return _queryJson(query, page, true, lat, lng)
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

        function _queryJson(query, page, resetMarkers, lat, lng) {
            return checklistService.queryJson(query, page, lat, lng)
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
	    // Format family and genus so they are readable.. do not need the ecoengine syntax 
	    // for displaying taxonomic names
	    for (var key in results['data']) {
		try {
		    var family = results['data'][key]['family']
		    var familyArr = family.split("/")
		    // if this appears to be an ecoengine formatted name, try to reduce
		    if (familyArr.length > 1) {
		    	family = familyArr[familyArr.length -2]
		    	results['data'][key]['family'] = family
		    }
		} catch(err) {
			results['data'][key]['family'] = ""
		}

		try {
		    var genus = results['data'][key]['genus']
		    var genusArr = genus.split("/")
		    // if this appears to be an ecoengine formatted name, try to reduce
		    if (genusArr.length > 1) {
		    	genus = genusArr[genusArr.length -2]
		    	results['data'][key]['genus'] = genus
		    }
		} catch(err) {
			results['data'][key]['genus'] = ""
		}
		try {
		    var infraspecific_epithet = results['data'][key]['infraspecific_epithet']
		    var infraspecific_epithetArr = infraspecific_epithet.split("/")
		    infraspecific_epithet = infraspecific_epithetArr[infraspecific_epithetArr.length -2]
		    results['data'][key]['infraspecific_epithet'] =infraspecific_epithet 
		} catch(err) {
			results['data'][key]['infraspecific_epithet'] = ""
		}
	    }
            queryResults.append(results);
	    //queryMap.setChecklist(true); 
            if (resetMarkers) {
                queryMap.setMarkers(results.data);
            } else {
                queryMap.addMarkers(results.data);
            }
        }
    }
})();
