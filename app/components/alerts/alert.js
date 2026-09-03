(function() {
    'use strict';

    angular.module('map.alerts')
        .factory('alerts', alerts);

    alerts.$inject = [];

    function alerts() {
        var alerts = [];

        var service = {
            info: info,
            success: success,
            warn: warn,
            error: error,
            getAlerts: getAlerts,
            clear: clear,
            remove: remove,
            removeTmp: removeTmp
        };

        return service;

        function info(msg, persist) {
            alerts.push(new Message(msg, 'info', persist))
        }

        function success(msg, persist) {
            alerts.push(new Message(msg, 'success', persist))
        }

        function warn(msg, persist) {
            alerts.push(new Message(msg, 'warning', persist))
        }

        function error(msg, persist) {
            alerts.push(new Message(msg, 'error', persist))
        }

        function getAlerts() {
            return alerts;
        }

        function remove(alert) {
            var i = alerts.indexOf(alert);
            alerts.splice(i, 1);
        }

        function clear() {
            alerts.length = 0;
        }

        function removeTmp() {
            for (var i = alerts.length - 1; i >= 0; i--) {
                if (!alerts[i].persist) {
                    alerts.splice(i, 1);
                }
            }
        }
    }

    function Message(msg, level, persist) {
        this.msg = msg;
        this.level = level;
        this.persist = persist || false;
    }
})();
