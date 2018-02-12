(function () {
    'use strict';

    angular.module('map.query')
        .controller('QueryStatsController', QueryStatsController);

    QueryStatsController.$inject = ['$scope', '$window', 'queryResults'];

    /**
    Manage the look and feel of the data table.  
    This controller relies heavily on the angular-data-grid package at https://www.npmjs.com/package/angular-data-grid
    */
    function QueryStatsController($scope, $window, queryResults) {
        var vm = this;
        //var totalResults = vm.totalResult;
        vm.queryResults = queryResults;

	// Watch for when the queryResults size changes, then run this function
     	$scope.$watch('queryStatsVm.queryResults.size', function () {
          vm.totalResults=vm.queryResults.totalElements
          vm.total
     	});
    }


})();
