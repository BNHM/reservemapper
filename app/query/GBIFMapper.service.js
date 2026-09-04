(function () {
    'use strict';

    angular.module('map.query')
        .factory('GBIFMapperService', mapperService);

    mapperService.$inject = ['queryService', 'queryMap', 'queryResults', 'alerts', '$q'];

    function mapperService(queryService, queryMap, queryResults, alerts, $q) {
        var PAGE_LIMIT = 300;
        var REQUESTED_DOWNLOAD_RECORD_LIMIT = 100000;
        var GBIF_SEARCH_RECORD_LIMIT = 100000;
        var DOWNLOAD_CONCURRENCY = 4;
        var FULL_RECORD_LIMIT = 1000;
        var LARGE_SAMPLE_LIMIT = 300;
        var EXACT_VIEWPORT_MIN_ZOOM = 14;
        var EXACT_VIEWPORT_RECORD_LIMIT = 5000;
        var AGGREGATE_CLICK_RECORD_LIMIT = 50;
        var AGGREGATE_CLICK_TOTAL_LIMIT = 25000;
        var COMPLEX_POLYGON_FALLBACK_WARNING = 'GBIF rejected this complex polygon. Results are using the selected layer bounding box, so records outside the boundary may be included.';
        var activeDrilldownSessionId = 0;
        var viewportRequestId = 0;
        var aggregateClickRequestId = 0;
        var drilldownErrorShown = false;
        var lastViewportMode = null;

        var mapperService = {
            query: query,
            downloadRecords: downloadRecords,
            downloadLimits: downloadLimits
        };

        return mapperService;

        function query(searchRequest) {
            activeDrilldownSessionId++;
            viewportRequestId++;
            aggregateClickRequestId++;
            drilldownErrorShown = false;
            lastViewportMode = null;

            return loadCountedRecordSet(searchRequest)
                .catch(function (err) {
                    return retryWithBoundsFallback(searchRequest, err);
                })
                .catch(function (err) {
                    queryResults.isSet = false;
                    alerts.error('Failed to load query results');
                    console.log('query-error:', err);
                    throw err;
            });
        }

        function loadCountedRecordSet(searchRequest) {
            return queryService.queryCount(searchRequest)
                .then(function (countResults) {
                    return loadRecordSetForCount(searchRequest, countResults);
                });
        }

        function retryWithBoundsFallback(searchRequest, err) {
            var fallbackRequest = queryService.boundsFallbackRequest(searchRequest);

            if (!fallbackRequest) {
                return $q.reject(err);
            }

            console.log('gbif-exact-polygon-query-error:', err);
            return loadCountedRecordSet(fallbackRequest);
        }

        function loadRecordSetForCount(searchRequest, countResults) {
            var totalElements = countResults.totalElements || 0;

            if (totalElements === 0) {
                queryMap._clearMap();
                queryResults.update({
                    querySource: 'gbif',
                    size: 0,
                    totalElements: 0,
                    data: [],
                    toFetch: 0,
                    isSet: true,
                    isCompleteRecordSet: true,
                    usingTileMap: false,
                    mapUsesBoundsFallback: false,
                    searchRequest: searchRequest,
                    sampleLimit: 0,
                    drilldownLimit: 0,
                    drilldownZoom: 0
                });
                alerts.info('No results found.');
                warnIfBoundsPredicate(searchRequest);
                return countResults;
            }

            if (totalElements <= FULL_RECORD_LIMIT) {
                return loadCompleteRecordSet(searchRequest, totalElements);
            }

            return loadLargeRecordSet(searchRequest, totalElements);
        }

        function downloadRecords(searchRequest, options) {
            var requestOptions = options || {};
            var totalElements = Number(requestOptions.totalElements) || 0;
            var recordLimit = Math.min(
                REQUESTED_DOWNLOAD_RECORD_LIMIT,
                GBIF_SEARCH_RECORD_LIMIT,
                totalElements
            );
            var offsets = [];
            var pagesByOffset = {};
            var failedOffsets = [];
            var nextIndex = 0;
            var loaded = 0;
            var workerCount;
            var workers = [];

            if (!searchRequest) {
                return $q.reject(new Error('No GBIF search request is available for download.'));
            }

            if (recordLimit <= 0) {
                return $q.when({
                    data: [],
                    totalElements: totalElements,
                    requestedLimit: REQUESTED_DOWNLOAD_RECORD_LIMIT,
                    loadedLimit: 0,
                    apiLimit: GBIF_SEARCH_RECORD_LIMIT,
                    truncated: false,
                    failedPages: 0
                });
            }

            for (var offset = 0; offset < recordLimit; offset += PAGE_LIMIT) {
                offsets.push(offset);
            }

            workerCount = Math.min(DOWNLOAD_CONCURRENCY, offsets.length);

            for (var i = 0; i < workerCount; i++) {
                workers.push(loadNextDownloadPage());
            }

            if (totalElements > recordLimit) {
                alerts.warn('Direct GBIF CSV export is limited to ' + recordLimit + ' records. Use GBIF occurrence downloads for larger exports.');
            }
            alerts.info('Preparing occurrence CSV...');

            return $q.all(workers)
                .then(function () {
                    var data = [];

                    angular.forEach(offsets, function (offset) {
                        data = data.concat(pagesByOffset[offset] || []);
                    });

                    return {
                        data: data,
                        totalElements: totalElements,
                        requestedLimit: REQUESTED_DOWNLOAD_RECORD_LIMIT,
                        loadedLimit: data.length,
                        apiLimit: GBIF_SEARCH_RECORD_LIMIT,
                        truncated: totalElements > data.length,
                        failedPages: failedOffsets.length
                    };
                })
                .finally(function () {
                    removeAlert('Preparing occurrence CSV...');
                });

            function loadNextDownloadPage() {
                var offset;
                var limit;

                if (nextIndex >= offsets.length) {
                    return $q.when();
                }

                offset = offsets[nextIndex++];
                limit = Math.min(PAGE_LIMIT, recordLimit - offset);

                return queryService.queryPredicate(searchRequest, {
                    limit: limit,
                    offset: offset,
                    preserveAlerts: true
                }).then(function (results) {
                    pagesByOffset[offset] = results.data || [];
                    loaded += pagesByOffset[offset].length;
                    if (angular.isFunction(requestOptions.onProgress)) {
                        requestOptions.onProgress(loaded, recordLimit);
                    }
                    return loadNextDownloadPage();
                }, function (err) {
                    failedOffsets.push(offset);
                    console.log('download-page-error:', offset, err);
                    if (angular.isFunction(requestOptions.onProgress)) {
                        requestOptions.onProgress(loaded, recordLimit);
                    }
                    return loadNextDownloadPage();
                });
            }
        }

        function downloadLimits() {
            return {
                requested: REQUESTED_DOWNLOAD_RECORD_LIMIT,
                api: GBIF_SEARCH_RECORD_LIMIT
            };
        }

        function loadCompleteRecordSet(searchRequest, totalElements) {
            var promises = [];

            for (var offset = 0; offset < totalElements; offset += PAGE_LIMIT) {
                promises.push(queryService.queryPredicate(searchRequest, {
                    limit: PAGE_LIMIT,
                    offset: offset
                }));
            }

            if (promises.length > 1) {
                alerts.info('Loading occurrence records...');
            }

            return $q.all(promises)
                .then(function (pages) {
                    var data = [];

                    angular.forEach(pages, function (page) {
                        data = data.concat(page.data || []);
                    });

                    queryResults.update({
                        querySource: 'gbif',
                        size: data.length,
                        totalElements: totalElements,
                        data: data,
                        toFetch: data.length,
                        isSet: true,
                        isCompleteRecordSet: true,
                        usingTileMap: false,
                        mapUsesBoundsFallback: false,
                        searchRequest: searchRequest,
                        sampleLimit: data.length,
                        drilldownLimit: 0,
                        drilldownZoom: 0
                    });

                    queryMap.setMarkers(data);
                    warnIfBoundsPredicate(searchRequest);

                    return queryResults;
                })
                .finally(function () {
                    removeAlert('Loading occurrence records...');
                });
        }

        function loadLargeRecordSet(searchRequest, totalElements) {
            var drilldownSessionId = activeDrilldownSessionId;

            return queryService.queryPredicate(searchRequest, {
                limit: LARGE_SAMPLE_LIMIT,
                offset: 0
            }).then(function (sampleResults) {
                var tileState = queryMap.setGBIFTiles(searchRequest, {
                    onTileError: function () {
                        alerts.warn('GBIF aggregate map markers failed to load; table and stats are still available.');
                    },
                    onViewportChange: function (bounds, zoom) {
                        handleViewportChange(searchRequest, bounds, zoom, drilldownSessionId);
                    },
                    maxAggregateClickRecords: AGGREGATE_CLICK_TOTAL_LIMIT,
                    onAggregateClick: function (clickInfo) {
                        handleAggregateClick(searchRequest, clickInfo, drilldownSessionId);
                    }
                });
                var data = sampleResults.data || [];

                queryResults.update({
                    querySource: 'gbif',
                    size: data.length,
                    totalElements: totalElements,
                    data: data,
                    toFetch: data.length,
                    isSet: true,
                    isCompleteRecordSet: false,
                    usingTileMap: true,
                    mapUsesBoundsFallback: tileState.usedBoundsFallback,
                    searchRequest: searchRequest,
                    sampleLimit: LARGE_SAMPLE_LIMIT,
                    drilldownLimit: EXACT_VIEWPORT_RECORD_LIMIT,
                    drilldownZoom: EXACT_VIEWPORT_MIN_ZOOM
                });

                alerts.info('Map is showing GBIF aggregate count markers for all ' + totalElements + ' records. Zoom to level ' + EXACT_VIEWPORT_MIN_ZOOM + ' or closer; exact occurrence points load when the current view has ' + EXACT_VIEWPORT_RECORD_LIMIT + ' or fewer records. The table is a ' + data.length + '-record sample.');
                warnIfBoundsPredicate(searchRequest);

                if (tileState.usedBoundsFallback) {
                    alerts.warn('The table and stats use the selected polygon; aggregate map markers use its bounding box because the polygon is too large for a GBIF tile URL. Exact drilldown points still use the selected polygon.');
                }

                return queryResults;
            });
        }

        function handleAggregateClick(searchRequest, clickInfo, drilldownSessionId) {
            if (drilldownSessionId !== activeDrilldownSessionId || !clickInfo || !clickInfo.bounds) {
                return;
            }

            if (clickInfo.total > AGGREGATE_CLICK_TOTAL_LIMIT) {
                if (queryMap.openGBIFMessagePopup) {
                    queryMap.openGBIFMessagePopup(
                        clickInfo.latlng,
                        'GBIF aggregate',
                        'This aggregate contains about ' + formatDisplayCount(clickInfo.total) + ' occurrence records. Zoom in or add filters before opening record previews.'
                    );
                }
                return $q.when();
            }

            var requestId = ++aggregateClickRequestId;
            var clickedRequest = buildViewportSearchRequest(searchRequest, clickInfo.bounds);

            return queryService.queryPredicate(clickedRequest, {
                limit: AGGREGATE_CLICK_RECORD_LIMIT,
                offset: 0,
                preserveAlerts: true
            }).then(function (results) {
                if (requestId !== aggregateClickRequestId || drilldownSessionId !== activeDrilldownSessionId) {
                    return results;
                }

                queryMap.openGBIFRecordPopup(results.data || [], clickInfo.latlng, {
                    totalElements: results.totalElements || 0,
                    resultLimit: AGGREGATE_CLICK_RECORD_LIMIT,
                    title: 'GBIF records in clicked cluster'
                });

                return results;
            }).catch(function (err) {
                if (requestId !== aggregateClickRequestId || drilldownSessionId !== activeDrilldownSessionId) {
                    return;
                }

                if (queryMap.openGBIFMessagePopup) {
                    queryMap.openGBIFMessagePopup(clickInfo.latlng, 'GBIF records', 'Unable to load records for this cluster.');
                }
                console.log('gbif-aggregate-click-error:', err);
            });
        }

        function handleViewportChange(searchRequest, bounds, zoom, drilldownSessionId) {
            if (drilldownSessionId !== activeDrilldownSessionId || !bounds) {
                return;
            }

            var requestId = ++viewportRequestId;
            var currentZoom = getDrilldownZoom(zoom);

            if (currentZoom < EXACT_VIEWPORT_MIN_ZOOM) {
                showAggregateMode();
                return $q.when();
            }

            var viewportRequest = buildViewportSearchRequest(searchRequest, bounds);

            return queryService.queryCount(viewportRequest, {
                preserveAlerts: true
            }).then(function (countResults) {
                var viewportTotal = countResults.totalElements || 0;

                if (requestId !== viewportRequestId || drilldownSessionId !== activeDrilldownSessionId) {
                    return countResults;
                }

                if (viewportTotal > EXACT_VIEWPORT_RECORD_LIMIT) {
                    showAggregateMode();
                    return countResults;
                }

                return loadViewportRecordSet(viewportRequest, viewportTotal, requestId, drilldownSessionId);
            }).catch(function (err) {
                if (requestId !== viewportRequestId || drilldownSessionId !== activeDrilldownSessionId) {
                    return;
                }

                if (!drilldownErrorShown) {
                    drilldownErrorShown = true;
                    console.log('GBIF exact drilldown query failed; keeping aggregate map markers visible.');
                }
                queryMap.showGBIFAggregateTiles();
                console.log('gbif-drilldown-error:', err);
            });
        }

        function loadViewportRecordSet(viewportRequest, totalElements, requestId, drilldownSessionId) {
            var promises = [];

            for (var offset = 0; offset < totalElements; offset += PAGE_LIMIT) {
                promises.push(queryService.queryPredicate(viewportRequest, {
                    limit: PAGE_LIMIT,
                    offset: offset,
                    preserveAlerts: true
                }));
            }

            if (promises.length === 0) {
                queryMap.showGBIFExactMarkers([]);
                lastViewportMode = 'exact';
                return $q.when([]);
            }

            return $q.all(promises)
                .then(function (pages) {
                    var data = [];

                    if (requestId !== viewportRequestId || drilldownSessionId !== activeDrilldownSessionId) {
                        return data;
                    }

                    angular.forEach(pages, function (page) {
                        data = data.concat(page.data || []);
                    });

                    queryMap.showGBIFExactMarkers(data);
                    lastViewportMode = 'exact';

                    return data;
                });
        }

        function buildViewportSearchRequest(searchRequest, bounds) {
            var request = angular.extend({}, searchRequest);
            var body = angular.copy(searchRequest.predicateBody || {});
            var predicates = [];

            delete body.limit;
            delete body.offset;
            delete body.facets;
            delete body.facetLimit;

            if (body.predicate) {
                predicates.push(body.predicate);
            }
            addViewportBoundsPredicates(predicates, bounds);

            if (predicates.length === 1) {
                body.predicate = predicates[0];
            } else if (predicates.length > 1) {
                body.predicate = {
                    type: 'and',
                    predicates: predicates
                };
            } else {
                delete body.predicate;
            }

            request.predicateBody = body;
            return request;
        }

        function addViewportBoundsPredicates(predicates, bounds) {
            var south = clampLatitude(Math.min(bounds.getSouth(), bounds.getNorth()));
            var north = clampLatitude(Math.max(bounds.getSouth(), bounds.getNorth()));
            var longitudePredicate = buildLongitudePredicate(bounds.getWest(), bounds.getEast());

            predicates.push(rangePredicate('DECIMAL_LATITUDE', south, north));

            if (longitudePredicate) {
                predicates.push(longitudePredicate);
            }
        }

        function buildLongitudePredicate(west, east) {
            var span = east - west;

            if (!isFinite(west) || !isFinite(east)) {
                return null;
            }

            if (span < 0) {
                span += 360;
            }
            if (span >= 360) {
                return null;
            }

            west = normalizeLongitude(west);
            east = normalizeLongitude(east);

            if (west <= east) {
                return rangePredicate('DECIMAL_LONGITUDE', west, east);
            }

            return {
                type: 'or',
                predicates: [
                    rangePredicate('DECIMAL_LONGITUDE', west, 180),
                    rangePredicate('DECIMAL_LONGITUDE', -180, east)
                ]
            };
        }

        function rangePredicate(key, gte, lte) {
            return {
                type: 'range',
                key: key,
                value: {
                    gte: formatNumber(gte),
                    lte: formatNumber(lte)
                }
            };
        }

        function clampLatitude(value) {
            return Math.max(-90, Math.min(90, Number(value)));
        }

        function normalizeLongitude(value) {
            var longitude = Number(value);

            while (longitude < -180) {
                longitude += 360;
            }
            while (longitude > 180) {
                longitude -= 360;
            }

            return longitude;
        }

        function formatNumber(value) {
            return Number(value).toString();
        }

        function formatDisplayCount(value) {
            return String(Math.round(Number(value) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        }

        function getDrilldownZoom(zoom) {
            var currentZoom = Number(zoom);

            if (!isFinite(currentZoom) && queryMap.getZoom) {
                currentZoom = Number(queryMap.getZoom());
            }

            if (!isFinite(currentZoom)) {
                return 0;
            }

            return currentZoom;
        }

        function showAggregateMode() {
            if (lastViewportMode !== 'aggregate') {
                queryMap.showGBIFAggregateTiles();
            }
            lastViewportMode = 'aggregate';
        }

        function removeAlert(msg) {
            var currentAlerts = alerts.getAlerts();

            for (var i = currentAlerts.length - 1; i >= 0; i--) {
                if (currentAlerts[i].msg === msg) {
                    alerts.remove(currentAlerts[i]);
                }
            }
        }

        function warnIfBoundsPredicate(searchRequest) {
            if (searchRequest.usedBoundsFallback) {
                alerts.warn(COMPLEX_POLYGON_FALLBACK_WARNING);
            } else if (searchRequest.usesBoundsPredicate) {
                alerts.warn('The selected layer could not be converted to a polygon; GBIF search is using its bounding box.');
            }
        }
    }
})();
