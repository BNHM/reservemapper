(function () {
    'use strict';

    angular.module('map.query')
        .controller('QueryTableController', QueryTableController);

    QueryTableController.$inject = ['$scope', '$window', 'queryResults'];

    /**
    Manage the look and feel of the data table.  
    This controller relies heavily on the angular-data-grid package at https://www.npmjs.com/package/angular-data-grid
    */
    function QueryTableController($scope, $window, queryResults) {
        var vm = this;
        vm.queryResults = queryResults;
	vm.tableData = []

        vm.toGBIF = toGBIF;
        vm.toCalphotos = toCalphotos;

	// Control the angular-data-grid options
	$scope.gridOptions = {
            data: [],
	    pagination: {
                 itemsPerPage: '10'
            }
        };

    	// When a user clicks on a row, send them to the GBIF record for this row
     	function toCalphotos(key) {
            //$window.open("https://calphotos.berkeley.edu/cgi/img_query?enlarge=0000+3333+0531+0442" + key);
            $window.open(key)
     	}
    	// When a user clicks on a row, send them to the GBIF record for this row
     	function toGBIF(key) {
            $window.open("http://www.gbif.org/occurrence/" + key);
     	}

	// Watch for when the queryResults size changes, then run this function
     	$scope.$watch('queryTableVm.queryResults.size', function () {
	    $scope.gridOptions.data = vm.queryResults.data
            $scope.gridOptions.pagination.totalItems=vm.queryResults.data.length
     	});
    }
})();
