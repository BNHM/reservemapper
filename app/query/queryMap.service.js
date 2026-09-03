(function () {
	'use strict';

	angular.module('map.query')
		.factory('queryMap', queryMap)
		.factory('photoViewer', function() {
			return {
				clear: function(){
					if (document.getElementById("popupContent")) {
						document.getElementById("popupContent").innerHTML = ""
					}
					if (document.getElementById("modalPopupContent")) {
						document.getElementById("modalPopupContent").innerHTML = ""
					}
					return true;
				}
			};
		})

	queryMap.$inject = ['Map'];

	function queryMap(Map) {
		var _this = this
		function QueryMap(latColumn, lngColumn) {
			Map.call(this, latColumn, lngColumn);
		}

		QueryMap.prototype = Object.create(Map.prototype);

		QueryMap.prototype.setPhoto = function (photoOption) {
			this._clearMap();
			this.photoOption = photoOption
			var this1 = this
			$('input[name=selector]').change(function(popupContent) {
				var _photo = this	
				if (this.value == 'photos'){
					this.photoOption = photoOption
					
				} else if (this.value == 'query') { 
					var _query = this
					this.photoOption != photoOption
				}
			})
		} 
	

			QueryMap.prototype.setMarkers = function (data, zoomTo, options) {
				Map.prototype.setMarkers.call(this, data, popupContent, zoomTo, options);
			};

			QueryMap.prototype.addMarkers = function (data, zoomTo, options) {
				Map.prototype.addMarkers.call(this, data, popupContent, zoomTo, options);
			};
	
		return new QueryMap('decimalLatitude', 'decimalLongitude');
	}
})();
