'use strict';

angular.module('map.query')

    .config(['$routeProvider', function ($routeProvider) {
        $routeProvider.when('/', {
            templateUrl: 'query/query.html',
            controller: 'QueryController',
            controllerAs: 'vm'
        });
    }]);

