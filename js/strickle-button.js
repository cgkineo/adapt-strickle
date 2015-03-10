/*
* adapt-diffuseAssessment
* License - http://github.com/adaptlearning/adapt_framework/LICENSE
* Maintainers - Oliver Foster <oliver.foster@kineo.com>
*/

define([
    'require',
    "./DataTypes/StructureType",
    './utils'
    ], function(require, StructureType, utils) {
    var ComponentView = require('coreViews/componentView');
    var Adapt = require('coreJS/adapt');


    var STrickleButton = ComponentView.extend({

        events: {
            "click .strickle-button-inner > *": "onClick",
            "inview": "onInview"
        },

        initialize: function() {
            this.$el.addClass("no-state");
            this.$el.addClass(this.model.get("_strickle")._componentClasses);
            ComponentView.prototype.initialize.apply(this);
            this.model.set("_isLocked", false);
            this.model.set("_isEnabled", false);
            switch (this.model.get("_strickle")._buttonType) {
            case "trickle":
                this.model.set("_isVisible", false, { pluginName: "blank" });
                break;
            }
            this.listenTo(this.model, "change:_isEnabled", this.onEnabledChange);
        },

        postRender: function() {
            switch (this.model.get("_strickle")._buttonType) {
            case "jump": 
                this.model.set("_isLocked", false);
                this.model.set("_isEnabled", true);
                break;
            default:
                this.toggleDisabled(false);
            }
            
            this.setReadyStatus();
            this.setupEventListeners();
        },

        setupEventListeners: function() {
            this.listenTo(Adapt, "remove", this.onRemove);
            this.listenTo(this.model, "change:_isVisible", this.onVisibilityChange);
        },

        onClick: function() {
            if (!this.model.get("_isLocked")) {
                this.completeJump();
            } else {
                this.completeLock();
            }
        },

        completeJump: function() {
            switch (this.model.get("_strickle")._buttonType) {
            case "inline-jump": case "jump":
                this.scrollTo();
                break;
            }
        },

        completeLock: function() {
            this.toggleLock(false);

            this.setCompletionStatus();

            switch (this.model.get("_strickle")._buttonType) {
            case "trickle":
                this.model.set("_isEnabled", false);
                this.model.set("_isVisible", false, { pluginName: "blank" });
                this.stopListening();
                break;
            case "inline-jump": case "jump":
                this.model.set("_isEnabled", true);
                break;
            case "inline-disable":
                this.model.set("_isEnabled", false);
                this.stopListening();
                break;
            case "inline-hide":
                this.model.set("_isEnabled", false);
                this.model.set("_isVisible", false, { pluginName: "blank" });
                this.stopListening();
                break;
            }
            this.scrollTo();
        },

        onEnabledChange: function(model, value) {
            this.toggleDisabled(value);
        },

        toggleDisabled: function(bool) {
            if (bool === false) {
                this.$el.find(".strickle-button-inner > *").addClass("disabled").attr("disabled","disabled");
            } else {
                this.$el.find(".strickle-button-inner > *").removeClass("disabled").removeAttr("disabled");
            }
        },

        onInview: function(event, isInview) {
            if (this.model.get("_isComplete")) return;
            if (!this.model.get("_isEnabled") || !this.model.get("_isVisible")) return;

            this.toggleLock(isInview);
        },

        onVisibilityChange: function(model, value) {
            this.toggleLock(value);
        },

        toggleLock: function(bool) {
            if (this.model.get("_isLocked") === bool) return;
            if (bool) {
                this.$el.find('.component-inner').addClass("locked");
                this.model.set("_isLocked", true);
                Adapt.trigger("strickle-button:locked", this);
            } else {
                this.$el.find('.component-inner').removeClass("locked");
                this.model.set("_isLocked", false);
                Adapt.trigger("strickle-button:unlocked", this);
            }
        },

        scrollTo: function() {

            if (this.model.get("_strickle")._autoScroll === false) return;
            var scrollTo = this.model.get("_strickle")._scrollTo;
            var duration = this.model.get("_strickle")._duration || 500;
            if (scrollTo === undefined) scrollTo = "@component +1";
            if (scrollTo.substr(0,1) == "@") {
                var descendantType = StructureType.fromString(this.model.get("_parentType"));
                var type = scrollTo.substr(0, _.indexOf(scrollTo, " "));
                var by = parseInt(scrollTo.substr(type.length));
                type = type.substr(1);

                var flatPageDescendantsJSON = this.model.get("_flatPageDescendantsJSON");
                var currentIndex = this.model.get("_index");

                var typeCount = {};
                for (var i = descendantType._level - 1, l = 0; i > l; i--) {
                    typeCount[StructureType.fromInt(i)._id] = -1;
                }

                for (var i = currentIndex +1, l = flatPageDescendantsJSON.length; i < l; i++) {
                    var item = flatPageDescendantsJSON[i];
                    if (!typeCount[item._type]) typeCount[item._type] = 0;
                    typeCount[item._type]++;
                    if (typeCount[type] >= by) {
                        return this.navigateToElement("." + item._id, duration);
                    }
                }
            } else if (scrollTo.substr(0,1) == ".") {
                this.navigateToElement(scrollTo, duration);
            } else {
                this.navigateToElement("." + scrollTo, duration);
            }

        },

        navigateToElement: function(to, duration) {
            _.defer(function() {
                Adapt.navigateToElement(to, {
                    duration: duration,
                    offset: {
                        top: -$('.navigation').height()
                    }
                }, false);
                if ($.fn.a11y_focus) $(to).a11y_focus();
            });
        }

    });

    Adapt.register("strickle-button", STrickleButton);

    return STrickleButton;
});
