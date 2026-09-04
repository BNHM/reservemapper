(function () {
    'use strict';

    angular.module('map.query')
        .controller('QueryController', QueryController);

    QueryController.$inject = ['$rootScope', '$scope', 'queryParams', 'queryResults', 'queryMap', 'alerts'];

    function QueryController($rootScope, $scope, queryParams, queryResults, queryMap, alerts ) {
        var vm = this;
        vm.alerts = alerts;
        vm.queryResults = queryResults;
        vm.queryParams = queryParams;
        vm.queryParams.queryType = 'query';

        vm.showSidebar = true;
        vm.showMap = true;
        vm.showTable = false;
        vm.showStats = false;
        vm.showMessages = false;
        vm.showAbout = false;
        vm.showCalphotosError = false;
        vm.calphotosErrorMessage = '';
        vm.sidebarToggleToolTip = "hide sidebar";

        vm.queryMap = queryMap;
        vm.invalidSize = false;
        vm.clearMessages = clearMessages;
        vm.dismissCalphotosError = dismissCalphotosError;

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

        var deregisterShowMessages = $rootScope.$on('query:showMessages', function () {
            $scope.$evalAsync(function () {
                setActiveControl('messages');
            });
        });
        var deregisterCalphotosUnavailable = $rootScope.$on('query:calphotosUnavailable', function (event, message) {
            $scope.$evalAsync(function () {
                vm.calphotosErrorMessage = message;
                vm.showCalphotosError = true;
            });
        });
        $scope.$on('$destroy', deregisterShowMessages);
        $scope.$on('$destroy', deregisterCalphotosUnavailable);

        $scope.showControl=setActiveControl;

        function setActiveControl(state){
            if(state == 'map') {
                vm.showMap=true;
                vm.showTable=false;
                vm.showStats=false;
                vm.showMessages=false;
                vm.showAbout=false;
            } else if(state == 'table'){
                vm.showMap=false;
                vm.showTable=true;
                vm.showStats=false;
                vm.showMessages=false;
                vm.showAbout=false;
            } else if(state == 'stats'){
                vm.showMap=false;
                vm.showTable=false;
                vm.showStats=true;
                vm.showMessages=false;
                vm.showAbout=false;
            } else if(state == 'messages'){
                vm.showMap=false;
                vm.showTable=false;
                vm.showStats=false;
                vm.showMessages=true;
                vm.showAbout=false;
            } else if(state == 'about'){
                vm.showMap=false;
                vm.showTable=false;
                vm.showStats=false;
                vm.showMessages=false;
                vm.showAbout=true;
            }
        }

        function clearMessages() {
            var popupContent = document.getElementById('popupContent');

            alerts.clear();
            if (popupContent) {
                popupContent.innerHTML = '';
            }
        }

        function dismissCalphotosError() {
            vm.showCalphotosError = false;
        }
    }
})();
