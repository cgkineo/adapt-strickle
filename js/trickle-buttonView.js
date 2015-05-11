/*
* adapt-contrib-trickle
* License - http://github.com/adaptlearning/adapt_framework/LICENSE
* Maintainers - Oliver Foster <oliver.foster@kineo.com>
*/

define([
    'coreJS/adapt',
    'coreViews/componentView'
], function(Adapt, ComponentView) {

    var TrickleButtonView = ComponentView.extend({

        onEnabledChange: function(model, value) {
            this.setDisabledState(!value);
        },

        onVisibilityChange: function(model, value) {
            //apply/remove the lock when button visible/hidden
            this.checkApplyLock(value);
        },

        onInteractionRequired: function(parentModel) {
            this.showButton(parentModel); 
        },

        onInview: function(event, isInview) {
            //show or hide the button when button is inview/outview
            this.checkAutoHide(isInview);
        },

        onClick: function() {
            if (!this.model.get("_isLocking")) {
                this.completeJump();
            } else {
                this.completeLock();
            }
        },

        onRemove: function() {
            this.undelegateEvents();
            this.$el.remove();
        },

        events: {
            "click .trickle-button-inner > *": "onClick",
            "inview": "onInview"
        },

        _isTrickleWaiting: false,

        initialize: function() {
            this.addCustomClasses();
            ComponentView.prototype.initialize.apply(this);

            var _isEnabled = this.canStartEnabled();
            var _isVisible = this.canStartVisible();

            this.model.set("_isEnabled", _isEnabled);
            this.model.set("_isVisible", _isVisible);
        },

        addCustomClasses: function() {
            if (!this.model.get("_trickle")._button || !this.model.get("_trickle")._button._className) return;
            
            this.$el.addClass(this.model.get("_trickle")._button._className);
        },

        canStartEnabled: function() {
            var trickleConfig = this.model.get("_trickle");

            var _isEnabled = true;
            if (trickleConfig._stepLocking._isCompletionRequired && trickleConfig._stepLocking._isEnabled) {

                var isEnabledAfterCompletion = (trickleConfig._button._styleAfterClick == "scroll");
                _isEnabled = isEnabledAfterCompletion && this.model.get("_isInteractionComplete");

            }
            return _isEnabled;
        },

        canStartVisible: function() {
            var trickleConfig = this.model.get("_trickle");

            var _isVisible = true;
            if (trickleConfig._button._styleBeforeCompletion == "hidden") {
                var isVisibleBeforeCompletion = (trickleConfig._button._styleBeforeCompletion != "hidden");
                _isVisible = isVisibleBeforeCompletion || this.model.get("_isInteractionComplete");
            }

            if (trickleConfig._button._autoHide) {
                _isVisible = false;
            }
            
            return _isVisible;
        },

        postRender: function() {
            var _isEnabled = this.canStartEnabled();
            this.setDisabledState(!_isEnabled);

            this.setReadyStatus();
            this.setupEventListeners();
        },

        setDisabledState: function(bool) {
            if (bool) this.$el.find(".trickle-button-inner > *").addClass("disabled").attr("disabled","disabled");
            else this.$el.find(".trickle-button-inner > *").removeClass("disabled").removeAttr("disabled");
        },

        setupEventListeners: function() {
            this.listenTo(Adapt, "trickle:interactionRequired", this.onInteractionRequired);
            this.listenTo(Adapt, "steplocking:waitCheck", this.onInteractionRequired);
            this.listenTo(this.model, "change:_isEnabled", this.onEnabledChange);
            this.listenTo(this.model, "change:_isVisible", this.onVisibilityChange);
            this.listenToOnce(Adapt, "remove", this.onRemove);
        },

        checkApplyLock: function(bool) {
            //if not complete, is enabled and is visible then set lock according to inview
            if (this.model.get("_isComplete")) return;
            if (!this.model.get("_isEnabled") || !this.model.get("_isVisible")) return;

            this.toggleLock(bool);
        },

        toggleLock: function(bool) {
            if (!this.isStepLockingEnabled()) return;

            var trickleConfig = this.model.get("_trickle");

            if (bool) {

                this.$el.find('.component-inner').addClass("locking");

                this.model.set("_isLocking", true);

                this.steplockingWait();

            } else {

                this.$el.find('.component-inner').removeClass("locking");

                this.model.set("_isLocking", false);

                this.steplockingUnwait();
            }
        },

        isStepLockingEnabled: function() {
            var trickleConfig = this.model.get("_trickle");
            if (trickleConfig && trickleConfig._stepLocking && trickleConfig._stepLocking._isEnabled) {
                return true;
            }
            return false;
        },

        steplockingWait: function() {
            if (!this._isTrickleWaiting) Adapt.trigger("steplocking:wait");
            this._isTrickleWaiting = true;
        },

        steplockingUnwait: function() {
            if (this._isTrickleWaiting) Adapt.trigger("steplocking:unwait");
            this._isTrickleWaiting = false;
        },

        showButton: function(parentModel) {
            //check if the interaction required event is intended for this button
            if (parentModel.get("_id") != this.model.get("_parentId")) return;
            if (this.model.get("_isComplete")) return;

            var trickleConfig = this.model.get("_trickle");

            var _isVisible = true;
            if (trickleConfig._button._styleBeforeCompletion == "hidden") {
                var isVisibleBeforeCompletion = (trickleConfig._button._styleBeforeCompletion != "hidden");
                _isVisible = isVisibleBeforeCompletion || parentModel.get("_isInteractionComplete");;
            }

            this.model.set("_isVisible", _isVisible);
            this.model.set("_isEnabled", true);

            this.toggleLock(true);
        },

        checkAutoHide: function(bool) {
            var trickleConfig = this.model.get("_trickle");
            if (!trickleConfig._button._autoHide) return;

            if (!this.isOnCompleteVisible()) return;

            this.$('.component-inner').css("visibility", bool ? "visible" : "hidden");
        },

        isOnCompleteVisible: function() {
            var trickleConfig = this.model.get("_trickle");

            var _isVisible = true;
            if (trickleConfig._button._styleBeforeCompletion == "hidden") {
                var parentModel = Adapt.findById(this.model.get("_parentId"));

                var isVisibleBeforeCompletion = (trickleConfig._button._styleBeforeCompletion != "hidden");
                _isVisible = isVisibleBeforeCompletion || parentModel.get("_isInteractionComplete");
            }
            return _isVisible;

        },

        completeJump: function() {

            var trickleConfig = this.model.get("_trickle");
            trickleConfig._isInteractionComplete = true;

            this.updateState();

            this.scrollTo();
        },

        updateState: function() {

            var trickleConfig = this.model.get("_trickle");

            switch (trickleConfig._button._styleAfterClick) {
            case "disabled": 
                this.model.set("_isEnabled", false);
                this.setDisabledState(true);
                this.stopListening();
                break;
            case "hidden":
                this.model.set("_isEnabled", false);
                this.model.set("_isVisible", false);
                this.stopListening();
                break;
            case "scroll":
                this.model.set("_isEnabled", true);
                break;
            }
        },

        scrollTo: function() {
            var trickleConfig = this.model.get("_trickle");
            var scrollTo = trickleConfig._scrollTo;
            var parentModel = Adapt.findById(this.model.get("_parentId"));
            Adapt.trigger("trickle:relativeScrollTo", parentModel, scrollTo);
        },

        completeLock: function() {

            this.setCompletionStatus();

            this.toggleLock(false);

            //as this is an 'out-of-course' component, we must manually ask trickle to consider its completion
            Adapt.trigger("trickle:interactionComplete", this.model);
            
            this.updateState();
        }

    });

    Adapt.register("trickle-button", TrickleButtonView);

    return TrickleButtonView;
});
