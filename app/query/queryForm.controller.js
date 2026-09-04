(function (angular) {
    'use strict';

    var app = angular.module('map.query');
    app.directive('taxonEmptyContents', ['$filter', '$http', taxonEmptyContents]);
    app.directive('taxonAutoComplete', ['$filter', '$http', taxonAutoCompleteDir]);
    app.controller('QueryFormController', QueryFormController);
    QueryFormController.$inject = ['$scope', '$location', 'GBIFMapperService', 'GBIFChecklistService', 'photoMapperService', 'queryParams', 'photoParams', 'queryService', 'photoService', 'photoViewer', 'queryMap', 'queryResults', 'usSpinnerService', 'alerts', 'CSV', '$window', '$http', '$q'];

    function QueryFormController($scope, $location, GBIFMapperService, GBIFChecklistService, photoMapperService, queryParams, photoParams, queryService, photoService, photoViewer, queryMap, queryResults, usSpinnerService, alerts, CSV, $window, $http, $q ) {
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

        // Prepare data for Download
        vm.downloadColumns = ["basisOfRecord", "institutionCode", "collectionCode", "catalogNumber", "continent", "country", "stateProvince", "locality", "waterBody", "decimalLatitude", "decimalLongitude", "depth", "elevation", "eventDate", "month", "year", "scientificName", "kingdom", "phylum", "class", "order", "family", "genus", "species", "establishmentMeans", "repatriated", "typeStatus", "lastInterpreted", "mediaType", "protocol", "license", "publishingCountry", "publishingOrg", "recordedBy", "key"]
        vm.checklistDownloadColumns = GBIFChecklistService.downloadColumns();

        vm.params = queryParams;
        vm.map = queryMap;
        vm.queryResults = queryResults;

        vm.queryJson = queryJson;
        vm.queryPhotos = queryPhotos;
        vm.queryChecklists = queryChecklists;
        vm.downloadOccurrenceCsv = downloadOccurrenceCsv;
        vm.downloadChecklistCsv = downloadChecklistCsv;
        vm.downloadLabel = downloadLabel;
        vm.checklistDownloadLabel = checklistDownloadLabel;
        vm.downloadInProgress = false;
        vm.downloadProgress = '';
        vm.downloadLimits = GBIFMapperService.downloadLimits();

        vm.spatialLayerChanged = spatialLayerChanged;
        activate();

        function activate() {
            // getCountryCodes();
            processSpatialLayers();
            getBasisOfRecords();
        }

        // CSV Download
        $scope.downloadCsv = function (data) {
            return buildDownloadRows(data || [], vm.downloadColumns);
        };

        function buildDownloadRows(data, columns) {
            var downloadData = [];
            if (data.length > 0) {
                angular.forEach(data, function (resource) {
                    var resourceData = [];
                    angular.forEach(columns, function (key) {
                        // display a link to key field
                        if (key == 'key' && resource[key]) {
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

        function downloadOccurrenceCsv() {
            var downloadPromise;

            if (!queryResults.isSet || queryResults.querySource !== 'gbif' || vm.downloadInProgress) {
                return $q.when();
            }

            vm.downloadInProgress = true;
            vm.downloadProgress = '';
            usSpinnerService.spin('query-spinner');

            if (queryResults.isCompleteRecordSet) {
                downloadPromise = $q.when({
                    data: queryResults.data,
                    totalElements: queryResults.totalElements,
                    loadedLimit: queryResults.data.length,
                    truncated: false
                });
            } else {
                downloadPromise = GBIFMapperService.downloadRecords(queryResults.searchRequest || queryParams.build(), {
                    totalElements: queryResults.totalElements,
                    onProgress: function (loaded, limit) {
                        vm.downloadProgress = 'Preparing ' + loaded + ' of ' + limit + ' records';
                    }
                });
            }

            return downloadPromise
                .then(function (results) {
                    var rows = buildDownloadRows(results.data || [], vm.downloadColumns);

                    return CSV.stringify(rows, {
                        header: vm.downloadColumns,
                        txtDelim: '"',
                        decimalSep: '.',
                        fieldSep: ',',
                        addByteOrderMarker: true
                    }).then(function (csv) {
                        saveCsv(csv, 'reservemapper.csv');

                        if (results.truncated) {
                            alerts.warn('Downloaded first ' + results.loadedLimit + ' of ' + results.totalElements + ' GBIF records. Use GBIF occurrence downloads for the full result set.');
                        }
                    });
                })
                .catch(function (err) {
                    alerts.error('Failed to prepare GBIF download');
                    console.log('download-error:', err);
                })
                .finally(function () {
                    vm.downloadInProgress = false;
                    vm.downloadProgress = '';
                    usSpinnerService.stop('query-spinner');
                });
        }

        function downloadChecklistCsv() {
            var rows;

            if (!queryResults.isSet || queryResults.querySource !== 'gbif-checklist' || vm.downloadInProgress) {
                return $q.when();
            }

            rows = queryResults.data || [];
            vm.downloadInProgress = true;
            vm.downloadProgress = rows.length ? 'Preparing 0 of ' + rows.length + ' species names' : '';
            usSpinnerService.spin('query-spinner');

            return GBIFChecklistService.ensureTaxonomyForRows(rows, {
                onProgress: function (loaded, limit) {
                    vm.downloadProgress = 'Preparing ' + loaded + ' of ' + limit + ' species names';
                }
            }).then(function (enrichedRows) {
                return CSV.stringify(buildDownloadRows(enrichedRows, vm.checklistDownloadColumns), {
                    header: vm.checklistDownloadColumns,
                    txtDelim: '"',
                    decimalSep: '.',
                    fieldSep: ',',
                    addByteOrderMarker: true
                });
            }).then(function (csv) {
                saveCsv(csv, 'reservemapper-checklist.csv');
            }).catch(function (err) {
                alerts.error('Failed to prepare checklist download');
                console.log('checklist-download-error:', err);
            }).finally(function () {
                vm.downloadInProgress = false;
                vm.downloadProgress = '';
                usSpinnerService.stop('query-spinner');
            });
        }

        function saveCsv(csv, filename) {
            var blob = new $window.Blob([csv], { type: 'text/csv;charset=utf-8;' });
            var urlApi = $window.URL || $window.webkitURL;
            var link;
            var url;

            if ($window.navigator.msSaveOrOpenBlob) {
                $window.navigator.msSaveOrOpenBlob(blob, filename);
                return;
            }

            url = urlApi.createObjectURL(blob);
            link = $window.document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';
            $window.document.body.appendChild(link);
            link.click();
            $window.document.body.removeChild(link);
            urlApi.revokeObjectURL(url);
        }

        function downloadLabel() {
            if (vm.downloadInProgress) {
                return 'Preparing CSV';
            }

            if (queryResults.querySource === 'gbif' && !queryResults.isCompleteRecordSet) {
                return 'Download CSV';
            }

            return 'Download';
        }

        function checklistDownloadLabel() {
            return vm.downloadInProgress ? 'Preparing CSV' : 'Download';
        }

        /* when a spatial layer is changed, we need to remove all old data on the map, 
        clear out data arrays, and then finally zoom into this layer */
        function spatialLayerChanged() {
            queryMap._clearMap();
            queryResults.clear();
            if (!vm.spatialLayer) {
                return $q.when();
            }
            return zoomLayer();

        }

        /* zoom into a chosen layer */
        function zoomLayer() {
	    photoViewer.clear();
            if (!vm.spatialLayer) {
                alerts.error('Select an area of interest before searching.');
                return $q.reject('missing-spatial-layer');
            }

            // Fetch the WKT from the download_layer and set it to vm.spatialLayer
            return $http.get(vm.spatialLayer).then(function (response) {
                //var l = omnivore.wkt.parse(response.data);
                var l = L.geoJSON(response.data);
                var bounds = l.getBounds();
                // set bounds for queryParams
                queryParams.bounds = bounds;
                queryParams.setGeometryFromGeoJson(response.data);
                // set bounds for photoParams
                photoParams.bounds = bounds;
                if (_currentLayer) {
                    queryMap.removeLayer(_currentLayer);
                }

                queryMap.addLayer(l);
                _currentLayer = l;

                return l;
            });
        }

        function queryJson() {
            usSpinnerService.spin('query-spinner');
	    // Remove any elements from map, in case the user switches between photos and query but does not change
	    // the spatial layer
            queryMap._clearMap();

            queryResults.clear();
            zoomLayer()
                .then(function () {
                    return GBIFMapperService.query(queryParams.build());
                })
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

        function queryPhotos() {
            usSpinnerService.spin('query-spinner');
	    // Remove any elements from map, in case the user switches between photos and query but does not change
	    // the spatial layer
            queryMap._clearMap();
            queryMap.setPhoto(true);

            queryResults.clear();
            zoomLayer()
                .then(function () {
                    return photoMapperService.query(photoParams.build(), 0);
                })
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
	    // Remove occurrence or photo markers before building the GBIF checklist.
            queryMap._clearMap();
            queryMap.setPhoto(false);

            queryResults.clear();
            zoomLayer()
                .then(function () {
                    return GBIFChecklistService.query(queryParams.buildAreaQuery());
                })
                .then(queryChecklistsSuccess)
                .catch(queryChecklistsFailed)
                .finally(queryChecklistsFinally);

            function queryChecklistsSuccess() {
                $scope.queryForm.$setPristine(true);
                if (angular.isFunction($scope.showControl)) {
                    $scope.showControl('table');
                }
            }
            function queryChecklistsFailed(response) {
                queryResults.isSet = false;
            }

            function queryChecklistsFinally() {
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
        return $http.get("https://api.gbif.org/v1/species/suggest/?q=" + encodeURIComponent(characters) + "&rank=" + encodeURIComponent(rank))
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
                        var term = request.term;
                        // TODO: fetch radio button rank
                        //var rank = scope.queryFormVm.params.rank
                        var rank = (scope.queryFormVm.params.rank).toString().toLowerCase()

                        // cal searchTaxonData function and wait for response
                        searchTaxonData(term, $http, rank)
                            .then(function (data) {
                                response(buildTaxonSuggestions(data, term, rank));
                            }, function () {
                                response([]);
                            });
                    },
                    minLength: 2,
                    // Detect if user changes values and if ui['item'] (taxonomy) is null
                    // and then set other key values to empty
                    change: function (event, ui) {
                        if (ui['item'] == null) {
                            scope.$apply(function () {
                                scope.queryFormVm.params.taxonomy = ''
                                scope.queryFormVm.params.taxonKey = ''
                                scope.queryFormVm.params.selectedTaxonomy = ''
                            });
                        }
                    },
                    open: function () {
                        elem.autocomplete('widget')
                            .addClass('taxon-autocomplete-menu')
                            .outerWidth(elem.outerWidth());
                    },
                    select: function (event, ui) {
                        //force a digest cycle to update taxonKey based on chosen taxon
                        scope.$apply(function () {
                            var rank = (scope.queryFormVm.params.rank).toString().toLowerCase()
                            var selectedTaxonomy = ui['item']._selectedTaxonomy || ui['item'].label || ui['item'].value || taxonLabel(ui['item'], rank);

                            scope.queryFormVm.params.taxonKey = ui['item']._taxonKey || ui['item'][rank + 'Key'] || ui['item'].key;
                            scope.queryFormVm.params.taxonomy = selectedTaxonomy;
                            scope.queryFormVm.params.selectedTaxonomy = selectedTaxonomy;
                            ngModel.$setViewValue(selectedTaxonomy);
                            ngModel.$render();
                        });
                        elem.val(ui['item'].value);
                        return false;
                    },

                });
            }
        };
    }

    function buildTaxonSuggestions(data, term, rank) {
        var suggestions = [];
        var seen = {};

        angular.forEach(data || [], function (item) {
            var label = taxonLabel(item, rank);
            var key = taxonKey(item, rank);
            var seenKey;

            if (!label || !key || !matchesTaxonTerm(item, label, term, rank)) {
                return;
            }

            seenKey = key + ':' + label;
            if (seen[seenKey]) {
                return;
            }

            seen[seenKey] = true;
            item.label = label;
            item.value = label;
            item._selectedTaxonomy = label;
            item._taxonKey = key;
            suggestions.push(item);
        });

        return suggestions;
    }

    function taxonLabel(item, rank) {
        if (!item) {
            return '';
        }

        if (rank === 'species') {
            return item.scientificName || item.canonicalName || item.species || '';
        }

        return item.canonicalName || item.scientificName || item[rank] || '';
    }

    function taxonKey(item, rank) {
        if (!item) {
            return null;
        }

        if (String(item.rank || '').toLowerCase() === rank && item.key) {
            return item.key;
        }

        return item[rank + 'Key'] || item.key;
    }

    function matchesTaxonTerm(item, label, term, rank) {
        var normalizedTerm = String(term || '').toLowerCase();

        return !normalizedTerm ||
            String(label || '').toLowerCase().indexOf(normalizedTerm) !== -1 ||
            String((item && item[rank]) || '').toLowerCase().indexOf(normalizedTerm) !== -1 ||
            String((item && item.scientificName) || '').toLowerCase().indexOf(normalizedTerm) !== -1 ||
            String((item && item.canonicalName) || '').toLowerCase().indexOf(normalizedTerm) !== -1;
    }
})(angular);
