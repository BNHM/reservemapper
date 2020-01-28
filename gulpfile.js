var gulp = require('gulp');
var usemin = require('gulp-usemin');
var uglify = require('gulp-uglify');
var minifyCss = require('gulp-minify-css');
var replace = require('gulp-replace');
var rimraf = require("rimraf");


function core() {
    return gulp
	.src(['app/**/*', '!app/index-async.html', '!app/bower_components/**/*'])
	.pipe(gulp.dest('public'))
	.pipe(replace('<base href="/">', '<base href="/">'))
}

// Clean assets
function clean(cb) {
    return rimraf("./public/",cb);
}

const build = gulp.series(core)

// export tasks
exports.default = build;
exports.clean = clean;
