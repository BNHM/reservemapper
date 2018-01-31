var gulp = require('gulp');
var usemin = require('gulp-usemin');
var uglify = require('gulp-uglify');
var minifyCss = require('gulp-minify-css');
var replace = require('gulp-replace');
var rimraf = require('rimraf');

gulp.task('default', ['copy-assets'], function() {
    gulp.src(['app/**/*.html', 'app/**/*.ico', '!app/index-async.html', '!app/bower_components/**/*.html'])
        .pipe(usemin({
            assetsDir: 'app',
            css: [minifyCss(), 'concat'],
            modernizer: [],
            minJs: []
        }))
        .pipe(replace('<base href="/">', '<base href="/">'))
        .pipe(gulp.dest('public'));
});

gulp.task('copy-assets', function() {
    gulp.src('app/*.css')
        .pipe(gulp.dest('public/'));
    gulp.src('app/*.js')
        .pipe(gulp.dest('public/'));

    gulp.src('app/filters/**/*')
        .pipe(gulp.dest('public/filters/'));
    gulp.src('app/directives/**/*')
        .pipe(gulp.dest('public/directives/'));
    gulp.src('app/components/**/*')
        .pipe(gulp.dest('public/components/'));
    gulp.src('app/query/**/*')
        .pipe(gulp.dest('public/query/'));
    gulp.src('app/*.png')
        .pipe(gulp.dest('public/'));
    gulp.src('app/bower_components/bootstrap/dist/fonts/**/*')
        .pipe(gulp.dest('public/fonts/'));
    gulp.src('app/bower_components/leaflet/dist/images/**/*')
        .pipe(gulp.dest('public/css/images/'));
    gulp.src('app/bower_components/leaflet/dist/leaflet.css')
        .pipe(gulp.dest('public/bower_components/leaflet/dist/'));
    gulp.src('app/bower_components/leaflet.markercluster/dist/*.css')
        .pipe(gulp.dest('public/bower_components/leaflet.markercluster/dist/'));
    gulp.src('app/bower_components/html5-boilerplate/dist/js/vendor/modernizr-3.5.0.min.js')
        .pipe(gulp.dest('public/bower_components/html5-boilerplate/dist/js/vendor/'));
    gulp.src('app/bower_components/jquery/dist/jquery.min.js')
        .pipe(gulp.dest('public/bower_components/jquery/dist/'));
    gulp.src('app/bower_components/jquery-ui/jquery-ui.min.js')
        .pipe(gulp.dest('public/bower_components/jquery-ui/'));
    gulp.src('app/bower_components/angular/angular.min.js')
        .pipe(gulp.dest('public/bower_components/angular/'));
    gulp.src('app/bower_components/angular-route/angular-route.min.js')
        .pipe(gulp.dest('public/bower_components/angular-route/'));
    gulp.src('app/bower_components/leaflet/dist/leaflet.js')
        .pipe(gulp.dest('public/bower_components/leaflet/dist/'));
    gulp.src('app/bower_components/leaflet.markercluster/dist/leaflet.markercluster.js')
        .pipe(gulp.dest('public/bower_components/leaflet.markercluster/dist/'));
    gulp.src('app/bower_components/leaflet-spin/leaflet.spin.js')
        .pipe(gulp.dest('public/bower_components/leaflet-spin/'));
    gulp.src('app/bower_components/angular-spinner/dist/angular-spinner.min.js')
        .pipe(gulp.dest('public/bower_components/angular-spinner/dist/'));
    gulp.src('app/bower_components/angular-bootstrap/ui-bootstrap-tpls.min.js')
        .pipe(gulp.dest('public/bower_components/angular-bootstrap/'));
    gulp.src('app/bower_components/spin.js/spin.js')
        .pipe(gulp.dest('public/bower_components/spin.js/'));
    gulp.src('app/bower_components/angular-sanitize/angular-sanitize.min.js')
        .pipe(gulp.dest('public/bower_components/angular-sanitize/'));
    gulp.src('app/bower_components/ng-csv/build/ng-csv.min.js')
        .pipe(gulp.dest('public/bower_components/ng-csv/build/'));

     // gulp.src('app/query/spatialLayers.json')
     //   .pipe(gulp.dest('public/query/'));
});

gulp.task('clean', function(cb) {
    rimraf('./public', cb);
});
