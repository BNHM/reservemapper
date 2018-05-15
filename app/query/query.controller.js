(function () {
    'use strict';

    angular.module('map.query')
        .controller('QueryController', QueryController);

    QueryController.$inject = ['$rootScope', '$scope', 'queryParams', 'queryResults', 'queryMap', 'alerts', 'photoViewer'];

    function QueryController($rootScope, $scope, queryParams, queryResults, queryMap, alerts,photoViewer ) {
        var vm = this;
        vm.alerts = alerts;
        vm.queryResults = queryResults;
        vm.queryParams = queryParams;
        vm.queryParams.queryType = 'query';

        vm.showSidebar = true;
        vm.showMap = true;
        vm.sidebarToggleToolTip = "hide sidebar";

        vm.queryMap = queryMap;
        vm.invalidSize = false;

        activate();

        function activate() {
            queryParams.clear();
            queryResults.clear();
        }

        $scope.$watch('vm.showSidebar', function () {
            if (vm.showSidebar) {
                vm.sidebarToggleToolTip = "hide sidebar";
            } else {
                vm.sidebarToggleToolTip = "show sidebar";
            }
        });

        $scope.$watch('vm.showSidebar', updateMapSize);
        $scope.$watch('vm.showMap', updateMapSize);
       //$scope.$watch('vm.showStats',showStats);

        function updateMapSize(newVal, oldVal) {
            if (newVal != oldVal) {
                vm.invalidSize = true;
            }
        }

        $scope.showControl=function(state){
            if(state == 'map') {
                vm.showMap=true;
                vm.showTable=false;
                vm.showStats=false;
            } else if(state == 'table'){
                vm.showMap=false;
		photoViewer.clear();
                vm.showTable=true;
                vm.showStats=false;
            } else if(state == 'stats'){
                vm.showMap=false;
		photoViewer.clear();
                vm.showTable=false;
                vm.showStats=true;
            }
        }
    }
})();
