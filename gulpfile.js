var gulp = require('gulp');
var usemin = require('gulp-usemin');
var uglify = require('gulp-uglify');
var minifyCss = require('gulp-minify-css');
var replace = require('gulp-replace');
var rimraf = require("rimraf");



function fonts() {
    return gulp
    	.src('app/bower_components/bootstrap/dist/fonts/**/*')
	.pipe(gulp.dest("public/fonts/"));
}
function cssimages() {
    return gulp
    	.src('app/bower_components/leaflet/dist/images/**/*')
	.pipe(gulp.dest("public/css/images/"));
}
function images() {
    return gulp
    	.src('app/images/*.png')
	.pipe(gulp.dest("public/images"));
}

function core() {
    return gulp
    .src(['app/**/*.html', 'app/**/*.ico', '!app/index-async.html', '!app/bower_components/**/*.html', 'app/**/*'])
        .pipe(gulp.dest('public'))
        .pipe(replace('<base href="/">', '<base href="/">'))
}

// Clean assets
function clean(cb) {
  return rimraf("./public/",cb);
}

const build = gulp.series(core, images, cssimages, fonts);

// export tasks
exports.default = build;
exports.clean = clean;
