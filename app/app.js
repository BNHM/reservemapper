'use strict';

// Declare app level module which depends on views, and components
angular.module('myApp', ['ngRoute', 'map.query'])

    .config(['$locationProvider', '$routeProvider', function ($locationProvider, $routeProvider) {
        $locationProvider.html5Mode(true);

        $routeProvider.otherwise({redirectTo: '/'});
    }])

    .constant("MAPBOX_TOKEN", "pk.eyJ1Ijoicm9kbmV5NzU3IiwiYSI6ImNqNGg2b3FwNDAwYzczN241ajZxMzk1eGwifQ.ORi2we67jDX-cxd9RDmugw");
