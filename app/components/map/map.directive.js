(function () {
    'use strict';

    angular.module('map.map')
        .directive('leafletMap', Map);

    Map.$inject = ['$timeout'];

    function Map($timeout) {
        var directive = {
            link: link,
            templateUrl: "components/map/map.tpl.html",
            controller: MapController,
            controllerAs: 'mapVm',
            restrict: 'E',
            scope: {
                map: '<',
                invalidateSize: '='
            },
            bindToController: true
        };

        return directive;

        function link(scope, element, attrs, ctrl) {

            scope.$watch("mapVm.invalidateSize", function (val) {
                if (val) {
                    $timeout(function () {
                        ctrl.map.refreshSize();
                        ctrl.invalidateSize = false;
                    });
                }
            });

            $timeout(function () {
                ctrl.map.init(ctrl.mapId);
            }, 0);

        }
    }

    MapController.$inject = [];

    function MapController() {
        var vm = this;
        vm.tiles = 'map';
        vm.mapId = "map-" + parseInt((Math.random() * 100), 10);
        vm.toggleMapView = toggleMapView;

        function toggleMapView(tiles) {
            vm.tiles = tiles;
            if (tiles === 'map') {
                vm.map.mapView();
            } else if (tiles === 'sat') {
                vm.map.satelliteView();
            //} else if (tiles === 'usgs') {
             //   vm.map.usgsView();
            //}
            } else if (tiles === 'esriTopo') {
               vm.map.esriTopoView();
            }
        }
    }

})();
