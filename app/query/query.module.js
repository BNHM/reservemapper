(function () {
    'use strict';

    var queryModule = angular.module('map.query', ['ngRoute', 'angularSpinner', 'map.map', 'map.alerts', 'map.filters.html', 
        'ui.bootstrap', 'ui.bootstrap.showErrors', 'ngSanitize', 'ngCsv', 'dataGrid', 'pagination', 'ngModal']);
    //queryModule.value  ("showPopup"  , true);

})();
