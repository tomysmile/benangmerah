// helpers
// All members of module.exports will be registered as a hbs helper

var traverse = require('traverse');
var _ = require('lodash');

var shared = require('./shared');
var Handlebars = require('hbs').handlebars;

var helpers = module.exports;

helpers.ldValue = function(value) {
  return shared.getLdValue(value);
}

// Show a preferred label based on locale and other heuristics
helpers.preferredLabel = function() {
  if (arguments.length === 1) {
    var resource = this;
  }
  else {
    var resource = arguments[0];
  }

  return shared.getPreferredLabel(resource);
}

helpers.descriptionLink = function(value, lbl, options) {
  var hash = (options && options.hash) || {};
  if (typeof value === 'string') {
    var uri = value;
  }
  else {
    var uri = value['@id'];
  }

  if (hash.raw) {
    var descriptionPath = uri;
  }
  else {
    var descriptionPath = shared.getDescriptionPath(uri);
  }

  var label;
  if (arguments.length === 3 && lbl)
    label = lbl;
  if (!label)
    label = shared.getPreferredLabel(value);
  if (!label)
    label = uri;

  return new Handlebars.SafeString('<a href="' + descriptionPath + '">' + label + '</a>');
}

helpers.ldObject = function(ldObj) {
  if (ldObj instanceof Array) {
    ldObj = ldObj.map(helpers.ldObject);
    return new Handlebars.SafeString(ldObj.join(', '));
  }
  if (typeof ldObj === 'string') {
    return ldObj;
  }
  else if (ldObj['@id']) {
    return helpers.descriptionLink(ldObj);
  }
  else {
    return helpers.ldValue(ldObj);
  }
}

helpers.rawLdObject = function(ldObj) {
  if (ldObj instanceof Array) {
    ldObj = ldObj.map(helpers.ldObject);
    return new Handlebars.SafeString(ldObj.join(', '));
  }
  if (typeof ldObj === 'string') {
    return ldObj;
  }
  else if (ldObj['@id']) {
    return helpers.descriptionLink(ldObj, null, {raw: true});
  }
  else {
    return helpers.ldValue(ldObj);
  }
}

var deferredBlocks = [];

helpers.defer = function(options) {
  var deferredBlock = options.fn(this);
  deferredBlocks.push(deferredBlock);
  return '';
}

helpers.flush = function() {
  var output = deferredBlocks.join('');

  delete deferredBlocks;
  deferredBlocks = [];

  return new Handlebars.SafeString(output);
}

helpers.periodValues = function(periods, options) {
  var output = '';
  var self = this;
  periods.forEach(function(period) {
    output += options.fn(self, {data: { value: self[period] } });
  });

  return output;
}

helpers.ifCollection = function(collection, options) {
  if (!_.isEmpty(collection)) {
    return options.fn(this);
  }
  else {
    return options.inverse(this);
  }
}

helpers.link = function(text, options) {
  var hash = (options && options.hash) || {};
  var attrs = [];

  if (!hash.href) {
    hash.href = text;

    for(var prop in hash) {
      attrs.push(prop + '="' + hash[prop] + '"');
    }

    return new Handlebars.SafeString(
      "<a " + attrs.join(" ") + ">" + text + "</a>"
    );
  }
}

helpers.trim = function(text) {
  return text.trim();
}

helpers.datacubeTable = function(dataset, options) {
  if (arguments.length == 1) {
    var options = dataset;
    var dataset = this;
  }

  var getLabel = shared.getPreferredLabel;
  var getValue = shared.getLdValue;
  // Columns: dimensions, using colspan
  // First column: Measurement
  // Output: table

  if (options) {
    var hash = options.hash || {};
    if (hash.defaultHeader) {
      var defaultHeader = hash.defaultHeader;
      delete hash.defaultHeader;
    }
    if (hash.dimensionLabels) {
      var dimensionLabels = hash.dimensionLabels;
      delete hash.dimensionLabels;
    }
  }

  var output = '<table';
  if (options && !_.isEmpty(options.hash)) {
    _.forIn(options.hash, function(value, attr) {
      output += ' ' + attr + '=' + '"' + value + '"';
    });
  }
  output += '>';

  // Header
  var dimensions = dataset.dimensions;

  output += '\n  <thead>';
  dimensions.forEach(function(dimension, idx) {
    var values = dimension.values;

    var nextDimension = dimensions[idx + 1];
    if (nextDimension) {
      var colSpan = nextDimension.values.length;
    }
    else {
      var colSpan = "1";
    }

    var firstColumn = dimensionLabels ? getLabel(dimension) : '';

    output += '\n    <tr>';
    output += '\n      <th>' + firstColumn + '</th>';
    // console.log(values);
    values.forEach(function(value) {
      output += '\n      <th colspan="' + colSpan + '">' + helpers.ldObject(value) + '</th>';
    });
    output += '\n    </tr>';
  });
  output += '\n  </thead>';

  // Body
  var measures = dataset.measures;

  output += '\n  <tbody>';
  measures.forEach(function(measure, idx) {
    var measureId = measure['@id'];
    var measureLabel = getLabel(measure);
    var cursor = dataset.datacube;

    output += '\n    <tr>';
    output += '\n      <th>' + measureLabel + '</th>';
    traverse(dataset.datacube).forEach(function() {
      if (this.level === dimensions.length) {
        var text = helpers.ldObject(this.node[measureId]);
        output += '\n      <td>' + text + '</td>';
      }
    });
    output += '\n    </tr>';
  })
  output += '\n  </tbody>';

  // End table
  output += '\n</table>';

  return new Handlebars.SafeString(output);
}