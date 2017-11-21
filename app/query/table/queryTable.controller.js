(function () {
    'use strict';

    angular.module('map.query')
        .controller('QueryTableController', QueryTableController);

    QueryTableController.$inject = ['$scope', '$window', 'queryResults'];

    function QueryTableController($scope, $window, queryResults) {
        var vm = this;
        vm.queryResults = queryResults;

        // vm.tableColumns = ["principalInvestigator", "materialSampleID", "locality", "decimalLatitude", "decimalLongitude", "genus", "species", "bcid"];
        //vm.tableColumns = [];
	    // Limiting table Columns -- check out the response for the full set.
	    // here is a sample:
	    // {"offset":11700,"limit":1,"endOfRecords":false,"count":15051,"results":[{"key":945579765,"datasetKey":"4fa7b334-ce0d-4e88-aaae-2e0c138d049e","publishingOrgKey":"e2e717bf-551a-4917-bdc9-4fa0f342c530","publishingCountry":"US","protocol":"DWC_ARCHIVE","lastCrawled":"2016-11-24T07:24:55.400+0000","lastParsed":"2016-11-24T07:24:55.430+0000","crawlId":7,"extensions":{},"basisOfRecord":"HUMAN_OBSERVATION","individualCount":1,"taxonKey":7597244,"kingdomKey":1,"phylumKey":44,"classKey":212,"orderKey":1448,"familyKey":5289,"genusKey":2476136,"speciesKey":2476137,"scientificName":"Selasphorus calliope (Gould, 1847)","kingdom":"Animalia","phylum":"Chordata","order":"Apodiformes","family":"Trochilidae","genus":"Stellula","species":"Stellula calliope","genericName":"Selasphorus","specificEpithet":"calliope","taxonRank":"SPECIES","decimalLongitude":-121.549469,"decimalLatitude":36.388315,"stateProvince":"California","year":1969,"month":4,"day":8,"eventDate":"1969-04-08T00:00:00.000+0000","issues":["COORDINATE_ROUNDED"],"lastInterpreted":"2017-02-19T21:18:54.236+0000","license":"http://creativecommons.org/publicdomain/zero/1.0/legalcode","identifiers":[],"facts":[],"relations":[],"geodeticDatum":"WGS84","class":"Aves","countryCode":"US","country":"United States","identifier":"OBS188971464","catalogNumber":"OBS188971464","recordedBy":"obsr356390","institutionCode":"CLO","locality":"Hastings Natural History Reservation","county":"Monterey","gbifID":"945579765","collectionCode":"EBIRD","occurrenceID":"URN:catalog:CLO:EBIRD:OBS188971464"}],"facets":[]}
        vm.tableColumns = ["institutionCode","collectionCode","basisOfRecord","phylum","class","order","family","genus","scientificName","eventDate","locality","decimalLatitude","decimalLongitude","key"];
        vm.tableData = [];
        vm.currentPage = 1;
        vm.pageSize = 50;
        vm.updatePage = updatePage;
        vm.toGBIF = toGBIF;

        function updatePage() {
            var start = (vm.currentPage - 1) * vm.pageSize;
            var end = start + vm.pageSize;

            var data = vm.queryResults.data.slice(start, end);

            prepareTableData(data);
        }

        function toGBIF(resource) {
            var keyIndex = vm.tableColumns.indexOf("key");
            $window.open("http://www.gbif.org/occurrence/" + resource[keyIndex]);
        }

        /*
         transform the data into an array so we can use sly-repeat to display it. sly-repeat bypasses the $watches
         greatly improving the performance of sizable tables
         */
        function prepareTableData(data) {
            vm.tableData = [];
            //if (data[0]) {
                //vm.tableColumns = Object.keys(data[0]).filter(function(key) {
                 //   return key.indexOf('Key') === -1;
                //});
           // }

            if (data.length > 0) {

                angular.forEach(data, function (resource) {
                    var resourceData = [];
                    angular.forEach(vm.tableColumns, function (key) {
                        var text = resource[key];
			    
                        if (angular.isArray(text)) {
                            text = text.join(" | ");
                        } else if (angular.isObject(text)) {
                            text = (angular.equals({}, text)) ? '' : JSON.stringify(text);
                        }
                        resourceData.push((text) ? text.toString() : '');
                    });
                    vm.tableData.push(resourceData);
                });

            }
        }

        $scope.$watch('queryTableVm.queryResults.size', function () {
            vm.currentPage = 1;
            updatePage();
        });
    }

})();
