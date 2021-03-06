
'use strict';

var nconf = require('nconf'),
	fs = require('fs'),
	path = require('path'),
	async = require('async'),
	db = require('../database');

module.exports = function(Meta) {
	Meta.themes = {};

	Meta.themes.get = function (callback) {
		var themePath = nconf.get('themes_path');
		if (typeof themePath !== 'string') {
			return callback(null, []);
		}

		fs.readdir(themePath, function (err, files) {
			if (err) {
				return callback(err);
			}

			async.filter(files, function (file, next) {
				fs.stat(path.join(themePath, file), function (err, fileStat) {
					if (err) {
						return next(false);
					}

					next((fileStat.isDirectory() && file.slice(0, 13) === 'nodebb-theme-'));
				});
			}, function (themes) {
				async.map(themes, function (theme, next) {
					var config = path.join(themePath, theme, 'theme.json');

					if (fs.existsSync(config)) {
						fs.readFile(config, function (err, file) {
							if (err) {
								return next();
							} else {
								var configObj = JSON.parse(file.toString());
								next(err, configObj);
							}
						});
					} else {
						next();
					}
				}, function (err, themes) {
					themes = themes.filter(function (theme) {
						return (theme !== undefined);
					});
					callback(null, themes);
				});
			});
		});
	};

	Meta.themes.set = function(data, callback) {
		var	themeData = {
			'theme:type': data.type,
			'theme:id': data.id,
			'theme:staticDir': '',
			'theme:templates': '',
			'theme:src': ''
		};

		switch(data.type) {
		case 'local':
			async.waterfall([
				function(next) {
					fs.readFile(path.join(nconf.get('themes_path'), data.id, 'theme.json'), function(err, config) {
						if (!err) {
							config = JSON.parse(config.toString());
							next(null, config);
						} else {
							next(err);
						}
					});
				},
				function(config, next) {
					themeData['theme:staticDir'] = config.staticDir ? config.staticDir : '';
					themeData['theme:templates'] = config.templates ? config.templates : '';
					themeData['theme:src'] = '';

					db.setObject('config', themeData, next);
				}
			], callback);

			Meta.restartRequired = true;
			break;

		case 'bootswatch':
			Meta.configs.set('theme:src', data.src, callback);
			break;
		}
	};

};