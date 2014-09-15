/*
* adapt-strickle
* License - http://github.com/adaptlearning/adapt_framework/LICENSE
* Maintainers - Oliver Foster <oliver.foster@kineo.com>
*/

define(function(require) {

    var Adapt = require('coreJS/adapt');

//GOTO REVEAL PARENT IF REVEAL HIDDEN
	function STRIfIdOffsetHiddenReturnParentId(id) {
        if (STRIfIdOffsetHiddenReturnParentId.swapOutIds[id] !== undefined) return STRIfIdOffsetHiddenReturnParentId.swapOutIds[id];

        var $element = $("." + id);
        var displayNoneParents = _.filter($element.parents(), function(item) { return $(item).css("display") == "none"; } );
        if (displayNoneParents.length === 0) return id;

        var parentId = Adapt.findById(id).get("_parentId");
        STRIfIdOffsetHiddenReturnParentId.swapOutIds[id] = parentId;
        return parentId;
    }
    STRIfIdOffsetHiddenReturnParentId.swapOutIds = {};
    window.STRIfIdOffsetHiddenReturnParentId = STRIfIdOffsetHiddenReturnParentId;
});