/*
* adapt-trickle
* License - http://github.com/adaptlearning/adapt_framework/LICENSE
* Maintainers - Oliver Foster <oliver.foster@kineo.com>
*/

define([
	'coreJS/adapt', 
	], function(Adapt) {

	var TrickleTutorPlugin = _.extend({

		_isTrickleWaiting: false,

		initialize: function() {
			this.listenToOnce(Adapt, "app:dataReady", this.onDataReady);
		},

		onDataReady: function() {
			this.setupEventListeners();
		},

		setupEventListeners: function() {
			this.listenTo(Adapt, "steplocking:waitCheck", this.onStepLockingWaitCheck);
			this.listenTo(Adapt, "tutor:open", this.onTutorOpened);
			this.listenTo(Adapt, "tutor:closed", this.onTutorClosed);
		},

		onStepLockingWaitCheck: function(model) {
			if ( model.get("_type") === "component" && model.get("_isQuestionType") &&  model.get("_canShowFeedback")) {
				Adapt.trigger("steplocking:wait");
				this._isTrickleWaiting = true;
			}
		},

		onTutorOpened: function() {
			if (!this._isTrickleWaiting) Adapt.trigger("steplocking:wait");
		},

		onTutorClosed: function() {
			Adapt.trigger("steplocking:unwait");
			this._isTrickleWaiting = false;
		}

	}, Backbone.Events);

	TrickleTutorPlugin.initialize();

})
