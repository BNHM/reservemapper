(function () {
    'use strict';

    angular.module('map.query')
        .factory('checklistService', checklistService);

    checklistService.$inject = ['$http', 'alerts'];

    function checklistService($http, alerts) {

        var checklistService = {
            queryJson: queryJson
        };

        return checklistService;

        function queryJson(query, page) {
            alerts.removeTmp();
	    page = page +1 

	     // Fetch results from ecoengine for checklists
            //return $http.get("https://ecoengine.berkeley.edu/api/checklists/?format=json&page_size=300&page="+page+"&"+ query)
	    // TODO: just pushing a bbox into the query field here... need to get the real bbox and emulate how calphotos searches things
	    //query = "bbox=-121.57531921372191,36.35702762814656,-121.53031454118944,36.402266027122046";
	    return $http.get("https://ecoengine.berkeley.edu//api/observations/?format=json&observation_type=checklist&fields=scientific_name,begin_date,collection_code,genus,family,specific_epithet,infraspecific_epithet,url&page="+page+"&page_size=1000&"+query)
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

    }
    })()
