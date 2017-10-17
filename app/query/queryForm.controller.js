(function () {
    'use strict';

    angular.module('map.query')
        .controller('QueryFormController', QueryFormController);

    QueryFormController.$inject = ['GBIFMapperService', 'queryParams', 'queryService', 'queryMap', 'queryResults', 'usSpinnerService', 'alerts'];

    function QueryFormController(GBIFMapperService, queryParams, queryService, queryMap, queryResults, usSpinnerService, alerts) {
        var vm = this;
        var _currentLayer = undefined;

        // select lists
        vm.countryCodes = [];
        vm.spatialLayers = [];
        vm.basisOfRecord = [];

        // view toggles
        vm.moreSearchOptions = false;
        vm.showMap = true;
        vm.spatialLayer = undefined;
        vm.basisOfRecord= undefined;

        vm.params = queryParams;
        vm.map = queryMap;

        vm.queryJson = queryJson;
	vm.spatialLayerChanged = spatialLayerChanged;

        activate();

        function activate() {
            // getCountryCodes();
            getSpatialLayers();
            getBasisOfRecords();
        }

	function spatialLayerChanged() {
		zoomLayer();
	}

	function zoomLayer() {
            var l = omnivore.wkt.parse(vm.spatialLayer);
            vm.params.bounds = l.getBounds();

            if (_currentLayer && l.getBounds() !== _currentLayer.getBounds()) {
                queryMap.removeLayer(_currentLayer);
            }

            queryMap.addLayer(l);
            _currentLayer = l;

	}
        function queryJson() {
            usSpinnerService.spin('query-spinner');

	    // zoom to selected layer
            zoomLayer();

            queryResults.clear();
            GBIFMapperService.query(queryParams.build(), 0)
                .finally(queryJsonFinally);

            function queryJsonFinally() {
                usSpinnerService.stop('query-spinner');
            }
        }

         function getBasisOfRecords() {
             queryService.basisOfRecords()
                 .then(function (records) {
                     vm.basisOfRecord = records;
                 }, function () {
                     alerts.error('error fetching basisOfRecord terms');
                 });
         }
        // function getCountryCodes() {
        //     queryService.countryCodes()
        //         .then(function (codes) {
        //             vm.countryCodes = codes;
        //         }, function () {
        //             alerts.error('error fetching countryCodes');
        //         });
        // }

        function getSpatialLayers() {
            queryService.spatialLayers()
                .then(function (response) {
                    vm.spatialLayers = response.data;
                }, function () {
                    alerts.error('error fetching spatial layers');
                });
        }

    }

})();
