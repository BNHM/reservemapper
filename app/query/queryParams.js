(function () {
    'use strict';

    angular.module('map.query')
        .factory('queryParams', queryParams);

    queryParams.$inject = ['QueryBuilder'];

    function queryParams(QueryBuilder) {
        var defaultParams = {
            queryString: null,
            genus: null,
            locality: null,
            family: null,
            institutionCode: null,
            collectionCode: null,
            basisOfRecord: null,
            species: null,
            country: null,
            fromYear: null,
            toYear: null,
            bounds: null
        };

        var params = {
            build: buildQuery,
            clear: clear
        };

        activate();

        return params;

        function activate() {
            clear();
        }

        function buildQuery() {
            var builder = new QueryBuilder();

            if (params.queryString) {
                builder.add("q", params.queryString);
            }

            if (params.country) {
                builder.add("country", params.country);
            }
            if (params.basisOfRecord) {
                builder.add("basisOfRecord", params.basisOfRecord);
            }

            if (params.genus) {
                builder.add("genusKey", params.genus);
            }

            if (params.locality) {
                builder.add("locality", params.locality);
            }

            if (params.family) {
                builder.add("familyKey", params.family);
            }

            if (params.species) {
                builder.add("speciesKey", params.species);
            }
            if (params.institutionCode) {
                builder.add("institutionCode", params.institutionCode);
            }
            if (params.collectionCode) {
                builder.add("collectionCode", params.collectionCode);
            }

            if (params.fromYear || params.toYear) {
                builder.add("year", params.fromYear + "," + params.toYear);
            }

            if (params.bounds) {
                var ne = params.bounds.getNorthEast();
                var sw = params.bounds.getSouthWest();

                // if (ne.lng > sw.lng) {
                    builder.add("decimalLongitude", sw.lng + "," + ne.lng);
                // } else {
                //     builder.add("decimalLongitude:>=" + escapeNum(sw.lng) + " +decimalLongitude:<=180)");
                //     builder.add("(+decimalLongitude:<=" + escapeNum(ne.lng) + " +decimalLongitude:>=\\-180))");
                // }

                builder.add("decimalLatitude", sw.lat + "," + ne.lat);
            }


            return builder.build();

        }

        function clear() {
            angular.extend(params, defaultParams);
        }
    }

})();
