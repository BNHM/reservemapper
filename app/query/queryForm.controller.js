(function (angular) {
    'use strict';

    var app = angular.module('map.query');
    app.directive('taxonEmptyContents',['$filter','$http', taxonEmptyContents]);     
    app.directive('taxonAutoComplete',['$filter','$http', taxonAutoCompleteDir]);     
    app.controller('QueryFormController', QueryFormController);
    app.$inject = ['$rootScope', 'GBIFMapperService', 'queryParams', 'queryService', 'queryMap', 'queryResults', 'usSpinnerService', 'alerts'];

    function QueryFormController($scope, GBIFMapperService, queryParams, queryService, queryMap, queryResults, usSpinnerService, alerts) {
        var vm = this;
        var _currentLayer = undefined;

        $scope.ranks =  [ 'GENUS', 'FAMILY', 'ORDER', 'CLASS', 'PHYLUM', 'KINGDOM' ]
	//vm.params.rank = $scope.ranks[0]
	queryParams.rank = 'GENUS';

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

   /* dynamically search taxon data */
   function searchTaxonData(characters,$http,rank) {
	   return $http.get("http://api.gbif.org/v1/species/suggest/?q="+characters+"&rank="+rank)
	       .then(queryJsonComplete);//function(response) {
	   function queryJsonComplete(response) {
               return response.data;
            } 
   }

   /* directive to handlie click events for the taxon empty contents x button */
   function taxonEmptyContents($filter,$http) {
      return {
        restrict: 'A',
        scope: true,
        link: function (scope, elem, attrs) {

            function functionToBeCalled () {
                scope.$apply(function(){
	        	scope.queryFormVm.params.taxonomy = '';
	        	scope.queryFormVm.params.taxonKey = '';
	        	scope.queryFormVm.params.selectedTaxonomy = '';
		});
            }

            elem.on('click', functionToBeCalled);
        }
      };
   }

   /* Directive for working with taxon-based autocomplete functions */
   function taxonAutoCompleteDir($filter,$http) {
         return {
		require: "ngModel",
                restrict: 'A',       
                link: function (scope, elem, attrs, ngModel) {
                        elem.autocomplete({
                        source: function (request, response) {
                            //term has the data typed by the user
                            var params = request.term;
			    // TODO: fetch radio button rank
			    //var rank = scope.queryFormVm.params.rank
	 		    var rank = (scope.queryFormVm.params.rank).toString().toLowerCase()
				
			    // cal searchTaxonData function and wait for response
			    searchTaxonData(params,$http,rank)
				.then(function(data) {
                            	   if (data) { 
					var result = ''
					if (rank == "genus")
                                	    result = $filter('filter')(data, {'genus':params});
					if (rank == "family")
                                	    result = $filter('filter')(data, {'family':params});
					if (rank == "order")
                                	    result = $filter('filter')(data, {'order':params});
					if (rank == "class")
                                	    result = $filter('filter')(data, {'class':params});
					if (rank == "phylum")
                                	    result = $filter('filter')(data, {'phylum':params});
					if (rank == "kingdom")
                                	    result = $filter('filter')(data, {'kingdom':params});

                                        angular.forEach(result, function (item) {
                                               item['value'] = item[rank];
                                	});                       
                            	    }
                                    response(result);
			    });
                        },
                        minLength: 2,                       
			// Detect if user changes values and if ui['item'] (taxonomy) is null
			// and then set other key values to empty
                        change: function (event, ui) {
		            if (ui['item'] == null) {
				 alert('Must taxon name from list')
			         scope.queryFormVm.params.taxonomy = ''
			         scope.queryFormVm.params.taxonKey = ''
			         scope.queryFormVm.params.selectedTaxonomy = ''
			    } 
                        },
                        select: function (event, ui) {
                           //force a digest cycle to update taxonKey based on chosen taxon
                           scope.$apply(function(){
			    	 var rank = (scope.queryFormVm.params.rank).toString().toLowerCase()
			         scope.queryFormVm.params.taxonKey = ui['item'][rank+'Key'];
			         scope.queryFormVm.params.selectedTaxonomy = ui['item'][rank];
                           });                       
                        },
                       
                    });
                }
          };
    }
})(angular);
