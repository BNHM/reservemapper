(function (angular) {
    'use strict';

    var app = angular.module('map.query');
    app.directive('taxonEmptyContents', ['$filter', '$http', taxonEmptyContents]);
    app.directive('taxonAutoComplete', ['$filter', '$http', taxonAutoCompleteDir]);
    app.controller('QueryFormController', QueryFormController);
    app.$inject = ['$rootScope', '$location', 'GBIFMapperService', 'photoMapperService', 'checklistMapperService', 'queryParams', 'photoParams', 'checklistParams', 'queryService', 'photoService', 'checklistService', 'photoViewer', 'queryMap', 'queryResults', 'usSpinnerService', 'alerts', '$http'];

    function QueryFormController($scope, $location, GBIFMapperService, photoMapperService, checklistMapperService, queryParams, photoParams, checklistParams, queryService, photoService,  checklistService, photoViewer, queryMap, queryResults, usSpinnerService, alerts, $http ) {
        var vm = this;
        var _currentLayer = undefined;

	$scope.setPhotoOption = function(value) {
		queryMap.setPhoto(value)
	}
        $scope.ranks = ['SPECIES', 'GENUS', 'FAMILY', 'ORDER', 'CLASS', 'PHYLUM', 'KINGDOM']
        //vm.params.rank = $scope.ranks[0]
        queryParams.rank = 'SPECIES';
        queryParams.queryType = 'query';

        // select lists
        vm.countryCodes = [];
        vm.spatialLayers = [];
        vm.basisOfRecord = [];
        vm.checkList = [];

        // view toggles
        //vm.queryParams.queryType = "query";
        vm.moreSearchOptions = false;
        vm.showMap = true;
        //vm.showTable = false;
        //vm.showStats = false;
        vm.spatialLayer = undefined;
	// Set default spatialLayerTitle
        vm.spatialLayerTitle = "Select Area of Interest";
        vm.basisOfRecord = undefined;
        vm.checkList = undefined;

        // Prepare data for Download
        vm.downloadColumns = ["basisOfRecord", "institutionCode", "collectionCode", "catalogNumber", "continent", "country", "stateProvince", "locality", "waterBody", "decimalLatitude", "decimalLongitude", "depth", "elevation", "eventDate", "month", "year", "scientificName", "kingdom", "phylum", "class", "order", "family", "genus", "species", "establishmentMeans", "repatriated", "typeStatus", "lastInterpreted", "mediaType", "protocol", "license", "publishingCountry", "publishingOrg", "recordedBy", "key"]
        vm.checklistDownloadColumns = ["family", "genus", "specific_epithet", "begin_date", "recorded_by", "remote_resource"]

        vm.params = queryParams;
        vm.map = queryMap;

        vm.queryJson = queryJson;
        vm.queryPhotos = queryPhotos;
        vm.queryChecklists = queryChecklists;

        vm.spatialLayerChanged = spatialLayerChanged;
        activate();

        function activate() {
            // getCountryCodes();
            processSpatialLayers();
            getBasisOfRecords();
        }

        // CSV Download
        $scope.downloadCsv = function (data) {
            var downloadData = [];
            if (data.length > 0) {
                angular.forEach(data, function (resource) {
                    var resourceData = [];
                    angular.forEach(vm.downloadColumns, function (key) {
                        // display a link to key field
                        if (key == 'key') {
                            var text = 'https://www.gbif.org/occurrence/' + resource[key];
                        }
                        else {
                            var text = resource[key];

                            if (angular.isArray(text)) {
                                text = text.join(" | ");
                            } else if (angular.isObject(text)) {
                                text = (angular.equals({}, text)) ? '' : JSON.stringify(text);
                            }
                        }
                        resourceData.push((text) ? text.toString() : '');
                    });
                    downloadData.push(resourceData);
                });
            }
            return downloadData;
        }
	// download checklist CSV
        $scope.downloadChecklistCsv = function (data) {
            var downloadData = [];
            if (data.length > 0) {
                angular.forEach(data, function (resource) {
                    var resourceData = [];
                    angular.forEach(vm.checklistDownloadColumns, function (key) {
                        var text = resource[key];

                        if (angular.isArray(text)) {
                            text = text.join(" | ");
                        } else if (angular.isObject(text)) {
                            text = (angular.equals({}, text)) ? '' : JSON.stringify(text);
                        }
                        resourceData.push((text) ? text.toString() : '');
                    });
                    downloadData.push(resourceData);
                });
            }
            return downloadData;
        }

        /* when a spatial layer is changed, we need to remove all old data on the map, 
        clear out data arrays, and then finally zoom into this layer */
        function spatialLayerChanged() {
            queryMap._clearMap();
            queryResults.clear();
            zoomLayer();

        }

        /* zoom into a chosen layer */
        function zoomLayer() {
	    photoViewer.clear();
            // Fetch the WKT from the download_layer and set it to vm.spatialLayer
            $http.get(vm.spatialLayer).then(function (response) {
                //var l = omnivore.wkt.parse(response.data);
                var l = L.geoJSON(response.data);
                // set bounds for queryParams
                queryParams.bounds = l.getBounds();
                // set bounds for photoParams
                photoParams.bounds = l.getBounds();
                // set bounds for checklistParams
                checklistParams.bounds = l.getBounds();
                checklistParams.checkList = $scope.queryFormVm.params.checkList

	    	// Grab a new set of checklists for this layer
            	getChecklists(checklistParams.build());
                if (_currentLayer && l.getBounds() !== _currentLayer.getBounds()) {
                    queryMap.removeLayer(_currentLayer);
                }

                queryMap.addLayer(l);
                _currentLayer = l;

            });
        }

        function queryJson() {
            usSpinnerService.spin('query-spinner');
	    // Remove any elements from map, in case the user switches between photos and query but does not change
	    // the spatial layer
            queryMap._clearMap();

            // zoom to selected layer
            zoomLayer();

            queryResults.clear();
            GBIFMapperService.query(queryParams.build(), 0)
                .then(queryJsonSuccess)
                .catch(queryJsonFailed)
                .finally(queryJsonFinally);

            function queryJsonSuccess() {
                $scope.queryForm.$setPristine(true)
            }
            function queryJsonFailed(response) {
                queryResults.isSet = false;
            }

            function queryJsonFinally() {
                usSpinnerService.stop('query-spinner');
            }
        }

        function queryChecklists() {
            usSpinnerService.spin('query-spinner');

	    // Remove any elements from map, in case the user switches between photos and query but does not change
	    // the spatial layer
            queryMap._clearMap();

            queryResults.clear();

	    // Grab lat lng of center to pass to checklist query function so it can be used for species lookup functions
	    var lat = checklistParams.bounds.getCenter().lat;
	    var lng = checklistParams.bounds.getCenter().lng;

            checklistMapperService.query(checklistParams.build($scope.queryFormVm.params.checkList), 0, lat, lng)
                .then(queryJsonSuccess)
                .catch(queryJsonFailed)
                .finally(queryJsonFinally);

            function queryJsonSuccess() {
                $scope.queryForm.$setPristine(true)
            }
            function queryJsonFailed(response) {
                queryResults.isSet = false;
            }

            function queryJsonFinally() {
		// display the table controller
		$scope.showControl('table')
                usSpinnerService.stop('query-spinner');
            }
        }

        function queryPhotos() {
            usSpinnerService.spin('query-spinner');
	    // Remove any elements from map, in case the user switches between photos and query but does not change
	    // the spatial layer
            queryMap._clearMap();

            // zoom to selected layer
            zoomLayer();

            queryResults.clear();
            photoMapperService.query(photoParams.build(), 0)
                .then(queryJsonSuccess)
                .catch(queryJsonFailed)
                .finally(queryJsonFinally);

            function queryJsonSuccess() {
                $scope.queryForm.$setPristine(true)
            }
            function queryJsonFailed(response) {
                queryResults.isSet = false;
            }

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

        function getChecklists(query) {
            checklistService.checklists(query)
                .then(function (records) {
                    vm.checkList = records;
                }, function () {
		    // for now, don't display an error here
                    //alerts.error('error fetching checkList terms');
                });
        }

        // The following defines a location where we fetch a list of spatial layers
        // TODO: put this in a configuration file 
        function getSpatialLayers() {
	    // Insert client_id and client_secret here from github app if needed for testing
	    var clients = ''
            //return $http.get('https://api.github.com/repositories/59048930/contents/wkt');
	    var spatialLayerBase = 'https://api.github.com/repositories/59048930/contents/'
	    var spatialLayerDirectory = ''
	    // Set title for layer drop down box
	    if ($location.search().title == 'undefined' || $location.search().title == null) {
        	vm.spatialLayerTitle = "University of California Natural Reserve";
	    } else {
        	vm.spatialLayerTitle = $location.search().title 
	    }
   	    // Set the spatialLayerDiretory either defaulting to the Univ. of California reserves, or user specified directory
	    if ($location.search().layers == 'undefined' || $location.search().layers == null) {
	    	spatialLayerDirectory = spatialLayerBase + 'json/' + clients
	    } else {
	    	spatialLayerDirectory = spatialLayerBase + $location.search().layers.replace(/%22/g,'').replace(/"/g,'') + clients
	   }
            return $http.get(spatialLayerDirectory)
        }

        function processSpatialLayers() {
            getSpatialLayers()
                .then(function (response) {
                    // initialize a new object to hold our data
                    var spatialLayerArray = [];
                    //loop the results while inserting the download_url as the value and 
                    //reserve name as the key
                    response.data.forEach(function (spatialLayer) {
                        // Modify the name to insert spaces before Caps, except for first
                        var modifiedName = spatialLayer.name.split(".")[0]
                        modifiedName = modifiedName.replace(/([A-Z])/g, ' $1').trim().replace(/\+/g,'')

                        // Assign the WKT object that was returned to spatialLayer
                        spatialLayerArray[modifiedName] = spatialLayer.download_url;
                    })
                    vm.spatialLayers = spatialLayerArray;
                }, function () {
                    alerts.error('error fetching spatial layers');
                });
        }
    }

    /* dynamically search taxon data */
    function searchTaxonData(characters, $http, rank) {
        return $http.get("https://api.gbif.org/v1/species/suggest/?q=" + characters + "&rank=" + rank)
            .then(queryJsonComplete);//function(response) {
        function queryJsonComplete(response) {
            return response.data;
        }
    }

    /* directive to handlie click events for the taxon empty contents x button */
    function taxonEmptyContents($filter, $http) {
        return {
            restrict: 'A',
            scope: true,
            link: function (scope, elem, attrs) {

                function functionToBeCalled() {
                    scope.$apply(function () {
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
    function taxonAutoCompleteDir($filter, $http) {
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
                        searchTaxonData(params, $http, rank)
                            .then(function (data) {
                                if (data) {
                                    var result = ''
                                    if (rank == "species")
                                        result = $filter('filter')(data, { 'species': params });
                                    if (rank == "genus")
                                        result = $filter('filter')(data, { 'genus': params });
                                    if (rank == "family")
                                        result = $filter('filter')(data, { 'family': params });
                                    if (rank == "order")
                                        result = $filter('filter')(data, { 'order': params });
                                    if (rank == "class")
                                        result = $filter('filter')(data, { 'class': params });
                                    if (rank == "phylum")
                                        result = $filter('filter')(data, { 'phylum': params });
                                    if (rank == "kingdom")
                                        result = $filter('filter')(data, { 'kingdom': params });

                                    angular.forEach(result, function (item) {
                                        if (rank == "species")
                                            item['value'] = item['scientificName'];
                                        else
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
                            alert('Click on name in drop-down list to filter by taxonomy')
                            scope.queryFormVm.params.taxonomy = ''
                            scope.queryFormVm.params.taxonKey = ''
                            scope.queryFormVm.params.selectedTaxonomy = ''
                        }
                    },
                    select: function (event, ui) {
                        //force a digest cycle to update taxonKey based on chosen taxon
                        scope.$apply(function () {
                            var rank = (scope.queryFormVm.params.rank).toString().toLowerCase()
                            if (rank == "species") {
                                scope.queryFormVm.params.taxonKey = ui['item'][rank + 'Key'];
                                scope.queryFormVm.params.selectedTaxonomy = ui['item']['scientificName'];
                            } else {
                                scope.queryFormVm.params.taxonKey = ui['item'][rank + 'Key'];
                                scope.queryFormVm.params.selectedTaxonomy = ui['item'][rank];
                            }
                        });
                    },

                });
            }
        };
    }
})(angular);
