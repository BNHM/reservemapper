(function () {
    'use strict';

    angular.module('map.query')
        .factory('photoService', photoService);

    photoService.$inject = ['$http', 'alerts'];

    function photoService($http, alerts) {

        var photoService = {
            queryJson: queryJson
        };

        return photoService;

        function queryJson(query, page) {
            alerts.removeTmp();
	    page = page +1 
            return $http.get("http://ecoengine.berkeley.edu/api/photos/?format=json&page_size=300&page="+page+"&bbox=-124,44,-114,46")
               .then(queryJsonComplete);

            function queryJsonComplete(response) {
                var results = {
                    size: 0,
                    totalElements: 0,
                    data: []
                };
                if (response.data) {
                    results.size = response.data.limit;
                    results.totalElements = response.data.count;
                    if (results.totalElements === 0) {
                        alerts.info("No results found.")
                    }
                    results.data = response.data.results;
                }
                return results;
            }
        }

      //  function basisOfRecords() {
       //     return $http.get('http://api.gbif.org/v1/enumeration/basic/BasisOfRecord')
        //        .then(function (response) {
         //           var records = [];
//
 //                   angular.forEach(response.data, function (c) {
  //                      records.push({
   //                         'name': c,
    //                        'record': c
     //                   });
      //              });
//
 //                   return records;
  //              });
   //     }
    //    function countryCodes() {
     //       return $http.get('http://api.gbif.org/v1/enumeration/country')
      //          .then(function (response) {
       //             var codes = [];
//
 //                   angular.forEach(response.data, function (c) {
  //                      codes.push({
   //                         'name': c.title,
    //                        'code': c.iso2
     //                   });
      //              });
//
 //                   return codes;
  //              });
   //     }

    }
    })()
