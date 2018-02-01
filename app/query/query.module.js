(function () {
    'use strict';

    angular.module('map.query', ['ngRoute', 'angularSpinner', 'map.map', 'map.alerts', 'map.filters.html', 
        'ui.bootstrap', 'ui.bootstrap.showErrors', 'ngSanitize', 'ngCsv', 'dataGrid', 'pagination']);
})();
