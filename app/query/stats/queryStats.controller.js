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

	$scope.gridOptions = {
            data: []
        };

	// Watch for when the queryResults size changes, then run this function
     	$scope.$watch('queryStatsVm.queryResults.size', function () {
          vm.totalResults=vm.queryResults.totalElements
          vm.total
          $scope.gridOptions.data = valueTotal('year', 'value', 'ascending')
     	});

// Group on a name and return the number of counts for each name in the dataset
// parameters are:
// 2. a name containing an attribute in the JSON Object
// 3. sortTopic "key" or "value"
// 4. sortDirection "ascending" or "descending"
// 5. nestedName, another name to nest
function valueTotal(name, sortTopic, sortDirection, nestedName) {
        var groupData;
        if (nestedName != null) {
                groupData = d3.nest()
                .key(function(d) { return eval('d.'+name); })
                .key(function(d) { return eval('d.'+nestedName); })
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
