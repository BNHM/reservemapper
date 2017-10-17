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
            js: [uglify, 'concat'],
            modernizer: [],
            minJs: []
        }))
        .pipe(replace('<base href="/">', '<base href="/">'))
        .pipe(gulp.dest('public'));
});

gulp.task('copy-assets', function() {
    gulp.src('app/bower_components/bootstrap/dist/fonts/**/*')
        .pipe(gulp.dest('public/fonts/'));

    gulp.src('app/bower_components/leaflet/dist/images/**/*')
        .pipe(gulp.dest('public/css/images/'));

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

    gulp.src('app/query/spatialLayers.json')
        .pipe(gulp.dest('public/query/'));
});

gulp.task('clean', function(cb) {
    rimraf('./public', cb);
});
