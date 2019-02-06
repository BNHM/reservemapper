(function () {
    'use strict';

    angular.module('map.query')
        .factory('ChecklistBuilder', ChecklistBuilder);

    ChecklistBuilder.$inject = [];

    function ChecklistBuilder() {

        function ChecklistBuilder() {
            this.queryString = "";
        }

        ChecklistBuilder.prototype = {

            add: function (key, val) {
                if (!this._isEmpty()) {
                    this.queryString += "&";
                }
		if (key == "checkList") {
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

        return ChecklistBuilder;
    }

})();
