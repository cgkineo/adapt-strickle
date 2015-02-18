define(["require", "./DataTypes/StructureType"], function(require, StructureType) {

	var Adapt = require("coreJS/adapt");

	var utils = {

		fetchAdaptStructureFlat: function(id, parentFirst) {
			var model = Adapt.findById(id);
			if (model === undefined) return undefined;

			var struct = StructureType.fromString(model.get("_type"));
			if (struct._level === StructureType.levels) {
				return [model];
			}

			var children = model.getChildren();

			var ret = [];
			for (var i = 0, l = children.models.length; i < l; i++) {
				var child = children.models[i];

				var struct = StructureType.fromString(child.get("_type"));
				if (struct._level === StructureType.levels) {
					ret.push(child);
				} else {
					var append = utils.fetchAdaptStructureFlat(child.get("_id"), parentFirst);
					if (parentFirst !== false) ret.push(child);
					ret = ret.concat(append);
					if (parentFirst === false) ret.push(child);
				}

			}
			return ret;
		},

		backboneModelArrayToJSONArray: function(modelArray) {
			return (new Backbone.Collection(modelArray)).toJSON();
		}

	};


	return utils;
});