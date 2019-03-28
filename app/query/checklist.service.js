(function () {
    'use strict';

    angular.module('map.query')
        .factory('checklistService', checklistService);

    checklistService.$inject = ['$http', 'alerts'];
    var MAP_OF_LIFE = 'Map of Life'
    var SPECIES_LOOKUP = 'AmphibiaWeb Species Lookup'

    function checklistService($http, alerts) {

        var checklistService = {
            queryJson: queryJson,
	    checklists: checklists
        };

        return checklistService;

        function queryJson(query, page, lat, lng) {
            alerts.removeTmp();
	    page = page +1 

	    if (query.includes(MAP_OF_LIFE)) {
	        return $http.get("https://api.mol.org/1.x/spatial/species/list?lang=en&lat="+lat+"&lng="+lng+"&radius=2000").then(queryMapOfLife);
	    } else if (query.includes(SPECIES_LOOKUP)) {
	        return $http.get("https://specieslookup.berkeley.edu/search_json/"+lng+","+lat).then(querySpeciesLookup);
	    } else {
	        return $http.get("https://ecoengine.berkeley.edu/api/observations/?format=json&observation_type=checklist&fields=scientific_name,begin_date,collection_code,genus,family,specific_epithet,infraspecific_epithet,url,recorded_by,remote_resource&page="+page+"&page_size=1000&"+query).then(queryEcoEngine);
	    }

            function querySpeciesLookup(response) {
                var results = {
                    size: 0,
                    totalElements: 0,
                    data: []
                };
                if (response.data) {
		    var totalElements = 0;
		    for (var i =0; i < response.data.species.length; i++) {
			// Map the Species Lookup details to a format similar to ecoengine
			var record = response.data.species[i]
			var nameArr=record.scientific_name.split("_")
			var genus = nameArr[0]
			var species= nameArr[1]
			var recordObj = {
				"genus":genus,
				"specific_epithet":species,
				"family":ucFirst(record.family),
				"order":ucFirst(record.order),
				"class":ucFirst(record.class),
				recorded_by:SPECIES_LOOKUP
				}
			results.data.push(recordObj)
			totalElements++
		    }

		    // Set totalElements to 1... not used for MoL... responses are always within range of paging size
		    results.size = totalElements
                    results.totalElements =  totalElements
                    if (results.totalElements === 0) {
                        alerts.info("No results found.")
                    }
		    return results;
                }
	    }
            function queryMapOfLife(response) {
                var results = {
                    size: 0,
                    totalElements: 0,
                    data: []
                };
                if (response.data) {
		    var totalElements = 0;
		    for (var i =0; i < response.data.length; i++) {
		    	for (var j =0; j < response.data[i].species.length; j++) {
				// Map the Map of Life details to a format similar to ecoengine
				var record = response.data[i].species[j]		
				var nameArr = record.scientificname.split(" ")
				record.genus = nameArr[0]
				record.specific_epithet = nameArr[1]
				record.begin_date= record.last_update
				record.recorded_by = MAP_OF_LIFE
			 	results.data.push(record)
				totalElements++
			}
		    }

		    // Set totalElements to 1... not used for MoL... responses are always within range of paging size
		    results.size = totalElements
                    results.totalElements =  totalElements
                    if (results.totalElements === 0) {
                        alerts.info("No results found.")
                    }
		    return results;
                }
	    }
            function queryEcoEngine(response) {
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

		    // Hard-coded checklist queries
	            reserves.push(MAP_OF_LIFE)
		    records.push({
		    	'name': MAP_OF_LIFE,
			'record': MAP_OF_LIFE,
			'reserve': MAP_OF_LIFE
		    })
	            reserves.push(SPECIES_LOOKUP)
		    records.push({
		    	'name': SPECIES_LOOKUP,
			'record': SPECIES_LOOKUP,
			'reserve': SPECIES_LOOKUP
		    })

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

       function ucFirst(string)
       {
           return string.charAt(0).toUpperCase() + string.slice(1);
	   }
    }
    })()
