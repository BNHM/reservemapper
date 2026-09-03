(function () {
    'use strict';

    angular.module('map.query')
        .controller('QueryTableController', QueryTableController);

    QueryTableController.$inject = ['$scope', '$window', 'queryResults'];

    /**
    Manage the look and feel of the data table.  
    This controller relies heavily on the angular-data-grid package at https://www.npmjs.com/package/angular-data-grid
    */
    function QueryTableController($scope, $window, queryResults) {
        var vm = this;
        vm.queryResults = queryResults;
	vm.tableData = []

        vm.toGBIF = toGBIF;
        vm.toURL= toURL;
        vm.mediaUrl = mediaUrl;
        vm.mediaPreviewUrl = mediaPreviewUrl;
        vm.mediaLinkUrl = mediaLinkUrl;

	// Control the angular-data-grid options
	$scope.gridOptions = {
            data: [],
	    pagination: {
                 itemsPerPage: '15'
            }
        };

    	// When a user clicks on a row, send them to the record for this row
     	function toURL(key) {
            //$window.open("https://calphotos.berkeley.edu/cgi/img_query?enlarge=0000+3333+0531+0442" + key);
            $window.open(key)
     	}
    	// When a user clicks on a row, send them to the GBIF record for this row
     	function toGBIF(key) {
            $window.open("http://www.gbif.org/occurrence/" + key);
     	}

        function mediaUrl(item) {
            return mediaPreviewUrl(item);
        }

        function mediaPreviewUrl(item) {
            var mediaItems = imageMedia(item);
            return mediaItems.length ? mediaItems[0].thumbnailUrl || mediaItems[0].previewUrl || mediaItems[0].url : null;
        }

        function mediaLinkUrl(item) {
            var mediaItems = imageMedia(item);
            return mediaItems.length ? mediaItems[0].pageUrl || mediaItems[0].url || mediaItems[0].previewUrl : null;
        }

        function imageMedia(item) {
            var urls = [];
            var seen = {};

            var extensions = (item && item.extensions) || {};
            addMultimediaExtensionItems(urls, seen, extensions['http://rs.gbif.org/terms/1.0/Multimedia'], 'gbif');
            addMultimediaExtensionItems(urls, seen, extensions['http://rs.tdwg.org/ac/terms/Multimedia'], 'audubonCore');

            angular.forEach((item && item.media) || [], function (media) {
                addMediaUrl(urls, seen, media);
            });

            angular.forEach(parseAssociatedMedia(item && item.associatedMedia), function (url) {
                addMediaUrl(urls, seen, {
                    type: 'StillImage',
                    identifier: url
                });
            });

            return urls;
        }

        function addMediaUrl(urls, seen, media) {
            var mediaUrls = getMediaUrls(media);
            var url = mediaUrls.url || mediaUrls.previewUrl || mediaUrls.thumbnailUrl;
            var seenKey = mediaUrls.dedupeKey || url;

            if (!url || seen[seenKey] || !isStillImageMedia(media, url)) {
                return;
            }

            seen[seenKey] = true;
            seen[url] = true;
            urls.push({
                url: url,
                previewUrl: mediaUrls.previewUrl || url,
                thumbnailUrl: mediaUrls.thumbnailUrl || mediaUrls.previewUrl || url,
                pageUrl: mediaUrls.pageUrl
            });
        }

        function addMultimediaExtensionItems(urls, seen, records, extensionType) {
            angular.forEach(records || [], function (media) {
                var normalized = {
                    type: media['http://purl.org/dc/terms/type'],
                    format: media['http://purl.org/dc/terms/format'],
                    identifier: media['http://purl.org/dc/terms/identifier'],
                    references: media['http://purl.org/dc/terms/references'],
                    accessURI: media['http://rs.tdwg.org/ac/terms/accessURI'],
                    goodQualityAccessURI: media['http://rs.tdwg.org/ac/terms/goodQualityAccessURI'],
                    thumbnail: media['http://rs.tdwg.org/ac/terms/thumbnailAccessURI']
                };

                if (extensionType === 'audubonCore' && !normalized.type) {
                    normalized.type = media['http://rs.tdwg.org/ac/terms/subtype'];
                }

                addMediaUrl(urls, seen, normalized);
            });
        }

        function getMediaUrls(media) {
            var identifier = sanitizeMediaUrl(media && media.identifier);
            var references = sanitizeMediaUrl(media && media.references);
            var accessURI = sanitizeMediaUrl(media && media.accessURI);
            var goodQualityAccessURI = sanitizeMediaUrl(media && media.goodQualityAccessURI);
            var thumbnail = sanitizeMediaUrl(media && media.thumbnail);
            var imageUrl = firstImageUrl([
                goodQualityAccessURI,
                accessURI,
                identifier,
                thumbnail,
                references
            ]);
            var previewUrl = isImageUrl(goodQualityAccessURI) ? goodQualityAccessURI : getPreviewImageUrl(imageUrl);
            var thumbnailUrl = isImageUrl(thumbnail) ? thumbnail : getThumbnailImageUrl(imageUrl);

            return {
                url: imageUrl,
                previewUrl: previewUrl,
                thumbnailUrl: thumbnailUrl,
                pageUrl: firstPageUrl([references, identifier, accessURI]),
                dedupeKey: getMediaDedupeKey([identifier, accessURI, goodQualityAccessURI, thumbnail, references], imageUrl)
            };
        }

        function getMediaDedupeKey(urls, fallbackUrl) {
            for (var i = 0; i < urls.length; i++) {
                if (isImageUrl(urls[i])) {
                    return getInaturalistMediaIdentity(urls[i]) || urls[i];
                }
            }

            for (var j = 0; j < urls.length; j++) {
                if (urls[j]) {
                    return getInaturalistMediaIdentity(urls[j]) || urls[j];
                }
            }

            return getInaturalistMediaIdentity(fallbackUrl) || fallbackUrl || '';
        }

        function getInaturalistMediaIdentity(url) {
            var text = sanitizeMediaUrl(url);
            var match;

            if (!text || text.toLowerCase().indexOf('inaturalist') === -1) {
                return '';
            }

            match = text.match(/^(https?:\/\/[^?#]*\/photos\/\d+)(?:\/|$)/i);
            return match ? match[1].toLowerCase() : '';
        }

        function firstImageUrl(urls) {
            for (var i = 0; i < urls.length; i++) {
                if (isImageUrl(urls[i])) {
                    return urls[i];
                }
            }

            return '';
        }

        function firstPageUrl(urls) {
            for (var i = 0; i < urls.length; i++) {
                if (urls[i] && !isImageUrl(urls[i])) {
                    return urls[i];
                }
            }

            return '';
        }

        function getPreviewImageUrl(url) {
            return getInaturalistImageVariant(url, 'medium') || url;
        }

        function getThumbnailImageUrl(url) {
            return getInaturalistImageVariant(url, 'thumb') || getPreviewImageUrl(url);
        }

        function getInaturalistImageVariant(url, variant) {
            var text = sanitizeMediaUrl(url);
            var match;

            if (!text || text.toLowerCase().indexOf('inaturalist') === -1) {
                return '';
            }

            match = text.match(/^(https?:\/\/[^?#]*\/photos\/\d+\/)([^\/?#]+?)(\.(?:jpe?g|png|gif|webp))([?#].*)?$/i);
            if (!match || !/^(original|large|medium|small|square|thumb)$/i.test(match[2])) {
                return '';
            }

            return match[1] + variant + match[3] + (match[4] || '');
        }

        function isStillImageMedia(media, url) {
            var type = String((media && media.type) || '').toLowerCase();
            var format = String((media && media.format) || '').toLowerCase();

            return type === 'stillimage' ||
                type === 'still image' ||
                type === 'image' ||
                format.indexOf('image/') === 0 ||
                isImageUrl(url);
        }

        function parseAssociatedMedia(value) {
            if (!value) {
                return [];
            }

            return String(value).split('|').map(function (url) {
                return url.trim();
            }).filter(Boolean);
        }

        function sanitizeMediaUrl(url) {
            var text = String(url || '').trim();

            if (/^https?:\/\//i.test(text)) {
                return text;
            }
            if (/^\/\//.test(text)) {
                return 'https:' + text;
            }

            return '';
        }

        function isImageUrl(url) {
            return /\.(jpg|jpeg|png|gif|webp)(\?|#|$)/i.test(String(url || ''));
        }

	// Watch for when the queryResults data changes, then run this function
	$scope.$watchCollection('queryTableVm.queryResults.data', function () {
	    $scope.gridOptions.data = vm.queryResults.data
            $scope.gridOptions.pagination.totalItems=vm.queryResults.data.length
     	});
    }
})();
