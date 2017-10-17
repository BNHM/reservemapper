(function () {
    'use strict';

    angular.module('map.query')
        .factory('QueryBuilder', QueryBuilder);

    QueryBuilder.$inject = [];

    function QueryBuilder() {

        function QueryBuilder() {
            this.queryString = "";
        }

        QueryBuilder.prototype = {

            add: function (key, val) {
                if (!this._isEmpty()) {
                    this.queryString += "&";
                }

		// Requests to GBIF for Basis of Record only work when each BOR call is its own 
		// query string
		if (key == "basisOfRecord") {
		    var i = 0
		    for (var bor in val) {
                         this.queryString += key + "=" + val[bor];
			 if (i < val.length) {
			     this.queryString += "&";
			 }
			 i++
		    }
		// All other calls take multiple values as comma separated
		} else {
                    this.queryString += key + "=" + val;
		}
            },

            build: function () {
                if (this._isEmpty()) {
                    this.queryString = "q=*";
                }
                return String(this.queryString);
            },

            _isEmpty: function() {
                return this.queryString.trim().length === 0;
            }
        };

        return QueryBuilder;
    }

})();
