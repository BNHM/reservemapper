(function () {
    'use strict';

    angular.module('map.query')
        .factory('queryService', queryService);

    queryService.$inject = ['$http', 'alerts', '$q'];

    function queryService($http, alerts, $q) {
        var PREDICATE_SEARCH_URL = 'https://api.gbif.org/v1/occurrence/search/predicate';
        var FACET_LIMIT = 20;
        var taxonNameCache = {};
        var taxonDetailsCache = {};

        var queryService = {
            queryJson: queryJson,
            queryPredicate: queryPredicate,
            queryCount: queryCount,
            queryFacet: queryFacet,
            taxonName: taxonName,
            taxonDetails: taxonDetails,
            countryCodes: countryCodes,
            basisOfRecords: basisOfRecords
        };

        return queryService;

        function queryJson(query, page) {
            var queryString = angular.isObject(query) ? query.queryString : query;

            alerts.removeTmp();
            return $http.get('https://api.gbif.org/v1/occurrence/search?limit=300' + '&offset=' + 300 * page + '&' + queryString)
               .then(queryJsonComplete);

            function queryJsonComplete(response) {
                var results = {
                    size: 0,
                    totalElements: 0,
                    data: []
                };
                if (response.data) {
                    results.totalElements = response.data.count;
                    if (results.totalElements === 0) {
                        alerts.info('No results found.');
                    }
                    results.data = response.data.results || [];
                    results.size = results.data.length;
                }
                return results;
            }
        }

        function queryPredicate(searchRequest, options) {
            var requestOptions = options || {};
            var body = angular.copy(searchRequest.predicateBody || {});

            if (requestOptions.limit !== undefined) {
                body.limit = requestOptions.limit;
            }
            if (requestOptions.offset !== undefined) {
                body.offset = requestOptions.offset;
            }
            if (requestOptions.facets) {
                body.facets = requestOptions.facets;
            }
            if (requestOptions.facetLimit !== undefined) {
                body.facetLimit = requestOptions.facetLimit;
            }
            if (requestOptions.facetOffset !== undefined) {
                body.facetOffset = requestOptions.facetOffset;
            }

            if (!requestOptions.preserveAlerts) {
                alerts.removeTmp();
            }

            return $http.post(PREDICATE_SEARCH_URL, body)
                .then(function (response) {
                    return normalizePredicateResults(response);
                });
        }

        function queryCount(searchRequest, options) {
            return queryPredicate(searchRequest, angular.extend({
                limit: 0,
                offset: 0
            }, options || {}));
        }

        function queryFacet(searchRequest, facetKey, options) {
            var requestOptions = options || {};

            return queryPredicate(searchRequest, {
                limit: 0,
                offset: 0,
                facets: [facetKey],
                facetLimit: requestOptions.facetLimit || FACET_LIMIT,
                facetOffset: requestOptions.facetOffset || 0,
                preserveAlerts: true
            });
        }

        function taxonName(key) {
            if (!key) {
                return $q.when('Unspecified');
            }

            if (taxonNameCache[key]) {
                return $q.when(taxonNameCache[key]);
            }

            return $http.get('https://api.gbif.org/v1/species/' + encodeURIComponent(key))
                .then(function (response) {
                    var name = response.data.canonicalName || response.data.scientificName || String(key);
                    taxonNameCache[key] = name;
                    return name;
                }, function () {
                    return String(key);
                });
        }

        function taxonDetails(key) {
            if (!key) {
                return $q.when(emptyTaxonDetails(key));
            }

            if (taxonDetailsCache[key]) {
                return $q.when(taxonDetailsCache[key]);
            }

            return $http.get('https://api.gbif.org/v1/species/' + encodeURIComponent(key))
                .then(function (response) {
                    var details = normalizeTaxonDetails(response.data || {}, key);

                    taxonDetailsCache[key] = details;
                    taxonNameCache[key] = details.canonicalName || details.scientificName || String(key);
                    return details;
                }, function () {
                    return emptyTaxonDetails(key);
                });
        }

        function normalizePredicateResults(response) {
            var responseData = response.data || {};
            var data = responseData.results || [];

            return {
                size: data.length,
                totalElements: responseData.count || 0,
                data: data,
                facets: normalizeFacets(responseData.facets || [])
            };
        }

        function normalizeFacets(facets) {
            var facetMap = {};

            angular.forEach(facets, function (facet) {
                facetMap[facet.field] = (facet.counts || []).map(function (count) {
                    return {
                        key: count.name || 'Unspecified',
                        value: count.count || 0
                    };
                });
            });

            return facetMap;
        }

        function normalizeTaxonDetails(data, fallbackKey) {
            var canonicalName = data.canonicalName || data.species || data.scientificName || '';

            return {
                key: data.key || fallbackKey,
                scientificName: data.scientificName || canonicalName || String(fallbackKey || ''),
                canonicalName: canonicalName,
                vernacularName: data.vernacularName || '',
                kingdom: data.kingdom || '',
                phylum: data.phylum || '',
                'class': data['class'] || '',
                order: data.order || '',
                family: data.family || '',
                genus: data.genus || '',
                specificEpithet: specificEpithet(canonicalName),
                rank: data.rank || '',
                taxonomicStatus: data.taxonomicStatus || ''
            };
        }

        function emptyTaxonDetails(key) {
            return normalizeTaxonDetails({
                key: key,
                scientificName: key ? String(key) : ''
            }, key);
        }

        function specificEpithet(canonicalName) {
            var parts = String(canonicalName || '').split(/\s+/);

            return parts.length > 1 ? parts[1] : '';
        }

        function basisOfRecords() {
            return $http.get('https://api.gbif.org/v1/enumeration/basic/BasisOfRecord')
                .then(function (response) {
                    var records = [];

                    angular.forEach(response.data, function (c) {
                        records.push({
                            'name': c,
                            'record': c
                        });
                    });

                    return records;
                });
        }

        function countryCodes() {
            return $http.get('https://api.gbif.org/v1/enumeration/country')
                .then(function (response) {
                    var codes = [];

                    angular.forEach(response.data, function (c) {
                        codes.push({
                            'name': c.title,
                            'code': c.iso2
                        });
                    });

                    return codes;
                });
        }
    }
})();
