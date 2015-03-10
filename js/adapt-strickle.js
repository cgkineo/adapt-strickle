/*
* adapt-strickle
* License - http://github.com/adaptlearning/adapt_framework/LICENSE
* Maintainers - Oliver Foster <oliver.foster@kineo.com>
*/

define([
	'require', 
	"./DataTypes/StructureType", 
	'./strickle-button',
	'./utils',
	'./dom-resize-event'
	], function(require, StructureType, STrickleButton, utils) {

	var Adapt = require('coreJS/adapt');
	var AdaptModel = require('coreModels/adaptModel');
	var Backbone = require('backbone');

	var defaultConfig = {
		_isEnabled: false,
		_duration: 500,
		_autoScroll: true
	};

	var STrickle = Backbone.View.extend({

		initialize: function() {
			this.listenToOnce(Adapt, "app:dataReady", this.onDataReady);
		},

		onDataReady: function() {
			this.setupEventListeners();
		},

		setupEventListeners: function() {
			this.listenTo(Adapt, "menuView:preRender", this.onMenuInitialize);
			this.listenTo(Adapt, "pageView:preRender", this.onPageInitialize);
			this.listenTo(Adapt, "pageView:ready", this.onPageReady);
			this.listenTo(Adapt, "tutor:opened", this.onTutorOpened);
			this.listenTo(Adapt, "tutor:closed", this.onTutorClosed);
			this.listenTo(Adapt, "strickle-button:locked", this.onStrickleButtonLocked);
			this.listenTo(Adapt, "strickle-button:unlocked", this.onStrickleButtonUnlocked);
			this.listenTo(Adapt, "componentView:postRender blockView:postRender articleView:postRender", this.onPostRender);
			this.listenTo(Adapt.components, "change:_isComplete change:_isInteractionsComplete change:_isInteractionComplete", this.onComplete);
			this.listenTo(Adapt.blocks, "change:_isComplete change:_isInteractionsComplete change:_isInteractionComplete", this.onComplete);
			this.listenTo(Adapt.articles, "change:_isComplete change:_isInteractionsComplete change:_isInteractionComplete", this.onComplete);
		},

		onMenuInitialize: function(view) {
			this.removeStrickle();
		},

		onPageInitialize: function(view) {
			this.initializePage(view);
		},

		onPageReady: function(view) {
			console.log("STrickle onPageReady");
			this.initializeStep();
		},

		initializePage: function(view) {
			var pageId = view.model.get("_id");
			var flatPageDescendants = utils.fetchAdaptStructureFlat(pageId, false);
			var flatPageDescendantsJSON = utils.backboneModelArrayToJSONArray(flatPageDescendants);
			var flatPageDescendantsParentFirst = utils.fetchAdaptStructureFlat(pageId, true);
			var flatPageDescendantsParentFirstJSON = utils.backboneModelArrayToJSONArray(flatPageDescendantsParentFirst);
			this.model.set("_flatPageDescendantsJSON", flatPageDescendantsJSON);
			this.model.set("_flatPageDescendants", flatPageDescendants);
			this.model.set("_flatPageDescendantsParentFirstJSON", flatPageDescendantsParentFirstJSON);
			this.model.set("_flatPageDescendantsParentFirst", flatPageDescendantsParentFirst);
			this.model.set("_currentIndex", 0);
			this.model.set("_isFinished", false);
			this.model.set("_isTutorOpen", false);
			this.model.set("_wasTutorShown", false);
			this.model.set("_isStrickleButtonLocked", false);

		},

		initializeStep: function() {
			if (this.isFinished()) return;
			this.model.set("_wasTutorShown", false);

			var currentIndex = this.model.get("_currentIndex");
			var flatPageDescendants = this.model.get("_flatPageDescendants");
			for (var i = currentIndex, l = flatPageDescendants.length; i < l; i++) {
				var descendant = flatPageDescendants[i];

				if (!this.isDescendantStrickled(descendant, true)) continue;

				this.model.set("_currentIndex", i);
				this.model.set("_tutorClosed", false);

				this.resizeToCurrentIndex();

				$("html").addClass("strickle");

				return;
			}
			this.removeStrickle();
		},

		removeStrickle: function() {
			this.model.set("_currentIndex", -1);
			this.model.set("_isFinished", true);
			$("body").css("height", "");
			$("html").removeClass("strickle");
		},

		isDescendantStrickled: function(descendantModel, ignoreNonStepLocked) {
			if (!descendantModel.get("_strickle")) return false;
			if (descendantModel.get("_strickle")._buttonType !== "jump-lock") {
				if (descendantModel.get("_isSubmitted" === true)) return false;
				if (descendantModel.get("_isSubmitted" === false)) return true;
				if (descendantModel.get("_isInteractionComplete") === false) return true;
				if (descendantModel.get("_isComplete")) return false;
			}

			var descendantId = descendantModel.get("_id");
			var flatPageDescendantsJSON = this.model.get("_flatPageDescendantsJSON");
			var pageDescendantIds = _.pluck(flatPageDescendantsJSON, "_id");
			if (_.indexOf( pageDescendantIds, descendantId ) == -1) return false;

			var descendantConfig = this.getDescendantConfig(descendantModel);
			if (descendantConfig._isEnabled === false) return false;
			if (ignoreNonStepLocked && descendantConfig._buttonType == "jump") return false;
			if (descendantConfig._isComplete && descendantConfig._buttonType == "jump-lock") return false;

			return true;
		},

		getDescendantConfig: function(descendantModel) {
			var descendantStrickleConfig = descendantModel.get("_strickle");
			var descendantConfig = _.extend({}, defaultConfig,  descendantStrickleConfig);
			return descendantConfig;
		},

		getDescendantIndex: function(descendantModel) {
			var descendantId = descendantModel.get("_id");
			var flatPageDescendantsJSON = this.model.get("_flatPageDescendantsJSON");
			var pageDescendantIds = _.pluck(flatPageDescendantsJSON, "_id");
			var index = _.indexOf( pageDescendantIds, descendantId );
			return index;
		},

		getCurrentDescendant: function() {
			if (this.isFinished()) return;

			var currentIndex = this.model.get("_currentIndex");

			var flatPageDescendants = this.model.get("_flatPageDescendants");
			var descendant = flatPageDescendants[currentIndex];

			return descendant;
		},

		isFinished: function() {
			var isFinished = this.model.get("_isFinished");
			return isFinished;
		},

		resizeToCurrentIndex: function() {
			if (this.isFinished()) return;

			this.model.set("_isResizeListenerAttached", false);

			this.hideElements();

			var currentDescendant = this.getCurrentDescendant();
			var currentDescendantId = currentDescendant.get("_id");
			var currentDescendantElement = $("." + currentDescendantId);

			if (currentDescendantElement.length === 0) return;

			var currentDescendantOffset = currentDescendantElement.offset();

			var currentDescendantBottomOffset = currentDescendantOffset.top + currentDescendantElement.height();

			$('body').css("height", currentDescendantBottomOffset + "px");

			
			this.model.set("_isResizeListenerAttached", true);
		},

		hideElements: function() {
			var currentDescendant = this.getCurrentDescendant();
			var currentDescendantId = currentDescendant.get("_id");

			var flatPageDescendantsParentFirstJSON = this.model.get("_flatPageDescendantsParentFirstJSON");
			var pageDescendantIds = _.pluck(flatPageDescendantsParentFirstJSON, "_id");
			var currentParentFirstIndex = _.indexOf(pageDescendantIds, currentDescendantId);

			var jquerySelector;
			var elementIdsAfterCurrent = [];
			for (var i = currentParentFirstIndex + 1, l = pageDescendantIds.length; i < l; i++) {
				elementIdsAfterCurrent.push("."+pageDescendantIds[i]);
			}
			jquerySelector = elementIdsAfterCurrent.join(",");
			$( jquerySelector )
				.addClass("strickle-hidden");

			var elementIdsBeforeCurrent = [];
			for (var i = 0, l = currentParentFirstIndex+1; i < l; i++) {
				elementIdsBeforeCurrent.push("."+pageDescendantIds[i]);
			}
			jquerySelector = elementIdsBeforeCurrent.join(",");
			$( jquerySelector )
				.removeClass("strickle-hidden");
			$("."+currentDescendantId)
				.removeClass("strickle-hidden")
				.find(".strickle-hidden")
				.removeClass("strickle-hidden");

			console.log("Unlocking to:")
			console.log(currentDescendantId);
		},

		onWrapperResize: function() {
			if (this.model.get("_isResizeListenerAttached") === true) 
				this.resizeToCurrentIndex();
		},

		onPostRender: function(view) {
			this.setupSection(view);
		},

		setupSection: function(view) {
			if (this.isFinished()) return;

			var descendant = view.model;
			
			if (descendant.get("_component") === "strickle-button") return;

			if (!this.isDescendantStrickled(descendant)) return;
			
			this.setupSectionButton(descendant);
		},

		setupSectionButton: function(descendantModel) {
			var descendantConfig = this.getDescendantConfig(descendantModel);
			if (descendantConfig.button === undefined) return;

			var descendantId = descendantModel.get("_id");
			var descendantElement = $("." + descendantId);

			switch (descendantConfig._buttonType) {
			case undefined:
				descendantConfig._buttonType = "fixed-bottom";
				break;
			}

			var index = this.getDescendantIndex(descendantModel);

			var buttonModel = new AdaptModel({
				_id: "strickle-button",
				_type: "component",
				_parentType: descendantModel.get("_type"),
				_parentComponent: descendantModel.get("_component"),
				_component: "strickle-button",
				_strickle: descendantConfig,
				_classes: "",
				_layout: "full",
				_isVisible: (descendantConfig._buttonType == "fixed-bottom") ? false : true,
				_isAvailable: true,
				_isEnabled: true,
				_isComplete: descendantModel.get("_isComplete"),
				_flatPageDescendantsJSON: this.model.get("_flatPageDescendantsJSON"),
				_index: index
			});

			var buttonView = new STrickleButton({ model: buttonModel, nthChild: "additional" } );
			descendantElement.append( buttonView.$el );

			descendantModel.get("_strickle")._buttonView = buttonView;

			this.listenToOnce(buttonModel, "change:_isComplete", this.onStrickleButtonComplete);

		},

		onComplete: function(model) {
			this.sectionComplete(model);
		},

		sectionComplete: function(descendantModel) {
			if (this.isFinished()) return;

			var descendant = this.getCurrentDescendant();

			if (descendant.get("_id") == descendantModel.get("_id")) {
				var descendantStrickleConfig = descendant.get("_strickle");
				if (!descendantStrickleConfig) return;
				
				if (descendantStrickleConfig._buttonType == "jump-lock") {
					if (!descendantStrickleConfig._buttonView) return;
					descendantStrickleConfig._isComplete = descendantStrickleConfig._buttonView.model.get("_isComplete");
				} else {
					if ( descendantModel.get("_type") === "component" &&  descendantModel.get("_canShowFeedback") && !this.model.get("_wasTutorShown")) return;
					if (!descendantModel.get("_isComplete")) return;

					if (descendantStrickleConfig._buttonView) {
						if (!descendantStrickleConfig._buttonView.model.get("_isComplete")) {
							descendantStrickleConfig._buttonView.model.set("_isVisible", true, {pluginName: "blank"} );
							descendantStrickleConfig._buttonView.model.set("_isLocked", true);
							descendantStrickleConfig._buttonView.model.set("_isEnabled", true);
							return;
						}
					}
					
					if (this.model.get("_isTutorOpen")) return;
					if (this.model.get("_isStrickleButtonLocked")) return;
				}
				
				this.initializeStep();
				Adapt.trigger('device:resize');
				if (!descendantStrickleConfig._buttonView) {
					this.scrollTo();
				}
			}
		},

		onTutorOpened: function() {
			this.model.set("_isTutorOpen", true);
		},

		onTutorClosed: function() {
			this.model.set("_wasTutorShown", true);
			this.model.set("_isTutorOpen", false);

			if (this.isFinished()) return;

			var descendant = this.getCurrentDescendant();
			
			this.sectionComplete(descendant);

		},

		onStrickleButtonComplete: function() {
			if (this.isFinished()) return;

			var descendant = this.getCurrentDescendant();
			
			this.sectionComplete(descendant);
		},

		onStrickleButtonLocked: function() {
			this.model.set("_isStrickleButtonLocked", true);
		},

		onStrickleButtonUnlocked: function() {
			this.model.set("_isStrickleButtonLocked", false);
		},


		scrollTo: function() {
			if (this.isFinished()) return;

			var descendant = this.getCurrentDescendant();
			
            if (descendant.get("_strickle")._autoScroll === false) return;

            var scrollTo = descendant.get("_strickle")._scrollTo;
            var duration = descendant.get("_strickle")._duration || 500;

            if (scrollTo === undefined) scrollTo = "@component +1";
            if (scrollTo.substr(0,1) == "@") {

            	var descendantType = StructureType.fromString(descendant.get("_type"));
            	var typeCount = {};
                for (var i = descendantType._level - 1, l = 0; i > l; i--) {
                    typeCount[StructureType.fromInt(i)._id] = -1;
                }


                var type = scrollTo.substr(0, _.indexOf(scrollTo, " "));
                var by = parseInt(scrollTo.substr(type.length));
                type = type.substr(1);

                var flatPageDescendantsJSON = this.model.get("_flatPageDescendantsJSON");
                for (var i = currentIndex +1, l = flatPageDescendantsJSON.length; i < l; i++) {
                    var item = flatPageDescendantsJSON[i];
                    if (!typeCount[item._type]) typeCount[item._type] = 0;
                    typeCount[item._type]++;
                    if (typeCount[type] >= by) {
                    	if (!$("."+item._id).is(":visible")) {
                            by++;
                            continue;
                        }
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
                $(to).a11y_focus();
            });
        }
		
	});
	
	var strickle = new STrickle({
		model: new Backbone.Model({})
	});

	var resizeCallback = _.bind(strickle.onWrapperResize, strickle);
	$("#wrapper").on('resize', resizeCallback );

	return strickle;

})
