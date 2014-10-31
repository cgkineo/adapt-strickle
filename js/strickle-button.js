/*
* adapt-diffuseAssessment
* License - http://github.com/adaptlearning/adapt_framework/LICENSE
* Maintainers - Oliver Foster <oliver.foster@kineo.com>
*/

define(function(require) {
    var ComponentView = require('coreViews/componentView');
    var Adapt = require('coreJS/adapt');

    var strickleButton = ComponentView.extend({
        events: {
            "click button": "onClick"
        },
        postRender: function() {
            this.setReadyStatus();
            this.$el.one("inview", _.bind(this.onActive, this));
        },
        onClick: function() {
            this.setCompletionStatus();
            this.$el.find("button").addClass("disabled").attr("disabled","disabled");
            this.$el.find('.component-inner').removeClass("strickle-is-active");
        },
        onActive: function() {
            _.defer(_.bind(function() {
                this.$el.find('.component-inner').addClass("strickle-is-active");
            }, this));
        }
    });

    Adapt.register("strickle-button", strickleButton);

    return strickleButton;
});
