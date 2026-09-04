(function () {
    'use strict';

    angular.module('map.query')
        .factory('GBIFChecklistService', GBIFChecklistService);

    GBIFChecklistService.$inject = ['queryService', 'queryResults', 'alerts', '$q'];

    function GBIFChecklistService(queryService, queryResults, alerts, $q) {
        var SPECIES_FACET = 'SPECIES_KEY';
        var SCIENTIFIC_NAME_FACET = 'SCIENTIFIC_NAME';
        var YEAR_FACET = 'YEAR';
        var FACET_PAGE_LIMIT = 500;
        var CHECKLIST_ROW_LIMIT = 10000;
        var YEAR_FACET_LIMIT = 1000;
        var TAXONOMY_CONCURRENCY = 6;
        var LOADING_ALERT = 'Loading GBIF observed species checklist...';
        var COMPLEX_POLYGON_FALLBACK_WARNING = 'GBIF rejected this complex polygon. Checklist results are using the selected layer bounding box, so species from outside the boundary may be included.';
        var DOWNLOAD_COLUMNS = [
            'family',
            'genus',
            'specific_epithet',
            'scientific_name',
            'begin_date',
            'recorded_by',
            'remote_resource',
            'occurrence_count',
            'gbif_taxon_key'
        ];

        var service = {
            query: query,
            ensureTaxonomy: ensureTaxonomy,
            ensureTaxonomyForRows: ensureTaxonomyForRows,
            ensureEvidence: ensureEvidence,
            downloadRows: downloadRows,
            scientificNameCounts: scientificNameCounts,
            downloadColumns: downloadColumns,
            rowLimit: rowLimit
        };

        return service;

        function query(searchRequest) {
            if (!searchRequest) {
                return $q.reject(new Error('No GBIF search request is available for checklist.'));
            }

            alerts.removeTmp();
            alerts.info(LOADING_ALERT);

            return loadChecklistForRequest(searchRequest)
                .catch(function (err) {
                    return retryChecklistWithBoundsFallback(searchRequest, err);
                })
                .catch(function (err) {
                    queryResults.isSet = false;
                    alerts.error('Failed to load GBIF checklist');
                    console.log('checklist-query-error:', err);
                    throw err;
                })
                .finally(function () {
                    removeAlert(LOADING_ALERT);
                });
        }

        function loadChecklistForRequest(searchRequest) {
            return loadFacetPages(searchRequest, 0, [], 0)
                .then(function (result) {
                    queryResults.update({
                        querySource: 'gbif-checklist',
                        size: result.rows.length,
                        totalElements: result.rows.length,
                        occurrenceTotalElements: result.occurrenceTotalElements,
                        data: result.rows,
                        toFetch: result.rows.length,
                        isSet: true,
                        isCompleteRecordSet: !result.truncated,
                        usingTileMap: false,
                        mapUsesBoundsFallback: false,
                        searchRequest: searchRequest,
                        sampleLimit: result.rows.length,
                        drilldownLimit: 0,
                        drilldownZoom: 0,
                        checklistLimit: CHECKLIST_ROW_LIMIT,
                        checklistTruncated: result.truncated
                    });

                    if (result.rows.length === 0) {
                        alerts.info('No checklist species found.');
                    }
                    if (result.truncated) {
                        alerts.warn('Checklist is limited to the first ' + CHECKLIST_ROW_LIMIT + ' species by GBIF occurrence count.');
                    }
                    warnIfBoundsPredicate(searchRequest);

                    return queryResults;
                });
        }

        function retryChecklistWithBoundsFallback(searchRequest, err) {
            var fallbackRequest = queryService.boundsFallbackRequest(searchRequest);

            if (!fallbackRequest) {
                return $q.reject(err);
            }

            console.log('checklist-exact-polygon-query-error:', err);
            return loadChecklistForRequest(fallbackRequest);
        }

        function ensureEvidence(row) {
            var evidenceRequest;

            if (!row || !row.speciesKey) {
                return $q.when(row);
            }
            if (row.evidenceStatus === 'loaded') {
                return $q.when(row);
            }
            if (row.evidenceStatus === 'loading' && row._evidencePromise) {
                return row._evidencePromise;
            }

            row.evidenceStatus = 'loading';
            evidenceRequest = addSpeciesPredicate(queryResults.searchRequest, row.speciesKey);

            row._evidencePromise = $q.all([
                ensureTaxonomy(row),
                queryService.queryPredicate(evidenceRequest, {
                    limit: 1,
                    offset: 0,
                    facets: [YEAR_FACET],
                    facetLimit: YEAR_FACET_LIMIT,
                    preserveAlerts: true
                })
            ]).then(function (results) {
                applyOccurrenceEvidence(row, results[1]);
                row.evidenceStatus = 'loaded';
                row._evidencePromise = null;
                return row;
            }, function (err) {
                row.evidenceStatus = 'error';
                row.evidenceError = 'Unable to load occurrence evidence.';
                row._evidencePromise = null;
                console.log('checklist-evidence-error:', err);
                return row;
            });

            return row._evidencePromise;
        }

        function ensureTaxonomy(row) {
            if (!row || !row.speciesKey) {
                return $q.when(row);
            }
            if (row.taxonomyStatus === 'loaded') {
                return $q.when(row);
            }
            if (row.taxonomyStatus === 'loading' && row._taxonomyPromise) {
                return row._taxonomyPromise;
            }

            row.taxonomyStatus = 'loading';
            row._taxonomyPromise = queryService.taxonDetails(row.speciesKey)
                .then(function (details) {
                    applyTaxonDetails(row, details);
                    row.taxonomyStatus = 'loaded';
                    row._taxonomyPromise = null;
                    return row;
                }, function (err) {
                    row.taxonomyStatus = 'error';
                    row.taxonomyError = 'Unable to load taxonomy.';
                    row._taxonomyPromise = null;
                    console.log('checklist-taxonomy-error:', err);
                    syncLegacyFields(row);
                    return row;
                });

            return row._taxonomyPromise;
        }

        function ensureTaxonomyForRows(rows, options) {
            var items = rows || [];
            var requestOptions = options || {};
            var nextIndex = 0;
            var completeCount = 0;
            var workers = [];
            var workerCount = Math.min(TAXONOMY_CONCURRENCY, items.length);

            if (!items.length) {
                return $q.when(items);
            }

            for (var i = 0; i < workerCount; i++) {
                workers.push(loadNextTaxon());
            }

            return $q.all(workers).then(function () {
                return items;
            });

            function loadNextTaxon() {
                var row;

                if (nextIndex >= items.length) {
                    return $q.when();
                }

                row = items[nextIndex++];
                return ensureTaxonomy(row)
                    .finally(function () {
                        completeCount++;
                        if (angular.isFunction(requestOptions.onProgress)) {
                            requestOptions.onProgress(completeCount, items.length);
                        }
                    })
                    .then(loadNextTaxon);
            }
        }

        function downloadRows(searchRequest, options) {
            if (!searchRequest) {
                return $q.reject(new Error('No GBIF search request is available for checklist download.'));
            }

            return loadScientificNameFacetPages(searchRequest, 0, [], 0, options || {})
                .then(function (result) {
                    var rows = result.rows.map(scientificNameDownloadRow);

                    return {
                        data: rows,
                        totalElements: result.occurrenceTotalElements,
                        loadedLimit: rows.length,
                        truncated: result.truncated,
                        failed: result.failed
                    };
                }, function (err) {
                    var fallbackRows = queryResults.data || [];

                    console.log('checklist-download-facet-error:', err);
                    if (!fallbackRows.length) {
                        throw err;
                    }

                    angular.forEach(fallbackRows, syncLegacyFields);
                    return {
                        data: fallbackRows,
                        totalElements: queryResults.occurrenceTotalElements || queryResults.totalElements || fallbackRows.length,
                        loadedLimit: fallbackRows.length,
                        truncated: queryResults.checklistTruncated || false,
                        failed: true
                    };
                });
        }

        function scientificNameCounts(searchRequest, options) {
            if (!searchRequest) {
                return $q.reject(new Error('No GBIF search request is available for checklist stats.'));
            }

            return loadScientificNameFacetPages(searchRequest, 0, [], 0, options || {});
        }

        function downloadColumns() {
            return DOWNLOAD_COLUMNS.slice();
        }

        function rowLimit() {
            return CHECKLIST_ROW_LIMIT;
        }

        function loadFacetPages(searchRequest, facetOffset, rows, occurrenceTotalElements) {
            if (rows.length >= CHECKLIST_ROW_LIMIT) {
                return $q.when({
                    rows: rows,
                    occurrenceTotalElements: occurrenceTotalElements,
                    truncated: true
                });
            }

            return queryService.queryFacet(searchRequest, SPECIES_FACET, {
                facetLimit: FACET_PAGE_LIMIT,
                facetOffset: facetOffset
            }).then(function (results) {
                var counts = (results.facets && results.facets[SPECIES_FACET]) || [];
                var totalOccurrenceRecords = facetOffset === 0 ? results.totalElements : occurrenceTotalElements;
                var overflow = false;

                for (var i = 0; i < counts.length; i++) {
                    if (rows.length >= CHECKLIST_ROW_LIMIT) {
                        overflow = true;
                        break;
                    }
                    addChecklistRow(rows, counts[i]);
                }

                if (overflow || counts.length < FACET_PAGE_LIMIT) {
                    return {
                        rows: rows,
                        occurrenceTotalElements: totalOccurrenceRecords,
                        truncated: overflow
                    };
                }

                return loadFacetPages(searchRequest, facetOffset + FACET_PAGE_LIMIT, rows, totalOccurrenceRecords);
            });
        }

        function loadScientificNameFacetPages(searchRequest, facetOffset, rows, occurrenceTotalElements, options) {
            var requestOptions = options || {};

            if (rows.length >= CHECKLIST_ROW_LIMIT) {
                return $q.when({
                    rows: rows,
                    occurrenceTotalElements: occurrenceTotalElements,
                    truncated: true,
                    failed: false
                });
            }

            return queryService.queryFacet(searchRequest, SCIENTIFIC_NAME_FACET, {
                facetLimit: FACET_PAGE_LIMIT,
                facetOffset: facetOffset
            }).then(function (results) {
                var counts = (results.facets && results.facets[SCIENTIFIC_NAME_FACET]) || [];
                var totalOccurrenceRecords = facetOffset === 0 ? results.totalElements : occurrenceTotalElements;
                var remaining = CHECKLIST_ROW_LIMIT - rows.length;

                rows.push.apply(rows, counts.slice(0, remaining));
                reportProgress(requestOptions, rows.length);

                if (counts.length < FACET_PAGE_LIMIT || rows.length >= CHECKLIST_ROW_LIMIT) {
                    return {
                        rows: rows,
                        occurrenceTotalElements: totalOccurrenceRecords,
                        truncated: rows.length >= CHECKLIST_ROW_LIMIT && counts.length === FACET_PAGE_LIMIT,
                        failed: false
                    };
                }

                return loadScientificNameFacetPages(searchRequest, facetOffset + FACET_PAGE_LIMIT, rows, totalOccurrenceRecords, requestOptions);
            }, function (err) {
                console.log('checklist-scientific-name-facet-error:', err);
                if (rows.length) {
                    return {
                        rows: rows,
                        occurrenceTotalElements: occurrenceTotalElements,
                        truncated: true,
                        failed: true
                    };
                }
                throw err;
            });
        }

        function addChecklistRow(rows, count) {
            var speciesKey = Number(count.key);

            if (!isFinite(speciesKey) || speciesKey <= 0) {
                return;
            }

            rows.push({
                speciesKey: speciesKey,
                occurrenceCount: count.value || 0,
                scientificName: '',
                canonicalName: '',
                vernacularName: '',
                kingdom: '',
                phylum: '',
                'class': '',
                order: '',
                family: '',
                genus: '',
                specificEpithet: '',
                rank: '',
                taxonomicStatus: '',
                taxonUrl: 'https://www.gbif.org/species/' + speciesKey,
                firstYear: '',
                lastYear: '',
                sampleOccurrenceKey: '',
                sampleOccurrenceUrl: '',
                sampleEventDate: '',
                sampleDatasetTitle: '',
                recordedBy: 'GBIF observed species checklist',
                taxonomyStatus: 'not-loaded',
                taxonomyError: '',
                evidenceStatus: 'not-loaded',
                evidenceError: ''
            });
            syncLegacyFields(rows[rows.length - 1]);
        }

        function scientificNameDownloadRow(count) {
            var scientificName = count.key === 'Unspecified' ? '' : count.key;
            var parsedName = parseScientificName(scientificName);
            var row = {
                speciesKey: '',
                occurrenceCount: count.value || 0,
                scientificName: scientificName,
                canonicalName: parsedName.canonicalName,
                vernacularName: '',
                kingdom: '',
                phylum: '',
                'class': '',
                order: '',
                family: '',
                genus: parsedName.genus,
                specificEpithet: parsedName.specificEpithet,
                rank: '',
                taxonomicStatus: '',
                taxonUrl: '',
                firstYear: '',
                lastYear: '',
                sampleOccurrenceKey: '',
                sampleOccurrenceUrl: '',
                sampleEventDate: '',
                sampleDatasetTitle: '',
                recordedBy: 'GBIF scientific name checklist',
                taxonomyStatus: 'facet',
                taxonomyError: '',
                evidenceStatus: 'not-loaded',
                evidenceError: ''
            };

            syncLegacyFields(row);
            return row;
        }

        function parseScientificName(scientificName) {
            var normalized = String(scientificName || '').replace(/\s+/g, ' ').trim();
            var parts = normalized.split(' ');

            return {
                canonicalName: parts.length >= 2 ? parts[0] + ' ' + parts[1] : normalized,
                genus: parts[0] || '',
                specificEpithet: parts.length >= 2 ? parts[1] : ''
            };
        }

        function addSpeciesPredicate(baseRequest, speciesKey) {
            var request = angular.extend({}, baseRequest || {});
            var body = angular.copy((baseRequest && baseRequest.predicateBody) || {});
            var speciesPredicate = {
                type: 'equals',
                key: SPECIES_FACET,
                value: String(speciesKey)
            };

            delete body.limit;
            delete body.offset;
            delete body.facets;
            delete body.facetLimit;
            delete body.facetOffset;
            body.predicate = combinePredicates(body.predicate, speciesPredicate);
            request.predicateBody = body;

            return request;
        }

        function combinePredicates(existingPredicate, extraPredicate) {
            var predicate;

            if (!existingPredicate) {
                return extraPredicate;
            }

            if (existingPredicate.type === 'and' && angular.isArray(existingPredicate.predicates)) {
                predicate = angular.copy(existingPredicate);
                predicate.predicates.push(extraPredicate);
                return predicate;
            }

            return {
                type: 'and',
                predicates: [
                    existingPredicate,
                    extraPredicate
                ]
            };
        }

        function applyTaxonDetails(row, details) {
            if (!details) {
                return;
            }

            copyIfValue(row, 'scientificName', details.scientificName);
            copyIfValue(row, 'canonicalName', details.canonicalName);
            copyIfValue(row, 'vernacularName', details.vernacularName);
            copyIfValue(row, 'kingdom', details.kingdom);
            copyIfValue(row, 'phylum', details.phylum);
            copyIfValue(row, 'class', details['class']);
            copyIfValue(row, 'order', details.order);
            copyIfValue(row, 'family', details.family);
            copyIfValue(row, 'genus', details.genus);
            copyIfValue(row, 'specificEpithet', details.specificEpithet);
            copyIfValue(row, 'rank', details.rank);
            copyIfValue(row, 'taxonomicStatus', details.taxonomicStatus);
            syncLegacyFields(row);
        }

        function applyOccurrenceEvidence(row, results) {
            var sample = (results.data || [])[0] || {};
            var yearCounts = (results.facets && results.facets[YEAR_FACET]) || [];
            var years = [];

            angular.forEach(yearCounts, function (yearCount) {
                var year = Number(yearCount.key);

                if (isFinite(year)) {
                    years.push(year);
                }
            });

            if (years.length) {
                years.sort(function (left, right) {
                    return left - right;
                });
                row.firstYear = years[0];
                row.lastYear = years[years.length - 1];
            }

            copyOccurrenceTaxonFallback(row, sample);
            row.sampleOccurrenceKey = sample.key || '';
            row.sampleOccurrenceUrl = sample.key ? 'https://www.gbif.org/occurrence/' + sample.key : '';
            row.sampleEventDate = sample.eventDate || '';
            row.sampleDatasetTitle = sample.datasetName || sample.datasetTitle || sample.datasetKey || '';
            syncLegacyFields(row);
        }

        function copyOccurrenceTaxonFallback(row, sample) {
            copyIfBlank(row, 'scientificName', sample.scientificName);
            copyIfBlank(row, 'canonicalName', sample.species || sample.scientificName);
            copyIfBlank(row, 'kingdom', sample.kingdom);
            copyIfBlank(row, 'phylum', sample.phylum);
            copyIfBlank(row, 'class', sample['class']);
            copyIfBlank(row, 'order', sample.order);
            copyIfBlank(row, 'family', sample.family);
            copyIfBlank(row, 'genus', sample.genus);
            copyIfBlank(row, 'specificEpithet', sample.specificEpithet);
        }

        function syncLegacyFields(row) {
            if (!row) {
                return;
            }

            row.specific_epithet = row.specificEpithet || '';
            row.scientific_name = row.scientificName || '';
            row.begin_date = row.firstYear || row.sampleEventDate || '';
            row.recorded_by = row.recordedBy || 'GBIF observed species checklist';
            row.remote_resource = row.taxonUrl || (row.speciesKey ? 'https://www.gbif.org/species/' + row.speciesKey : '');
            row.occurrence_count = row.occurrenceCount || 0;
            row.gbif_taxon_key = row.speciesKey || '';
        }

        function reportProgress(options, loaded) {
            if (angular.isFunction(options.onProgress)) {
                options.onProgress(loaded, CHECKLIST_ROW_LIMIT);
            }
        }

        function copyIfValue(row, key, value) {
            if (value !== undefined && value !== null && value !== '') {
                row[key] = value;
            }
        }

        function copyIfBlank(row, key, value) {
            if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
                return;
            }
            copyIfValue(row, key, value);
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
                alerts.warn('The selected layer could not be converted to a polygon; checklist search is using its bounding box.');
            }
        }
    }
})();
