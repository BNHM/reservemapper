(function () {
    'use strict';

    angular.module('map.query')
        .factory('queryParams', queryParams);

    queryParams.$inject = [];

    function queryParams() {
        var defaultParams = {
            queryString: null,
            taxonKey: null,
            institutionCode: null,
            collectionCode: null,
            basisOfRecord: null,
            species: null,
            country: null,
            locality: null,
            fromYear: null,
            toYear: null,
            bounds: null,
            geometryWkt: null,
            queryType: 'query',
            rank: 'SPECIES',
            taxonomy: null,
            selectedTaxonomy: null
        };

        var params = {
            build: buildQuery,
            buildAreaQuery: buildAreaQuery,
            clear: clear,
            setGeometryFromGeoJson: setGeometryFromGeoJson,
            geoJsonToWkt: geoJsonToWkt
        };

        activate();

        return params;

        function activate() {
            clear();
        }

        function buildQuery() {
            var geometryWkt = params.geometryWkt;

            return {
                queryString: buildGetQuery(geometryWkt),
                predicateBody: buildPredicateBody(geometryWkt),
                boundsQueryString: buildGetQuery(null),
                boundsPredicateBody: buildPredicateBody(null),
                tileQueryExact: buildGetQuery(geometryWkt),
                tileQueryBounds: buildGetQuery(null),
                bounds: params.bounds,
                geometryWkt: geometryWkt,
                usesBoundsPredicate: !hasValue(geometryWkt) && !!params.bounds,
                canUseBoundsFallback: hasValue(geometryWkt) && !!params.bounds,
                usedBoundsFallback: false,
                hasTextQuery: hasValue(params.queryString)
            };
        }

        function buildAreaQuery() {
            var geometryWkt = params.geometryWkt;

            return {
                queryString: buildAreaGetQuery(geometryWkt),
                predicateBody: buildAreaPredicateBody(geometryWkt),
                boundsQueryString: buildAreaGetQuery(null),
                boundsPredicateBody: buildAreaPredicateBody(null),
                tileQueryExact: buildAreaGetQuery(geometryWkt),
                tileQueryBounds: buildAreaGetQuery(null),
                bounds: params.bounds,
                geometryWkt: geometryWkt,
                usesBoundsPredicate: !hasValue(geometryWkt) && !!params.bounds,
                canUseBoundsFallback: hasValue(geometryWkt) && !!params.bounds,
                usedBoundsFallback: false,
                hasTextQuery: false
            };
        }

        function buildPredicateBody(geometryWkt) {
            var body = {};
            var predicates = [];

            if (hasValue(params.queryString)) {
                body.q = params.queryString;
            }

            addWithinPredicate(predicates, geometryWkt);
            if (!hasValue(geometryWkt)) {
                addBoundsPredicates(predicates, params.bounds);
            }
            addEqualsPredicate(predicates, 'TAXON_KEY', params.taxonKey);
            addEqualsPredicate(predicates, 'COUNTRY', params.country);
            addBasisOfRecordPredicate(predicates, params.basisOfRecord);
            addEqualsPredicate(predicates, 'LOCALITY', params.locality);
            addEqualsPredicate(predicates, 'INSTITUTION_CODE', params.institutionCode);
            addEqualsPredicate(predicates, 'COLLECTION_CODE', params.collectionCode);
            addYearPredicate(predicates, params.fromYear, params.toYear);

            if (predicates.length === 1) {
                body.predicate = predicates[0];
            } else if (predicates.length > 1) {
                body.predicate = {
                    type: 'and',
                    predicates: predicates
                };
            }

            return body;
        }

        function buildAreaPredicateBody(geometryWkt) {
            var body = {};
            var predicates = [];

            addWithinPredicate(predicates, geometryWkt);
            if (!hasValue(geometryWkt)) {
                addBoundsPredicates(predicates, params.bounds);
            }

            if (predicates.length === 1) {
                body.predicate = predicates[0];
            } else if (predicates.length > 1) {
                body.predicate = {
                    type: 'and',
                    predicates: predicates
                };
            }

            return body;
        }

        function buildGetQuery(geometryWkt) {
            var parts = [];

            addQueryParam(parts, 'q', params.queryString);
            addQueryParam(parts, 'taxonKey', params.taxonKey);
            addQueryParam(parts, 'country', params.country);
            addQueryParam(parts, 'basisOfRecord', params.basisOfRecord);
            addQueryParam(parts, 'locality', params.locality);
            addQueryParam(parts, 'institutionCode', params.institutionCode);
            addQueryParam(parts, 'collectionCode', params.collectionCode);

            if (hasValue(params.fromYear) || hasValue(params.toYear)) {
                addQueryParam(parts, 'year', (params.fromYear || '') + ',' + (params.toYear || ''));
            }

            if (geometryWkt) {
                addQueryParam(parts, 'geometry', geometryWkt);
            } else if (params.bounds) {
                addBoundsQueryParams(parts, params.bounds);
            }

            if (parts.length === 0) {
                parts.push('q=*');
            }

            return parts.join('&');
        }

        function buildAreaGetQuery(geometryWkt) {
            var parts = [];

            if (geometryWkt) {
                addQueryParam(parts, 'geometry', geometryWkt);
            } else if (params.bounds) {
                addBoundsQueryParams(parts, params.bounds);
            }

            if (parts.length === 0) {
                parts.push('q=*');
            }

            return parts.join('&');
        }

        function addWithinPredicate(predicates, geometryWkt) {
            if (!hasValue(geometryWkt)) {
                return;
            }

            predicates.push({
                type: 'within',
                geometry: geometryWkt
            });
        }

        function addBoundsPredicates(predicates, bounds) {
            if (!bounds) {
                return;
            }

            var ne = bounds.getNorthEast();
            var sw = bounds.getSouthWest();

            predicates.push({
                type: 'range',
                key: 'DECIMAL_LONGITUDE',
                value: {
                    gte: String(sw.lng),
                    lte: String(ne.lng)
                }
            });
            predicates.push({
                type: 'range',
                key: 'DECIMAL_LATITUDE',
                value: {
                    gte: String(sw.lat),
                    lte: String(ne.lat)
                }
            });
        }

        function addEqualsPredicate(predicates, key, value) {
            if (!hasValue(value)) {
                return;
            }

            predicates.push({
                type: 'equals',
                key: key,
                value: String(value)
            });
        }

        function addBasisOfRecordPredicate(predicates, values) {
            if (!hasValue(values)) {
                return;
            }

            if (angular.isArray(values)) {
                if (values.length === 1) {
                    addEqualsPredicate(predicates, 'BASIS_OF_RECORD', values[0]);
                } else {
                    predicates.push({
                        type: 'in',
                        key: 'BASIS_OF_RECORD',
                        values: values.map(String)
                    });
                }
                return;
            }

            addEqualsPredicate(predicates, 'BASIS_OF_RECORD', values);
        }

        function addYearPredicate(predicates, fromYear, toYear) {
            if (!hasValue(fromYear) && !hasValue(toYear)) {
                return;
            }

            var value = {};
            if (hasValue(fromYear)) {
                value.gte = String(fromYear);
            }
            if (hasValue(toYear)) {
                value.lte = String(toYear);
            }

            predicates.push({
                type: 'range',
                key: 'YEAR',
                value: value
            });
        }

        function addQueryParam(parts, key, value) {
            if (!hasValue(value)) {
                return;
            }

            if (angular.isArray(value)) {
                angular.forEach(value, function (item) {
                    addQueryParam(parts, key, item);
                });
                return;
            }

            parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
        }

        function addBoundsQueryParams(parts, bounds) {
            var ne = bounds.getNorthEast();
            var sw = bounds.getSouthWest();

            addQueryParam(parts, 'decimalLongitude', sw.lng + ',' + ne.lng);
            addQueryParam(parts, 'decimalLatitude', sw.lat + ',' + ne.lat);
        }

        function setGeometryFromGeoJson(geoJson) {
            params.geometryWkt = geoJsonToWkt(geoJson);
            return params.geometryWkt;
        }

        function geoJsonToWkt(geoJson) {
            var polygons = [];
            collectPolygons(geoJson, polygons);

            if (polygons.length === 0) {
                return null;
            }

            if (polygons.length === 1) {
                return 'POLYGON ' + polygonToWkt(polygons[0]);
            }

            return 'MULTIPOLYGON (' + polygons.map(polygonToWkt).join(', ') + ')';
        }

        function collectPolygons(geoJson, polygons) {
            if (!geoJson) {
                return;
            }

            if (geoJson.type === 'FeatureCollection') {
                angular.forEach(geoJson.features, function (feature) {
                    collectPolygons(feature, polygons);
                });
                return;
            }

            if (geoJson.type === 'Feature') {
                collectPolygons(geoJson.geometry, polygons);
                return;
            }

            if (geoJson.type === 'GeometryCollection') {
                angular.forEach(geoJson.geometries, function (geometry) {
                    collectPolygons(geometry, polygons);
                });
                return;
            }

            if (geoJson.type === 'Polygon') {
                addPolygon(geoJson.coordinates, polygons);
                return;
            }

            if (geoJson.type === 'MultiPolygon') {
                angular.forEach(geoJson.coordinates, function (polygon) {
                    addPolygon(polygon, polygons);
                });
            }
        }

        function addPolygon(coordinates, polygons) {
            var polygon = normalizePolygon(coordinates);
            if (polygon) {
                polygons.push(polygon);
            }
        }

        function normalizePolygon(coordinates) {
            var rings = [];

            angular.forEach(coordinates, function (ring, index) {
                var normalizedRing = normalizeRing(ring, index === 0);
                if (normalizedRing) {
                    rings.push(normalizedRing);
                }
            });

            return rings.length ? rings : null;
        }

        function normalizeRing(ring, exterior) {
            var normalized = [];

            angular.forEach(ring, function (coordinate) {
                if (angular.isArray(coordinate) && coordinate.length >= 2 && isFinite(coordinate[0]) && isFinite(coordinate[1])) {
                    normalized.push([Number(coordinate[0]), Number(coordinate[1])]);
                }
            });

            if (normalized.length < 3) {
                return null;
            }

            closeRing(normalized);

            var isCounterClockwise = ringArea(normalized) > 0;
            if (isCounterClockwise !== exterior) {
                normalized.reverse();
            }

            return normalized;
        }

        function closeRing(ring) {
            var first = ring[0];
            var last = ring[ring.length - 1];

            if (first[0] !== last[0] || first[1] !== last[1]) {
                ring.push([first[0], first[1]]);
            }
        }

        function ringArea(ring) {
            var sum = 0;

            for (var i = 0; i < ring.length - 1; i++) {
                var current = ring[i];
                var next = ring[i + 1];
                sum += current[0] * next[1] - next[0] * current[1];
            }

            return sum / 2;
        }

        function polygonToWkt(polygon) {
            return '(' + polygon.map(ringToWkt).join(', ') + ')';
        }

        function ringToWkt(ring) {
            return '(' + ring.map(coordinateToWkt).join(', ') + ')';
        }

        function coordinateToWkt(coordinate) {
            return formatNumber(coordinate[0]) + ' ' + formatNumber(coordinate[1]);
        }

        function formatNumber(value) {
            return Number(value).toString();
        }

        function hasValue(value) {
            if (angular.isArray(value)) {
                return value.length > 0;
            }

            return value !== undefined && value !== null && value !== '';
        }

        function clear() {
            angular.extend(params, angular.copy(defaultParams));
        }
    }

})();
