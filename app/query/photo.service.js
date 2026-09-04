(function () {
    'use strict';

    angular.module('map.query')
        .factory('photoService', photoService);

    photoService.$inject = ['$http', 'alerts', '$q', '$rootScope'];


    function photoService($http, alerts, $q, $rootScope) {
        var CALPHOTOS_API_URL = 'https://calphotos.berkeley.edu/cgi/api_ee';
        var CALPHOTOS_HOME_URL = 'https://calphotos.berkeley.edu/';
        var CALPHOTOS_UNAVAILABLE_MESSAGE = 'CalPhotos queries are currently unavailable. We are working to fix this.';

        var photoService = {
            queryJson: queryJson
        };

        return photoService;

        function queryJson(query) {
            alerts.removeTmp();

            var bounds = parseBBoxQuery(query);
            if (!bounds) {
                return rejectCalPhotosError('CalPhotos search needs a valid map boundary before it can load photos.');
            }

            var queryString = buildCalPhotosQueryString(bounds);
            var requestUrl = CALPHOTOS_API_URL + '?' + queryString;

            return $http.get(requestUrl, {
                headers: {
                    Accept: 'application/json'
                }
            }).then(queryJsonComplete, queryJsonFailed);

            function queryJsonComplete(response) {
                var results = {
                    size: 0,
                    totalElements: 0,
                    data: [],
                    canPage: false
                };

                if (!response.data) {
                    alerts.info('No results found.');
                    return results;
                }

                if (!angular.isObject(response.data)) {
                    if (isCalPhotosChallenge(response.data)) {
                        return rejectCalPhotosUnavailable();
                    }

                    return rejectCalPhotosUnavailable();
                }

                results.data = normalizeCalPhotosRecords(response.data.results || response.data.data || response.data);
                results.size = results.data.length;
                results.totalElements = Number(response.data.count || response.data.total || results.size) || results.size;

                if (results.totalElements === 0) {
                    alerts.info('No results found.');
                }

                return results;
            }

            function queryJsonFailed(response) {
                if (response && response._alertShown) {
                    return $q.reject(response);
                }

                if (response && (response.status === 0 || response.status === -1)) {
                    return rejectCalPhotosUnavailable();
                }

                return rejectCalPhotosUnavailable();
            }
        }

        function parseBBoxQuery(query) {
            var parts = parseQueryString(query);
            var bbox = parts.bbox;
            var values;

            if (!bbox) {
                return null;
            }

            values = String(bbox).split(',').map(function (value) {
                return Number(value);
            });

            if (values.length !== 4 || values.some(function (value) { return !isFinite(value); })) {
                return null;
            }

            return {
                west: values[0],
                south: values[1],
                east: values[2],
                north: values[3]
            };
        }

        function parseQueryString(query) {
            var parsed = {};

            angular.forEach(String(query || '').split('&'), function (part) {
                var pair;
                var key;
                var value;

                if (!part) {
                    return;
                }

                pair = part.split('=');
                key = decodeURIComponent(pair.shift() || '');
                value = decodeURIComponent(pair.join('=') || '');

                if (key) {
                    parsed[key] = value;
                }
            });

            return parsed;
        }

        function buildCalPhotosQueryString(bounds) {
            return [
                'nw_lat=' + encodeURIComponent(bounds.north),
                'nw_lon=' + encodeURIComponent(bounds.west),
                'se_lat=' + encodeURIComponent(bounds.south),
                'se_lon=' + encodeURIComponent(bounds.east)
            ].join('&');
        }

        function isCalPhotosChallenge(data) {
            var text = String(data || '').toLowerCase();

            return text.indexOf('/cgi/auth/challenge') !== -1 ||
                text.indexOf('quick check to make sure you are human') !== -1 ||
                text.indexOf('calphotos has been overwhelmed with web crawlers') !== -1;
        }

        function normalizeCalPhotosRecords(records) {
            var normalizedRecords = [];

            if (!angular.isArray(records)) {
                return normalizedRecords;
            }

            angular.forEach(records, function (record) {
                var normalized = normalizeCalPhotosRecord(record);

                if (normalized) {
                    normalizedRecords.push(normalized);
                }
            });

            return normalizedRecords;
        }

        function normalizeCalPhotosRecord(record) {
            var normalized;
            var point;

            if (!angular.isObject(record)) {
                return null;
            }

            normalized = angular.copy(record);
            if (!angular.isArray(normalized.observations)) {
                normalized.observations = [];
            }
            if (!normalized.observations.length) {
                normalized.observations.push({
                    scientific_name: normalized.scientific_name || normalized.taxon || 'Unknown'
                });
            }

            normalized.media_url = normalized.media_url || normalized.image_url || normalized.img_url || normalized.thumbnail_url || normalized.thumbnail;
            normalized.remote_resource = normalized.remote_resource || normalized.url || normalized.detail_url || normalized.references || CALPHOTOS_HOME_URL;
            normalized.scientificName = normalized.scientificName || normalized.scientific_name || normalized.taxon || normalized.observations[0].scientific_name;
            normalized.eventDate = normalized.eventDate || normalized.begin_date || normalized.beginDate || normalized.date;
            normalized.begin_date = normalized.begin_date || normalized.beginDate || normalized.eventDate;

            if (!normalized.geometry) {
                point = getRecordPoint(normalized);
                if (point) {
                    normalized.geometry = {
                        type: 'Feature',
                        properties: {},
                        geometry: {
                            type: 'Point',
                            coordinates: [point.lng, point.lat]
                        }
                    };
                }
            }

            return normalized;
        }

        function getRecordPoint(record) {
            var lat = firstFiniteNumber([
                record.latitude,
                record.lat,
                record.decimalLatitude,
                record.decimal_latitude,
                record.y
            ]);
            var lng = firstFiniteNumber([
                record.longitude,
                record.lng,
                record.lon,
                record.long,
                record.decimalLongitude,
                record.decimal_longitude,
                record.x
            ]);

            if (!isFinite(lat) || !isFinite(lng)) {
                return null;
            }

            return {
                lat: lat,
                lng: lng
            };
        }

        function firstFiniteNumber(values) {
            var number;

            for (var i = 0; i < values.length; i++) {
                number = Number(values[i]);
                if (isFinite(number)) {
                    return number;
                }
            }

            return NaN;
        }

        function rejectCalPhotosError(message) {
            var error = new Error(message);
            error._alertShown = true;
            alerts.error(message);
            return $q.reject(error);
        }

        function rejectCalPhotosUnavailable() {
            $rootScope.$emit('query:calphotosUnavailable', CALPHOTOS_UNAVAILABLE_MESSAGE);
            var error = new Error(CALPHOTOS_UNAVAILABLE_MESSAGE);
            error._alertShown = true;
            return $q.reject(error);
        }

    }
    })()
