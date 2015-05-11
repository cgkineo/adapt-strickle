/*
* adapt-trickle
* License - http://github.com/adaptlearning/adapt_framework/LICENSE
* Maintainers - Oliver Foster <oliver.foster@kineo.com>
*/

define([
	'coreJS/adapt', 
	'./DataTypes/StructureType', 
	'./Defaults/DefaultTrickleConfig',
	'./Utility/Models',
	'./trickle-tutorPlugin',
	'./trickle-buttonView',
	'./lib/dom-resize-event'
	], function(Adapt, StructureType, DefaultTrickleConfig, Models) {

	var Trickle = _.extend({

		onDataReady: function() {
			this.setupEventListeners();
		},

		onPagePreRender: function(view) {
			this.initializePage(view);
		},

		onArticlePreRender: function(view) {
			this.checkApplyTrickleToChildren( view.model );
		},

		onPagePostRender: function(view) {
			this.resizeBodyToCurrentIndex();
		},

		onArticleAndBlockPostRender: function(view) {
			this.setupStep( view.model );
		},

		onPageReady: function(view) {
			this.initializeStep();
			this.resizeBodyToCurrentIndex();
		},

		onAnyComplete: function(model, value, isPerformingCompletionQueue) {
			this.queueOrExecuteCompletion(mode, value, performCompletionQueue);
		},

		onStepUnlockWait: function() {
			this._waitForUnlockRequestsCount++;
		},

		onStepUnlockUnwait: function() {
			this._waitForUnlockRequestsCount--;
			if (this._waitForUnlockRequestsCount < 0) this._waitForUnlockRequestsCount = 0;

			if (this._isFinished) return;

			var descendant = this.getCurrentStepModel();
			this.checkStepComplete(descendant);
		},

		onWrapperResize: function() {
			if (this._stopListeningToResizeEvent == true) return;

			this.resizeBodyToCurrentIndex();
		},

		onRemove: function(view) {
			this.removeTrickle();
		},



		model: new Backbone.Model({}),

		_stopListeningToResizeEvent: true,

		initialize: function() {
			this.listenToOnce(Adapt, "app:dataReady", this.onDataReady);
		},

		setupEventListeners: function() {
			this._onWrapperResize = _.bind(Trickle.onWrapperResize, Trickle);
			$("#wrapper").on('resize', this._onWrapperResize );

			this.listenTo(Adapt, "remove", this.onRemove);
			this.listenTo(Adapt, "pageView:preRender", this.onPagePreRender);
			this.listenTo(Adapt, "pageView:postRender", this.onPagePostRender);
			this.listenTo(Adapt, "pageView:ready", this.onPageReady);

			this.listenTo(Adapt, "articleView:preRender", this.onArticlePreRender);
			this.listenTo(Adapt, "blockView:postRender articleView:postRender", this.onArticleAndBlockPostRender);

			this.listenTo(Adapt.articles, "change:_isInteractionComplete", this.onAnyComplete);
			this.listenTo(Adapt.blocks, "change:_isInteractionComplete", this.onAnyComplete);
			this.listenTo(Adapt.components, "change:_isInteractionComplete", this.onAnyComplete);           

			this.listenTo(Adapt, "trickle:interactionComplete", this.onAnyComplete);

			this.listenTo(Adapt, "steplocking:wait", this.onStepUnlockWait);
			this.listenTo(Adapt, "steplocking:unwait", this.onStepUnlockUnwait);

			this.listenTo(Adapt, "trickle:relativeScrollTo", this.relativeScrollTo);
		},


		addTrickle: function() {
			$("html").addClass("trickle");
			Adapt.trigger("steplocking:waitInitialize");
		},

		removeTrickle: function() {
			this._currentStepIndex = -1;
			this._isFinished = true;
			$("body").css("height", "");
			$("html").removeClass("trickle");
			this.hideElements();
		},

		initializePage: function(view) {
			var pageId = view.model.get("_id");

			var pageConfig = Adapt.course.get("_trickle");
			if (pageConfig && pageConfig._isEnabled === false) return;

			var descendantsChildrenFirst = Models.getDescendantsFlattened(pageId);
			var descendantsParentFirst = Models.getDescendantsFlattened(pageId, true);

			this._descendantsChildrenFirst = descendantsChildrenFirst;
			this._descendantsParentFirst = descendantsParentFirst;
			this._currentStepIndex = 0;
			this._isFinished = false;
			this._stopListeningToResizeEvent = true;

			this.checkResetChildren();

			this.initializeStepUnlockWait();

		},

		checkResetChildren: function() {
			var descendantsChildrenFirst = this._descendantsChildrenFirst;
			for (var i = 0, model; model = descendantsChildrenFirst.models[i++];) {
				this.checkResetModel(model);
			}
		},

		checkResetModel: function(model) {
			var trickleConfig = this.getModelTrickleConfig(model);
			if (!trickleConfig._stepLocking) return;

			if (!trickleConfig._stepLocking._isEnabled) return;

			if (trickleConfig._onChildren) return;

			if (!trickleConfig._isInteractionComplete) {
				
				trickleConfig._isLocking = true;

			} else if (trickleConfig._stepLocking._isLockedOnRevisit && !trickleConfig._stepLocking._isCompletionRequired) {

				trickleConfig._isInteractionComplete = false;
				trickleConfig._isLocking = true;
				model.set("_isInteractionComplete", false);

			} else if ( trickleConfig._stepLocking._isCompletionRequired && !model.get("_isInteractionComplete") ) {
				
				trickleConfig._isInteractionComplete = false;
				trickleConfig._isLocking = true;
				model.set("_isInteractionComplete", false);

			} else if ( trickleConfig._stepLocking._isLockedOnRevisit && trickleConfig._stepLocking._isCompletionRequired && model.get("_isInteractionComplete") ) {
				
				trickleConfig._isInteractionComplete = true;
				trickleConfig._isLocking = true;

			}
		},

		checkApplyTrickleToChildren: function(model) {
			if (model.get("_type") === "article") {
				var trickleConfig = this.getModelTrickleConfig(model);
				if (!trickleConfig) return;

				if (!trickleConfig._onChildren) return;

				this.applyTrickleToChildren(model, trickleConfig);
			}
		},

		applyTrickleToChildren: function(model, trickleConfig) {
			var children = model.getChildren();
			for (var i = 0, l = children.models.length; i < l; i++) {

				var child = children.models[i];
				var childTrickleConfig = child.get("_trickle");
				var textOverlay;

				if (i == l - 1) {
					if (trickleConfig._button.finalText) {
						var previousText = $.extend(true, 
							{}, 
							trickleConfig, 
							childTrickleConfig
						)._button.text;

						textOverlay = {
							_button: {
								text: trickleConfig._button.finalText,
								previousText: previousText
							}
						};
					}
				} else {
					if (childTrickleConfig && childTrickleConfig._button.previousText) {
						textOverlay = {
							_button: {
								text: childTrickleConfig._button.previousText,
								previousText: null
							}
						};
					}
				}

				child.set("_trickle", $.extend(true, 
					{}, 
					trickleConfig, 
					childTrickleConfig, 
					{ 
						_id: child.get("_id"),
						_onChildren: false,
						_isEnabled: trickleConfig._isEnabled
					},
					textOverlay
				));
				
			}
		},

		getModelTrickleConfig: function(model) {

			function initializeModelTrickleConfig(model, parent) {
				var trickleConfig = model.get("_trickle");

				var courseConfig = Adapt.course.get("_trickle");
				if (courseConfig && courseConfig._isEnabled === false) return false;

				var trickleConfig = $.extend(true, 
					{}, 
					DefaultTrickleConfig, 
					trickleConfig,
					{ 
						_id: model.get("_id"), 
						_areDefaultsSet: true,
						_index: parent.getModelPageIndex(model)
					}
				);

				model.set("_trickle", trickleConfig);

				return true;
			}

			var trickleConfig = model.get("_trickle");
			if (trickleConfig === undefined) return false;

			//if has been initialized already, return;
			if (trickleConfig._areDefaultsSet) return trickleConfig;

			if (!initializeModelTrickleConfig(model, this)) return false;
			
			return model.get("_trickle");
		},

		initializeStep: function() {
			if (this._isFinished) return;
			this.initializeStepUnlockWait();

			if (this.setupStepLock()) {
				this.addTrickle();
			} else {
				this.removeTrickle();
			}
		},

		setupStepLock: function() {
			var currentIndex = this._currentStepIndex;
			var descendants = this._descendantsChildrenFirst;
			for (var i = currentIndex, l = descendants.models.length; i < l; i++) {
				var descendant = descendants.models[i];

				if (!this.isModelStepLocking(descendant)) continue;

				this._currentStepIndex = i;

				this._stopListeningToResizeEvent = false;
				
				return true;
			}

			return false;
		},

		isModelStepLocking: function(model) {
			var trickleConfig = this.getModelTrickleConfig(model)
			if (!trickleConfig) return false;

			if (trickleConfig._onChildren) return false;
			
			if (!trickleConfig._stepLocking._isEnabled) return false;
			
			if (trickleConfig._isLocking) return true;
			if (trickleConfig._isInteractionComplete) return false;

			if (!this.isModelTrickleEnabled(model)) return false;

			var isComplete = model.get("_isInteractionComplete");
			if (isComplete !== undefined) return !isComplete;

			return true;
		},

		isModelTrickleEnabled: function(model) {
			var trickleConfig = this.getModelTrickleConfig(model);
			if (!trickleConfig) return false;

			if (trickleConfig._isEnabled === false) return false;

			var isOnPage = (this.getModelPageIndex(model) != -1);
			if (!isOnPage) return false;

			if (trickleConfig._onChildren) return false;

			return true;
		},

		getModelPageIndex: function(model) {
			var descendants = this._descendantsChildrenFirst.toJSON();
			var pageDescendantIds = _.pluck(descendants, "_id");

			var id = model.get("_id");
			var index = _.indexOf( pageDescendantIds, id );

			return index;
		},

		resizeBodyToCurrentIndex: function() {
			if (this._isFinished) return;

			this._stopListeningToResizeEvent = true;

			this.hideElements();

			var model = this.getCurrentStepModel();
			var id = model.get("_id");
			var $element = $("." + id);

			if ($element.length === 0) {
				this._stopListeningToResizeEvent = false
				return;
			}

			var elementOffset = $element.offset();
			var elementBottomOffset = elementOffset.top + $element.height();

			$('body').css("height", elementBottomOffset + "px");

			this._stopListeningToResizeEvent = false;
		},

		getCurrentStepModel: function() {
			if (this._isFinished) return;

			return this._descendantsChildrenFirst.models[this._currentStepIndex];
		},

		hideElements: function() {
			if (this._descendantsParentFirst === undefined) return;

			var model = this.getCurrentStepModel();
			var ancestors = this._descendantsParentFirst.models;
			var ancestorIds = _.pluck(this._descendantsParentFirst.toJSON(), "_id");

			var showToId;
			if (model !== undefined) {
				showToId = model.get("_id");

				var modelStructureType = StructureType.fromString(model.get("_type"));
				var isLastType = (modelStructureType._level === StructureType.levels);

				if (!isLastType) {
					var currentAncestorIndex = _.indexOf(ancestorIds, showToId);
					var ancestorChildComponents = ancestors[currentAncestorIndex].findDescendants("components");

					showToId = ancestorChildComponents.models[ancestorChildComponents.models.length-1].get("_id");
				}

			} else {
				showToId = ancestors[ancestors.length -1].get("_id");
			}
			
			
			var showToIndex = _.indexOf(ancestorIds, showToId);

			for (var i = 0, l = ancestors.length; i < l; i++) {
				var itemModel = ancestors[i];
				if (i <= showToIndex) {
					itemModel.set("_isVisible", true);
				} else {
					itemModel.set("_isVisible", false);
				}
			}

			console.log("Unlocking to:", showToId);
		},


		setupStep: function(model) {
			//ignore _isTrickleInteractiveComponents
			if (model.get("_isTrickleInteractiveComponent")) return;

			var trickleConfig = this.getModelTrickleConfig(model)
			if (!trickleConfig) return;

			if (trickleConfig._onChildren) return;

			this.setModelIsStepLockingState(model);

			Adapt.trigger("trickle:interactionInitialize", model);
		},

		setModelIsStepLockingState: function(model) {
			var trickleConfig = this.getModelTrickleConfig(model)
			var isStepLocking = this.isModelStepLocking(model);
			if (trickleConfig === undefined) return;
			if (trickleConfig._stepLocking === undefined) return;
			trickleConfig._isStepLocking = isStepLocking;
		},

		
		

		//completion reorder and processing
		_completionQueue: [],
		queueOrExecuteCompletion: function(model, value, isPerformCompletionQueue) {
			if (value === false) return;    

			if (isPerformCompletionQueue !== true) {
				//article, block and component completion trigger in a,b,c order need in c,b,a order
				//otherwise block completion events will occur before component completion events
				var modelStructureType = StructureType.fromString(model.get("_type"));
				var isLastType = (modelStructureType._level === StructureType.levels);

				if (!isLastType) {
					//defer completion event handling if not at component level
					return this._completionQueue.push({
						model: model,
						value: value    
					});
				} else {
					//if at component level, handle completion queue events after component completion is handled
					_.defer(_.bind(this.performCompletionQueue, this));
				}
			}

			Adapt.trigger("steplocking:waitCheck", model);
			this.checkStepComplete(model);
		},

		performCompletionQueue: function() {
			while (this._completionQueue.length > 0) {
				var item = this._completionQueue.pop();
				this.onAnyComplete(item.model, item.value, true);
			}
		},

		checkStepComplete: function(model) {
			if (this._isFinished) return;

			var currentModel = this.getCurrentStepModel();
			//check if the step is complete only if the model matches the current trickle item, or the completion came from a trickle interactive component
			if (model.get("_id") != currentModel.get("_id") && !model.get("_isTrickleInteractiveComponent")) return;
			
			//if trickle interactive component, swap for currentModel
			if (model.get("_isTrickleInteractiveComponent")) {
				model = currentModel;
			}

			var trickleConfig = this.getModelTrickleConfig(model);
			if (!trickleConfig) return;

			//set interaction complete
			trickleConfig._isLocking = false;
			trickleConfig._isInteractionComplete = true;
			
			//if plugins need to present before the interaction then break
			if (this.isStepUnlockWaiting()) return;
			
			//if completion is required and item is not yet complete then break
			if (trickleConfig._stepLocking._isCompletionRequired &&!model.get("_isInteractionComplete")) return;

			Adapt.trigger("trickle:interactionRequired", model);
			
			//if plugins need to present before the next step occurs then break
			if (this.isStepUnlockWaiting()) return;

			this.stepComplete(model);
		},

		stepComplete: function(model) {
			this.initializeStep();

			Adapt.trigger('device:resize');

			this.scrollToStep(model);
		},

		scrollToStep: function(model) {
			var trickleConfig = this.getModelTrickleConfig(model);
			if (trickleConfig._autoScroll === false) return;

			var scrollTo = trickleConfig._scrollTo;
			this.relativeScrollTo( model, scrollTo );
		},


		//steplocking wait interface
		initializeStepUnlockWait: function() {
			this._waitForUnlockRequestsCount = 0;
		},

		isStepUnlockWaiting: function() {
			return this._waitForUnlockRequestsCount > 0;
		},


		relativeScrollTo: function(model, scrollTo) {
			if (scrollTo === undefined) scrollTo = "@block +1";

			var scrollToId = "";
			switch (scrollTo.substr(0,1)) {
			case "@":
				//NAVIGATE BY RELATIVE TYPE
				var relativeModel = Models.findRelative(model, scrollTo);
				scrollToId = relativeModel.get("_id");

				break;
			case ".":
				//NAVIGATE BY CLASS
				scrollToId = scrollTo.substr(1, scrollTo.length-1);
				break;
			default: 
				scrollToId = scrollTo;
			}

			if (scrollToId == "") return;
			
			var duration = model.get("_trickle")._scrollDuration || 500;
			_.delay(function() {
				Adapt.scrollTo("." + scrollToId, { duration: duration });
			}, 250);
		}
		
	}, Backbone.Events);

	Trickle.initialize();

	return Trickle;

})
