/*
* adapt-strickle
* License - http://github.com/adaptlearning/adapt_framework/LICENSE
* Maintainers - Oliver Foster <oliver.foster@kineo.com>
*/

define([
	'require', 
	'coreModels/adaptModel',
	"./DataTypes/StructureType", 
	'./strickle-button',
	'./utils',
	'./dom-resize-event'
	], function(require, AdaptModel, StructureType, STrickleButton, utils) {

	var Adapt = require('coreJS/adapt');
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

				if (!this.isDescendantStepLocking(descendant)) continue;

				this.model.set("_currentIndex", i);
				this.model.set("_previousIndex", currentIndex);
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

		isDescendantStepLocking: function(descendantModel) {
			if (!descendantModel.get("_strickle")) return false;
			
			if (descendantModel.get("_strickle")._buttonType !== "jump-lock") {
				
				var isDescendantComplete = this.isDescendantComplete(descendantModel);
				if (isDescendantComplete !== undefined) return !isDescendantComplete;

			}

			var isDescendantConfigured = this.isDescendantConfigured(descendantModel);
			if (isDescendantConfigured === false) return false;


			var isJumpButtonStepLocked = this.isJumpButtonStepLocked(descendantModel);
			if (isJumpButtonStepLocked !== undefined) return false;

			return true;
		},

		shouldRenderButton: function(descendantModel) {
			if (!descendantModel.get("_strickle")) return false;

			switch (descendantModel.get("_strickle")._buttonType) {
			case "jump-lock": case "jump": case "inline-jump": case "inline-disable":
				return true;
			}

			var isDescendantComplete = this.isDescendantComplete(descendantModel);
			if (isDescendantComplete !== undefined) return !isDescendantComplete;

			var isDescendantConfigured = this.isDescendantConfigured(descendantModel);
			if (isDescendantConfigured === false) return false;

			return true;
		},

		isJumpButtonStepLocked: function(descendantModel) {
			var descendantConfig = this.getDescendantConfig(descendantModel);

			if (descendantConfig._buttonType == "jump") return false;
			if (descendantConfig._isInteractionComplete && descendantConfig._buttonType == "jump-lock") return false;
		},

		isDescendantComplete: function(descendantModel) {
			if (descendantModel.get("_isSubmitted") === true) return true;
			if (descendantModel.get("_isInteractionComplete") === false) return false;
			if (descendantModel.get("_isComplete")) return true;
			if (descendantModel.get("_isSubmitted") === false) return false;
		},

		isDescendantConfigured: function(descendantModel) {
			var descendantId = descendantModel.get("_id");
			var flatPageDescendantsJSON = this.model.get("_flatPageDescendantsJSON");
			var pageDescendantIds = _.pluck(flatPageDescendantsJSON, "_id");
			if (_.indexOf( pageDescendantIds, descendantId ) == -1) return false;

			var descendantConfig = this.getDescendantConfig(descendantModel);
			if (descendantConfig._isEnabled === false) return false;
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
		
		getPreviousDescendant: function() {
			if (this.isFinished()) return;

			var previousIndex = this.model.get("_previousIndex");

			var flatPageDescendants = this.model.get("_flatPageDescendants");
			var descendant = flatPageDescendants[previousIndex];

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

			console.log("Unlocking to:", currentDescendantId);
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

			if (!this.shouldRenderButton(descendant)) return;
			
			this.setupSectionButton(descendant);
		},

		setupSectionButton: function(descendantModel) {

			var _isComplete = !this.isLockedOnRevisit(descendantModel);

			var descendantStrickleConfig = descendantModel.get("_strickle");
			if (descendantStrickleConfig.button === undefined) return;		

			var descendantConfig = this.getDescendantConfig(descendantModel);
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
				_isComplete: _isComplete,
				_flatPageDescendantsJSON: this.model.get("_flatPageDescendantsJSON"),
				_index: index
			});

			var buttonView = new STrickleButton({ model: buttonModel, nthChild: "additional" } );
			descendantElement.append( buttonView.$el );

			descendantModel.get("_strickle")._buttonView = buttonView;

			this.listenToOnce(buttonModel, "change:_isComplete", this.onStrickleButtonComplete);

		},

		isLockedOnRevisit: function(descendantModel) {
			var _isComplete = descendantModel.get("_isComplete");
			var _isLocked = !_isComplete;

			var descendantStrickleConfig = descendantModel.get("_strickle");
			if (descendantStrickleConfig._isLockedOnRevisit === true) {
				//ALWAYS LOCK ON REVISIT
				_isLocked = true;
				descendantStrickleConfig._isInteractionComplete = false
			} else {
				//ONLY LOCK IF SECTION NOT COMPLETE
				descendantStrickleConfig._isInteractionComplete = _isComplete;
			}

			return _isLocked;
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
					descendantStrickleConfig._isInteractionComplete = descendantStrickleConfig._buttonView.model.get("_isComplete");
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
				$(window).resize();
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

			var descendant = this.getPreviousDescendant();
			
            if (descendant.get("_strickle")._autoScroll === false) return;

            var scrollTo = descendant.get("_strickle")._scrollTo;
            var duration = descendant.get("_strickle")._duration || 500;

            if (scrollTo === undefined) scrollTo = "@component +1";
            if (scrollTo.substr(0,1) == "@") {
            	var currentIndex = this.model.get("_previousIndex");

            	//NAVIGATE BY OFFSET

            	var descendantType = StructureType.fromString(descendant.get("_type"));

            	//CREATE HASH FOR OFFSET OF PARENTS ACCORDING TO DESCENDANT TYPE
            	var typeCount = {};
                for (var i = descendantType._level - 1, l = 0; i > l; i--) {
                    typeCount[StructureType.fromInt(i)._id] = -1;
                }

                //SPLIT SCROLLTO TEXT INTO @TYPE +BY
                var type = scrollTo.substr(0, _.indexOf(scrollTo, " "));
                var by = parseInt(scrollTo.substr(type.length));
                type = type.substr(1);

                //GO THROUGH DESCENDANTS FROM CURRENT INDEX
                //USING THE OFFSET HASH FOR BEARING CORRECTIONS
                //IF THE ITEM IS AT CORRECT OFFSET ACCORDING TO +BY AND @TYPE THEN NAVIGATE TO IT
                var flatPageDescendantsJSON = this.model.get("_flatPageDescendantsJSON");
                for (var i = currentIndex +1, l = flatPageDescendantsJSON.length; i < l; i++) {
                    var item = flatPageDescendantsJSON[i];
                    if (!typeCount[item._type]) typeCount[item._type] = 0;
                    typeCount[item._type]++;
                    if (typeCount[type] >= by) {
                    	if (!$("."+item._id).is(":visible")) {
                    		//IGNORE VISIBLY HIDDEN ELEMENTS
                            by++;
                            continue;
                        }
                        console.log("scrolling to", item._id);
                        return this.navigateToElement("." + item._id, duration);
                    }
                }

            } else if (scrollTo.substr(0,1) == ".") {
            	//NAVIGATE BY CLASS
                this.navigateToElement(scrollTo, duration);
            } else {
            	//NAVIGATE BY ID
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
	
	var strickle = new STrickle({
		model: new Backbone.Model({})
	});

	var resizeCallback = _.bind(strickle.onWrapperResize, strickle);
	$("#wrapper").on('resize', resizeCallback );

	return strickle;

})
