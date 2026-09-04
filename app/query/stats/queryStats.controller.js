(function () {
    'use strict';

    angular.module('map.query')
	.controller('QueryStatsController', QueryStatsController);

    QueryStatsController.$inject = ['$scope', '$window', 'queryResults', 'queryParams', 'queryService', 'GBIFChecklistService', '$q', 'alerts'];

    /**
    Manage the look and feel of the data table.
    This controller relies heavily on the angular-data-grid package at https://www.npmjs.com/package/angular-data-grid
    */
    function QueryStatsController($scope, $window, queryResults, queryParams, queryService, GBIFChecklistService, $q, alerts) {
	var vm = this;
	var ALL_FACET_PAGE_LIMIT = 500;
	var MAX_STAT_FACETS = 100000;
	//var totalResults = vm.totalResult;
	vm.queryResults = queryResults;
	vm.loadingStats = false;
	vm.statsProgress = '';
	vm.valueColumnName = 'count';
	$scope.gridOptions = {
	    data: []
	};

	// Watch for when the queryResults size changes, then run this function
	$scope.$watchGroup([
	    'queryStatsVm.queryResults.size',
	    'queryStatsVm.queryResults.totalElements',
	    'queryStatsVm.queryResults.isSet'
	], function () {
	    if (!vm.queryResults.isSet) {
		$scope.gridOptions.data = [];
		vm.statsProgress = '';
		vm.valueColumnName = 'count';
		return;
	    }

	    vm.totalResults = vm.queryResults.totalElements;
	    if (vm.totalResults === 0) {
		$scope.gridOptions.data = [];
		return;
	    }

	    //populate the table with institution stats by default
	    if (isChecklistQuery()) {
		$scope.familyCount();
	    } else if (isGbifQuery()) {
		$scope.institutionCount();
	    } else {
		$scope.collectionCodeCount();
	    }
	});

	// CalPhotos Specific Counts
	$scope.scientificNameCount= function () {
	    if (isChecklistQuery()) {
		return checklistScientificNameCount();
	    }
	    if (isGbifQuery()) {
		return gbifFacet('SCIENTIFIC_NAME', 'scientific_name', false, {
		    all: true
		});
	    }
	    $scope.gridOptions.data = valueTotal('scientificName', null, 'key', 'ascending')
	}
	$scope.collectionCodeCount = function () {
	    if (isGbifQuery()) {
		return gbifFacet('COLLECTION_CODE', 'collectionCode');
	    }
	    $scope.gridOptions.data = valueTotal( 'collection_code', null, 'value', 'ascending')
	}

	// GBIF Counts
	$scope.institutionCount = function () {
	    if (isGbifQuery()) {
		return gbifFacet('INSTITUTION_CODE', 'institutionCode');
	    }
	    $scope.gridOptions.data = valueTotal('institutionCode', 'collectionCode', 'value', 'ascending')
	}
	$scope.basisOfRecordCount = function () {
	    if (isGbifQuery()) {
		return gbifFacet('BASIS_OF_RECORD', 'basisOfRecord');
	    }
	    $scope.gridOptions.data = valueTotal('basisOfRecord', null, 'value', 'ascending')
	}
	$scope.yearCount =  function() {
	    if (isGbifQuery()) {
		return gbifFacet('YEAR', 'year');
	    }
	    $scope.gridOptions.data = valueTotal('year', null, 'value', 'ascending')
	}
	$scope.kingdomCount = function () {
	    if (isGbifQuery()) {
		return gbifFacet('KINGDOM_KEY', 'kingdom', true);
	    }
	    $scope.gridOptions.data = valueTotal('kingdom', null, 'value', 'ascending')
	}
	$scope.phylumCount= function () {
	    if (isGbifQuery()) {
		return gbifFacet('PHYLUM_KEY', 'phylum', true);
	    }
	    $scope.gridOptions.data = valueTotal('phylum', null, 'value', 'ascending')
	}
	$scope.speciesCount = function () {
	    if (isGbifQuery()) {
		return gbifFacet('SPECIES_KEY', 'species', true);
	    }
	    $scope.gridOptions.data = valueTotal('species', null, 'value', 'ascending')
	}
	$scope.localityCount = function () {
	    if (isGbifQuery()) {
		return gbifFacet('LOCALITY', 'locality');
	    }
	    $scope.gridOptions.data = valueTotal('locality', null, 'value', 'ascending')
	}
	$scope.classCount = function () {
	    if (isChecklistQuery()) {
		return checklistCount('class', 'class');
	    }
	    $scope.gridOptions.data = valueTotal('class', null, 'value', 'ascending')
	}
	$scope.orderCount = function () {
	    if (isChecklistQuery()) {
		return checklistCount('order', 'order');
	    }
	    $scope.gridOptions.data = valueTotal('order', null, 'value', 'ascending')
	}
	$scope.familyCount = function () {
	    if (isChecklistQuery()) {
		return checklistCount('family', 'family');
	    }
	    $scope.gridOptions.data = valueTotal('family', null, 'value', 'ascending')
	}
	$scope.genusCount = function () {
	    if (isChecklistQuery()) {
		return checklistCount('genus', 'genus');
	    }
	    $scope.gridOptions.data = valueTotal('genus', null, 'value', 'ascending')
	}
	$scope.firstYearCount = function () {
	    return checklistCount('firstYear', 'firstYear');
	}
	$scope.lastYearCount = function () {
	    return checklistCount('lastYear', 'lastYear');
	}

	function isGbifQuery() {
	    return vm.queryResults.querySource === 'gbif';
	}

	function isChecklistQuery() {
	    return vm.queryResults.querySource === 'gbif-checklist';
	}

	function checklistCount(fieldName, columnName) {
	    vm.columnName = columnName;
	    vm.valueColumnName = 'count';
	    $scope.gridOptions.data = valueTotal(fieldName, null, 'value', 'descending');
	    return $q.when($scope.gridOptions.data);
	}

	function checklistScientificNameCount() {
	    vm.columnName = 'scientific_name';
	    vm.valueColumnName = 'occurrence_count';
	    vm.loadingStats = true;
	    vm.statsProgress = 'Preparing 0 of ' + (vm.queryResults.data || []).length + ' species names';
	    $scope.gridOptions.data = [];

	    return GBIFChecklistService.ensureTaxonomyForRows(vm.queryResults.data || [], {
		onProgress: function (loaded, limit) {
		    vm.statsProgress = 'Preparing ' + loaded + ' of ' + limit + ' species names';
		}
	    }).then(function () {
		$scope.gridOptions.data = sumTotal('scientific_name', 'occurrence_count', 'key', 'ascending');
		return $scope.gridOptions.data;
	    }, function (err) {
		alerts.error('Failed to load checklist scientific names');
		console.log('checklist-stats-error:', err);
		throw err;
	    }).finally(function () {
		vm.loadingStats = false;
		vm.statsProgress = '';
	    });
	}

	function gbifFacet(facetKey, columnName, resolveTaxonKeys, options) {
	    var requestOptions = options || {};

	    vm.columnName = columnName;
	    vm.valueColumnName = 'count';
	    vm.loadingStats = true;
	    vm.statsProgress = requestOptions.all ? 'Loading 0 ' + columnName + ' values' : '';
	    $scope.gridOptions.data = [];

	    return loadGbifFacetRows(facetKey, requestOptions)
		.then(function (results) {
		    var rows = results.rows;

		    if (resolveTaxonKeys) {
			return resolveTaxonRows(rows).then(function (resolvedRows) {
			    $scope.gridOptions.data = resolvedRows;
			    return resolvedRows;
			});
		    }

		    $scope.gridOptions.data = rows;
		    if (results.truncated) {
			alerts.warn('Stats are limited to the first ' + MAX_STAT_FACETS + ' ' + columnName + ' values.');
		    }
		    return rows;
		}, function (err) {
		    alerts.error('Failed to load GBIF stats');
		    console.log('stats-error:', err);
		    throw err;
		})
		.finally(function () {
		    vm.loadingStats = false;
		    vm.statsProgress = '';
		});
	}

	function loadGbifFacetRows(facetKey, options) {
	    var requestOptions = options || {};

	    if (!requestOptions.all) {
		return queryService.queryFacet(vm.queryResults.searchRequest || queryParams.build(), facetKey)
		    .then(function (results) {
			return {
			    rows: results.facets[facetKey] || [],
			    truncated: false
			};
		    });
	    }

	    return loadGbifFacetPage(facetKey, 0, []);
	}

	function loadGbifFacetPage(facetKey, facetOffset, rows) {
	    if (rows.length >= MAX_STAT_FACETS) {
		return $q.when({
		    rows: rows,
		    truncated: true
		});
	    }

	    return queryService.queryFacet(vm.queryResults.searchRequest || queryParams.build(), facetKey, {
		facetLimit: ALL_FACET_PAGE_LIMIT,
		facetOffset: facetOffset
	    }).then(function (results) {
		var pageRows = results.facets[facetKey] || [];
		var remaining = MAX_STAT_FACETS - rows.length;

		rows.push.apply(rows, pageRows.slice(0, remaining));
		vm.statsProgress = 'Loading ' + rows.length + ' ' + vm.columnName + ' values';

		if (pageRows.length < ALL_FACET_PAGE_LIMIT || rows.length >= MAX_STAT_FACETS) {
		    return {
			rows: rows,
			truncated: rows.length >= MAX_STAT_FACETS && pageRows.length === ALL_FACET_PAGE_LIMIT
		    };
		}

		return loadGbifFacetPage(facetKey, facetOffset + ALL_FACET_PAGE_LIMIT, rows);
	    });
	}

	function resolveTaxonRows(rows) {
	    return $q.all(rows.map(function (row) {
		if (row.key === 'Unspecified') {
		    return $q.when(row);
		}

		return queryService.taxonName(row.key).then(function (name) {
		    return {
			key: name,
			value: row.value
		    };
		});
	    }));
	}

	// Group on a name and return the number of counts for each name in the dataset
	// parameters are:`
	// 2. a name containing an attribute in the JSON Object
	// 3. sortTopic "key" or "value"
	// 4. sortDirection "ascending" or "descending"
	// 5. nestedName, another name to nest
	function valueTotal(name, nestedName, sortTopic, sortDirection) {
	    vm.valueColumnName = 'count';
	    if (nestedName != null)  {
		vm.columnName = name + ':' + nestedName
	    } else {
		vm.columnName = normalizedColumnName(name);
	    }
	    var groupData;
	    if (nestedName != null) {
		groupData = d3.nest()
		    .key(function(d) {
			return normalizedGroupValue(fieldValue(d, name)) + ':' + normalizedGroupValue(fieldValue(d, nestedName));
		    })
		    .rollup(function(v) {return v.length; })
		    .entries(vm.queryResults.data)
	    } else {
		groupData = d3.nest()
		    .key(function(d) {
			return normalizedGroupValue(fieldValue(d, name));
		    })
		    .rollup(function(v) {return v.length; })
		    .entries(vm.queryResults.data)
	    }
	    return sortRows(groupData, sortTopic, sortDirection);
	}

	function sumTotal(name, valueName, sortTopic, sortDirection) {
	    var groupData;

	    vm.columnName = normalizedColumnName(name);
	    vm.valueColumnName = valueName;

	    groupData = d3.nest()
		.key(function(d) {
		    return normalizedGroupValue(fieldValue(d, name));
		})
		.rollup(function(values) {
		    return values.reduce(function(total, item) {
			var value = Number(fieldValue(item, valueName));

			return total + (isFinite(value) ? value : 0);
		    }, 0);
		})
		.entries(vm.queryResults.data);

	    return sortRows(groupData, sortTopic, sortDirection);
	}

	function normalizedColumnName(name) {
	    if (name == 'observations[0].scientific_name' || name == 'scientificName' || name == 'scientific_name') {
		return 'scientific_name';
	    }

	    return name;
	}

	function normalizedGroupValue(value) {
	    if (value === '' || value === null || value === undefined) {
		return 'Unspecified';
	    }

	    return value;
	}

	function fieldValue(item, path) {
	    var parts = String(path || '').replace(/\[(\d+)\]/g, '.$1').split('.');
	    var value = item;

	    for (var i = 0; i < parts.length; i++) {
		if (!parts[i]) {
		    continue;
		}
		if (value === undefined || value === null) {
		    return undefined;
		}
		value = value[parts[i]];
	    }

	    return value;
	}

	function sortRows(rows, sortTopic, sortDirection) {
	    return rows.sort(function(x,y) {
		return d3[sortDirection](x[sortTopic], y[sortTopic]);
	    });
	}
    }
})();
