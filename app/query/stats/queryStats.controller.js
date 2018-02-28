(function () {
    'use strict';

    angular.module('map.query')
        .controller('QueryStatsController', QueryStatsController);

    QueryStatsController.$inject = ['$scope', '$window', 'queryResults', 'queryParams'];

    /**
    Manage the look and feel of the data table.  
    This controller relies heavily on the angular-data-grid package at https://www.npmjs.com/package/angular-data-grid
    */
    function QueryStatsController($scope, $window, queryResults, queryParams) {
        var vm = this;
        //var totalResults = vm.totalResult;
        vm.queryResults = queryResults;
	$scope.gridOptions = {
            data: []
        };

	// Watch for when the queryResults size changes, then run this function
     	$scope.$watch('queryStatsVm.queryResults.size', function () {
            vm.totalResults=vm.queryResults.totalElements
            vm.total
	    //populate the table with institution stats by default 
	    if (queryParams.queryType == "query")
	  	$scope.institutionCount()
	    else
	  	$scope.collectionCodeCount()
	});
	    

	// CalPhotos Specific Counts
	    $scope.scientificNameCount= function () {
      	$scope.gridOptions.data = valueTotal( 'observations[0].scientific_name', null, 'value', 'ascending') 
	    }
	    $scope.collectionCodeCount = function () {
      	$scope.gridOptions.data = valueTotal( 'collection_code', null, 'value', 'ascending') 
	    }

	// GBIF Counts
	    $scope.institutionCount = function () {
      	$scope.gridOptions.data = valueTotal('institutionCode', 'collectionCode', 'value', 'ascending') 
	    }
	    $scope.basisOfRecordCount = function () {
      	$scope.gridOptions.data = valueTotal('basisOfRecord', null, 'value', 'ascending')
	    }
	   $scope.yearCount =  function() {
      	$scope.gridOptions.data = valueTotal('year', null, 'value', 'ascending')
	    } 
	      $scope.kingdomCount = function () {
      	$scope.gridOptions.data = valueTotal('kingdom', null, 'value', 'ascending') 
	    }
		$scope.phylumCount= function () {
      	$scope.gridOptions.data = valueTotal('phylum', null, 'value', 'ascending') 
	    }
		$scope.speciesCount = function () {
      	$scope.gridOptions.data = valueTotal('species', null, 'value', 'ascending') 
	    }
		$scope.localityCount = function () {
      	$scope.gridOptions.data = valueTotal('locality', null, 'value', 'ascending') 
	    }
// Group on a name and return the number of counts for each name in the dataset
// parameters are:`
// 2. a name containing an attribute in the JSON Object
// 3. sortTopic "key" or "value"
// 4. sortDirection "ascending" or "descending"
// 5. nestedName, another name to nest
function valueTotal(name, nestedName, sortTopic, sortDirection) {
	if (nestedName != null) 
		vm.columnName = name + ":" + nestedName
	else
		vm.columnName = name
        var groupData;
        if (nestedName != null) {
                groupData = d3.nest()
            	.key(function(d) { return eval('d.'+name) + ":" + eval('d.'+nestedName); })
                .rollup(function(v) {return v.length; })
                .entries(vm.queryResults.data)
        } else {
                groupData = d3.nest()
                .key(function(d) { return eval('d.'+name); })
                .rollup(function(v) {return v.length; })
                .entries(vm.queryResults.data)
        }
        // sort by key,value and ascending,descending
        return groupData.sort(function(x,y) {
                return eval('d3.'+sortDirection+'(x.'+sortTopic+',y.'+sortTopic+')');
        });
}
}
})();
