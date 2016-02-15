'use strict';

var _ = require('lodash'),
    async = require('async'),
    fs = require('fs-extra'),
    glob = require('glob'),
    path = require('path'),
    util = require('../common/util');

var mapping = require('../../fp/_mapping'),
    templatePath = path.join(__dirname, 'template/modules'),
    template = util.globTemplate(path.join(templatePath, '*.jst'));

var aryMethods = _.union(
  mapping.aryMethod[1],
  mapping.aryMethod[2],
  mapping.aryMethod[3],
  mapping.aryMethod[4]
);

var categories = [
  'array',
  'collection',
  'date',
  'function',
  'lang',
  'math',
  'number',
  'object',
  'seq',
  'string',
  'util'
];

var ignored = [
  '_*.js',
  'core.js',
  'fp.js',
  'index.js',
  'lodash.js'
];

function copyFile(srcPath, destPath) {
  return _.partial(fs.copy, srcPath, destPath);
}

function isAlias(funcName) {
  return _.has(mapping.aliasToReal, funcName);
}

function isCategory(funcName) {
  return _.includes(categories, funcName);
}

function isThru(funcName) {
  return !_.includes(aryMethods, funcName);
}

function getTemplate(moduleName) {
  var data = {
    'name': _.result(mapping.aliasToReal, moduleName, moduleName),
    'rename': mapping.rename
  };

  if (isAlias(moduleName)) {
    return template.alias(data);
  }
  if (isCategory(moduleName)) {
    return template.category(data);
  }
  if (isThru(moduleName)) {
    return template.thru(data);
  }
  return template.module(data);
}

function writeFile(filePath, data) {
  return _.partial(fs.writeFile, filePath, data);
}

/*----------------------------------------------------------------------------*/

function onComplete(error) {
  if (error) {
    throw error;
  }
}

function build(target) {
  var fpPath = path.join(target, 'fp');

  // Glob existing lodash module paths.
  var modulePaths = glob.sync(path.join(target, '*.js'), {
    'nodir': true,
    'ignore': ignored.map(function(filename) {
      return path.join(target, filename);
    })
  });

  // Add FP alias and remapped module paths.
  _.each([mapping.aliasToReal, mapping.rename], function(data) {
    _.forOwn(data, function(realName, alias) {
      if (!_.startsWith(alias, '_')) {
        modulePaths.push(path.join(target, alias + '.js'));
      }
    });
  });

  modulePaths = _.uniq(modulePaths);

  var actions = modulePaths.map(function(modulePath) {
    var moduleName = path.basename(modulePath, '.js');
    return writeFile(path.join(fpPath, moduleName + '.js'), getTemplate(moduleName));
  });

  actions.unshift(copyFile(path.join(__dirname, '../../fp'), fpPath));
  actions.push(writeFile(path.join(target, 'fp.js'), template.fp()));
  actions.push(writeFile(path.join(fpPath, 'convert.js'), template.convert()));
  actions.push(writeFile(path.join(fpPath, '_util.js'), template._util()));

  async.series(actions, onComplete);
}

build(_.last(process.argv));