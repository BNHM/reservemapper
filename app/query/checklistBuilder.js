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

                this.queryString += key + "=" + val;
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
