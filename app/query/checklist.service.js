(function () {
    'use strict';

    angular.module('map.query')
        .factory('checklistService', checklistService);

    checklistService.$inject = ['$http', 'alerts'];

    function checklistService($http, alerts) {

        var checklistService = {
            queryJson: queryJson,
	    checklists: checklists
        };

        return checklistService;

        function queryJson(query, page) {
            alerts.removeTmp();
	    page = page +1 

	    return $http.get("https://ecoengine.berkeley.edu//api/observations/?format=json&observation_type=checklist&fields=scientific_name,begin_date,collection_code,genus,family,specific_epithet,infraspecific_epithet,url,recorded_by,remote_resource&page="+page+"&page_size=1000&"+query)
               .then(queryJsonComplete);

            function queryJsonComplete(response) {
                var results = {
                    size: 0,
                    totalElements: 0,
                    data: []
                };
                if (response.data) {
                    results.size = response.data.results.length;
                    results.totalElements = response.data.count;
                    if (results.totalElements === 0) {
                        alerts.info("No results found.")
                    }
                    results.data = response.data.results;
                }
                return results;
            }
        }
	// Get all of the checklists
	function checklists(query) {
	    return $http.get("https://ecoengine.berkeley.edu//api/observations/?format=json&observation_type=checklist&fields=recorded_by&page=1&ordering=recorded_by&page_size=1000&"+query)
                .then(function (response) {
                    var records = [];

		    var reserves = ["None"]
                    angular.forEach(response.data.results, function (c) {
			// In ecoengine observations, recorded_by is the same as the list_title (ListTitle) field

			if (!reserves.includes(c.recorded_by)) {
			    reserves.push(c.recorded_by)
                                records.push({
                                    'name': c.recorded_by,
                                    'record': c.recorded_by,
			            'reserve': c.recorded_by
                                });
			}
                    });

                    return records;
                });
       }
    }
    })()
